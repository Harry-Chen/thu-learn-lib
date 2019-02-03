import 'cheerio';
import { Base64 } from 'js-base64';

import * as URL from './urls';
import { CourseInfo, SemesterInfo, Notification, File, Homework, Discussion, Question, IDiscussionBase } from './types';
import { INotification, INotificationDetail } from './types';
import { IHomeworkDetail, IHomeworkStatus } from './types';
import { parseSemesterType, decodeHTMLEntities, trimAndDefine } from './utils';

const FETCH_COMMON_CONFIG: RequestInit = {
    credentials: 'include',
};

const myFetch = (url: string, config: RequestInit = {}) => {
    return fetch(url, {...FETCH_COMMON_CONFIG, ...config});
};

const CHEERIO_CONFIG: CheerioOptionsInterface = {
    decodeEntities: false,
};

const $ = (html: string) => {
    return cheerio.load(html, CHEERIO_CONFIG);
};

export default class Learn2018Helper {

    private username: string = "";
    private password: string = "";
    private hasLogin: boolean = false;

    constructor(username: string, password: string) {
        this.username = username;
        this.password = password;
    }

    public async login(): Promise<boolean> {

        const ticketResponse = await myFetch(URL.ID_LOGIN(), {
            body: URL.ID_LOGIN_FORM_DATA(this.username, this.password),
            method: 'POST',
        });
        if (!ticketResponse.ok) {
            return false;
        }
        const body = $(await ticketResponse.text());
        const targetURL = body('a').attr('href');
        const ticket = targetURL.split('=').slice(-1)[0];

        const loginResponse = await myFetch(URL.LEARN_AUTH_ROAM(ticket));
        return (this.hasLogin = loginResponse.ok);

    }

    public logout() {

        this.username = "";
        this.password = "";
        this.hasLogin = false;

    }

    public async getCurrentSemester(): Promise<SemesterInfo> {

        this.ensureLogin();
        const response = await myFetch(URL.LEARN_CURRENT_SEMESTER());
        const result = (await response.json()).result;
        return {
            id: result.id,
            startDate: new Date(result.kssj),
            endDate: new Date(result.jssj),
            startYear: Number(result.xnxq.slice(0, 4)),
            endYear: Number(result.xnxq.slice(5, 9)),
            type: parseSemesterType(Number(result.xnxq.slice(10, 11)))
        }

    }

    public async getCourseForSemester(semesterID: string): Promise<CourseInfo[]> {

        this.ensureLogin();
        const response = await myFetch(URL.LEARN_COURSE_LIST(semesterID));
        const result = (await response.json()).resultList as any[];
        const courses: CourseInfo[] = [];

        await Promise.all(result.map(async (c) => {
            courses.push({
                id: c.wlkcid,
                name: c.kcm,
                teacherName: c.jsm,
                courseNumber: c.kch,
                courseIndex: c.kxh,
            });
        }));

        return courses;

    }

    public async getNotificationList(courseID: string): Promise<Notification[]> {

        this.ensureLogin();
        const response = await myFetch(URL.LEARN_NOTIFICATION_LIST(courseID));
        const result = (await response.json()).object.aaData as any[];
        const notifications: Notification[] = [];

        await Promise.all(result.map(async (n) => {
            const notification: INotification = {
                id: n.ggid,
                content: decodeHTMLEntities(Base64.decode(n.ggnr)),
                title: n.bt,
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
            notifications.push({...notification, ...detail});
        }));

        return notifications;

    }

    public async getFileList(courseID: string): Promise<File[]> {

        this.ensureLogin();
        const response = await myFetch(URL.LEARN_FILE_LIST(courseID));
        const result = (await response.json()).object as any[];
        const files: File[] = [];

        await Promise.all(result.map(async (f) => {
            files.push({
                id: f.wjid,
                title: f.bt,
                description: f.ms,
                size: f.fileSize,
                uploadTime: new Date(f.scsj),
                downloadUrl: URL.LEARN_FILE_DOWNLOAD(f.wjid),
                isNew: f.isNew,
                markedImportant: f.sfqd === '1',
                visitCount: f.llcs,
                downloadCount: f.xzcs,
                fileType: f.wjlx,
            });
        }));

        return files;

    }

    public async getHomeworkList(courseID: string): Promise<Homework[]> {

        this.ensureLogin();
        const allHomework: Homework[] = [];

        await Promise.all(URL.LEARN_HOMEWORK_LIST_SOURCE(courseID).map(async (s) => {
            const homeworks = await this.getHomeworkListAtUrl(s.url, s.status);
            allHomework.push(...homeworks);
        }));

        return allHomework;

    }

    public async getDiscussionList(courseID: string): Promise<Discussion[]> {

        this.ensureLogin();
        const response = await myFetch(URL.LEARN_DISCUSSION_LIST(courseID));
        const result = (await response.json()).object.resultsList as any[];
        const discussions: Discussion[] = [];

        await Promise.all(result.map(async (d) => {
            discussions.push({
                ...this.parseDiscussionBase(d),
                boardId: d.bqid,
            })
        }));

        return discussions;

    }

    public async getQuestionList(courseID: string): Promise<Question[]> {

        this.ensureLogin();
        const response = await myFetch(URL.LEARN_DISCUSSION_LIST(courseID));
        const result = (await response.json()).object.resultsList as any[];
        const questions: Question[] = [];

        await Promise.all(result.map(async (q) => {
            questions.push({
                ...this.parseDiscussionBase(q),
                question: Base64.decode(q.wtnr),
            })
        }));

        return questions;

    }

    private ensureLogin() {
        if (!this.hasLogin) {
            throw new Error('Not logged in.');
        }
    }

    private async getHomeworkListAtUrl(url: string, status: IHomeworkStatus): Promise<Homework[]> {

        const response = await myFetch(url);
        const result = (await response.json()).object.aaData as any[];
        const homeworks: Homework[] = [];

        await Promise.all(result.map(async (h) => {
            homeworks.push({
                id: h.zyid,
                studentHomeworkId: h.xszyid,
                title: h.bt,
                url: URL.LEARN_HOMEWORK_DETAIL(h.wlkcid, h.zyid, h.xszyid),
                deadline: new Date(h.jssj),
                submitUrl: URL.LEARN_HOMEWORK_SUBMIT(h.wlkcid, h.xszyid),
                submitTime: h.scsj === null ? undefined : new Date(h.scsj),
                grade: h.cj === null ? undefined : h.cj,
                graderName: trimAndDefine(h.jsm),
                gradeContent: trimAndDefine(h.pynr),
                gradeTime: h.pysj === null ? undefined : new Date(h.pysj),
                submittedAttachmentUrl: h.zyfjid === '' ? undefined : URL.LEARN_HOMEWORK_DOWNLOAD(h.wlkcid, h.zyfjid),
                ...status,
                ...(await this.parseHomeworkDetail(h.wlkcid, h.zyid, h.xszyid)),
            });
        }));

        return homeworks;

    }

    private async parseNotificationDetail(courseID: string, id: string): Promise<INotificationDetail> {
        const response = await myFetch(URL.LEARN_NOTIFICATION_DETAIL(courseID, id));
        const result = $(await response.text());
        return { attachmentUrl: result('.ml-10').attr('href') };
    }

    private async parseHomeworkDetail(courseID: string, id: string, studentHomeworkID: string):
      Promise<IHomeworkDetail> {

        const response = await myFetch(URL.LEARN_HOMEWORK_DETAIL(courseID, id, studentHomeworkID));
        const result = $(await response.text());

        const fileDivs = result('div.list.fujian.clearfix');

        return {
            description: trimAndDefine(result('div.list.calendar.clearfix>div.fl.right>div.c55').slice(0,1).html()),
            answerContent: trimAndDefine(result('div.list.calendar.clearfix>div.fl.right>div.c55').slice(1,2).html()),
            submittedContent: trimAndDefine(cheerio(('div.right'),result('div.boxbox').slice(1,2)).slice(2,3).html()),
            ...this.parseHomeworkFile(fileDivs[0], 'attachmentName', 'attachmentUrl'),
            ...this.parseHomeworkFile(fileDivs[1], 'answerAttachmentName', 'answerAttachmentUrl'),
            ...this.parseHomeworkFile(fileDivs[2], 'submittedAttachmentName', 'submittedAttachmentUrl'),
            ...this.parseHomeworkFile(fileDivs[3], 'gradeAttachmentName', 'gradeAttachmentUrl'),
        }

    }

    private parseHomeworkFile = (fileDiv: CheerioElement, nameKey: string, urlKey: string) => {
        const fileNode = cheerio('.ftitle', fileDiv).children('a')[0];
        if (fileNode !== undefined) {
            return {
                [nameKey]: fileNode.children[0].data,
                [urlKey]: `${URL.LEARN_PREFIX}${fileNode.attribs.href.split('=').slice(-1)[0]}`
            }
        } else {
            return {};
        }
    };

    private parseDiscussionBase = (d: any): IDiscussionBase => {
        return {
            id: d.id,
            title: d.bt,
            url: URL.LEARN_DISCUSSION_DETAIL(d.wlkcid, d.bqid, d.id),
            publisherName: d.fbrxm,
            publishTime: new Date(d.fbsj),
            lastReplyTime: new Date(d.zhhfsj),
            lastReplierName: d.zhhfrxm,
            visitCount: d.djs,
            replyCount: d.hfcs,
        };
    };

}
