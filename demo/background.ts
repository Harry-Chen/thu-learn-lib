import browser from 'webextension-polyfill';

browser.action.onClicked.addListener(() => {
  browser.tabs.create({
    url: 'demo/index.html',
  });
});
