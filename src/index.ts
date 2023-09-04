/* eslint-disable @typescript-eslint/no-explicit-any */
import * as cheerio from 'cheerio';
import type * as DOM from 'domhandler';
import { Base64 } from 'js-base64';
import { fetch } from 'node-fetch-native';
import fetchCookie from 'fetch-cookie';

import * as URL from './urls';
import {
  CredentialProvider,
  Fetch,
  HelperConfig,
  Content,
  ContentType,
  CourseContent,
  CourseInfo,
  Discussion,
  FailReason,
  File,
  Homework,
  IDiscussionBase,
  IHomeworkDetail,
  IHomeworkStatus,
  INotification,
  INotificationDetail,
  Notification,
  Question,
  SemesterInfo,
  CourseType,
  CalendarEvent,
  ApiError,
  RemoteFile,
  IHomeworkSubmitAttachment,
  IHomeworkSubmitResult,
  Language,
  HomeworkTA,
} from './types';
import {
  decodeHTML,
  mapGradeToLevel,
  parseSemesterType,
  trimAndDefine,
  JSONP_EXTRACTOR_NAME,
  extractJSONPResult,
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
  if (url.includes('?')) {
    url += `&_csrf=${token}`;
  } else {
    url += `?_csrf=${token}`;
  }
  return url;
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
    this.#rawFetch =
      config?.fetch ??
      (typeof window !== 'undefined'
        ? (input, init) => fetch(input, { ...init, credentials: 'include' })
        : fetchCookie(fetch, config?.cookieJar));
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
    }
    const ticketResponse = await this.#rawFetch(URL.ID_LOGIN(), {
      body: URL.ID_LOGIN_FORM_DATA(username, password),
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
    const loginResponse = await this.#rawFetch(URL.LEARN_AUTH_ROAM(ticket));
    if (loginResponse.ok !== true) {
      return Promise.reject({
        reason: FailReason.ERROR_ROAMING,
      } as ApiError);
    }
    const courseListPageSource: string = await (await this.#rawFetch(URL.LEARN_STUDENT_COURSE_LIST_PAGE())).text();
    const tokenRegex = /^.*&_csrf=(\S*)".*$/gm;
    const tokenMatches = [...courseListPageSource.matchAll(tokenRegex)];
    if (tokenMatches.length == 0) {
      return Promise.reject({
        reason: FailReason.INVALID_RESPONSE,
        extra: 'cannot fetch CSRF token from source',
      } as ApiError);
    }
    this.#csrfToken = tokenMatches[0][1];
    const langRegex = /<script src="\/f\/wlxt\/common\/languagejs\?lang=(\S*?)&v=(\d*?)"><\/script>/g;
    const langMatches = [...courseListPageSource.matchAll(langRegex)];
    if (langMatches.length !== 0) this.#lang = langMatches[0][1] as Language;
  }

  /**  logout (to make everyone happy) */
  public async logout(): Promise<void> {
    await this.#rawFetch(URL.LEARN_LOGOUT(), { method: 'POST' });
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
    const ticketResponse = await this.#myFetchWithToken(URL.REGISTRAR_TICKET(), {
      method: 'POST',
      body: URL.REGISTRAR_TICKET_FORM_DATA(),
    });

    let ticket = (await ticketResponse.text()) as string;
    ticket = ticket.substring(1, ticket.length - 1);

    await this.#myFetch(URL.REGISTRAR_AUTH(ticket));

    const response = await this.#myFetch(URL.REGISTRAR_CALENDAR(startDate, endDate, graduate, JSONP_EXTRACTOR_NAME));

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
    const json = await (await this.#myFetchWithToken(URL.LEARN_SEMESTER_LIST())).json();
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
    const json = await (await this.#myFetchWithToken(URL.LEARN_CURRENT_SEMESTER())).json();
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
    const json = await (await this.#myFetchWithToken(URL.LEARN_COURSE_LIST(semesterID, courseType, this.#lang))).json();
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
        courses.push({
          id: c.wlkcid,
          name: c.zywkcm,
          chineseName: c.kcm,
          englishName: c.ywkcm,
          timeAndLocation: await (await this.#myFetchWithToken(URL.LEARN_COURSE_TIME_LOCATION(c.wlkcid))).json(),
          url: URL.LEARN_COURSE_PAGE(c.wlkcid, courseType),
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
  public async getAllContents(
    courseIDs: string[],
    type: ContentType,
    courseType: CourseType = CourseType.STUDENT,
    allowFailure = false,
  ): Promise<CourseContent> {
    let fetchFunc: (courseID: string, courseType: CourseType) => Promise<Content[]>;
    switch (type) {
      case ContentType.NOTIFICATION:
        fetchFunc = this.getNotificationList;
        break;
      case ContentType.FILE:
        fetchFunc = this.getFileList;
        break;
      case ContentType.HOMEWORK:
        fetchFunc = this.getHomeworkList;
        break;
      case ContentType.DISCUSSION:
        fetchFunc = this.getDiscussionList;
        break;
      case ContentType.QUESTION:
        fetchFunc = this.getAnsweredQuestionList;
        break;
    }

    const contents: CourseContent = {};

    const results = await Promise.allSettled(
      courseIDs.map(async (id) => {
        contents[id] = await fetchFunc.bind(this)(id, courseType);
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
    const json = await (await this.#myFetchWithToken(URL.LEARN_NOTIFICATION_LIST(courseID, courseType))).json();
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
          url: URL.LEARN_NOTIFICATION_DETAIL(courseID, n.ggid, courseType),
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
    const json = await (await this.#myFetchWithToken(URL.LEARN_FILE_LIST(courseID, courseType))).json();
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
    const files: File[] = [];

    await Promise.all(
      result.map(async (f) => {
        const title = decodeHTML(f.bt);
        const downloadUrl = URL.LEARN_FILE_DOWNLOAD(
          courseType === CourseType.STUDENT ? f.wjid : f.id,
          courseType,
          courseID,
        );
        const previewUrl = URL.LEARN_FILE_PREVIEW(ContentType.FILE, f.wjid, courseType, this.previewFirstPage);
        files.push({
          id: f.wjid,
          title: decodeHTML(f.bt),
          description: decodeHTML(f.ms),
          rawSize: f.wjdx,
          size: f.fileSize,
          uploadTime: new Date(f.scsj),
          downloadUrl,
          previewUrl,
          isNew: f.isNew,
          markedImportant: f.sfqd === 1,
          visitCount: f.llcs ?? 0,
          downloadCount: f.xzcs ?? 0,
          fileType: f.wjlx,
          remoteFile: {
            id: f.wjid,
            name: title,
            downloadUrl,
            previewUrl,
            size: f.fileSize,
          },
        });
      }),
    );

    return files;
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
      const json = await (await this.#myFetchWithToken(URL.LEARN_HOMEWORK_LIST_TEACHER(courseID))).json();
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
            url: URL.LEARN_HOMEWORK_DETAIL_TEACHER(courseID, d.zyid),
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
        URL.LEARN_HOMEWORK_LIST_SOURCE(courseID).map(async (s) => {
          const homeworks = await this.getHomeworkListAtUrl(s.url, s.status);
          allHomework.push(...homeworks);
        }),
      );

      return allHomework;
    }
  }

  /** Get all discussions （课程讨论） of the specified course. */
  public async getDiscussionList(courseID: string, courseType: CourseType = CourseType.STUDENT): Promise<Discussion[]> {
    const json = await (await this.#myFetchWithToken(URL.LEARN_DISCUSSION_LIST(courseID, courseType))).json();
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
          url: URL.LEARN_DISCUSSION_DETAIL(d.wlkcid, d.bqid, d.id, courseType),
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
    const json = await (await this.#myFetchWithToken(URL.LEARN_QUESTION_LIST_ANSWERED(courseID, courseType))).json();
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
          url: URL.LEARN_QUESTION_DETAIL(q.wlkcid, q.id, courseType),
        });
      }),
    );

    return questions;
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
          id: h.zyid,
          studentHomeworkId: h.xszyid,
          title: decodeHTML(h.bt),
          url: URL.LEARN_HOMEWORK_DETAIL(h.wlkcid, h.zyid, h.xszyid),
          deadline: new Date(h.jzsj),
          submitUrl: URL.LEARN_HOMEWORK_SUBMIT_PAGE(h.wlkcid, h.xszyid),
          submitTime: h.scsj === null ? undefined : new Date(h.scsj),
          grade: h.cj === null ? undefined : h.cj,
          gradeLevel: mapGradeToLevel(h.cj),
          graderName: trimAndDefine(h.jsm),
          gradeContent: trimAndDefine(h.pynr),
          gradeTime: h.pysj === null ? undefined : new Date(h.pysj),
          ...status,
          ...(await this.parseHomeworkDetail(h.wlkcid, h.zyid, h.xszyid)),
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
    const response = await this.#myFetchWithToken(URL.LEARN_NOTIFICATION_DETAIL(courseID, id, courseType));
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
    if (!path.startsWith(URL.LEARN_PREFIX)) {
      path = URL.LEARN_PREFIX + path;
    }
    return {
      attachment: {
        name: attachmentName,
        id: attachmentId,
        downloadUrl: path,
        previewUrl: URL.LEARN_FILE_PREVIEW(ContentType.NOTIFICATION, attachmentId, courseType, this.previewFirstPage),
        size,
      },
    };
  }

  private async parseHomeworkDetail(courseID: string, id: string, studentHomeworkID: string): Promise<IHomeworkDetail> {
    const response = await this.#myFetchWithToken(URL.LEARN_HOMEWORK_DETAIL(courseID, id, studentHomeworkID));
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
      let downloadUrl = URL.LEARN_PREFIX + fileNode.attribs.href;
      if (params.has('downloadUrl')) {
        downloadUrl = URL.LEARN_PREFIX + params.get('downloadUrl')!;
      }
      return {
        id: attachmentId,
        name: (fileNode.children[0] as DOM.Text).data!,
        downloadUrl,
        previewUrl: URL.LEARN_FILE_PREVIEW(
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
    studentHomeworkID: string,
    content = '',
    attachment?: IHomeworkSubmitAttachment,
    removeAttachment = false,
  ): Promise<IHomeworkSubmitResult> {
    return await (
      await this.#myFetchWithToken(URL.LEARN_HOMEWORK_SUBMIT(), {
        method: 'POST',
        body: URL.LEARN_HOMEWORK_SUBMIT_FORM_DATA(studentHomeworkID, content, attachment, removeAttachment),
      })
    ).json();
  }

  public async setLanguage(lang: Language): Promise<void> {
    await this.#myFetchWithToken(URL.LEARN_WEBSITE_LANGUAGE(lang), {
      method: 'POST',
    });
    this.#lang = lang;
  }

  public getCurrentLanguage(): Language {
    return this.#lang;
  }
}

export * from './types';
