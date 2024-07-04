import type { GlobalSetupContext } from 'vitest/node';
import { CourseType, Learn2018Helper } from '../src';
import { config } from './config';

/**
 * find suitable semester and course for testing or read from environment variables
 * this also works like a gate for skipping tests if no network connection or `OPENSSL_CONF` not correctly configured
 */
export default async function setup({ provide }: GlobalSetupContext) {
  const h = new Learn2018Helper(config);

  await h.login();

  const findCourse = async (semesterId: string, courseType: CourseType) => {
    const courses = await h.getCourseList(semesterId, courseType);
    return courses.length > 0 ? courses[0].id : undefined;
  };

  let semesterTester = process.env.S;
  let courseTester = process.env.C;
  let semesterTATester = process.env.ST;
  let courseTATester = process.env.CT;

  if (!semesterTester) {
    const semesters = await h.getSemesterIdList();
    for (const semester of semesters) {
      const course = await findCourse(semester, CourseType.STUDENT);
      if (course) {
        semesterTester = semester;
        courseTester = course;
        break;
      }
    }
    semesterTester = semesterTester || semesters[0];
  }
  if (!courseTester) {
    courseTester = await findCourse(semesterTester, CourseType.STUDENT);
  }
  provide('S', semesterTester);
  provide('C', courseTester);

  if (!semesterTATester) {
    const semesters = await h.getSemesterIdList();
    for (const semester of semesters) {
      const course = await findCourse(semester, CourseType.TEACHER);
      if (course) {
        semesterTATester = semester;
        courseTATester = course;
        break;
      }
    }
    semesterTATester = semesterTATester || semesters[0];
  }
  if (!courseTATester) {
    courseTATester = await findCourse(semesterTATester, CourseType.TEACHER);
  }
  provide('ST', semesterTATester);
  provide('CT', courseTATester);

  await h.logout();
}

declare module 'vitest' {
  export interface ProvidedContext {
    S: string;
    C: string | undefined;
    ST: string;
    CT: string | undefined;
  }
}
