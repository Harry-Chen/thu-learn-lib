import { Learn2018Helper } from '../src';

if (window !== undefined) {
    (window as any).Learn2018Helper = Learn2018Helper;
  }
  
if (chrome !== undefined) {
    chrome.browserAction.onClicked.addListener(() => {
        chrome.tabs.create({
        url: 'index.html',
        });
    });
}
