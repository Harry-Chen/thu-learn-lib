
export enum SemesterType {
  FALL = '秋季学期',
  SRPING = '春季学期',
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
  _id: string;
  name: string;
  teacherName: string;
  courseNumber: string;
  courseIndex: number;
}

export type CourseInfo = ICourseInfo;

export interface INotification {
  _id: string;
  title: string;
  content: string;
  hasRead: boolean;
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
  _id: string;
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

export interface IHomework {
  _id: string;
  studentHomeworkId: string;
  title: string;
  deadline: Date;
  attachmentUrl?: string;
  submitted: boolean;
  submitTime?: Date;
  graded: boolean;
  grade?: number;
  gradeTime?: Date;
  gradeContent?: string;
  graderName?: string;
  gradeAttachmentUrl?: string;
}

export interface IHomeworkDetail {
  description: string;
  answerContent?: string;
  answerAttachmentUrl?: string;
  submittedContent?: string;
  submittedAttachmentUrl?: string;
}

export type Homework = IHomework & IHomeworkDetail;