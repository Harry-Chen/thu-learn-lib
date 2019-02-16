import * as FormData from 'form-data';

export const LEARN_PREFIX = 'https://learn2018.tsinghua.edu.cn';
const MAX_SIZE = 200;

export const ID_LOGIN = () => {
  return 'https://id.tsinghua.edu.cn/do/off/ui/auth/login/post/bb5df85216504820be7bba2b0ae1535b/0?/login.do';
};

export const ID_LOGIN_FORM_DATA = (username: string, password: string) => {
  const credential = new FormData();
  credential.append('i_user', username);
  credential.append('i_pass', password);
  credential.append('atOnce', String(true));
  return credential;
};

export const LEARN_AUTH_ROAM = (ticket: string) => {
  return `${LEARN_PREFIX}/b/j_spring_security_thauth_roaming_entry?ticket=${ticket}`;
};

export const LEARN_LOGOUT = () => {
  return `${LEARN_PREFIX}/f/j_spring_security_logout`;
};

export const LEARN_SEMESTER_LIST = () => {
  return `${LEARN_PREFIX}/b/wlxt/kc/v_wlkc_xs_xktjb_coassb/queryxnxq`;
};

export const LEARN_CURRENT_SEMESTER = () => {
  return `${LEARN_PREFIX}/b/kc/zhjw_v_code_xnxq/getCurrentAndNextSemester`;
};

export const LEARN_COURSE_LIST = (semester: string) => {
  return `${LEARN_PREFIX}/b/wlxt/kc/v_wlkc_xs_xkb_kcb_extend/student/loadCourseBySemesterId/${semester}`;
};

export const LEARN_COURSE_URL = (courseID: string) => {
  return `${LEARN_PREFIX}/f/wlxt/index/course/student/course?wlkcid=${courseID}`;
};

export const LEARN_FILE_LIST = (courseID: string) => {
  return `${LEARN_PREFIX}/b/wlxt/kj/wlkc_kjxxb/student/kjxxbByWlkcidAndSizeForStudent?wlkcid=${courseID}&size=${MAX_SIZE}`;
};

export const LEARN_FILE_DOWNLOAD = (fileID: string) => {
  return `${LEARN_PREFIX}/b/wlxt/kj/wlkc_kjxxb/student/downloadFile?sfgk=0&wjid=${fileID}`;
};

export const LEARN_NOTIFICATION_LIST = (courseID: string) => {
  return `${LEARN_PREFIX}/b/wlxt/kcgg/wlkc_ggb/student/kcggListXs?wlkcid=${courseID}&size=${MAX_SIZE}`;
};

export const LEARN_NOTIFICATION_DETAIL = (courseID: string, notificationID: string) => {
  return `${LEARN_PREFIX}/f/wlxt/kcgg/wlkc_ggb/student/beforeViewXs?wlkcid=${courseID}&id=${notificationID}`;
};

export const LEARN_HOMEWORK_LIST_SOURCE = (courseID: string) => {
  return [
    {
      url: LEARN_HOMEWORK_LIST_NEW(courseID),
      status: {
        submitted: false,
        graded: false,
      },
    },
    {
      url: LEARN_HOMEWORK_LIST_SUBMITTED(courseID),
      status: {
        submitted: true,
        graded: false,
      },
    },
    {
      url: LEARN_HOMEWORK_LIST_GRADED(courseID),
      status: {
        submitted: true,
        graded: true,
      },
    },
  ];
};

export const LEARN_HOMEWORK_LIST_NEW = (courseID: string) => {
  return `${LEARN_PREFIX}/b/wlxt/kczy/zy/student/index/zyListWj?wlkcid=${courseID}&size=${MAX_SIZE}`;
};

export const LEARN_HOMEWORK_LIST_SUBMITTED = (courseID: string) => {
  return `${LEARN_PREFIX}/b/wlxt/kczy/zy/student/index/zyListYjwg?wlkcid=${courseID}&size=${MAX_SIZE}`;
};

export const LEARN_HOMEWORK_LIST_GRADED = (courseID: string) => {
  return `${LEARN_PREFIX}/b/wlxt/kczy/zy/student/index/zyListYpg?wlkcid=${courseID}&size=${MAX_SIZE}`;
};

export const LEARN_HOMEWORK_DETAIL = (courseID: string, homeworkID: string, studentHomeworkID: string) => {
  return `${LEARN_PREFIX}/f/wlxt/kczy/zy/student/viewCj?wlkcid=${courseID}&zyid=${homeworkID}&xszyid=${studentHomeworkID}`;
};

export const LEARN_HOMEWORK_DOWNLOAD = (courseID: string, attachmentID: string) => {
  return `${LEARN_PREFIX}/b/wlxt/kczy/zy/student/downloadFile/${courseID}/${attachmentID}`;
};

export const LEARN_HOMEWORK_SUBMIT = (courseID: string, studentHomeworkID: string) => {
  return `${LEARN_PREFIX}/f/wlxt/kczy/zy/student/tijiao?wlkcid=${courseID}&xszyid=${studentHomeworkID}`;
};

export const LEARN_DISCUSSION_LIST = (courseID: string) => {
  return `${LEARN_PREFIX}/b/wlxt/bbs/bbs_tltb/student/kctlList?wlkcid=${courseID}&size=${MAX_SIZE}`;
};

export const LEARN_DISCUSSION_DETAIL = (courseID: string, boardID: string, discussionID: string, tabId: number = 1) => {
  return `${LEARN_PREFIX}/f/wlxt/bbs/bbs_tltb/student/viewTlById?wlkcid=${courseID}&id=${discussionID}&tabbh=${tabId}&bqid=${boardID}`;
};

export const LEARN_QUESTION_LIST_ANSWERED = (courseID: string) => {
  return `${LEARN_PREFIX}/b/wlxt/bbs/bbs_tltb/student/kcdyList?wlkcid=${courseID}&size=${MAX_SIZE}`;
};

export const LEARN_QUESTION_DETAIL = (courseID: string, questionID: string) => {
  return `${LEARN_PREFIX}/f/wlxt/bbs/bbs_kcdy/student/viewDyById?wlkcid=${courseID}&id=${questionID}`;
};
