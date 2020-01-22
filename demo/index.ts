import { Learn2018Helper } from '../src';

browser.browserAction.onClicked.addListener(() => {
  browser.tabs.create({
    url: 'index.html',
  });
});

(window as any).Learn2018Helper = Learn2018Helper;
