
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

interface INotification {
  _id: string;
  title: string;
  content: string;
  publishTime: Date;
  publisher: string;
  attachmentName ?: string;
  attachmentUrl?: string;
}

export type Notification = INotification;

interface IFile {
  _id: string;
  size: string;
  title: string;
  description: string;
  uploadTime: Date;
  downloadUrl: string;
}

export type File = IFile;