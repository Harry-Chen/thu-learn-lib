import { Learn2018Helper } from '../src';

if (window !== undefined) {
    (window as any).learn_2018_helper = Learn2018Helper;
  }
  
if (browser !== undefined) {
    browser.browserAction.onClicked.addListener(() => {
        browser.tabs.create({
        url: 'index.html',
        });
    });
}
