import { Learn2018Helper } from '../src';

if (window !== undefined) {
    (window as any).learn_2018_helper = Learn2018Helper;
  }
  
if (chrome !== undefined) {
    chrome.browserAction.onClicked.addListener(() => {
        chrome.tabs.create({
        url: 'index.html',
        });
    });
}
