import * as cheerio from 'cheerio';
import { Base64 } from 'js-base64';

import fetch from 'cross-fetch';
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
} from './types';
import { decodeHTML, mapGradeToLevel, parseSemesterType, trimAndDefine, JSONP_EXTRACTOR_NAME, extractJSONPResult } from './utils';

const IsomorphicFetch = require('real-isomorphic-fetch');
const tough = require('tough-cookie-no-native');

const CHEERIO_CONFIG: CheerioOptionsInterface = {
  decodeEntities: false,
};

const $ = (html: string) => {
  return cheerio.load(html, CHEERIO_CONFIG);
};

const noLogin = (url: string) => url.includes('login_timeout');

/** the main helper class */
export class Learn2018Helper {

  readonly #provider?: CredentialProvider;
  readonly #rawFetch: Fetch;
  readonly #myFetch: Fetch;

  readonly #withReAuth = (rawFetch: Fetch): Fetch => {
    const login = this.login.bind(this);
    return async function wrappedFetch(...args) {
      const retryAfterLogin = async () => {
        await login();
        return await rawFetch(...args);
      };
      return await rawFetch(...args).then(res => (noLogin(res.url) ? retryAfterLogin() : res));
    };
  }

  public readonly cookieJar: any;

  /** you can provide a CookieJar and / or CredentialProvider in the configuration */
  constructor(config?: HelperConfig) {
    this.cookieJar = config?.cookieJar ?? new tough.CookieJar();
    this.#provider = config?.provider;
    this.#rawFetch = new IsomorphicFetch(fetch, this.cookieJar);
    this.#myFetch = this.#provider
      ? this.#withReAuth(this.#rawFetch)
      : async (...args) => {
          const result = await this.#rawFetch(...args);
          if (noLogin(result.url)) return Promise.reject(FailReason.NOT_LOGGED_IN);
          return result;
        };
  }

  /** login is necessary if you do not provide a `CredentialProvider` */
  public async login(username?: string, password?: string) {
    if (!username || !password) {
      if (!this.#provider) return Promise.reject(FailReason.NO_CREDENTIAL);
      const credential = await this.#provider();
      username = credential.username;
      password = credential.password;
    }
    const ticketResponse = await this.#rawFetch(URL.ID_LOGIN(), {
      body: URL.ID_LOGIN_FORM_DATA(username, password),
      method: 'POST',
    });
    if (!ticketResponse.ok) {
      return Promise.reject(FailReason.ERROR_FETCH_FROM_ID);
    }
    // check response from id.tsinghua.edu.cn
    const ticketResult = await ticketResponse.text();
    const body = $(ticketResult);
    const targetURL = body('a').attr('href') as string;
    const ticket = targetURL.split('=').slice(-1)[0];
    if (ticket === 'BAD_CREDENTIALS') {
      return Promise.reject(FailReason.BAD_CREDENTIAL);
    }
    const loginResponse = await this.#rawFetch(URL.LEARN_AUTH_ROAM(ticket));
    if (loginResponse.ok !== true) {
      return Promise.reject(FailReason.ERROR_ROAMING);
    }
  }

  /**  logout (to make everyone happy) */
  public async logout() {
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
  public async getCalendar(startDate: string, endDate: string, graduate: boolean = false): Promise<CalendarEvent[]> {
    const ticketResponse = await this.#myFetch(URL.REGISTRAR_TICKET(), {
      method: 'POST',
      body: URL.REGISTRAR_TICKET_FORM_DATA(),
    });

    let ticket = (await ticketResponse.text()) as string;
    ticket = ticket.substring(1, ticket.length - 1);

    await this.#myFetch(URL.REGISTRAR_AUTH(ticket));

    const response = await this.#myFetch(URL.REGISTRAR_CALENDAR(startDate, endDate, graduate, JSONP_EXTRACTOR_NAME));

    if (!response.ok) {
      return Promise.reject(FailReason.INVALID_RESPONSE);
    }

    const result = extractJSONPResult(await response.text()) as any[];

    return result.map<CalendarEvent>(i => ({
      location: i.dd,
      status: i.fl,
      startTime: i.kssj,
      endTime: i.jssj,
      date: i.nq,
      courseName: i.nr,
    }));
  }

  public async getSemesterIdList(): Promise<string[]> {
    const response = await this.#myFetch(URL.LEARN_SEMESTER_LIST());
    const semesters = (await response.json()) as string[];
    // sometimes web learning returns null, so confusing...
    return semesters.filter(s => s != null);
  }

  public async getCurrentSemester(): Promise<SemesterInfo> {
    const response = await this.#myFetch(URL.LEARN_CURRENT_SEMESTER());
    const result = (await response.json()).result;
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
    const response = await this.#myFetch(URL.LEARN_COURSE_LIST(semesterID, courseType));
    const result = (await response.json()).resultList as any[];
    const courses: CourseInfo[] = [];

    await Promise.all(
      result.map(async c => {
        courses.push({
          id: c.wlkcid,
          name: c.kcm,
          englishName: c.ywkcm,
          timeAndLocation: await (await this.#myFetch(URL.LEARN_COURSE_TIME_LOCATION(c.wlkcid))).json(),
          url: URL.LEARN_COURSE_URL(c.wlkcid, courseType),
          teacherName: c.jsm ?? '', // teacher can not fetch this
          teacherNumber: c.jsh,
          courseNumber: c.kch,
          courseIndex: c.kxh,
          courseType,
        });
      }),
    );

    return courses;
  }

  /**
   * Get certain type of content of all specified courses.
   * It actually wraps around other `getXXX` functions
   */
  public async getAllContents(
    courseIDs: string[],
    type: ContentType,
    courseType: CourseType = CourseType.STUDENT,
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

    await Promise.all(
      courseIDs.map(async id => {
        contents[id] = await fetchFunc.bind(this)(id, courseType);
      }),
    );

    return contents;
  }

  /** Get all notifications （课程公告） of the specified course. */
  public async getNotificationList(
    courseID: string,
    courseType: CourseType = CourseType.STUDENT,
  ): Promise<Notification[]> {
    let json = await (await this.#myFetch(URL.LEARN_NOTIFICATION_LIST(courseID, courseType))).json();
    if (json.result !== 'success') {
      return [];
    }

    const result = (json.object.aaData ?? json.object.resultsList) as any[];
    const notifications: Notification[] = [];

    await Promise.all(
      result.map(async n => {
        const notification: INotification = {
          id: n.ggid,
          content: decodeHTML(Base64.decode(n.ggnr)),
          title: decodeHTML(n.bt),
          url: URL.LEARN_NOTIFICATION_DETAIL(courseID, n.ggid, courseType),
          publisher: n.fbrxm,
          hasRead: n.sfyd === '是',
          markedImportant: n.sfqd === '1',
          publishTime: new Date(n.fbsjStr),
        };
        let detail: INotificationDetail = {};
        if (n.fjmc !== null) {
          notification.attachmentName = n.fjmc;
          detail = await this.parseNotificationDetail(courseID, notification.id, courseType);
        }
        notifications.push({ ...notification, ...detail });
      }),
    );

    return notifications;
  }

  /** Get all files （课程文件） of the specified course. */
  public async getFileList(courseID: string, courseType: CourseType = CourseType.STUDENT): Promise<File[]> {
    const json = await (await this.#myFetch(URL.LEARN_FILE_LIST(courseID, courseType))).json();
    if (json.result !== 'success') {
      return [];
    }
    let result: any[];
    if (json?.object?.resultsList) {
      // teacher
      result = json.object.resultsList;
    } else {
      // student
      result = json.object;
    }
    const files: File[] = [];

    await Promise.all(
      result.map(async f => {
        files.push({
          id: f.wjid,
          title: decodeHTML(f.bt),
          description: decodeHTML(f.ms),
          rawSize: f.wjdx,
          size: f.fileSize,
          uploadTime: new Date(f.scsj),
          downloadUrl: URL.LEARN_FILE_DOWNLOAD(courseType === CourseType.STUDENT ? f.wjid : f.id, courseType, courseID),
          previewUrl: URL.LEARN_FILE_PREVIEW(f.wjid, courseType, true),
          isNew: f.isNew,
          markedImportant: f.sfqd === 1,
          visitCount: f.llcs ?? 0,
          downloadCount: f.xzcs ?? 0,
          fileType: f.wjlx,
        });
      }),
    );

    return files;
  }

  /** Get all homeworks （课程作业） of the specified course (support student version only). */
  public async getHomeworkList(courseID: string, courseType: CourseType = CourseType.STUDENT): Promise<Homework[]> {
    if (courseType === CourseType.TEACHER) {
      return Promise.reject(FailReason.NOT_IMPLEMENTED);
    }

    const allHomework: Homework[] = [];

    await Promise.all(
      URL.LEARN_HOMEWORK_LIST_SOURCE(courseID).map(async s => {
        const homeworks = await this.getHomeworkListAtUrl(s.url, s.status);
        allHomework.push(...homeworks);
      }),
    );

    return allHomework;
  }

  /** Get all discussions （课程讨论） of the specified course. */
  public async getDiscussionList(courseID: string, courseType: CourseType = CourseType.STUDENT): Promise<Discussion[]> {
    const json = await (await this.#myFetch(URL.LEARN_DISCUSSION_LIST(courseID, courseType))).json();
    if (json.result !== 'success') {
      return [];
    }
    const result = json.object.resultsList as any[];
    const discussions: Discussion[] = [];

    await Promise.all(
      result.map(async d => {
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
    const json = await (await this.#myFetch(URL.LEARN_QUESTION_LIST_ANSWERED(courseID, courseType))).json();
    if (json.result !== 'success') {
      return [];
    }
    const result = json.object.resultsList as any[];
    const questions: Question[] = [];

    await Promise.all(
      result.map(async q => {
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
    const json = await (await this.#myFetch(url)).json();
    if (json.result !== 'success') {
      return [];
    }
    const result = json.object.aaData as any[];
    const homeworks: Homework[] = [];

    await Promise.all(
      result.map(async h => {
        homeworks.push({
          id: h.zyid,
          studentHomeworkId: h.xszyid,
          title: decodeHTML(h.bt),
          url: URL.LEARN_HOMEWORK_DETAIL(h.wlkcid, h.zyid, h.xszyid),
          deadline: new Date(h.jzsj),
          submitUrl: URL.LEARN_HOMEWORK_SUBMIT(h.wlkcid, h.xszyid),
          submitTime: h.scsj === null ? undefined : new Date(h.scsj),
          grade: h.cj === null ? undefined : h.cj,
          gradeLevel: mapGradeToLevel(h.cj),
          graderName: trimAndDefine(h.jsm),
          gradeContent: trimAndDefine(h.pynr),
          gradeTime: h.pysj === null ? undefined : new Date(h.pysj),
          submittedAttachmentUrl: h.zyfjid === '' ? undefined : URL.LEARN_HOMEWORK_DOWNLOAD(h.wlkcid, h.zyfjid),
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
  ): Promise<INotificationDetail> {
    const response = await this.#myFetch(URL.LEARN_NOTIFICATION_DETAIL(courseID, id, courseType));
    const result = $(await response.text());
    let path = '';
    if (courseType === CourseType.STUDENT) {
      path = result('.ml-10').attr('href')!;
    } else {
      path = result('#wjid').attr('href')!;
    }
    return { attachmentUrl: `${URL.LEARN_PREFIX}${path}` };
  }

  private async parseHomeworkDetail(courseID: string, id: string, studentHomeworkID: string): Promise<IHomeworkDetail> {
    const response = await this.#myFetch(URL.LEARN_HOMEWORK_DETAIL(courseID, id, studentHomeworkID));
    const result = $(await response.text());

    const fileDivs = result('div.list.fujian.clearfix');

    return {
      description: trimAndDefine(
        result('div.list.calendar.clearfix>div.fl.right>div.c55')
          .slice(0, 1)
          .html(),
      ),
      answerContent: trimAndDefine(
        result('div.list.calendar.clearfix>div.fl.right>div.c55')
          .slice(1, 2)
          .html(),
      ),
      submittedContent: trimAndDefine(
        cheerio('div.right', result('div.boxbox').slice(1, 2))
          .slice(2, 3)
          .html(),
      ),
      ...this.parseHomeworkFile(fileDivs[0], 'attachmentName', 'attachmentUrl'),
      ...this.parseHomeworkFile(fileDivs[1], 'answerAttachmentName', 'answerAttachmentUrl'),
      ...this.parseHomeworkFile(fileDivs[2], 'submittedAttachmentName', 'submittedAttachmentUrl'),
      ...this.parseHomeworkFile(fileDivs[3], 'gradeAttachmentName', 'gradeAttachmentUrl'),
    };
  }

  private parseHomeworkFile(fileDiv: CheerioElement, nameKey: string, urlKey: string) {
    const fileNode = cheerio('.ftitle', fileDiv).children('a')[0];
    if (fileNode !== undefined) {
      return {
        [nameKey]: fileNode.children[0].data,
        [urlKey]: `${URL.LEARN_PREFIX}${fileNode.attribs.href.split('=').slice(-1)[0]}`,
      };
    } else {
      return {};
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
}
