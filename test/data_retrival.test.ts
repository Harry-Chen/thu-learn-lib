import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { CourseType, Language, Learn2018Helper } from '../src';
import { config } from './config';

describe('helper data retrival', () => {
  const h = new Learn2018Helper(config);

  beforeAll(async () => {
    await h.login();
  });
  afterAll(async () => {
    await h.logout();
  });

  const semesterTester = inject('S');
  const courseTester = inject('C');
  const semesterTATester = inject('ST');
  const courseTATester = inject('CT');

  it('should get correct language', async () => {
    const lang = h.getCurrentLanguage();
    expect(lang).toBeDefined();
    const courses = await h.getCourseList(semesterTester);
    courses.forEach((course) => {
      expect(course.name).toBe(lang === Language.EN ? course.englishName : course.chineseName);
    });
  });

  it('should get semesterIdList correctly', async () => {
    const semesters = await h.getSemesterIdList();
    expect(Array.isArray(semesters)).toEqual(true);
    for (const semester of semesters) {
      expect(typeof semester).toBe('string');
    }
    expect(semesters).toContain(semesterTester);
    expect(semesters).toContain(semesterTATester);
  });

  it('should get currentSemester correctly', async () => {
    const currSemester = await h.getCurrentSemester();
    expect(currSemester).not.toBeUndefined();
    expect(currSemester).not.toBeNull();
  });

  it('should get courseList correctly', async () => {
    const courses = await h.getCourseList(semesterTester);
    expect(courses.length).toBeGreaterThanOrEqual(0);
    if (courses.length > 0) {
      expect(courses.map((c) => c.id)).toContain(courseTester);
    }
  });

  it('should get TAcourses correctly', async () => {
    const courses = await h.getCourseList(semesterTATester, CourseType.TEACHER);
    expect(courses.length).toBeGreaterThanOrEqual(0);
    if (courses.length > 0) {
      expect(courses.map((c) => c.id)).toContain(courseTATester);
    }
  });

  it('should get contents (or throw on unimplemented function) correctly', async () => {
    if (courseTester !== undefined) {
      expect((await h.getHomeworkList(courseTester)).length).toBeGreaterThanOrEqual(0);
      expect((await h.getDiscussionList(courseTester)).length).toBeGreaterThanOrEqual(0);
      expect((await h.getNotificationList(courseTester)).length).toBeGreaterThanOrEqual(0);
      expect((await h.getFileList(courseTester)).length).toBeGreaterThanOrEqual(0);
      expect((await h.getAnsweredQuestionList(courseTester)).length).toBeGreaterThanOrEqual(0);
    }
    if (courseTATester !== undefined) {
      // expect((await h.getDiscussionList(courseTATester, CourseType.TEACHER)).length).toBeGreaterThanOrEqual(0);
      // expect((await h.getNotificationList(courseTATester, CourseType.TEACHER)).length).toBeGreaterThanOrEqual(0);
      expect((await h.getFileList(courseTATester, CourseType.TEACHER)).length).toBeGreaterThanOrEqual(0);
      // expect((await h.getAnsweredQuestionList(courseTATester, CourseType.TEACHER)).length).toBeGreaterThanOrEqual(0);
      expect((await h.getHomeworkList(courseTATester, CourseType.TEACHER)).length).toBeGreaterThanOrEqual(0);
    }
  });

  it('should get file categories and list correctly', async () => {
    if (courseTester !== undefined) {
      const categories = await h.getFileCategoryList(courseTester);
      expect(categories.length).toBeGreaterThanOrEqual(0);
      expect((await h.getFileListByCategory(courseTester, categories[0].id)).length).toBeGreaterThanOrEqual(0);
    }
    if (courseTATester !== undefined) {
      const categories = await h.getFileCategoryList(courseTATester, CourseType.TEACHER);
      expect(categories.length).toBeGreaterThanOrEqual(0);
      expect(
        (await h.getFileListByCategory(courseTATester, categories[0].id, CourseType.TEACHER)).length,
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it('should get user info correctly', async () => {
    const userInfo = await h.getUserInfo();
    expect(userInfo).toBeDefined();

    expect(userInfo.name).toBeTruthy();
    expect(typeof userInfo.name).toBe('string');

    expect(userInfo.department).toBeTruthy();
    expect(typeof userInfo.department).toBe('string');
  });

  it('should get calendar items correctly and throw on invalid response', async () => {
    expect((await h.getCalendar('20210501', '20210530')).length).toBeGreaterThanOrEqual(0);
    // await expect(h.getCalendar('gg', 'GG')).rejects.toHaveProperty('reason', FailReason.INVALID_RESPONSE);
  });
});
