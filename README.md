# thu-learn-lib

This is a JavaScript library aimed to provide a program-friendly interface of [web Learning of Tsinghua University](https://learn.tsinghua.edu.cn). Only the newest version (learn2018) is supported.

This project is licensed under MIT License.

## Compatibility

The library uses `cross-fetch` and `real-isomorphic-fetch`, which provides cookie and redirection support in both browsers and JS engines (like node).

I don't like polyfill. In case of any problems, just upgrade your browser / Node.

## Installation

`yarn add thu-learn-lib`

## Build from source

### Library version (for development or Node)

`yarn && yarn run build-lib`

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

```javascript
import { Learn2018Helper } from 'thu-learn-lib';
import { ContentType } from 'thu-learn-lib/lib/types'

// in JS engines, each instance owns different cookie jars
const helper = new Learn2018Helper();

// all following methods are async

// first login
const loginSuccess = await helper.login('user', 'pass');
// take out cookies (e.g. for file download), which will not work in browsers
// its type is require('tough-cookie-no-native').CookieJar
console.log(helper.cookieJar);

// get ids of all semesters that current account has access to
const semesters = await helper.getSemesterIdList();

// get get semester info
const semester = await helper.getCurrentSemester();

// get courses of this semester (learned or assisted)
const courses = await helper.getCourseList(semester.id);
const TAcourses = await helper.getTACourseList(semester.id);
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

// logout if you want, the cookie jar will be cleared in Node
const logoutSuccess = await helper.logout();
```

According to security strategies (CORS, CORB) of browsers, you might need to run the code in the page context of `https://learn2018.tsinghua.edu.cn` and `https://id.tsinghua.edu.cn`. The simplest way is to run the code as a browser extension.

## Typing

See `lib/types.d.ts` for type definitions.

## Changelog

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
  - __Rename of some APIs__ (break compatibility before we have actual users)

- v1.0.0
  - First release
  - Support parsing of notification, homework, file, discussion and __answered__ questions
  
## Projects using this library

- [Harry-Chen/Learn Project](https://github.com/Harry-Chen/Learn-Project)
- [jiegec/clone-learn-tsinghua](https://github.com/jiegec/clone-learn-tsinghua)
