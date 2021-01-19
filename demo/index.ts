import { Learn2018Helper } from '../src';
import { ContentType, CourseType } from '../src/types';

browser.browserAction.onClicked.addListener(() => {
  browser.tabs.create({
    url: 'index.html',
  });
});

const helper = {
  Learn2018Helper,
  ContentType,
  CourseType,
};

(window as any).LearnHelper = helper;
