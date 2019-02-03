export const LEARN_PREFIX = 'https://learn2018.tsinghua.edu.cn';
const MAX_SIZE = 200;

// const generateQueryFormData = (query: object) => {
//   const form = new FormData();
//   form.append('aoData', JSON.stringify(query));
//   return form;
// };

export const ID_LOGIN = () =>{
  return 'https://id.tsinghua.edu.cn/do/off/ui/auth/login/post/bb5df85216504820be7bba2b0ae1535b/0?/login.do'
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

export const LEARN_CURRENT_SEMESTER = () => {
  return `${LEARN_PREFIX}/b/kc/zhjw_v_code_xnxq/getCurrentAndNextSemester`;
};

export const LEARN_COURSE_LIST = (semester: string) => {
  return `${LEARN_PREFIX}/b/wlxt/kc/v_wlkc_xs_xkb_kcb_extend/student/loadCourseBySemesterId/${semester}`;
};

// export const LEARN_FILE_CATEGORY_LIST = (courseId: string) => {
//   return `${LEARN_PREFIX}/b/wlxt/kj/wlkc_kjflb/student/pageList?wlkcid=${courseId}`;
// };
//
// export const LEARN_FLIE_LIST = (courseID: string, categoryID: string) => {
//   return `${LEARN_PREFIX}/b/wlxt/kj/wlkc_kjxxb/student/kjxxb/${courseID}/${categoryID}`;
// };

export const LEARN_FILE_LIST = (courseID: string) => {
  return `${LEARN_PREFIX}b/wlxt/kj/wlkc_kjxxb/student/kjxxbByWlkcidAndSizeForStudent?wlkcid=${courseID}&size=${MAX_SIZE}`;
};

export const LEARN_FILE_DOWNLOAD = (fileID: string) => {
  return `${LEARN_PREFIX}/b/wlxt/kj/wlkc_kjxxb/student/downloadFile?sfgk=0&wjid=${fileID}`;
};

// export const LEARN_NOTIFICATION_LIST = () => {
//   return `${LEARN_PREFIX}/b/wlxt/kcgg/wlkc_ggb/student/pageListXs`;
// };
//
// export const LEARN_NOTIFICATION_LIST_FORM_DATA = (courseID: string) => {
//   const data = [
//     {
//       name: 'sEcho',
//       value: 1
//     }, {
//       name: 'iColumns',
//       value: 3
//     }, {
//       name: 'sColumns',
//       value: ',,'
//     }, {
//       name: 'iDisplayStart',
//       value: 0
//     }, {
//       name: 'iDisplayLength',
//       value: 30
//     }, {
//       name: 'mDataProp_0',
//       value: 'bt'
//     }, {
//       name: 'bSortable_0',
//       value: true
//     }, {
//       name: 'mDataProp_1',
//       value: 'fbr'
//     }, {
//       name: 'bSortable_1',
//       value: true
//     }, {
//       name: 'mDataProp_2',
//       value: 'fbsj'
//     }, {
//       name: 'bSortable_2',
//       value: true
//     }, {
//       name: 'iSortingCols',
//       value: 0
//     }, {
//       name: 'wlkcid',
//       value: `${courseID}`
//     }];
//   return generateQueryFormData(data);
// };

export const LEARN_NOTIFICATION_LIST = (courseID: string) => {
  return `${LEARN_PREFIX}b/wlxt/kcgg/wlkc_ggb/student/kcggListXs?wlkcid=${courseID}&size=${MAX_SIZE}`;
};

export const LEARN_NOTIFICATION_DETAIL = (courseID: string, notificationID: string) => {
  return `${LEARN_PREFIX}/f/wlxt/kcgg/wlkc_ggb/student/beforeViewXs?wlkcid=${courseID}&id=${notificationID}`;
}

export const LEARN_HOMEWORK_LIST_SOURCE = (courseID: string) => {
  return [
    {
      url: LEARN_HOMEWORK_LIST_NEW(courseID),
      status: {
        submitted: false,
        graded: false,
      }
    }, {
      url: LEARN_HOMEWORK_LIST_SUBMITTED(courseID),
      status: {
        submitted: true,
        graded: false,
      }
    }, {
      url: LEARN_HOMEWORK_LIST_GRADED(courseID),
      status: {
        submitted: true,
        graded: true,
      }
    }
  ];
};

export const LEARN_HOMEWORK_LIST_NEW = (courseID: string) => {
  return `${LEARN_PREFIX}/b/wlxt/kczy/zy/student/index/zyListWj?wlkcid=${courseID}&size=${MAX_SIZE}`;
};

export const LEARN_HOMEWORK_LIST_SUBMITTED = (courseID: string) => {
  return `${LEARN_PREFIX}/b/wlxt/kczy/zy/student/index/zyListYjWg?wlkcid=${courseID}&size=${MAX_SIZE}`;
};

export const LEARN_HOMEWORK_LIST_GRADED = (courseID: string) => {
  return `${LEARN_PREFIX}/b/wlxt/kczy/zy/student/index/zyListYpg?wlkcid=${courseID}&size=${MAX_SIZE}`;
};

// export const LEARN_HOMEWORK_LIST_FORM_DATA = (courseID: string) => {
//   const data = [
//     {
//       name: 'sEcho',
//       value: 1
//     },
//     {
//       name: 'iColumns',
//       value: 8
//     },
//     {
//       name: 'sColumns',
//       value: ',,,,,,,'
//     },
//     {
//       name: 'iDisplayStart',
//       value: 0
//     },
//     {
//       name: 'iDisplayLength',
//       value: '30'
//     },
//     {
//       name: 'mDataProp_0',
//       value: 'wz'
//     },
//     {
//       name: 'bSortable_0',
//       value: true
//     },
//     {
//       name: 'mDataProp_1',
//       value: 'bt'
//     },
//     {
//       name: 'bSortable_1',
//       value: true
//     },
//     {
//       name: 'mDataProp_2',
//       value: 'zywcfs'
//     },
//     {
//       name: 'bSortable_2',
//       value: true
//     },
//     {
//       name: 'mDataProp_3',
//       value: 'scsj'
//     },
//     {
//       name: 'bSortable_3',
//       value: true
//     },
//     {
//       name: 'mDataProp_4',
//       value: 'jsm'
//     },
//     {
//       name: 'bSortable_4',
//       value: false
//     },
//     {
//       name: 'mDataProp_5',
//       value: 'pysj'
//     },
//     {
//       name: 'bSortable_5',
//       value: true
//     },
//     {
//       name: 'mDataProp_6',
//       value: 'cj'
//     },
//     {
//       name: 'bSortable_6',
//       value: true
//     },
//     {
//       name: 'mDataProp_7',
//       value: 'function'
//     },
//     {
//       name: 'bSortable_7',
//       value: false
//     },
//     {
//       name: 'iSortCol_0',
//       value: 0
//     },
//     {
//       name: 'sSortDir_0',
//       value: 'desc'
//     },
//     {
//       name: 'iSortingCols',
//       value: 1
//     },
//     {
//       name: 'wlkcid',
//       value: `${courseID}`
//     }
//   ];
//   return generateQueryFormData(data);
// };

export const LEARN_HOMEWORK_DETAIL = (courseID: string, homeworkID: string, studentHomeworkID: string) => {
  return `${LEARN_PREFIX}/f/wlxt/kczy/zy/student/viewCj?wlkcid=${courseID}&zyid=${homeworkID}&xszyid=${studentHomeworkID}`;
};

export const LEARN_HOMEWORK_DOWNLOAD = (courseID: string, attachmentID: string) => {
  return `${LEARN_PREFIX}/b/wlxt/kczy/zy/student/downloadFile/${courseID}/${attachmentID}`;
};

export const LEARN_HOMEWORK_SUBMIT = (courseID: string, studentHomeworkID: string) => {
  return `${LEARN_PREFIX}/f/wlxt/kczy/zy/student/tijiao?wlkcid=${courseID}&xszyid=${studentHomeworkID}`
};

// export const LEARN_DISCUSSION_BOARD_LIST = () => {
//   return `${LEARN_PREFIX}/b/wlxt/bbs/bbs_bqb/student/bqListByWlkcid`;
// };
//
// export const LEARN_DISCUSSION_BOARD_LIST_FORM_DATA = (courseID: string) => {
//   const form = new FormData();
//   form.append('wlkcid', courseID);
//   return form;
// };

export const LEARN_DISCUSSION_LIST = (courseID: string) => {
  return `${LEARN_PREFIX}/b/wlxt/bbs/bbs_tltb/student/kctlList?wlkcid=${courseID}&size=${MAX_SIZE}`;
};

// export const LEARN_DISCUSSION_LIST_FORM_DATA = (courseID: string, boardID: string) => {
//   const data = [
//     {
//       name: 'sEcho',
//       value: 2
//     },
//     {
//       name: 'iColumns',
//       value: 6
//     },
//     {
//       name: 'sColumns',
//       value: ',,,,,'
//     },
//     {
//       name: 'iDisplayStart',
//       value: 0
//     },
//     {
//       name: 'iDisplayLength',
//       value: '30'
//     },
//     {
//       name: 'mDataProp_0',
//       value: 'function'
//     },
//     {
//       name: 'bSortable_0',
//       value: false
//     },
//     {
//       name: 'mDataProp_1',
//       value: 'bt'
//     },
//     {
//       name: 'bSortable_1',
//       value: true
//     },
//     {
//       name: 'mDataProp_2',
//       value: 'fbrxm'
//     },
//     {
//       name: 'bSortable_2',
//       value: true
//     },
//     {
//       name: 'mDataProp_3',
//       value: 'fbsj'
//     },
//     {
//       name: 'bSortable_3',
//       value: true
//     },
//     {
//       name: 'mDataProp_4',
//       value: 'hfcs'
//     },
//     {
//       name: 'bSortable_4',
//       value: true
//     },
//     {
//       name: 'mDataProp_5',
//       value: 'zhhfsj'
//     },
//     {
//       name: 'bSortable_5',
//       value: true
//     },
//     {
//       name: 'iSortingCols',
//       value: 0
//     },
//     {
//       name: 'wlkcid',
//       value: `${courseID}`
//     },
//     {
//       name: 'bqid',
//       value: `${boardID}`
//     }
//   ];
//   return generateQueryFormData(data);
// };

export const LEARN_DISCUSSION_DETAIL = (courseID: string, boardID: string, discussionID: string, tabId: number = 1) => {
  return `${LEARN_PREFIX}/f/wlxt/bbs/bbs_tltb/student/viewTlById?wlkcid=${courseID}&id=${discussionID}&tabbh=${tabId}&bqid=${boardID}`;
};

// export const LEARN_QUESTION_LIST_UNANSWERED = () => {
//   return `${LEARN_PREFIX}/b/wlxt/bbs/bbs_tltb/student/wddyPageList`;
// };

export const LEARN_QUESTION_LIST_ANSWERED = (courseID: string) => {
  return `${LEARN_PREFIX}/b/wlxt/bbs/bbs_tltb/student/kcdyList?wlkcid=${courseID}&size=${MAX_SIZE}`;
};

// export const LEARN_QUESTION_LIST_FORM_DATA = (courseID: string) => {
//   const data = [
//     {
//       name: 'sEcho',
//       value: 1
//     },
//     {
//       name: 'iColumns',
//       value: 8
//     },
//     {
//       name: 'sColumns',
//       value: ',,,,,,,'
//     },
//     {
//       name: 'iDisplayStart',
//       value: 0
//     },
//     {
//       name: 'iDisplayLength',
//       value: '30'
//     },
//     {
//       name: 'mDataProp_0',
//       value: 'function'
//     },
//     {
//       name: 'bSortable_0',
//       value: false
//     },
//     {
//       name: 'mDataProp_1',
//       value: 'bt'
//     },
//     {
//       name: 'bSortable_1',
//       value: true
//     },
//     {
//       name: 'mDataProp_2',
//       value: 'fbrxm'
//     },
//     {
//       name: 'bSortable_2',
//       value: true
//     },
//     {
//       name: 'mDataProp_3',
//       value: 'fbsj'
//     },
//     {
//       name: 'bSortable_3',
//       value: true
//     },
//     {
//       name: 'mDataProp_4',
//       value: 'zhhfrxm'
//     },
//     {
//       name: 'bSortable_4',
//       value: true
//     },
//     {
//       name: 'mDataProp_5',
//       value: 'zhhfsj'
//     },
//     {
//       name: 'bSortable_5',
//       value: true
//     },
//     {
//       name: 'mDataProp_6',
//       value: 'function'
//     },
//     {
//       name: 'bSortable_6',
//       value: true
//     },
//     {
//       name: 'mDataProp_7',
//       value: 'function'
//     },
//     {
//       name: 'bSortable_7',
//       value: false
//     },
//     {
//       name: 'iSortCol_0',
//       value: 4
//     },
//     {
//       name: 'sSortDir_0',
//       value: 'desc'
//     },
//     {
//       name: 'iSortingCols',
//       value: 1
//     },
//     {
//       name: 'wlkcid',
//       value: `${courseID}`
//     }
//   ];
//   return generateQueryFormData(data);
// };

export const LEARN_QUESTION_DETAIL = (courseID: string, questionID: string, tabId: number) => {
  return `${LEARN_PREFIX}/f/wlxt/bbs/bbs_kcdy/student/viewDyById?wlkcid=${courseID}&id=${questionID}&tabid=${tabId}`;
};

