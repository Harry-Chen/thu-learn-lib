import * as cheerio from 'cheerio';
import type * as DOM from 'domhandler';
import { Base64 } from 'js-base64';
import makeFetch from 'node-fetch-cookie-native';

import {
  ApiError,
  CalendarEvent,
  ContentType,
  ContentTypeMap,
  CourseContent,
  CourseInfo,
  CourseType,
  CredentialProvider,
  Discussion,
  FailReason,
  FavoriteItem,
  Fetch,
  File,
  FileCategory,
  HelperConfig,
  Homework,
  HomeworkTA,
  IDiscussionBase,
  IHomeworkDetail,
  IHomeworkStatus,
  IHomeworkSubmitAttachment,
  IHomeworkSubmitResult,
  INotification,
  INotificationDetail,
  Language,
  Notification,
  Question,
  RemoteFile,
  SemesterInfo,
  UserInfo,
} from './types';
import * as URLS from './urls';
import {
  FAVORITE_TYPE_MAP_REVERSE,
  GRADE_LEVEL_MAP,
  JSONP_EXTRACTOR_NAME,
  decodeHTML,
  extractJSONPResult,
  formatFileSize,
  parseSemesterType,
  trimAndDefine,
} from './utils';

const CHEERIO_CONFIG: cheerio.CheerioOptions = {
  // _useHtmlParser2
  xml: true,
  decodeEntities: false,
};

const $ = (html: string | DOM.Element | DOM.Element[]): cheerio.CheerioAPI => {
  return cheerio.load(html, CHEERIO_CONFIG);
};

const noLogin = (res: Response) => res.url.includes('login_timeout') || res.status == 403;

/** add CSRF token to any request URL as parameters */
export const addCSRFTokenToUrl = (url: string, token: string): string => {
  const newUrl = new URL(url);
  newUrl.searchParams.set('_csrf', token);
  return newUrl.toString();
};

/** the main helper class */
export class Learn2018Helper {
  readonly #provider?: CredentialProvider;
  readonly #rawFetch: Fetch;
  readonly #myFetch: Fetch;
  readonly #myFetchWithToken: Fetch = async (...args) => {
    if (this.#csrfToken == '') {
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
    this.#rawFetch = config?.fetch ?? makeFetch(config?.cookieJar);
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

  /** login is necessary if you do not provide a `CredentialProvider` */
  public async login(username?: string, password?: string): Promise<void> {
    if (!username || !password) {
      if (!this.#provider)
        return Promise.reject({
          reason: FailReason.NO_CREDENTIAL,
        } as ApiError);
      const credential = await this.#provider();
      username = credential.username;
      password = credential.password;
      if (!username || !password) {
        return Promise.reject({
          reason: FailReason.NO_CREDENTIAL,
        } as ApiError);
      }
    }
    const ticketResponse = await this.#rawFetch(URLS.ID_LOGIN(), {
      body: URLS.ID_LOGIN_FORM_DATA(username, password),
      method: 'POST',
    });
    if (!ticketResponse.ok) {
      return Promise.reject({
        reason: FailReason.ERROR_FETCH_FROM_ID,
      } as ApiError);
    }
    // check response from id.tsinghua.edu.cn
    const ticketResult = await ticketResponse.text();
    const body = $(ticketResult);
    const targetURL = body('a').attr('href') as string;
    const ticket = targetURL.split('=').slice(-1)[0];
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
    if (tokenMatches.length == 0) {
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
    const courses: CourseInfo[] = [];

    await Promise.all(
      result.map(async (c) => {
        let timeAndLocation: string[] = [];
        try {
          // see https://github.com/Harry-Chen/Learn-Helper/issues/145
          timeAndLocation = await (await this.#myFetchWithToken(URLS.LEARN_COURSE_TIME_LOCATION(c.wlkcid))).json();
        } catch (e) {
          /** ignore */
        }
        courses.push({
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
        });
      }),
    );

    return courses;
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
        if (r.status == 'rejected') {
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
    const json = await (await this.#myFetchWithToken(URLS.LEARN_NOTIFICATION_LIST(courseID, courseType))).json();
    if (json.result !== 'success') {
      return Promise.reject({
        reason: FailReason.INVALID_RESPONSE,
        extra: json,
      } as ApiError);
    }

    const result = (json.object?.aaData ?? json.object?.resultsList ?? []) as any[];
    const notifications: Notification[] = [];

    await Promise.all(
      result.map(async (n) => {
        const notification: INotification = {
          id: n.ggid,
          content: decodeHTML(Base64.decode(n.ggnr ?? '')),
          title: decodeHTML(n.bt),
          url: URLS.LEARN_NOTIFICATION_DETAIL(courseID, n.ggid, courseType),
          publisher: n.fbrxm,
          hasRead: n.sfyd === '是',
          markedImportant: Number(n.sfqd) === 1, // n.sfqd could be string '1' (teacher mode) or number 1 (student mode)
          publishTime: new Date(n.fbsj && typeof n.fbsj === 'string' ? n.fbsj : n.fbsjStr),
        };
        let detail: INotificationDetail = {};
        const attachmentName = courseType === CourseType.STUDENT ? n.fjmc : n.fjbt;
        if (attachmentName) {
          detail = await this.parseNotificationDetail(courseID, notification.id, courseType, attachmentName);
        }
        notifications.push({ ...notification, ...detail });
      }),
    );

    return notifications;
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
      const json = await (await this.#myFetchWithToken(URLS.LEARN_HOMEWORK_LIST_TEACHER(courseID))).json();
      if (json.result !== 'success') {
        return Promise.reject({
          reason: FailReason.INVALID_RESPONSE,
          extra: json,
        } as ApiError);
      }

      const result = (json.object?.aaData ?? []) as any[];
      const homeworks: HomeworkTA[] = [];

      await Promise.all(
        result.map(async (d) => {
          homeworks.push({
            id: d.zyid,
            index: d.wz,
            title: decodeHTML(d.bt),
            description: decodeHTML(Base64.decode(d.nr)),
            publisherId: d.fbr,
            publishTime: new Date(d.fbsj),
            startTime: new Date(d.kssj),
            deadline: new Date(d.jzsj),
            url: URLS.LEARN_HOMEWORK_DETAIL_TEACHER(courseID, d.zyid),
            completionType: d.zywcfs,
            submissionType: d.zytjfs,
            gradedCount: d.ypys,
            submittedCount: d.yjs,
            unsubmittedCount: d.wjs,
          });
        }),
      );

      return homeworks;
    } else {
      const allHomework: Homework[] = [];

      await Promise.all(
        URLS.LEARN_HOMEWORK_LIST_SOURCE(courseID).map(async (s) => {
          const homeworks = await this.getHomeworkListAtUrl(s.url, s.status);
          allHomework.push(...homeworks);
        }),
      );

      return allHomework;
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
    const discussions: Discussion[] = [];

    await Promise.all(
      result.map(async (d) => {
        discussions.push({
          ...this.parseDiscussionBase(d),
          boardId: d.bqid,
          url: URLS.LEARN_DISCUSSION_DETAIL(d.wlkcid, d.bqid, d.id, courseType),
        });
      }),
    );

    return discussions;
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
    const questions: Question[] = [];

    await Promise.all(
      result.map(async (q) => {
        questions.push({
          ...this.parseDiscussionBase(q),
          question: Base64.decode(q.wtnr),
          url: URLS.LEARN_QUESTION_DETAIL(q.wlkcid, q.id, courseType),
        });
      }),
    );

    return questions;
  }

  /**
   * Add an item to favorites. (收藏)
   */
  public async addToFavorites(type: ContentType, id: string): Promise<void> {
    const json = await (await this.#myFetchWithToken(URLS.LEARN_FAVORITE_ADD(type, id))).json();
    if (json.result !== 'success') {
      return Promise.reject({
        reason: FailReason.INVALID_RESPONSE,
        extra: json,
      } as ApiError);
    }
  }

  /**
   * Remove an item from favorites. (取消收藏)
   */
  public async removeFromFavorites(id: string): Promise<void> {
    const json = await (await this.#myFetchWithToken(URLS.LEARN_FAVORITE_REMOVE(id))).json();
    if (json.result !== 'success') {
      return Promise.reject({
        reason: FailReason.INVALID_RESPONSE,
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
        body: URLS.LEARN_FAVORITE_LIST_FORM_DATA(courseID),
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
        const type = FAVORITE_TYPE_MAP_REVERSE.get(e.ywlx);
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
          pinned: e.sfzd === '是',
          pinnedTime: e.zdsj === null ? undefined : new Date(e.zdsj), // Note: this field is originally unix timestamp instead of string
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
        reason: FailReason.INVALID_RESPONSE,
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
        reason: FailReason.INVALID_RESPONSE,
        extra: json,
      } as ApiError);
    }
  }

  private async getHomeworkListAtUrl(url: string, status: IHomeworkStatus): Promise<Homework[]> {
    const json = await (await this.#myFetchWithToken(url)).json();
    if (json.result !== 'success') {
      return Promise.reject({
        reason: FailReason.INVALID_RESPONSE,
        extra: json,
      } as ApiError);
    }

    const result = (json.object?.aaData ?? []) as any[];
    const homeworks: Homework[] = [];

    await Promise.all(
      result.map(async (h) => {
        homeworks.push({
          id: h.xszyid,
          studentHomeworkId: h.xszyid,
          baseId: h.zyid,
          title: decodeHTML(h.bt),
          url: URLS.LEARN_HOMEWORK_DETAIL(h.wlkcid, h.xszyid),
          deadline: new Date(h.jzsj),
          submitUrl: URLS.LEARN_HOMEWORK_SUBMIT_PAGE(h.wlkcid, h.xszyid),
          submitTime: h.scsj === null ? undefined : new Date(h.scsj),
          grade: h.cj === null ? undefined : h.cj,
          gradeLevel: GRADE_LEVEL_MAP.get(h.cj),
          graderName: trimAndDefine(h.jsm),
          gradeContent: trimAndDefine(h.pynr),
          gradeTime: h.pysj === null ? undefined : new Date(h.pysj),
          ...status,
          ...(await this.parseHomeworkDetail(h.wlkcid, h.xszyid)),
        });
      }),
    );

    return homeworks;
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
    const size = trimAndDefine(result('div#attachment > div.fl > span[class^="color"]').first().text())!;
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

  private async parseHomeworkDetail(courseID: string, id: string): Promise<IHomeworkDetail> {
    const response = await this.#myFetchWithToken(URLS.LEARN_HOMEWORK_DETAIL(courseID, id));
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
      const size = trimAndDefine($(fileDiv)('.fl > span[class^="color"]').first().text())!;
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
    };
  }

  public async submitHomework(
    id: string,
    content = '',
    attachment?: IHomeworkSubmitAttachment,
    removeAttachment = false,
  ): Promise<IHomeworkSubmitResult> {
    return await (
      await this.#myFetchWithToken(URLS.LEARN_HOMEWORK_SUBMIT(), {
        method: 'POST',
        body: URLS.LEARN_HOMEWORK_SUBMIT_FORM_DATA(id, content, attachment, removeAttachment),
      })
    ).json();
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
