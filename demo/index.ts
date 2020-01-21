import { Learn2018Helper } from '../src';

function rewriteCookie(e: any) {
  e.responseHeaders.forEach((header: any) => {
    if (header.name.toLowerCase() === 'set-cookie') header.value += '; SameSite=None; Secure';
    else if (header.name.toLowerCase() === 'location') {
      if (header.value.indexOf('http:') === 0) header.value = 'https:' + header.value.substr(5);
    }
  });

  return { responseHeaders: e.responseHeaders };
}

const opts = ['blocking', 'responseHeaders'] as browser.webRequest.OnHeadersReceivedOptions[];

if (navigator.userAgent.indexOf('Chrome') !== -1) {
  opts.push('extraHeaders' as any);
}

if (!browser.webRequest.onHeadersReceived.hasListener(rewriteCookie)) {
  browser.webRequest.onHeadersReceived.addListener(
    rewriteCookie,
    {
      urls: ['https://learn.tsinghua.edu.cn/*'],
    },
    opts,
  );
}

browser.browserAction.onClicked.addListener(() => {
  browser.tabs.create({
    url: 'index.html',
  });
});

(window as any).Learn2018Helper = Learn2018Helper;
