# thu-learn-lib

[![Build and Publish](https://github.com/Harry-Chen/thu-learn-lib/workflows/Build%20and%20Publish/badge.svg?event=push)](https://github.com/Harry-Chen/thu-learn-lib/actions?query=workflow%3A%22Build+and+Publish%22)
[![Github version](https://img.shields.io/github/package-json/v/Harry-Chen/thu-learn-lib)](https://github.com/Harry-Chen/thu-learn-lib)
[![npm version](https://img.shields.io/npm/v/thu-learn-lib)](https://www.npmjs.com/package/thu-learn-lib)
![npm size](https://img.shields.io/bundlephobia/min/thu-learn-lib)
![npm downloads](https://img.shields.io/npm/dw/thu-learn-lib)

This is a JavaScript library aimed to provide a program-friendly interface of [web Learning of Tsinghua University](https://learn.tsinghua.edu.cn).

This project is licensed under MIT License.

## Compatibility

The library uses [`node-fetch-cookie-native`](https://github.com/AsakuraMizu/node-fetch-cookie-native), which is a simple wrapper for [node-fetch-native](https://github.com/unjs/node-fetch-native) and [fetch-cookie](https://github.com/valeriangalliat/fetch-cookie), providing cookie and redirection support in both browsers and Node.

In case of any syntax problems, just upgrade your browser / Node, or use any corresponding polyfills.

## Installation

### Node / Bundler

```bash
yarn add thu-learn-lib
```

### Browser (IIFE)

```html
<script src="https://cdn.jsdelivr.net/npm/thu-learn-lib@3"></script>
<!-- or -->
<script src="https://unpkg.com/thu-learn-lib@3"></script>
```

The library is exposed under `window.LearnLib`.

### Browser (ESM)

```html
<script type="module">
  import { Learn2018Helper } from 'https://esm.sh/thu-learn-lib@3';
</script>
```

## Build

```
yarn run build
```

You can find the bundled library in `lib/`.

- `index.js`: ES module entry
- `index.d.ts`: definition file for TypeScript
- `index.global.js{,.map}`: IIFE for use in browser (with source map for debugging)

## Development in browser

```
yarn run dev
```

This will open a dev browser with a testing extension. Click the `t` icon in extension bar, then execute anything you want in the Console of Chrome Developer Tool.
The library is exposed under `window.LearnLib`.

Use `yarn run dev:build` to build the extension that can be installed to your chrome browser manually.

## Usage

### Authentication related (important changes since v1.2.0)

```typescript
import { Learn2018Helper } from 'thu-learn-lib';

// There are three ways of logging in:

// 1. provide a cookie jar with existing cookies (see `tough-cookie`)
const helper = new Learn2018Helper({ cookieJar });
// 2. provide nothing, but invoking login with username and password
const helper = new Learn2018Helper();
// 3. provide a CredentialProvider function, which can be async
const helper = new Learn2018Helper({
  provider: () => ({ username, password }),
});

// Note that by using the following two methods you may encounter problems like login time out.
// But if you provide a credential provider, the library will retry logging in when failing, automatically resolving the cookie expiry problem.
// So we strongly recommend using this method.

// If you do not provide a cookie jar or CredentialProvider, you must log in manually. Otherwise you do not need to call login explicitly.
try {
  await helper.login(username, password);
} catch (e) {
  // e is a FailReason
}

// You can also take out cookies (e.g. for file download), which will not work in browsers.
console.log(helper.cookieJar);

// Logout if you want, but the cookie jar will not be cleared.
await helper.logout();
```

### Content related

We currently support both student and teacher (or TA) version of web learning. To keep backwards compatibility, the **default behavior of all APIs is to use the student version**. The following APIs needs `CourseType.TEACHER` as the last (optional) parameter to access the teacher version. You **should use them when you are the teacher / TA** of one course, for you will get nothing from the student version in that case.

We do not maintain a global type in `Learn2018Helper` class, for there can be the situation that one can be a student and teacher of the same course simultaneously, on which by using different `CourseType` you can get different results.

- `getCourseList`
- `getNotificationList/getFileList/getHomeworkList/getDiscussionList/getAnsweredQuestionList`
- `getAllContents`

Note that currently fetching homework information from teacher version is **partially implemented**.

```typescript
import { ContentType, ApiError } from 'thu-learn-lib';

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
  const error = e as ApiError;
  // check e.reason and e.extra for information
  // you might want to check your date format or shrink the range (currently we observe a limit of 29 days)
}
```

According to security strategies (CORS, CORB) of browsers, you might need to run the code in the page context of `https://learn.tsinghua.edu.cn` and `https://id.tsinghua.edu.cn`. The simplest way is to run the code in Node.js or in [browser extension](#development-in-browser).

## Typing

See `src/types.ts` for type definitions. Note that `ApiError` represents the type that will be used in rejected Promises.

## Testing

Run `yarn test` for testing. It requires your personal credential since we don't have mocks for these APIs. To do this, you must touch a `.env` similar to `template.env` under /test folder.

It's ok if you meet `Timeout * Async callback was not invoked within the 5000ms timeout...` error when running tests, rerun tests may resolve this problem. If you hate this, just add the third argument `timeout` to every testcase `it("should...", async () => void, timeout)` and make sure it's greater than 5000.

## Changelog

- v4.1.0
  - Add late submission deadline, missing completion and submission types for student homework ([#66](https://github.com/Harry-Chen/thu-learn-lib/pull/66) by @robertying)
  - **(BREAKING)** Correct spelling of members of `HomeworkCompletionType`
  - Add notification expiration time ([#67](https://github.com/Harry-Chen/thu-learn-lib/pull/67) by @robertying)
  - Use the new API to get notification list and homework list
  - Lock `entities` to 4.5.0 to reduce binary size
  - Add excellent homework listing ([#69](https://github.com/Harry-Chen/thu-learn-lib/pull/69) by @robertying)
  - Add support for parsing excellent homework page
  - Fix HTML entities decoding for parsing homework pages (see [Learn-Helper#167](https://github.com/Harry-Chen/Learn-Helper/issues/167))
- v4.0.0
  - Upgrade cheerio to 1.0
  - Add support for questionnaire (add `getQuestionnaireList` API and some public types)
  - Add support for managing favorite items
  - Add support for sorting courses (i.e. manage the order on web learning)
  - Add support for managing comments on content (e.g. files, notifications)
  - (*BREAKING CHANGE*) Deprecate usage of `studentHomeworkId` 
- v3.2.1
  - Upgrade to eslint v9
  - Add `setCSRFToken` function to manually reuse previous (maybe valid) token and prevent unnecessary re-login (see [#49](https://github.com/Harry-Chen/thu-learn-lib/issues/49))  
    *Note:* To use this feature in Node.js, `cookieJar` should also be reused, otherwise it will not work. (not the case in browser env)
  - Fix `CourseContent` type: default value for type param `T` (breaking change introduced in [#53](https://github.com/Harry-Chen/thu-learn-lib/issues/53))
  - *(Breaking...?)* Rename `File.id2` added in previous version to actual `id` and previously used `id` to  `fileId` (see [#60](https://github.com/Harry-Chen/thu-learn-lib/issues/60))
  - Upgrade dependencies
- v3.2.0
  - Support file categories (see [#57](https://github.com/Harry-Chen/thu-learn-lib/issues/57)):
    - Add `FileCategory` type and optional `category` field in `File` type
    - Now `getFileList` function automatically fetches all categories and saves them in each `File` object
    - Add `getFileCategoryList` function to fetch file categories
    - Add `getFileListByCategory` function to get file list by category
  - Fix content of file download url and visit count in for `CourseType.TEACHER`
- v3.1.4
  - Allow and check for undefined credential in login (see [#52](https://github.com/Harry-Chen/thu-learn-lib/issues/52))
  - Discriminate `getAllContents` return type based on input content type (see [#53](https://github.com/Harry-Chen/thu-learn-lib/issues/53))
  - Use `searchParams` to set csrf token & add csrf token to `getCalendar` (see [#54](https://github.com/Harry-Chen/thu-learn-lib/issues/54))
  - Update bunches of dependencies
- v3.1.3
  - Fix empty time and location of course (see [#145](https://github.com/Harry-Chen/Learn-Helper/issues/145))
- v3.1.2
  - Fix empty course name parsing
  - (Maybe BEARKING) `Homework.gradeLevel` changed to `HomeworkGradeLevel` (a string enum) for better i18n
  - Fix get language
- v3.1.1
  - Remove `fetch-cookie` dependency in browser build, reducing bundle size
  - Add `getUserInfo` interface (#48, thanks to @robertying)
- v3.1.0
  - **Refactor**:
    - Build tool: `webpack` -> `tsup`
    - Development tool: `webpack` -> `vite`
    - Test tool: `jest` -> `vitest`
    - Fetch:
      - `cross-fetch` -> `node-fetch-native` (Node.js now has native `fetch`)
      - `real-isomorphic-fetch` -> `fetch-cookie` (`fetch-cookie` now can handle redirects)
      - `tough-cookie-no-native` -> `tough-cookie` (`tough-cookie` is now native)
    - **(BREAKING)** Updated library output structure, now everything exported in index, cannot use `/lib` or `/lib/types` anymore
  - Added:
    - Submit homework
    - Language switching and related behaviour
    - Get TA's homework info (partial support)
  - Fixed:
    - **Web Learning API update**
    - Decode course name
  - Other:
    - Move `fake-parse5` to [a seperate library](https://github.com/AsakuraMizu/fake-parse5)
- v3.0.4
  - No feature changes, upgrade dependencies
- v3.0.3
  - No feature changes, upgrade dependencies
- v3.0.2
  - No feature changes, upgrade dependencies to mitigate security vulnerabilities
- v3.0.1
  - Add config `generatePreviewUrlForFirstPage` to switch preview URL type (default to `true`)
- v3.0.0
  - (BREAKING CHANGE) Redesign exported types, use `RemoteFile` to represent a file on Web Learning
  - Add support for parsing attachment sizes & preview URLs in homework & notifications (Harry-Chen/Learn-Helper#109)
- v2.5.4
  - Fix (sometimes) incorrect publish time of notifications (#36)
- v2.5.3
  - Add `allowFailure` in `getAllContents` for convenience
- v2.5.2
  - Allow retrieving CSRF token via `getCSRFToken` method
  - Export `addCSRFTokenToUrl` function as API for convenience
- v2.5.1
  - No feature change, add support for direct `import` in Node.js
- v2.5.0
  - Add transparent support for CSRF token (recently deployed) in all Web Learning APIs
- v2.4.2
  - No functionality change, bump some dependencies to mitigate security concerns
- v2.4.1
  - Replace `parse5` with `htmlparser2` in Cheerio and remove it from bundled file (replaced with `src/fake-parse5`)
  - Replace TSLint with ESLint
- v2.4.0
  - Upgrade to TypeScript 4.1 & Webpack 5.15
  - Add more null checking for disabled functionalities (see [xxr3376/Learn-Project#90](https://github.com/xxr3376/Learn-Project/issues/90))
- v2.3.2
  - Fix a problem in `v2.3.1` (not published) and `v2.3.0` that build output fails to be uploaded to npm
- v2.3.0
  - Refine error detecting & handling by using `ApiError` in usage of `Promise.reject` (might be a breaking change)
- v2.2.3
  - Add workaround for some strange behaviors in teacher mode (thanks to @MashPlant)
- v2.2.2
  - Return error when API return any non-success result
- v2.2.1
  - Fix a missing parameter in `previewUrl`
- v2.2.0
  - Use ECMAScript private fields in `Learn2018Helper` class to protect credentials
  - Add `previewUrl` to `File`
  - Upgrade to TypeScript 3.8.2
- v2.1.2
  - Fix problem in invoking JSONP callback (because some engines might do JIT)
- v2.1.1
  - Remove usage of `eval` in `getCalendar`
- v2.1.0
  - Catch errors returned by calendar API and throw user-defined error
  - Add documentation for all public APIs
- v2.0.0
  - Use ES2018 in generated library
  - Add `FailReason` to represent all strings that will be used as the reason of rejected Promises
  - `login` and `logout` no longer return Promises
- v1.2.2
  - Fix a function signature to keep compatibility
- v1.2.1
  - Support TA version of many APIs (see above for usage)
  - Fix some wrong URLs in fetched data
- v1.2.0
  - Support getting course calendars from academic.tsinghua.edu.cn (thanks to robertying)
  - Automatic retry logging in when fetching failed and `CredentialProvider` is provided (thanks to mayeths)
  - Add unit tests using `jest` (thanks to mayeths)
  - Filter out `null` values in `getSemesterIdList` API
  - Switch to `https://learn.tsinghua.edu.cn/` from `learn2018` permanently
- v1.1.4
  - Return empty array if any content module is disabled
  - Add `getTACourseList` to get TA's course list (temporarily can not be used by other functions)
- v1.1.3
  - Emergency fix of wrongly decoded base64 string, add `js-base64` back
- v1.1.2
  - Switch to `Base64.js` instead of `js-base64`, which uses evil `eval`
- v1.1.1
  - Decode HTML entities in the title of disscussions (the last one, I promise!)
- v1.1.0
  - Fix an typo in grade level mapping
  - Bump to a new minor version
- v1.0.16 (no v1.0.15 due to some publishing issues)
  - Switch to `yarn`
  - Add parsing of grade levels of homework (A+/A/.../F)
- v1.0.14
  - Add prefix for `attachmentUrl` filed of Notification
  - Deprecate all old versions
- v1.0.13
  - Decode HTML entities whenever possible
- v1.0.12
  - Add `url` for Course
  - Fix `url` for Question (to display correct section name)
- v1.0.11
  - Fix `url` error in Question
- v1.0.10
  - Decode the HTML entities in the `description` field of homework
- v1.0.9
  - Use `entities` to decode HTML entities
- v1.0.8
  - Export type CourseContent
- v1.0.7
  - No change made to code, update README
- v1.0.6
  - Add API to fetching content for a list of courses
- v1.0.5
  - Fix HTML entity replacement.
- v1.0.4
  - No change made to code
  - Remove unused build commands
  - Fix multiple typos in README
- v1.0.3
  - Add real logout API (thank @zhaofeng-shu33)
- v1.0.2
  - Add API to get IDs of all semesters (thank @jiegec)
- v1.0.1
  - Expose CookieJar in helper class
  - Fix some HTML entity decoding problems
  - **Rename of some APIs** (break compatibility before we have actual users)
- v1.0.0
  - First release
  - Support parsing of notification, homework, file, discussion and **answered** questions

## Projects using this library

- [Harry-Chen/Learn Project](https://github.com/Harry-Chen/Learn-Project)
- [jiegec/clone-learn-tsinghua](https://github.com/jiegec/clone-learn-tsinghua)
- [robertying/learnX](https://github.com/robertying/learnX) (customized fork)
- [Konano/thu-weblearn-tgbot](https://github.com/Konano/thu-weblearn-tgbot)
- [Starrah/THUCourseHelper](https://github.com/Starrah/THUCourseHelper)
