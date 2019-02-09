# thu-learn-lib

This is a JavaScript library aimed to provide a program-friendly interface of [web Learning of Tsinghua University](https://leran.tsinghua.edu.cn). Only the newest version (learn2018) is supported.

This project is licensed under MIT License.

## Compatibility

The library uses `cross-fetch` and `real-isomorphic-fetch`, which provides cookie and redirection support in both browsers and JS engines (like node).

I don't like polyfill. In case of any problems, just upgrade your browser / Node.

## Installation

`npm install --save thu-learn-lib`

## Build from source

### Release version

`npm i && npm run build`

You can find the library in `lib/`.

### Test version

`npm i && npm run watch`

You can find the unpacked Chrome extension in `dist/`. Install it in Chrome and click the `t` icon in extension bar, then execute anything you want in the Console of Chrome Developer Tool. The helper class is attached as `window.Learn2018Helper` in this mode.

## Usage

```javascript
import { Learn2018Helper } from 'thu-learn-lib';

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

// get courses of this semester
const courses = await helper.getCourseList(semester.id);
const course = courses[0];

// get detail information about the course
const discussions = await helper.getDiscussionList(course.id);
const notifications = await helper.getNotificationList(course.id);
const files = await helper.getFileList(course.id);
const homework = await helper.getHomeworkList(course.id);
const questions = await helper.getAnsweredQuestionList(course.id);

// logout if you want, which has no effect in browsers
helper.logout();
```

According to security strategies (CORS, CORB) of browsers, you might need to run the code in the page context of `https://learn2018.tsinghua.edu.cn` and `https://id.tsinghua.edu.cn`. The simplest way is to run the code as a browser extension.

## Typing

See `lib/types.d.ts` for type definitions.

## Changelog

- v1.0.2
  - Add API to get IDs of all semesters (thanks @jiegec)

- v1.0.1
  - Expose CookieJar in helper class
  - Fix some HTML entity decoding problems
  - __Rename of some APIs__ (break compatibility before we have actual users)

- v1.0.0
  - First release
  - Support parsing of notification, homework, file, discussion and __answered__ questions
  