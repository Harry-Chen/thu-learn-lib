import { Learn2018Helper } from "../src"
import * as dotenv from "dotenv"
import { FailReason, CourseType } from "../src/types";

dotenv.config({ path: "test/.env" })
const U = process.env.U!;  // username
const P = process.env.P!;  // password
//                     ^ note the exclamation mark here
// prevent TS2322: Type 'string | undefined' is not assignable to type 'string'.


describe('helper data retrival', () => {
  let helper: Learn2018Helper;
  let semesterTester: string;
  let courseTester: string;

  beforeAll(async () => {
    const _h = new Learn2018Helper();
    await _h.login(U, P);
    const currSemester = await _h.getCurrentSemester();
    const courses = await _h.getCourseList(currSemester.id);
    expect(courses.length).toBeGreaterThan(0);
    semesterTester = currSemester.id;
    courseTester = courses[0].id;
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

  it("should throw on unimplemented functionality", async () => {
    await expect(helper.getHomeworkList(courseTester, CourseType.TEACHER)).rejects.toEqual(FailReason.NOT_IMPLEMENTED);
  })

  it("should get TAcourses correctly", async () => {
    expect("TobeDone").toEqual("TobeDone");
  })

  it("should get discussionList correctly", async () => {
    expect("TobeDone").toEqual("TobeDone");
  })

  it("should get NotificationList correctly", async () => {
    expect("TobeDone").toEqual("TobeDone");
  })

  it("should get FileList correctly", async () => {
    expect("TobeDone").toEqual("TobeDone");
  })

  it("should get HomeworkList correctly", async () => {
    expect("TobeDone").toEqual("TobeDone");
  })

  it("should get AnsweredQuestionList correctly", async () => {
    expect("TobeDone").toEqual("TobeDone");
  })

})
