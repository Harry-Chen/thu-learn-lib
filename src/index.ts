import * as cheerio from 'cheerio';
import { decodeHTML } from 'entities';
import { Base64 } from 'js-base64';

import fetch from 'cross-fetch';
import * as URL from './urls';
import {
  UPGetter,
  Fetch,
  HelperConfig,
  Content,
  ContentType,
  CourseContent,
  CourseInfo,
  Discussion,
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
} from './types';
import { mapGradeToLevel, parseSemesterType, trimAndDefine } from './utils';

const IsomorphicFetch = require('real-isomorphic-fetch');
const tough = require('tough-cookie-no-native');

const CHEERIO_CONFIG: CheerioOptionsInterface = {
  decodeEntities: false,
};

const $ = (html: string) => {
  return cheerio.load(html, CHEERIO_CONFIG);
};

export class Learn2018Helper {
  public cookieJar: any;
  private up?: UPGetter;
  private readonly rawFetch: Fetch;
  private readonly myFetch: Fetch;

  constructor(config?: HelperConfig) {
    this.cookieJar = config && config.cookieJar ? config.cookieJar : new tough.CookieJar();
    this.up = config && config.up ? config.up : undefined;
    this.rawFetch = new IsomorphicFetch(fetch, this.cookieJar);
    this.myFetch = config ? this.withReAuth(this.rawFetch) : this.rawFetch;
  }

  private withReAuth(rawFetch: Fetch): Fetch {
    const login = this.login.bind(this);  // avoid `this` change inside arrow function
    return async function wrappedFetch(...args) {
      const noLogin = (url: string) => url.includes("login_timeout")
      const retryAfterLogin = async () => await login().then(() => rawFetch(...args))
      return await rawFetch(...args).then(res => noLogin(res.url) ? retryAfterLogin() : res);
    }
  }

  public async login(username?: string, password?: string): Promise<boolean> {
    if (!username || !password) {
      if (!this.up) throw new Error('No Username & Password provided.');
      const up = await this.up();
      username = up.username;
      password = up.password;
    }
    const ticketResponse = await this.rawFetch(URL.ID_LOGIN(), {
      body: URL.ID_LOGIN_FORM_DATA(username, password),
      method: 'POST',
    });
    if (!ticketResponse.ok) {
      throw new Error('Error fetching ticket from id.tsinghua.edu.cn');
    }
    const ticketResult = await ticketResponse.text();
    const body = $(ticketResult);
    const targetURL = body('a').attr('href');
    const ticket = targetURL.split('=').slice(-1)[0];

    const loginResponse = await this.rawFetch(URL.LEARN_AUTH_ROAM(ticket));
    return loginResponse.ok;
  }

  public async logout() {
    this.cookieJar = new tough.CookieJar();
    await this.rawFetch(URL.LEARN_LOGOUT(), { method: 'POST' });

    return false;
  }

  public async getSemesterIdList(): Promise<string[]> {
    const response = await this.myFetch(URL.LEARN_SEMESTER_LIST());
    return (await response.json()) as string[];
  }

  public async getCurrentSemester(): Promise<SemesterInfo> {
    const response = await this.myFetch(URL.LEARN_CURRENT_SEMESTER());
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

  public async getCourseList(semesterID: string): Promise<CourseInfo[]> {
    const response = await this.myFetch(URL.LEARN_COURSE_LIST(semesterID));
    const result = (await response.json()).resultList as any[];
    const courses: CourseInfo[] = [];

    await Promise.all(
      result.map(async c => {
        courses.push({
          id: c.wlkcid,
          name: c.kcm,
          url: URL.LEARN_COURSE_URL(c.wlkcid, CourseType.STUDENT),
          teacherName: c.jsm,
          courseNumber: c.kch,
          courseIndex: c.kxh,
          courseType: CourseType.STUDENT,
        });
      }),
    );

    return courses;
  }

  public async getTACourseList(semesterID: string): Promise<CourseInfo[]> {
    const response = await this.myFetch(URL.LEARN_TA_COURSE_LIST(semesterID));
    const result = (await response.json()).resultList as any[];
    const courses: CourseInfo[] = [];

    await Promise.all(
      result.map(async c => {
        courses.push({
          id: c.wlkcid,
          name: c.kcm,
          url: URL.LEARN_COURSE_URL(c.wlkcid, CourseType.TEACHER),
          teacherName: '', // FIXME: currently it can not be fetched
          courseNumber: c.kch,
          courseIndex: c.kxh,
          courseType: CourseType.TEACHER,
        });
      }),
    );

    return courses;
  }

  public async getAllContents(courseIDs: string[], type: ContentType): Promise<CourseContent> {
    let fetchFunc: (courseID: string) => Promise<Content[]>;
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
        contents[id] = await fetchFunc.bind(this)(id);
      }),
    );

    return contents;
  }

  public async getNotificationList(courseID: string): Promise<Notification[]> {
    const json = await (await this.myFetch(URL.LEARN_NOTIFICATION_LIST(courseID))).json();
    if (json.result !== 'success') {
      return [];
    }
    const result = json.object.aaData as any[];
    const notifications: Notification[] = [];

    await Promise.all(
      result.map(async n => {
        const notification: INotification = {
          id: n.ggid,
          content: decodeHTML(Base64.decode(n.ggnr)),
          title: decodeHTML(n.bt),
          url: URL.LEARN_NOTIFICATION_DETAIL(courseID, n.ggid),
          publisher: n.fbrxm,
          hasRead: n.sfyd === '是',
          markedImportant: n.sfqd === '1',
          publishTime: new Date(n.fbsjStr),
        };
        let detail: INotificationDetail = {};
        if (n.fjmc !== null) {
          notification.attachmentName = n.fjmc;
          detail = await this.parseNotificationDetail(courseID, notification.id);
        }
        notifications.push({ ...notification, ...detail });
      }),
    );

    return notifications;
  }

  public async getFileList(courseID: string): Promise<File[]> {
    const json = await (await this.myFetch(URL.LEARN_FILE_LIST(courseID))).json();
    if (json.result !== 'success') {
      return [];
    }
    const result = json.object as any[];
    const files: File[] = [];

    await Promise.all(
      result.map(async f => {
        files.push({
          id: f.wjid,
          title: decodeHTML(f.bt),
          description: decodeHTML(f.ms),
          size: f.fileSize,
          uploadTime: new Date(f.scsj),
          downloadUrl: URL.LEARN_FILE_DOWNLOAD(f.wjid),
          isNew: f.isNew,
          markedImportant: f.sfqd === '1',
          visitCount: f.llcs,
          downloadCount: f.xzcs,
          fileType: f.wjlx,
        });
      }),
    );

    return files;
  }

  public async getHomeworkList(courseID: string): Promise<Homework[]> {
    const allHomework: Homework[] = [];

    await Promise.all(
      URL.LEARN_HOMEWORK_LIST_SOURCE(courseID).map(async s => {
        const homeworks = await this.getHomeworkListAtUrl(s.url, s.status);
        allHomework.push(...homeworks);
      }),
    );

    return allHomework;
  }

  public async getDiscussionList(courseID: string): Promise<Discussion[]> {
    const json = await (await this.myFetch(URL.LEARN_DISCUSSION_LIST(courseID))).json();
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
          url: URL.LEARN_DISCUSSION_DETAIL(d.wlkcid, d.bqid, d.id),
        });
      }),
    );

    return discussions;
  }

  public async getAnsweredQuestionList(courseID: string): Promise<Question[]> {
    const json = await (await this.myFetch(URL.LEARN_QUESTION_LIST_ANSWERED(courseID))).json();
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
          url: URL.LEARN_QUESTION_DETAIL(q.wlkcid, q.id),
        });
      }),
    );

    return questions;
  }


  private async getHomeworkListAtUrl(url: string, status: IHomeworkStatus): Promise<Homework[]> {
    const json = await (await this.myFetch(url)).json();
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

  private async parseNotificationDetail(courseID: string, id: string): Promise<INotificationDetail> {
    const response = await this.myFetch(URL.LEARN_NOTIFICATION_DETAIL(courseID, id));
    const result = $(await response.text());
    return { attachmentUrl: `${URL.LEARN_PREFIX}${result('.ml-10').attr('href')}` };
  }

  private async parseHomeworkDetail(courseID: string, id: string, studentHomeworkID: string): Promise<IHomeworkDetail> {
    const response = await this.myFetch(URL.LEARN_HOMEWORK_DETAIL(courseID, id, studentHomeworkID));
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
      visitCount: d.djs,
      replyCount: d.hfcs,
    };
  }
}
