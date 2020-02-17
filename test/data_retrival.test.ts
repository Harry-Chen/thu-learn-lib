import { Learn2018Helper } from "../src"
import * as dotenv from "dotenv"
import { FailReason, CourseType, ContentType } from "../src/types";

dotenv.config({ path: "test/.env" })
const U = process.env.U!;  // username
const P = process.env.P!;  // password


describe('helper data retrival', () => {
  let helper: Learn2018Helper;
  let semesterTester: string;
  let courseTester: string;
  let courseTATester: string;

  beforeAll(async () => {
    const _h = new Learn2018Helper();
    await _h.login(U, P);
    const currSemester = await _h.getCurrentSemester();
    const courses = await _h.getCourseList(currSemester.id);
    expect(courses.length).toBeGreaterThan(0);
    const taCourses = await _h.getCourseList(currSemester.id, CourseType.TEACHER);
    expect(taCourses.length).toBeGreaterThanOrEqual(0);
    semesterTester = currSemester.id;
    courseTester = courses[0].id;
    if (taCourses.length > 0) {
      courseTATester = taCourses[0].id;
    }
  })
  beforeAll(async () => {
    helper = new Learn2018Helper();
    await helper.login(U, P);
  })
  afterAll(async () => {
    await helper.logout();
  })

  it("should get semesterIdList correctly", async () => {
    const semesters = await helper.getSemesterIdList();
    expect(Array.isArray(semesters)).toEqual(true);
    for (const semester of semesters) {
      expect(typeof semester).toBe("string");
    }
    expect(semesters[0]).toEqual(semesterTester);
  })

  it("should get currentSemester correctly", async () => {
    const currSemester = await helper.getCurrentSemester();
    expect(currSemester).not.toBeUndefined();
    expect(currSemester).not.toBeNull();
    expect(currSemester.id).toEqual(semesterTester);
  })

  it("should get courseList correctly", async () => {
    const courses = await helper.getCourseList(semesterTester);
    expect(courses.length).toBeGreaterThan(0);
    expect(courses[0].id).toEqual(courseTester);
  })

  it("should get TAcourses correctly", async () => {
    const courses = await helper.getCourseList(semesterTester, CourseType.TEACHER);
    expect(courses.length).toBeGreaterThanOrEqual(0);
    if (courses.length > 0) {
      expect(courses[0].id).toEqual(courseTATester);
    }
  })

  it("should get contents (or throw on unimplemented function) correctly", async () => {
    expect((await helper.getHomeworkList(courseTester)).length).toBeGreaterThanOrEqual(0);
    expect((await helper.getDiscussionList(courseTester)).length).toBeGreaterThanOrEqual(0);
    expect((await helper.getNotificationList(courseTester)).length).toBeGreaterThanOrEqual(0);
    expect((await helper.getFileList(courseTester)).length).toBeGreaterThanOrEqual(0);
    expect((await helper.getAnsweredQuestionList(courseTester)).length).toBeGreaterThanOrEqual(0);
    if (courseTATester !== undefined) {
      expect((await helper.getDiscussionList(courseTATester, CourseType.TEACHER)).length).toBeGreaterThanOrEqual(0);
      expect((await helper.getNotificationList(courseTATester, CourseType.TEACHER)).length).toBeGreaterThanOrEqual(0);
      expect((await helper.getFileList(courseTATester, CourseType.TEACHER)).length).toBeGreaterThanOrEqual(0);
      expect((await helper.getAnsweredQuestionList(courseTATester, CourseType.TEACHER)).length).toBeGreaterThanOrEqual(0);
      await expect(helper.getHomeworkList(courseTATester, CourseType.TEACHER)).rejects.toEqual(FailReason.NOT_IMPLEMENTED);
    }
  })

  it("should get calendar items correctly and throw on invalid response", async () => {
    expect((await helper.getCalendar('20200217', '20200228')).length).toBeGreaterThanOrEqual(0);
    await expect(helper.getCalendar('gg', 'GG')).rejects.toEqual(FailReason.INVALID_RESPONSE);
  })


})
