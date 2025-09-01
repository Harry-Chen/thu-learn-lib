import { describe, it, expect } from 'vitest';
import { Learn2018Helper, FailReason } from '../src';
import { U, P, F } from './config';

describe('helper authentication', () => {
  it('should login & logout correctly if account is right', async () => {
    const helper = new Learn2018Helper();
    await helper.login(U, P, F);
    await helper.logout();
  });

  it('should failed to login if account is incorrect', async () => {
    const helper = new Learn2018Helper();
    await expect(helper.login('nouser', 'nopass', 'incorrect')).rejects.toHaveProperty(
      'reason',
      FailReason.BAD_CREDENTIAL,
    );
  });

  it('should failed to login if double authentication is required', async () => {
    const helper = new Learn2018Helper();
    await expect(helper.login(U, P, 'unknown')).rejects.toHaveProperty('reason', FailReason.DOUBLE_AUTH);
  });

  it("should throw error if hasn't login and not provide up config", async () => {
    const helper = new Learn2018Helper();
    await expect(helper.login()).rejects.toHaveProperty('reason', FailReason.NO_CREDENTIAL);
    await expect(helper.getSemesterIdList()).rejects.toHaveProperty('reason', FailReason.NO_CREDENTIAL);
  });

  it('should not throw error if manually invoke login()', async () => {
    const helper = new Learn2018Helper();
    await helper.login(U, P, F);
    const semesters = await helper.getSemesterIdList();
    expect(Array.isArray(semesters)).toEqual(true);
  });

  it('should not throw error if provide CredentialProvider', async () => {
    const configs = { provider: () => ({ username: U, password: P, fingerPrint: F }) };
    const helper = new Learn2018Helper(configs);
    const semesters = await helper.getSemesterIdList();
    expect(Array.isArray(semesters)).toEqual(true);
  });

  it('should not throw error if invoke logout() but provide CredentialProvider', async () => {
    const configs = { provider: () => ({ username: U, password: P, fingerPrint: F }) };
    const helper = new Learn2018Helper(configs);
    // First get
    const semesters = await helper.getSemesterIdList();
    expect(Array.isArray(semesters)).toEqual(true);
    // Logout
    await helper.logout();
    // Second get
    const semesters2 = await helper.getSemesterIdList();
    expect(Array.isArray(semesters2)).toEqual(true);
  });

  it('should support multiple attempts to login without logout', async () => {
    const helper = new Learn2018Helper();
    await helper.login(U, P, F);
    const semesters1 = await helper.getSemesterIdList();
    expect(Array.isArray(semesters1)).toEqual(true);

    // Attempt to login again without logout
    await helper.login(U, P, F);
    const semesters2 = await helper.getSemesterIdList();
    expect(Array.isArray(semesters2)).toEqual(true);
  });
});
