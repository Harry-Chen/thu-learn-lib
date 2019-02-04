export enum SemesterType {
  FALL = '秋季学期',
  SPRING = '春季学期',
  SUMMER = '夏季学期',
  UNKNOWN = '',
}

interface ISemesterInfo {
  id: string;
  startDate: Date;
  endDate: Date;
  startYear: number;
  endYear: number;
  type: SemesterType;
}

export type SemesterInfo = ISemesterInfo;

interface ICourseInfo {
  id: string;
  name: string;
  teacherName: string;
  courseNumber: string;
  courseIndex: number;
}

export type CourseInfo = ICourseInfo;

export interface INotification {
  id: string;
  title: string;
  content: string;
  hasRead: boolean;
  url: string;
  markedImportant: boolean;
  publishTime: Date;
  publisher: string;
  attachmentName?: string;
}

export interface INotificationDetail {
  attachmentUrl?: string;
}

export type Notification = INotification & INotificationDetail;

interface IFile {
  id: string;
  size: string;
  title: string;
  description: string;
  uploadTime: Date;
  downloadUrl: string;
  isNew: boolean;
  markedImportant: boolean;
  visitCount: number;
  downloadCount: number;
  fileType: string;
}

export type File = IFile;

export interface IHomeworkStatus {
  submitted: boolean;
  graded: boolean;
}

export interface IHomework extends IHomeworkStatus {
  id: string;
  studentHomeworkId: string;
  title: string;
  deadline: Date;
  url: string;
  submitUrl: string;
  submitTime?: Date;
  submittedAttachmentUrl?: string;
  grade?: number;
  gradeTime?: Date;
  graderName?: string;
  gradeContent?: string;
}

export interface IHomeworkDetail {
  description?: string;
  attachmentName?: string;
  attachmentUrl?: string;
  answerContent?: string;
  answerAttachmentName?: string;
  answerAttachmentUrl?: string;
  submittedContent?: string;
  submittedAttachmentName?: string;
  gradeAttachmentName?: string;
  gradeAttachmentUrl?: string;
}

export type Homework = IHomework & IHomeworkDetail;

export interface IDiscussionBase {
  id: string;
  title: string;
  publisherName: string;
  publishTime: Date;
  lastReplierName: string;
  lastReplyTime: Date;
  visitCount: number;
  replyCount: number;
}

interface IDiscussion extends IDiscussionBase {
  url: string;
  boardId: string;
}

export type Discussion = IDiscussion;

interface IQuestion extends IDiscussionBase {
  url: string;
  question: string;
}

export type Question = IQuestion;
