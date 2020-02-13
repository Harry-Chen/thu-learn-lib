import { Learn2018Helper } from "../src"
import * as dotenv from "dotenv"
import { FailReason } from "../src/types";

dotenv.config({ path: "test/.env" })
const U = process.env.U!;  // username
const P = process.env.P!;  // password
//                     ^ note the exclamation mark here
// prevent TS2322: Type 'string | undefined' is not assignable to type 'string'.

describe('helper authentication', () => {

  it("should login & logout correctly if account is right", async () => {
    const helper = new Learn2018Helper();
    await helper.login(U, P);
    await helper.logout();
  })

  it("should failed to login if account is incorrect", async () => {
    const helper = new Learn2018Helper();
    await expect(helper.login("nouser", "nopass")).rejects.toEqual(FailReason.BAD_CREDENTIAL);
  })

  it("should throw error if hasn't login and not provide up config", async () => {
    const helper = new Learn2018Helper();
    await expect(helper.login()).rejects.toEqual(FailReason.NO_CREDENTIAL);
    await expect(helper.getSemesterIdList()).rejects.toEqual(FailReason.NOT_LOGGED_IN);
  })

  it("should not throw error if manually invoke login()", async () => {
    const helper = new Learn2018Helper();
    await helper.login(U, P);
    const semesters = await helper.getSemesterIdList();
    expect(Array.isArray(semesters)).toEqual(true);
  })

  it("should not throw error if provide CredentialProvider", async () => {
    const configs = { provider: () => ({ username: U, password: P }) };
    const helper = new Learn2018Helper(configs);
    const semesters = await helper.getSemesterIdList();
    expect(Array.isArray(semesters)).toEqual(true);
  })

  it("should not throw error if invoke logout() but provide CredentialProvider", async () => {
    const configs = { provider: () => ({ username: U, password: P }) };
    const helper = new Learn2018Helper(configs);
    // First get
    const semesters = await helper.getSemesterIdList();
    expect(Array.isArray(semesters)).toEqual(true);
    // Logout
    await helper.logout();
    // Second get
    const semesters2 = await helper.getSemesterIdList();
    expect(Array.isArray(semesters2)).toEqual(true);
  })

})


