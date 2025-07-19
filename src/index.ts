import * as cheerio from 'cheerio';
import type * as DOM from 'domhandler';
import { Base64 } from 'js-base64';
import makeFetch from 'node-fetch-cookie-native';
import { CookieJar } from 'tough-cookie';
import { sm2 } from 'sm-crypto';

import {
  type ApiError,
  type CalendarEvent,
  type CommentItem,
  ContentType,
  type ContentTypeMap,
  type CourseContent,
  type CourseInfo,
  CourseType,
  type CredentialProvider,
  type Discussion,
  type ExcellentHomework,
  FailReason,
  type FavoriteItem,
  type Fetch,
  type File,
  type FileCategory,
  type HelperConfig,
  type Homework,
  type HomeworkTA,
  type IDiscussionBase,
  type IExcellentHomework,
  type IHomework,
  type IHomeworkDetail,
  type IHomeworkStatus,
  type IHomeworkSubmitAttachment,
  type INotification,
  type INotificationDetail,
  Language,
  type Notification,
  type Question,
  type Questionnaire,
  type QuestionnaireDetail,
  QuestionnaireType,
  type RemoteFile,
  type SemesterInfo,
  type UserInfo,
} from './types';
import * as URLS from './urls';
import {
  CONTENT_TYPE_MAP_REVERSE,
  GRADE_LEVEL_MAP,
  JSONP_EXTRACTOR_NAME,
  QNR_TYPE_MAP,
  decodeHTML,
  extractJSONPResult,
  formatFileSize,
  parseSemesterType,
  trimAndDecode,
  trimAndDefine,
} from './utils';

const CHEERIO_CONFIG: cheerio.CheerioOptions = { xml: { decodeEntities: false } };

const $ = (html: string | DOM.Element | DOM.Element[]): cheerio.CheerioAPI => {
  return cheerio.load(html, CHEERIO_CONFIG);
};

const noLogin = (res: Response) => res.url.includes('login_timeout') || res.status === 403;

const YES = '是';

/** add CSRF token to any request URL as parameters */
export const addCSRFTokenToUrl = (url: string, token: string): string => {
  const newUrl = new URL(url);
  newUrl.searchParams.set('_csrf', token);
  return newUrl.toString();
};

/** the main helper class */
export class Learn2018Helper {
  readonly #provider?: CredentialProvider;
  readonly #cookieJar;
  readonly #rawFetch: Fetch;
  readonly #myFetch: Fetch;
  readonly #myFetchWithToken: Fetch = async (...args) => {
    if (this.#csrfToken === '') {
      await this.login();
    }
    const [url, ...remaining] = args;
    return this.#myFetch(addCSRFTokenToUrl(url as string, this.#csrfToken), ...remaining);
  };
  #csrfToken = '';
  #lang = Language.ZH;

  readonly #withReAuth = (rawFetch: Fetch): Fetch => {
    const login = this.login.bind(this);
    return async function wrappedFetch(...args) {
      const retryAfterLogin = async () => {
        await login();
        return await rawFetch(...args).then((res: Response) => {
          if (noLogin(res)) {
            return Promise.reject({
              reason: FailReason.NOT_LOGGED_IN,
            } as ApiError);
          } else if (res.status != 200) {
            return Promise.reject({
              reason: FailReason.UNEXPECTED_STATUS,
              extra: {
                code: res.status,
                text: res.statusText,
              },
            } as ApiError);
          } else {
            return res;
          }
        });
      };
      return await rawFetch(...args).then((res: Response) => (noLogin(res) ? retryAfterLogin() : res));
    };
  };

  public previewFirstPage: boolean;

  /** you can provide a CookieJar and / or CredentialProvider in the configuration */
  constructor(config?: HelperConfig) {
    this.previewFirstPage = config?.generatePreviewUrlForFirstPage ?? true;
    this.#provider = config?.provider;
    this.#cookieJar = config?.cookieJar ?? new CookieJar();
    this.#rawFetch = config?.fetch ?? makeFetch(this.#cookieJar);
    this.#myFetch = this.#provider
      ? this.#withReAuth(this.#rawFetch)
      : async (...args) => {
          const result = await this.#rawFetch(...args);
          if (noLogin(result))
            return Promise.reject({
              reason: FailReason.NOT_LOGGED_IN,
            } as ApiError);
          return result;
        };
  }

  /** fetch CSRF token from helper (invalid after login / re-login), might be '' if not logged in */
  public getCSRFToken(): string {
    return this.#csrfToken;
  }

  /** manually set CSRF token (useful when you want to reuse previous token) */
  public setCSRFToken(csrfToken: string): void {
    this.#csrfToken = csrfToken;
  }

  /**
   * If using alternative cookie management systems,
   * be sure to clear id.tsinghua.edu.cn cookies before calling this function
   */
  public async getRoamingTicket(
    username: string,
    password: string,
    fingerPrint: string,
    fingerGenPrint: string = '',
    fingerGenPrint3: string = '',
  ) {
    return new Promise<string>((resolve, reject) => {
      this.#cookieJar.removeAllCookies(async (err) => {
        if (err) {
          reject(err);
          return;
        }

        try {
          const loginForm = await this.#rawFetch(URLS.ID_LOGIN());
          const body = $(await loginForm.text());
          const sm2publicKey = body('#sm2publicKey').text().trim();

          const formData = new FormData();
          formData.append('i_user', username);
          formData.append('i_pass', '04' + sm2.doEncrypt(password, sm2publicKey));
          formData.append('singleLogin', 'on');
          formData.append('fingerPrint', fingerPrint);
          formData.append('fingerGenPrint', fingerGenPrint ?? '');
          formData.append('fingerGenPrint3', fingerGenPrint3 ?? '');
          formData.append('i_captcha', '');
          const checkResponse = await this.#rawFetch(URLS.ID_LOGIN_CHECK(), {
            method: 'POST',
            body: formData,
          });
          const anchor = $(await checkResponse.text())('a');
          const redirectUrl = anchor.attr('href') as string;
          const ticket = redirectUrl.split('=').slice(-1)[0];
          resolve(ticket);
        } catch (err) {
          reject({
            reason: FailReason.ERROR_FETCH_FROM_ID,
            extra: err,
          });
        }
      });
    });
  }

  /** login is necessary if you do not provide a `CredentialProvider` */
  public async login(
    username?: string,
    password?: string,
    fingerPrint?: string,
    fingerGenPrint?: string,
    fingerGenPrint3?: string,
  ): Promise<void> {
    if (!username || !password || !fingerPrint) {
      if (!this.#provider)
        return Promise.reject({
          reason: FailReason.NO_CREDENTIAL,
        } as ApiError);
      const credential = await this.#provider();
      username = credential.username;
      password = credential.password;
      fingerPrint = credential.fingerPrint;
      fingerGenPrint = credential.fingerGenPrint;
      fingerGenPrint3 = credential.fingerGenPrint3;
      if (!username || !password || !fingerPrint) {
        return Promise.reject({
          reason: FailReason.NO_CREDENTIAL,
        } as ApiError);
      }
    }
    // check response from id.tsinghua.edu.cn
    const ticket = await this.getRoamingTicket(username, password, fingerPrint, fingerGenPrint, fingerGenPrint3);
    if (ticket === 'BAD_CREDENTIALS') {
      return Promise.reject({
        reason: FailReason.BAD_CREDENTIAL,
      } as ApiError);
    }
    const loginResponse = await this.#rawFetch(URLS.LEARN_AUTH_ROAM(ticket));
    if (loginResponse.ok !== true) {
      return Promise.reject({
        reason: FailReason.ERROR_ROAMING,
      } as ApiError);
    }
    const courseListPageSource: string = await (await this.#rawFetch(URLS.LEARN_STUDENT_COURSE_LIST_PAGE())).text();
    const tokenRegex = /^.*&_csrf=(\S*)".*$/gm;
    const tokenMatches = [...courseListPageSource.matchAll(tokenRegex)];
    if (tokenMatches.length === 0) {
      return Promise.reject({
        reason: FailReason.INVALID_RESPONSE,
        extra: 'cannot fetch CSRF token from source',
      } as ApiError);
    }
    this.#csrfToken = tokenMatches[0][1];
    const langRegex = /<script src="\/f\/wlxt\/common\/languagejs\?lang=(zh|en)"><\/script>/g;
    const langMatches = [...courseListPageSource.matchAll(langRegex)];
    if (langMatches.length !== 0) this.#lang = langMatches[0][1] as Language;
  }

  /**  logout (to make everyone happy) */
  public async logout(): Promise<void> {
    await this.#rawFetch(URLS.LEARN_LOGOUT(), { method: 'POST' });
  }

  /** get user's name and department */
  public async getUserInfo(courseType = CourseType.STUDENT): Promise<UserInfo> {
    const content = await (await this.#myFetchWithToken(URLS.LEARN_HOMEPAGE(courseType))).text();

    const dom = $(content);
    const name = dom('a.user-log').text().trim();
    const department = dom('.fl.up-img-info p:nth-child(2) label').text().trim();

    return {
      name,
      department,
    };
  }

  /**
   * Get calendar items during the specified period (in yyyymmdd format).
   * @param startDate start date (inclusive)
   * @param endDate end date (inclusive)
   * If the API returns any error, this function will throw `FailReason.INVALID_RESPONSE`,
   * and we currently observe a limit of no more that 29 days.
   * Otherwise it will return the parsed data (might be empty if the period is too far away from now)
   */
  public async getCalendar(startDate: string, endDate: string, graduate = false): Promise<CalendarEvent[]> {
    const ticketResponse = await this.#myFetchWithToken(URLS.REGISTRAR_TICKET(), {
      method: 'POST',
      body: URLS.REGISTRAR_TICKET_FORM_DATA(),
    });

    let ticket = (await ticketResponse.text()) as string;
    ticket = ticket.substring(1, ticket.length - 1);

    await this.#myFetch(URLS.REGISTRAR_AUTH(ticket));

    const response = await this.#myFetchWithToken(
      URLS.REGISTRAR_CALENDAR(startDate, endDate, graduate, JSONP_EXTRACTOR_NAME),
    );

    if (!response.ok) {
      return Promise.reject({
        reason: FailReason.INVALID_RESPONSE,
      } as ApiError);
    }

    const result = extractJSONPResult(await response.text()) as any[];

    return result.map<CalendarEvent>((i) => ({
      location: i.dd,
      status: i.fl,
      startTime: i.kssj,
      endTime: i.jssj,
      date: i.nq,
      courseName: i.nr,
    }));
  }

  public async getSemesterIdList(): Promise<string[]> {
    const json = await (await this.#myFetchWithToken(URLS.LEARN_SEMESTER_LIST())).json();
    if (!Array.isArray(json)) {
      return Promise.reject({
        reason: FailReason.INVALID_RESPONSE,
        extra: json,
      } as ApiError);
    }
    const semesters = json as string[];
    // sometimes web learning returns null, so confusing...
    return semesters.filter((s) => s != null);
  }

  public async getCurrentSemester(): Promise<SemesterInfo> {
    const json = await (await this.#myFetchWithToken(URLS.LEARN_CURRENT_SEMESTER())).json();
    if (json.message !== 'success') {
      return Promise.reject({
        reason: FailReason.INVALID_RESPONSE,
        extra: json,
      } as ApiError);
    }
    const result = json.result;
    return {
      id: result.id,
      startDate: new Date(result.kssj),
      endDate: new Date(result.jssj),
      startYear: Number(result.xnxq.slice(0, 4)),
      endYear: Number(result.xnxq.slice(5, 9)),
      type: parseSemesterType(Number(result.xnxq.slice(10, 11))),
    };
  }

  /** get all courses in the specified semester */
  public async getCourseList(semesterID: string, courseType: CourseType = CourseType.STUDENT): Promise<CourseInfo[]> {
    const json = await (
      await this.#myFetchWithToken(URLS.LEARN_COURSE_LIST(semesterID, courseType, this.#lang))
    ).json();
    if (json.message !== 'success' || !Array.isArray(json.resultList)) {
      return Promise.reject({
        reason: FailReason.INVALID_RESPONSE,
        extra: json,
      } as ApiError);
    }
    const result = (json.resultList ?? []) as any[];

    return Promise.all(
      result.map(async (c) => {
        let timeAndLocation: string[] = [];
        try {
          // see https://github.com/Harry-Chen/Learn-Helper/issues/145
          timeAndLocation = await (await this.#myFetchWithToken(URLS.LEARN_COURSE_TIME_LOCATION(c.wlkcid))).json();
        } catch (e) {}
        return {
          id: c.wlkcid,
          name: decodeHTML(c.zywkcm),
          chineseName: decodeHTML(c.kcm),
          englishName: decodeHTML(c.ywkcm),
          timeAndLocation,
          url: URLS.LEARN_COURSE_PAGE(c.wlkcid, courseType),
          teacherName: c.jsm ?? '', // teacher can not fetch this
          teacherNumber: c.jsh,
          courseNumber: c.kch,
          courseIndex: Number(c.kxh), // c.kxh could be string (teacher mode) or number (student mode)
          courseType,
        } satisfies CourseInfo;
      }),
    );
  }

  /**
   * Get certain type of content of all specified courses.
   * It actually wraps around other `getXXX` functions. You can ignore the failure caused by certain courses.
   */
  public async getAllContents<T extends ContentType>(
    courseIDs: string[],
    type: T,
    courseType: CourseType = CourseType.STUDENT,
    allowFailure = false,
  ) {
    const fetchContentForCourse = <T extends ContentType>(type: T, id: string, courseType: CourseType) => {
      switch (type) {
        case ContentType.NOTIFICATION:
          return this.getNotificationList(id, courseType) as Promise<ContentTypeMap[T][]>;
        case ContentType.FILE:
          return this.getFileList(id, courseType) as Promise<ContentTypeMap[T][]>;
        case ContentType.HOMEWORK:
          return this.getHomeworkList(id) as Promise<ContentTypeMap[T][]>;
        case ContentType.DISCUSSION:
          return this.getDiscussionList(id, courseType) as Promise<ContentTypeMap[T][]>;
        case ContentType.QUESTION:
          return this.getAnsweredQuestionList(id, courseType) as Promise<ContentTypeMap[T][]>;
        case ContentType.QUESTIONNAIRE:
          return this.getQuestionnaireList(id) as Promise<ContentTypeMap[T][]>;
        default:
          return Promise.reject({
            reason: FailReason.NOT_IMPLEMENTED,
            extra: 'Unknown content type',
          } as ApiError);
      }
    };

    const contents: CourseContent<T> = {};

    const results = await Promise.allSettled(
      courseIDs.map(async (id) => {
        contents[id] = await fetchContentForCourse(type, id, courseType);
      }),
    );

    if (!allowFailure) {
      for (const r of results) {
        if (r.status === 'rejected') {
          return Promise.reject({
            reason: FailReason.INVALID_RESPONSE,
            extra: {
              reason: r.reason,
            },
          } as ApiError);
        }
      }
    }

    return contents;
  }

  /** Get all notifications （课程公告） of the specified course. */
  public async getNotificationList(
    courseID: string,
    courseType: CourseType = CourseType.STUDENT,
  ): Promise<Notification[]> {
    return Promise.all([
      this.getNotificationListKind(courseID, courseType, false),
      this.getNotificationListKind(courseID, courseType, true),
    ]).then((r) => r.flat());
  }

  private async getNotificationListKind(
    courseID: string,
    courseType: CourseType,
    expired: boolean,
  ): Promise<Notification[]> {
    const json = await (
      await this.#myFetchWithToken(URLS.LEARN_NOTIFICATION_LIST(courseType, expired), {
        method: 'POST',
        body: URLS.LEARN_PAGE_LIST_FORM_DATA(courseID),
      })
    ).json();
    if (json.result !== 'success') {
      return Promise.reject({
        reason: FailReason.INVALID_RESPONSE,
        extra: json,
      } as ApiError);
    }

    const result = (json.object?.aaData ?? json.object?.resultsList ?? []) as any[];

    return Promise.all(
      result.map(async (n) => {
        const notification: INotification = {
          id: n.ggid,
          content: decodeHTML(Base64.decode(n.ggnr ?? '')),
          title: decodeHTML(n.bt),
          url: URLS.LEARN_NOTIFICATION_DETAIL(courseID, n.ggid, courseType),
          publisher: n.fbrxm,
          hasRead: n.sfyd === YES,
          markedImportant: Number(n.sfqd) === 1, // n.sfqd could be string '1' (teacher mode) or number 1 (student mode)
          publishTime: new Date(n.fbsj && typeof n.fbsj === 'string' ? n.fbsj : n.fbsjStr),
          expireTime: n.jzsj ? new Date(n.jzsj) : undefined,
          isFavorite: n.sfsc === YES,
          comment: n.bznr ?? undefined,
        };
        let detail: INotificationDetail = {};
        const attachmentName = courseType === CourseType.STUDENT ? n.fjmc : n.fjbt;
        if (attachmentName) {
          detail = await this.parseNotificationDetail(courseID, notification.id, courseType, attachmentName);
        }
        return { ...notification, ...detail } satisfies Notification;
      }),
    );
  }

  /** Get all files （课程文件） of the specified course. */
  public async getFileList(courseID: string, courseType: CourseType = CourseType.STUDENT): Promise<File[]> {
    const json = await (await this.#myFetchWithToken(URLS.LEARN_FILE_LIST(courseID, courseType))).json();
    if (json.result !== 'success') {
      return Promise.reject({
        reason: FailReason.INVALID_RESPONSE,
        extra: json,
      } as ApiError);
    }

    let result: any[] = [];
    if (Array.isArray(json.object?.resultsList)) {
      // teacher
      result = json.object.resultsList;
    } else if (Array.isArray(json.object)) {
      // student
      result = json.object;
    }

    const categories = new Map((await this.getFileCategoryList(courseID, courseType)).map((c) => [c.id, c]));

    return result.map((f) => {
      const title = decodeHTML(f.bt);
      const fileId = f.wjid;
      const uploadTime = new Date(f.scsj);
      const downloadUrl = URLS.LEARN_FILE_DOWNLOAD(fileId, courseType);
      const previewUrl = URLS.LEARN_FILE_PREVIEW(ContentType.FILE, fileId, courseType, this.previewFirstPage);
      return {
        id: f.kjxxid,
        fileId,
        category: categories.get(f.kjflid),
        title,
        description: decodeHTML(f.ms),
        rawSize: f.wjdx,
        size: f.fileSize,
        uploadTime,
        publishTime: uploadTime,
        downloadUrl,
        previewUrl,
        isNew: f.isNew ?? false,
        markedImportant: f.sfqd === 1,
        visitCount: f.xsllcs ?? f.llcs ?? 0,
        downloadCount: f.xzcs ?? 0,
        fileType: f.wjlx,
        remoteFile: {
          id: fileId,
          name: title,
          downloadUrl,
          previewUrl,
          size: f.fileSize,
        },
      } satisfies File;
    });
  }

  /** Get file categories of the specified course. */
  public async getFileCategoryList(
    courseID: string,
    courseType: CourseType = CourseType.STUDENT,
  ): Promise<FileCategory[]> {
    const json = await (await this.#myFetchWithToken(URLS.LEARN_FILE_CATEGORY_LIST(courseID, courseType))).json();
    if (json.result !== 'success') {
      return Promise.reject({
        reason: FailReason.INVALID_RESPONSE,
        extra: json,
      } as ApiError);
    }

    const result = (json.object?.rows ?? []) as any[];

    return result.map(
      (c) =>
        ({
          id: c.kjflid,
          title: decodeHTML(c.bt),
          creationTime: new Date(c.czsj),
        }) satisfies FileCategory,
    );
  }

  /**
   * Get all files of the specified category of the specified course.
   * Note: this cannot get correct `visitCount` and `downloadCount` for student
   */
  public async getFileListByCategory(
    courseID: string,
    categoryId: string,
    courseType: CourseType = CourseType.STUDENT,
  ): Promise<File[]> {
    if (courseType === CourseType.STUDENT) {
      const json = await (
        await this.#myFetchWithToken(URLS.LEARN_FILE_LIST_BY_CATEGORY_STUDENT(courseID, categoryId))
      ).json();
      if (json.result !== 'success') {
        return Promise.reject({
          reason: FailReason.INVALID_RESPONSE,
          extra: json,
        } as ApiError);
      }

      const result = (json.object ?? []) as any[];

      return result.map((f) => {
        const fileId = f[7];
        const title = decodeHTML(f[1]);
        const rawSize = f[9];
        const size = formatFileSize(rawSize);
        const downloadUrl = URLS.LEARN_FILE_DOWNLOAD(fileId, courseType);
        const previewUrl = URLS.LEARN_FILE_PREVIEW(ContentType.FILE, fileId, courseType, this.previewFirstPage);
        return {
          id: f[0],
          fileId,
          title,
          description: decodeHTML(f[5]),
          rawSize,
          size,
          uploadTime: new Date(f[6]),
          publishTime: new Date(f[10]),
          downloadUrl,
          previewUrl,
          isNew: f[8] === 1,
          markedImportant: f[2] === 1,
          visitCount: 0,
          downloadCount: 0,
          fileType: f[13],
          remoteFile: {
            id: fileId,
            name: title,
            downloadUrl,
            previewUrl,
            size,
          },
          isFavorite: f[11],
          comment: f[14] ?? undefined,
        } satisfies File;
      });
    } else {
      const json = await (
        await this.#myFetchWithToken(URLS.LEARN_FILE_LIST_BY_CATEGORY_TEACHER, {
          method: 'POST',
          body: URLS.LEARN_FILE_LIST_BY_CATEGORY_TEACHER_FORM_DATA(courseID, categoryId),
        })
      ).json();
      if (json.result !== 'success') {
        return Promise.reject({
          reason: FailReason.INVALID_RESPONSE,
          extra: json,
        } as ApiError);
      }

      const result = (json.object.aaData ?? []) as any[];

      return result.map((f) => {
        const title = decodeHTML(f.bt);
        const fileId = f.wjid;
        const uploadTime = new Date(f.scsj);
        const downloadUrl = URLS.LEARN_FILE_DOWNLOAD(fileId, courseType);
        const previewUrl = URLS.LEARN_FILE_PREVIEW(ContentType.FILE, fileId, courseType, this.previewFirstPage);
        return {
          id: f.kjxxid,
          fileId,
          title,
          description: decodeHTML(f.ms),
          rawSize: f.wjdx,
          size: f.fileSize,
          uploadTime,
          publishTime: uploadTime,
          downloadUrl,
          previewUrl,
          isNew: f.isNew ?? false,
          markedImportant: f.sfqd === 1,
          visitCount: f.xsllcs ?? f.llcs ?? 0,
          downloadCount: f.xzcs ?? 0,
          fileType: f.wjlx,
          remoteFile: {
            id: fileId,
            name: title,
            downloadUrl,
            previewUrl,
            size: f.fileSize,
          },
        } satisfies File;
      });
    }
  }

  /** Get all homeworks （课程作业） of the specified course. */
  public async getHomeworkList(courseID: string): Promise<Homework[]>;
  public async getHomeworkList(courseID: string, courseType: CourseType.STUDENT): Promise<Homework[]>;
  public async getHomeworkList(courseID: string, courseType: CourseType.TEACHER): Promise<HomeworkTA[]>;
  public async getHomeworkList(
    courseID: string,
    courseType: CourseType = CourseType.STUDENT,
  ): Promise<Homework[] | HomeworkTA[]> {
    if (courseType === CourseType.TEACHER) {
      const json = await (
        await this.#myFetchWithToken(URLS.LEARN_HOMEWORK_LIST_TEACHER, {
          method: 'POST',
          body: URLS.LEARN_PAGE_LIST_FORM_DATA(courseID),
        })
      ).json();
      if (json.result !== 'success') {
        return Promise.reject({
          reason: FailReason.INVALID_RESPONSE,
          extra: json,
        } as ApiError);
      }

      const result = (json.object?.aaData ?? []) as any[];

      return result.map(
        (d) =>
          ({
            id: d.zyid,
            index: d.wz,
            title: decodeHTML(d.bt),
            description: decodeHTML(Base64.decode(d.nr)),
            publisherId: d.fbr,
            publishTime: new Date(d.fbsj),
            startTime: new Date(d.kssj),
            deadline: new Date(d.jzsj),
            lateSubmissionDeadline: d.bjjzsj ? new Date(d.bjjzsj) : undefined,
            url: URLS.LEARN_HOMEWORK_DETAIL_TEACHER(courseID, d.zyid),
            completionType: d.zywcfs,
            submissionType: d.zytjfs,
            gradedCount: d.ypys,
            submittedCount: d.yjs,
            unsubmittedCount: d.wjs,
          }) satisfies HomeworkTA,
      );
    } else {
      return Promise.all(
        URLS.LEARN_HOMEWORK_LIST_SOURCE.map((s) => this.getHomeworkListAtUrl(courseID, s.url, s.status)),
      ).then((r) => r.flat());
    }
  }

  /** Get all discussions （课程讨论） of the specified course. */
  public async getDiscussionList(courseID: string, courseType: CourseType = CourseType.STUDENT): Promise<Discussion[]> {
    const json = await (await this.#myFetchWithToken(URLS.LEARN_DISCUSSION_LIST(courseID, courseType))).json();
    if (json.result !== 'success') {
      return Promise.reject({
        reason: FailReason.INVALID_RESPONSE,
        extra: json,
      } as ApiError);
    }

    const result = (json.object?.resultsList ?? []) as any[];

    return result.map(
      (d) =>
        ({
          ...this.parseDiscussionBase(d),
          boardId: d.bqid,
          url: URLS.LEARN_DISCUSSION_DETAIL(d.wlkcid, d.bqid, d.id, courseType),
        }) satisfies Discussion,
    );
  }

  /**
   * Get all notifications （课程答疑） of the specified course.
   * The student version supports only answered questions, while the teacher version supports all questions.
   */
  public async getAnsweredQuestionList(
    courseID: string,
    courseType: CourseType = CourseType.STUDENT,
  ): Promise<Question[]> {
    const json = await (await this.#myFetchWithToken(URLS.LEARN_QUESTION_LIST_ANSWERED(courseID, courseType))).json();
    if (json.result !== 'success') {
      return Promise.reject({
        reason: FailReason.INVALID_RESPONSE,
        extra: json,
      } as ApiError);
    }

    const result = (json.object?.resultsList ?? []) as any[];

    return result.map(
      (q) =>
        ({
          ...this.parseDiscussionBase(q),
          question: Base64.decode(q.wtnr),
          url: URLS.LEARN_QUESTION_DETAIL(q.wlkcid, q.id, courseType),
        }) satisfies Question,
    );
  }

  /**
   * Get all questionnaires （课程问卷/QNR） of the specified course.
   */
  public async getQuestionnaireList(courseID: string): Promise<Questionnaire[]> {
    return Promise.all([
      this.getQuestionnaireListAtUrl(courseID, URLS.LEARN_QNR_LIST_ONGOING),
      this.getQuestionnaireListAtUrl(courseID, URLS.LEARN_QNR_LIST_ENDED),
    ]).then((r) => r.flat());
  }

  private async getQuestionnaireListAtUrl(courseID: string, url: string): Promise<Questionnaire[]> {
    const json = await (
      await this.#myFetchWithToken(url, { method: 'POST', body: URLS.LEARN_PAGE_LIST_FORM_DATA(courseID) })
    ).json();
    if (json.result !== 'success') {
      return Promise.reject({
        reason: FailReason.INVALID_RESPONSE,
        extra: json,
      } as ApiError);
    }
    const result = (json.object?.aaData ?? []) as any[];
    return Promise.all(
      result.map(async (e) => {
        const type = QNR_TYPE_MAP.get(e.wjlx) ?? QuestionnaireType.SURVEY;
        return {
          id: e.wjid,
          type,
          title: decodeHTML(e.wjbt),
          startTime: new Date(e.kssj),
          endTime: new Date(e.jssj),
          uploadTime: new Date(e.scsj),
          uploaderId: e.scr,
          uploaderName: e.scrxm,
          submitTime: e.tjsj ? new Date(e.tjsj) : undefined,
          isFavorite: e.sfsc === YES,
          comment: e.bznr ?? undefined,
          url: URLS.LEARN_QNR_SUBMIT_PAGE(e.wlkcid, e.wjid, type),
          detail: await this.getQuestionnaireDetail(courseID, e.wjid),
        } satisfies Questionnaire;
      }),
    );
  }

  private async getQuestionnaireDetail(courseID: string, qnrID: string): Promise<QuestionnaireDetail[]> {
    const json = await (
      await this.#myFetchWithToken(URLS.LEARN_QNR_DETAIL, {
        method: 'POST',
        body: URLS.LEARN_QNR_DETAIL_FORM(courseID, qnrID),
      })
    ).json();
    return (json as any[]).map(
      (e) =>
        ({
          id: e.wtid,
          index: Number(e.wtbh),
          type: e.type,
          required: e.require === YES,
          title: decodeHTML(e.wtbt),
          score: e.wtfz ? Number(e.wtfz) : undefined, // unsure about original type
          options: (e.list as any[])?.map((o) => ({
            id: o.xxid,
            index: Number(o.xxbh),
            title: decodeHTML(o.xxbt),
          })),
        }) satisfies QuestionnaireDetail,
    );
  }

  /**
   * Add an item to favorites. (收藏)
   */
  public async addToFavorites(type: ContentType, id: string): Promise<void> {
    const json = await (await this.#myFetchWithToken(URLS.LEARN_FAVORITE_ADD(type, id))).json();
    if (json.result !== 'success' || !json.msg?.endsWith?.('成功')) {
      return Promise.reject({
        reason: FailReason.OPERATION_FAILED,
        extra: json,
      } as ApiError);
    }
  }

  /**
   * Remove an item from favorites. (取消收藏)
   */
  public async removeFromFavorites(id: string): Promise<void> {
    const json = await (await this.#myFetchWithToken(URLS.LEARN_FAVORITE_REMOVE(id))).json();
    if (json.result !== 'success' || !json.msg?.endsWith?.('成功')) {
      return Promise.reject({
        reason: FailReason.OPERATION_FAILED,
        extra: json,
      } as ApiError);
    }
  }

  /**
   * Get favorites. (我的收藏)
   * If `courseID` or `type` is specified, only return favorites of that course or type.
   */
  public async getFavorites(courseID?: string, type?: ContentType): Promise<FavoriteItem[]> {
    const json = await (
      await this.#myFetchWithToken(URLS.LEARN_FAVORITE_LIST(type), {
        method: 'POST',
        body: URLS.LEARN_PAGE_LIST_FORM_DATA(courseID),
      })
    ).json();
    if (json.result !== 'success') {
      return Promise.reject({
        reason: FailReason.INVALID_RESPONSE,
        extra: json,
      } as ApiError);
    }
    const result = (json.object?.aaData ?? []) as any[];
    return result
      .map((e): FavoriteItem | undefined => {
        const type = CONTENT_TYPE_MAP_REVERSE.get(e.ywlx);
        if (!type) return; // ignore unknown type
        return {
          id: e.ywid,
          type,
          title: decodeHTML(e.ywbt),
          time: type === ContentType.DISCUSSION || type === ContentType.QUESTION ? new Date(e.tlsj) : new Date(e.ywsj),
          state: e.ywzt,
          extra: e.ywbz ?? undefined,
          semesterId: e.xnxq,
          courseId: e.wlkcid,
          pinned: e.sfzd === YES,
          pinnedTime: e.zdsj === null ? undefined : new Date(e.zdsj), // Note: this field is originally unix timestamp instead of string
          comment: e.bznr ?? undefined,
          addedTime: new Date(e.scsj),
          itemId: e.id,
        } satisfies FavoriteItem;
      })
      .filter((x) => !!x);
  }

  /**
   * Pin a favorite item. (置顶)
   */
  public async pinFavoriteItem(id: string): Promise<void> {
    const json = await (
      await this.#myFetchWithToken(URLS.LEARN_FAVORITE_PIN, {
        method: 'POST',
        body: URLS.LEARN_FAVORITE_PIN_UNPIN_FORM_DATA(id),
      })
    ).json();
    if (json.result !== 'success') {
      return Promise.reject({
        reason: FailReason.OPERATION_FAILED,
        extra: json,
      } as ApiError);
    }
  }

  /**
   * Unpin a favorite item. (取消置顶)
   */
  public async unpinFavoriteItem(id: string): Promise<void> {
    const json = await (
      await this.#myFetchWithToken(URLS.LEARN_FAVORITE_UNPIN, {
        method: 'POST',
        body: URLS.LEARN_FAVORITE_PIN_UNPIN_FORM_DATA(id),
      })
    ).json();
    if (json.result !== 'success') {
      return Promise.reject({
        reason: FailReason.OPERATION_FAILED,
        extra: json,
      } as ApiError);
    }
  }

  /**
   * Set a comment. (备注)
   * Set an empty string to remove the comment.
   */
  public async setComment(type: ContentType, id: string, content: string): Promise<void> {
    const json = await (
      await this.#myFetchWithToken(URLS.LEARN_COMMENT_SET, {
        method: 'POST',
        body: URLS.LEARN_COMMENT_SET_FORM_DATA(type, id, content),
      })
    ).json();
    if (json.result !== 'success' || !json.msg?.endsWith?.('成功')) {
      return Promise.reject({
        reason: FailReason.OPERATION_FAILED,
        extra: json,
      } as ApiError);
    }
  }

  /**
   * Get comments. (我的备注)
   * If `courseID` or `type` is specified, only return favorites of that course or type.
   */
  public async getComments(courseID?: string, type?: ContentType): Promise<CommentItem[]> {
    const json = await (
      await this.#myFetchWithToken(URLS.LEARN_COMMENT_LIST(type), {
        method: 'POST',
        body: URLS.LEARN_PAGE_LIST_FORM_DATA(courseID),
      })
    ).json();
    if (json.result !== 'success') {
      return Promise.reject({
        reason: FailReason.INVALID_RESPONSE,
        extra: json,
      } as ApiError);
    }
    const result = (json.object?.aaData ?? []) as any[];
    return result
      .map((e): CommentItem | undefined => {
        const type = CONTENT_TYPE_MAP_REVERSE.get(e.ywlx);
        if (!type) return; // ignore unknown type
        return {
          id: e.ywid,
          type,
          content: e.bt,
          contentHTML: decodeHTML(e.bznrstring),
          title: decodeHTML(e.ywbt),
          semesterId: e.xnxq,
          courseId: e.wlkcid,
          commentTime: new Date(e.cjsj),
          itemId: e.id,
        } satisfies CommentItem;
      })
      .filter((x) => !!x);
  }

  public async sortCourses(courseIDs: string[]): Promise<void> {
    const json = await (
      await this.#myFetchWithToken(URLS.LEARN_SORT_COURSES, {
        method: 'POST',
        body: JSON.stringify(courseIDs.map((id, index) => ({ wlkcid: id, xh: index + 1 }))),
        headers: {
          'Content-Type': 'application/json',
        },
      })
    ).json();
    if (json.result !== 'success') {
      return Promise.reject({
        reason: FailReason.OPERATION_FAILED,
        extra: json,
      } as ApiError);
    }
  }

  private async getHomeworkListAtUrl(courseID: string, url: string, status: IHomeworkStatus): Promise<Homework[]> {
    const json = await (
      await this.#myFetchWithToken(url, {
        method: 'POST',
        body: URLS.LEARN_PAGE_LIST_FORM_DATA(courseID),
      })
    ).json();
    if (json.result !== 'success') {
      return Promise.reject({
        reason: FailReason.INVALID_RESPONSE,
        extra: json,
      } as ApiError);
    }

    const result = (json.object?.aaData ?? []) as any[];

    let excellentHomeworkListByHomework: { [id: string]: ExcellentHomework[] } = {};
    try {
      excellentHomeworkListByHomework = await this.getExcellentHomeworkListByHomework(courseID);
    } catch (e) {
      // Don't block the whole process if excellent homework list cannot be fetched
    }

    return Promise.all(
      result
        .map(
          (h) =>
            ({
              id: h.xszyid,
              studentHomeworkId: h.xszyid,
              baseId: h.zyid,
              title: decodeHTML(h.bt),
              url: URLS.LEARN_HOMEWORK_DETAIL(h.wlkcid, h.xszyid),
              deadline: new Date(h.jzsj),
              lateSubmissionDeadline: h.bjjzsj ? new Date(h.bjjzsj) : undefined,
              isLateSubmission: h.sfbj === YES,
              completionType: h.zywcfs,
              submissionType: h.zytjfs,
              submitUrl: URLS.LEARN_HOMEWORK_SUBMIT_PAGE(h.wlkcid, h.xszyid),
              submitTime: h.scsj === null ? undefined : new Date(h.scsj),
              grade: h.cj === null ? undefined : h.cj,
              gradeLevel: GRADE_LEVEL_MAP.get(h.cj),
              graderName: trimAndDecode(h.jsm),
              gradeContent: trimAndDecode(h.pynr),
              gradeTime: h.pysj === null ? undefined : new Date(h.pysj),
              isFavorite: h.sfsc === YES,
              favoriteTime: h.scsj === null || h.sfsc !== YES ? undefined : new Date(h.scsj),
              comment: h.bznr ?? undefined,
              excellentHomeworkList: excellentHomeworkListByHomework[h.zyid],
              ...status,
            }) satisfies IHomework,
        )
        .map(
          async (h) =>
            ({
              ...h,
              ...(await this.parseHomeworkAtUrl(h.url)),
            }) satisfies Homework,
        ),
    );
  }

  private async getExcellentHomeworkListByHomework(courseID: string): Promise<{ [id: string]: ExcellentHomework[] }> {
    const json = await (
      await this.#myFetchWithToken(URLS.LEARN_HOMEWORK_LIST_EXCELLENT, {
        method: 'POST',
        body: URLS.LEARN_PAGE_LIST_FORM_DATA(courseID),
      })
    ).json();
    if (json.result !== 'success') {
      return Promise.reject({
        reason: FailReason.INVALID_RESPONSE,
        extra: json,
      } as ApiError);
    }

    const result = (json.object?.aaData ?? []) as any[];

    return (
      await Promise.all(
        result
          .map(
            (h) =>
              ({
                id: h.xszyid,
                baseId: h.zyid,
                title: decodeHTML(h.bt),
                url: URLS.LEARN_HOMEWORK_DETAIL_EXCELLENT(h.wlkcid, h.xszyid),
                completionType: h.zywcfs,
                author: {
                  id: h.cy?.split(' ')?.[0],
                  name: h.cy?.split(' ')?.[1],
                  anonymous: h.sfzm === YES,
                },
              }) satisfies IExcellentHomework,
          )
          .map(
            async (h) =>
              ({
                ...h,
                ...(await this.parseHomeworkAtUrl(h.url)),
              }) satisfies ExcellentHomework,
          ),
      )
    ).reduce<{ [id: string]: ExcellentHomework[] }>((acc, cur) => {
      if (!acc[cur.baseId]) {
        acc[cur.baseId] = [];
      }
      acc[cur.baseId].push(cur);
      return acc;
    }, {});
  }

  private async parseNotificationDetail(
    courseID: string,
    id: string,
    courseType: CourseType,
    attachmentName: string,
  ): Promise<INotificationDetail> {
    /// from JSON (backup, currently not used)
    // const postParams = new FormData();
    // postParams.append('id', id);
    // postParams.append('wlkcid', courseID);
    // const metadata = await (await this.#myFetchWithToken(URL.LEARN_NOTIFICATION_EDIT(courseType), {
    //   'method': 'POST',
    //   'body': postParams,
    // })).json();
    // const attachmentId = metadata.ggfjid as string;
    /// parsed from HTML
    const response = await this.#myFetchWithToken(URLS.LEARN_NOTIFICATION_DETAIL(courseID, id, courseType));
    const result = $(await response.text());
    let path = '';
    if (courseType === CourseType.STUDENT) {
      path = result('.ml-10').attr('href')!;
    } else {
      path = result('#wjid').attr('href')!;
    }
    const size = trimAndDecode(result('div#attachment > div.fl > span[class^="color"]').first().text())!;
    const params = new URLSearchParams(path.split('?').slice(-1)[0]);
    const attachmentId = params.get('wjid')!;
    if (!path.startsWith(URLS.LEARN_PREFIX)) {
      path = URLS.LEARN_PREFIX + path;
    }
    return {
      attachment: {
        name: attachmentName,
        id: attachmentId,
        downloadUrl: path,
        previewUrl: URLS.LEARN_FILE_PREVIEW(ContentType.NOTIFICATION, attachmentId, courseType, this.previewFirstPage),
        size,
      },
    };
  }

  private async parseHomeworkAtUrl(url: string): Promise<IHomeworkDetail> {
    const response = await this.#myFetchWithToken(url);
    const result = $(await response.text());

    const fileDivs = result('div.list.fujian.clearfix');

    return {
      description: trimAndDefine(result('div.list.calendar.clearfix > div.fl.right > div.c55').slice(0, 1).html()),
      answerContent: trimAndDefine(result('div.list.calendar.clearfix > div.fl.right > div.c55').slice(1, 2).html()),
      submittedContent: trimAndDefine($(result('div.boxbox').slice(1, 2).toArray())('div.right').slice(2, 3).html()),
      attachment: this.parseHomeworkFile(fileDivs[0]),
      answerAttachment: this.parseHomeworkFile(fileDivs[1]),
      submittedAttachment: this.parseHomeworkFile(fileDivs[2]),
      gradeAttachment: this.parseHomeworkFile(fileDivs[3]),
    };
  }

  private parseHomeworkFile(fileDiv: DOM.Element): RemoteFile | undefined {
    const fileNode = ($(fileDiv)('.ftitle').children('a')[0] ?? $(fileDiv)('.fl').children('a')[0]) as DOM.Element;
    if (fileNode !== undefined) {
      const size = trimAndDecode($(fileDiv)('.fl > span[class^="color"]').first().text())!;
      const params = new URLSearchParams(fileNode.attribs.href.split('?').slice(-1)[0]);
      const attachmentId = params.get('fileId')!;
      // so dirty here...
      let downloadUrl = URLS.LEARN_PREFIX + fileNode.attribs.href;
      if (params.has('downloadUrl')) {
        downloadUrl = URLS.LEARN_PREFIX + params.get('downloadUrl')!;
      }
      return {
        id: attachmentId,
        name: (fileNode.children[0] as DOM.Text).data!,
        downloadUrl,
        previewUrl: URLS.LEARN_FILE_PREVIEW(
          ContentType.HOMEWORK,
          attachmentId,
          CourseType.STUDENT,
          this.previewFirstPage,
        ),
        size,
      };
    } else {
      return undefined;
    }
  }

  private parseDiscussionBase(d: any): IDiscussionBase {
    return {
      id: d.id,
      title: decodeHTML(d.bt),
      publisherName: d.fbrxm,
      publishTime: new Date(d.fbsj),
      lastReplyTime: new Date(d.zhhfsj),
      lastReplierName: d.zhhfrxm,
      visitCount: d.djs ?? 0, // teacher cannot fetch this
      replyCount: d.hfcs,
      isFavorite: d.sfsc === YES,
      comment: d.bznr ?? undefined,
    };
  }

  public async submitHomework(
    id: string,
    content = '',
    attachment?: IHomeworkSubmitAttachment,
    removeAttachment = false,
  ) {
    const json = await (
      await this.#myFetchWithToken(URLS.LEARN_HOMEWORK_SUBMIT(), {
        method: 'POST',
        body: URLS.LEARN_HOMEWORK_SUBMIT_FORM_DATA(id, content, attachment, removeAttachment),
      })
    ).json();
    if (json.result !== 'success') {
      return Promise.reject({
        reason: FailReason.OPERATION_FAILED,
        extra: json,
      } as ApiError);
    }
  }

  public async setLanguage(lang: Language): Promise<void> {
    await this.#myFetchWithToken(URLS.LEARN_WEBSITE_LANGUAGE(lang), {
      method: 'POST',
    });
    this.#lang = lang;
  }

  public getCurrentLanguage(): Language {
    return this.#lang;
  }
}

export * from './types';
