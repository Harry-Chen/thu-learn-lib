# thu-learn-lib

[![Github version](https://img.shields.io/github/package-json/v/Harry-Chen/thu-learn-lib)](https://github.com/Harry-Chen/thu-learn-lib)
[![npm version](https://img.shields.io/npm/v/thu-learn-lib)](https://www.npmjs.com/package/thu-learn-lib)
![npm size](https://img.shields.io/bundlephobia/min/thu-learn-lib)
![npm downloads](https://img.shields.io/npm/dw/thu-learn-lib)

This is a JavaScript library aimed to provide a program-friendly interface of [web Learning of Tsinghua University](https://learn.tsinghua.edu.cn). Only the newest version (learn2018) is supported.

This project is licensed under MIT License.

## Compatibility

The library uses `cross-fetch` and `real-isomorphic-fetch`, which provides cookie and redirection support in both browsers and JS engines (like node).

I don't like polyfill. In case of any syntax problems, just upgrade your browser / Node.

Version 2.0.0 breaks `login` and `logout` API compatibility, which do not return a promise any more.

## Installation

`yarn add thu-learn-lib`

## Build from source

### Library version (for development or Node)

`yarn && yarn run build`

You can find the library version in `lib/`.
It can be used in web development or imported with NodeJS (with all dependencies installed).
It __should not__ be directly used in browsers.

### Bundled version (for browsers or Node)

`yarn && yarn run build-dist`

You can find the bundled version in `dist/`.
You can install it as an unpacked extension in Chrome and click the `t` icon in extension bar, then execute anything you want in the Console of Chrome Developer Tool.
The helper class is attached as `window.Learn2018Helper` in this mode.
Or you can just import `index.js` with NodeJS.

Use `yarn run watch-dist` for watching file changes.

## Usage

### Authentication related (important changes since v1.2.0)

```typescript
import { Learn2018Helper } from 'thu-learn-lib';

// There are three ways of logging in:

// 1. provide a cookie jar with existing cookies (see `tough-cookie-no-native`)
const helper = new Learn2018Helper({cookieJar: jar});
// 2. provide nothing, but invoking login with username and password
const helper = new Learn2018Helper();
// 3. provide a CredentialProvider function, which can be async
const helper = new Learn2018Helper({provider: () => {return {username: 'xxx', password: 'xxx'};}});

// Note that by using the following two methods you may encounter problems like login time out.
// But if you provide a credential provider, the library will retry logging in when failing, automatically resolving the cookie expiry problem.
// So we strongly recommend using this method.


// If you do not provide a cookie jar or CredentialProvider, you must log in manually. Otherwise you do not need to call login explicitly.
try {
    await helper.login('user', 'pass');
} catch (e) {
    // e is a FailReason
}

// You can also take out cookies (e.g. for file download), which will not work in browsers.
console.log(helper.cookieJar);

// Logout if you want, but the cookie jar will not be cleared.
await helper.logout();
```

### Content related

We currently support both student and teacher (or TA) version of web learning. To keep backwards compatibility, the **default behavior of all APIs is to use the student version**. The following APIS needs `CourseType.TEACHER` as the last (optional) parameter to access the teacher version. You **should use them when you are the teacher / TA** of one course, for you will get nothing from the student version in that case.

We do not maintain a global type in `Learn2018Helper` class, for there can be the situation that one can be a student and teacher of the same course simultaneously, on which by using different `CourseType` you can get different results.

* `getCourseList`
* `getNotificationList/getFileList/getHomeworkList/getDiscussionList/getAnsweredQuestionList`
* `getAllContents`

Note that currently fetching homework information from teacher version is **not yet implemented**.

```typescript
import { ContentType } from 'thu-learn-lib/lib/types'

// get ids of all semesters that current account has access to
const semesters = await helper.getSemesterIdList();

// get get semester info
const semester = await helper.getCurrentSemester();

// get courses of this semester
const courses = await helper.getCourseList(semester.id);
const course = courses[0];

// get detail information about the course
const discussions = await helper.getDiscussionList(course.id);
const notifications = await helper.getNotificationList(course.id);
const files = await helper.getFileList(course.id);
const homework = await helper.getHomeworkList(course.id);
const questions = await helper.getAnsweredQuestionList(course.id);

// get content from bunches of courses
// the return type will be { [id: string]: Content }
// where Content = Notification | File | Homework | Discussion | Question
const homeworks = await helper.getAllContents([1, 2, 3], ContentType.HOMEWORK);

// get course calendar in a period
try {
    const calendar = await helper.getCalendar('20191001', '20191201');
} catch (e) {
    // if calendar API returns error, FailReason.INVALID_RESPONSE will be thrown here
    // you might want to check your date format or shrink the range (currently we observe a limit of 29 days)
}
```

According to security strategies (CORS, CORB) of browsers, you might need to run the code in the page context of `https://learn.tsinghua.edu.cn` and `https://id.tsinghua.edu.cn`. The simplest way is to run the code as a browser extension (an example is in `demo/`).

## Typing

See `lib/types.d.ts` for type definitions. Note that `FailReason` represents all strings that will be used as the reason of rejected Promises.

## Testing

Run `yarn test` for testing. It requires your personal credential since we don't have mocks for these APIs. To do this, you must touch a `.env` similar to `template.env` under /test folder.

It's ok if you meet `Timeout * Async callback was not invoked within the 5000ms timeout...` error when running tests, rerun tests may resolve this problem. If you hate this, just add the third argument `timeout` to every testcase `it("should...", async () => void, timeout)` and make sure it's greater than 5000.

## Changelog

* v2.0.1
  * Catch errors returned by calendar API and throw user-defined error

* v2.0.0
  * Use ES2018 in generated library
  * Add `FailReason` to represent all strings that will be used as the reason of rejected Promises
  * `login` and `logout` no longer return Promises

* v1.2.2
  * Fix a function signature to keep compatibility

* v1.2.1
  * Support TA version of many APIs (see above for usage)
  * Fix some wrong URLs in fetched data

* v1.2.0
  * Support getting course calendars from academic.tsinghua.edu.cn (thanks to robertying)
  * Automatic retry logging in when fetching failed and `CredentialProvider` is provided (thanks to mayeths)
  * Add unit tests using `jest` (thanks to mayeths)
  * Filter out `null` values in `getSemesterIdList` API
  * Switch to `https://learn.tsinghua.edu.cn/` from `learn2018` permanently

* v1.1.4
  * Return empty array if any content module is disabled
  * Add `getTACourseList` to get TA's course list (temporarily can not be used by other functions)

* v1.1.3
  * Emergency fix of wrongly decoded base64 string, add `js-base64` back

* v1.1.2
  * Switch to `Base64.js` instead of `js-base64`, which uses evil `eval`

* v1.1.1
  * Decode HTML entities in the title of disscussions (the last one, I promise!)

* v1.1.0
  * Fix an typo in grade level mapping
  * Bump to a new minor version

* v1.0.16 (no v1.0.15 due to some publishing issues)
  * Switch to `yarn`
  * Add parsing of grade levels of homework (A+/A/.../F)

* v1.0.14
  * Add prefix for `attachmentUrl` filed of Notification
  * Deprecate all old versions

* v1.0.13
  * Decode HTML entities whenever possible

* v1.0.12
  * Add `url` for Course
  * Fix `url` for Question (to display correct section name)

* v1.0.11
  * Fix `url` error in Question

* v1.0.10
  * Decode the HTML entities in the `description` field of homework

* v1.0.9
  * Use `entities` to decode HTML entities

* v1.0.8
  * Export type CourseContent

* v1.0.7
  * No change made to code, update README

* v1.0.6
  * Add API to fetching content for a list of courses

* v1.0.5
  * Fix HTML entity replacement.

* v1.0.4
  * No change made to code
  * Remove unused build commands
  * Fix multiple typos in README

* v1.0.3
  * Add real logout API (thank @zhaofeng-shu33)

* v1.0.2
  * Add API to get IDs of all semesters (thank @jiegec)

* v1.0.1
  * Expose CookieJar in helper class
  * Fix some HTML entity decoding problems
  * __Rename of some APIs__ (break compatibility before we have actual users)

* v1.0.0
  * First release
  * Support parsing of notification, homework, file, discussion and __answered__ questions
  
## Projects using this library

* [Harry-Chen/Learn Project](https://github.com/Harry-Chen/Learn-Project)
* [jiegec/clone-learn-tsinghua](https://github.com/jiegec/clone-learn-tsinghua)
* [robertying/learnX](https://github.com/robertying/learnX) (customized fork)
* [Konano/thu-weblearn-tgbot](https://github.com/Konano/thu-weblearn-tgbot)
