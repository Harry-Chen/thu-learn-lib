import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Language, Learn2018Helper } from '../src';
import { config } from './config';

describe('helper interaction', () => {
  const h = new Learn2018Helper(config);

  beforeAll(async () => {
    await h.login();
  });
  afterAll(async () => {
    await h.logout();
  });

  it('should set lang', async () => {
    await h.login();
    const pre_lang = h.getCurrentLanguage();
    const toset_lang = pre_lang === Language.EN ? Language.ZH : Language.EN;
    await h.setLanguage(toset_lang);
    expect(h.getCurrentLanguage()).toBe(toset_lang);

    await h.logout();
    await h.login();
    expect(h.getCurrentLanguage()).toBe(toset_lang);

    await h.setLanguage(pre_lang);
  });
});
