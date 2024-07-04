import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { ContentType, Language, Learn2018Helper } from '../src';
import { config } from './config';

describe('helper interaction', () => {
  const h = new Learn2018Helper(config);

  beforeAll(async () => {
    await h.login();
  });
  afterAll(async () => {
    await h.logout();
  });

  const courseTester = inject('C');

  it('should set lang', async () => {
    const pre_lang = h.getCurrentLanguage();
    const toset_lang = pre_lang === Language.EN ? Language.ZH : Language.EN;
    await h.setLanguage(toset_lang);
    expect(h.getCurrentLanguage()).toBe(toset_lang);
    await h.setLanguage(pre_lang);
  });

  it('should operate on favorites correctly', async () => {
    const oldFavorites = await h.getFavorites();
    expect(oldFavorites).toBeDefined();
    expect(oldFavorites.length).toBeGreaterThanOrEqual(0);

    if (courseTester) {
      const noti = (await h.getNotificationList(courseTester)).find((n) => !oldFavorites.find((f) => f.id === n.id));
      const hw = (await h.getHomeworkList(courseTester)).find((hw) => !oldFavorites.find((f) => f.id === hw.id));
      const file = (await h.getFileList(courseTester)).find((f) => !oldFavorites.find((fav) => fav.id === f.id));
      const discuss = (await h.getDiscussionList(courseTester)).find((d) => !oldFavorites.find((f) => f.id === d.id));
      if (noti) await h.addToFavorites(ContentType.NOTIFICATION, noti.id);
      if (hw) await h.addToFavorites(ContentType.HOMEWORK, hw.studentHomeworkId);
      if (file) await h.addToFavorites(ContentType.FILE, file.id);
      if (discuss) await h.addToFavorites(ContentType.DISCUSSION, discuss.id);
      const pinned = noti || hw || file || discuss;
      if (pinned) await h.pinFavoriteItem(pinned.id);

      const newFavorites = await h.getFavorites();
      const addedFavorites = newFavorites.filter((f) => !oldFavorites.find((of) => of.id === f.id));

      if (pinned) {
        const i = addedFavorites.findIndex((f) => f.id === pinned.id);
        expect(i).toBe(0);
        expect(addedFavorites[i].pinned).toBeTruthy();
        await h.unpinFavoriteItem(pinned.id);
      }

      if (noti) {
        expect(addedFavorites.find((f) => f.type === ContentType.NOTIFICATION && f.id === noti.id)).toBeDefined();
        await h.removeFromFavorites(noti.id);
      }
      if (hw) {
        expect(
          addedFavorites.find((f) => f.type === ContentType.HOMEWORK && f.id === hw.studentHomeworkId),
        ).toBeDefined();
        await h.removeFromFavorites(hw.studentHomeworkId);
      }
      if (file) {
        expect(addedFavorites.find((f) => f.type === ContentType.FILE && f.id === file.id)).toBeDefined();
        await h.removeFromFavorites(file.id);
      }
      if (discuss) {
        expect(addedFavorites.find((f) => f.type === ContentType.DISCUSSION && f.id === discuss.id)).toBeDefined();
        await h.removeFromFavorites(discuss.id);
      }
    }
  });
});
