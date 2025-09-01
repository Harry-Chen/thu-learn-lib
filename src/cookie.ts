/**
 * A very simple fetch wrapper that supports cookie management.
 *
 * This is used to replace tough-cookies and node-fetch-cookies which are heavy and unneeded in browser context.
 *
 * Adapted from <https://github.com/valeriangalliat/fetch-cookie/blob/c5fb451d98ce94f0568c9f059f7913d79b16c185/src/index.ts>.
 */

import type { Fetch } from './types';

type CookieJar = {
  [domain: string]: {
    [key: string]: string;
  };
};

const redirectStatus = new Set([301, 302, 303, 307, 308]);

export function makeFetch(): Fetch {
  if (typeof window === 'undefined') {
    const jar: CookieJar = {};

    async function handleRedirect(init: RequestInit, resp: Response): Promise<Response> {
      if (!redirectStatus.has(resp.status)) {
        return resp;
      }

      const locationUrl = resp.headers.get('location');
      if (locationUrl === null) {
        return resp;
      }

      const requestUrl = resp.url;
      const redirectUrl = new URL(locationUrl, requestUrl).toString();

      const headers = new Headers(init.headers);
      headers.delete('host');

      const removeBody =
        resp.status === 303 || ((resp.status === 301 || resp.status === 302) && init.method === 'POST');
      if (removeBody) headers.delete('content-length');

      return await fetchCookie(redirectUrl, {
        ...init,
        headers,
        ...(removeBody && {
          method: 'GET',
          body: undefined,
        }),
      });
    }

    async function fetchCookie(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = input instanceof URL ? input : new URL(typeof input === 'string' ? input : input.url);
      const cookie = Object.entries(jar[url.hostname] ?? {})
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');

      const headers = new Headers(init?.headers);
      headers.set('cookie', cookie);

      init = { ...init, redirect: 'manual', headers };
      const resp = await fetch(input, init);

      resp.headers.getSetCookie().forEach((cookie) => {
        // extract cookie name and value, ignoring path and other attributes
        const [nameValue] = cookie.split(';');
        const [name, value] = nameValue.split('=');
        jar[url.hostname] = jar[url.hostname] || {};
        jar[url.hostname][name] = value;
      });

      return await handleRedirect(init, resp);
    }

    return fetchCookie;
  } else {
    return (input, init) => fetch(input, { ...init, credentials: 'include' });
  }
}
