# thu-learn2018-lib

This is a JavaScript library aimed to provide a program-friendly interface of [learn 2018 of Tsinghua University](https://leran2018.tsinghua.edu.cn).

This project is licensed under MIT License.

## Compatibility

Since the library itself does not handle cookies, it can only be used in browsers.

I don't like polyfill. Just upgrade your browser, then problems will go away.

## Installation

`npm install --save thu-learn2018-lib`

## Build from source

`npm i && npm run build`

You can find the library in `lib/`.

## Usage

```ecmascript 6
import { Learn2018Helper } from 'thu-learn2018-lib';

const helper = new Learn2018Helper('user', 'pass');

// all following methods are async

// first login
const loginSuccess = await helper.login();

// get get semester info
const semester = await helper.getCurrentSemester();

// get courses of this semester
const courses = await helper.getCourseForSemester(semester.id);

// get detail information about the course
const discussions = await helper.getDiscussionList(courses.id);
const notifications = await helper.getNotificationList(courses.id);
const files = await helper.getFileList(courses.id);
const homework = await helper.getHomeworkList(courses.id);
const questions = await helper.getQuestionList(courses.id);

// logout if you want
helper.logout();
```

Typing

See `lib/types.d.ts` for type definitions.