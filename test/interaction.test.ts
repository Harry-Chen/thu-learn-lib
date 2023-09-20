import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as dotenv from 'dotenv';
import { Language, Learn2018Helper } from '../src';

dotenv.config({ path: 'test/.env' });
const U = process.env.U!; // username
const P = process.env.P!; // password
const configs = { provider: () => ({ username: U, password: P }) };

describe('helper interaction', () => {
  let helper: Learn2018Helper;

  beforeAll(async () => {
    helper = new Learn2018Helper(configs);
  });
  afterAll(async () => {
    await helper.logout();
  });

  it('should set lang', async () => {
    await helper.login();
    const pre_lang = helper.getCurrentLanguage();
    const toset_lang = pre_lang === Language.EN ? Language.ZH : Language.EN;
    await helper.setLanguage(toset_lang);
    expect(helper.getCurrentLanguage()).toBe(toset_lang);

    await helper.logout();
    await helper.login();
    expect(helper.getCurrentLanguage()).toBe(toset_lang);

    await helper.setLanguage(pre_lang);
  });
});
