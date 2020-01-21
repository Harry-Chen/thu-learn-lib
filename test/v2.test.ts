import { Learn2018Helper } from "../src"
import * as dotenv from "dotenv"

dotenv.config({ path: "test/.env" })
const U = process.env.U!;  // username
const P = process.env.P!;  // password
//                     ^ note the exclamation mark here
// prevent TS2322: Type 'string | undefined' is not assignable to type 'string'.

describe('v2helper config', () => {

  it("should throw error if hasn't login and not provide up config", async () => {
    const helper = new Learn2018Helper();
    await expect(helper.getSemesterIdList()).rejects.toThrow();
  })

  it("should not throw error if manually invoke login()", async () => {
    const helper = new Learn2018Helper();
    const loginok = await helper.login(U, P);
    expect(loginok).toEqual(true);
    const semesters = await helper.getSemesterIdList();
    expect(Array.isArray(semesters)).toEqual(true);
  })

  it("should not throw error if provide up config", async () => {
    const configs = { up: () => ({ username: U, password: P }) };
    const helper = new Learn2018Helper(configs);
    const semesters = await helper.getSemesterIdList();
    expect(Array.isArray(semesters)).toEqual(true);
  })

  it("should not throw error if invoke logout() but provide up config", async () => {
    const configs = { up: () => ({ username: U, password: P }) };
    const helper = new Learn2018Helper(configs);
    // First get
    const semesters = await helper.getSemesterIdList();
    expect(Array.isArray(semesters)).toEqual(true);
    // Logout
    const logoutok = await helper.logout();
    expect(logoutok).toEqual(false);
    // Second get
    const semesters2 = await helper.getSemesterIdList();
    expect(Array.isArray(semesters2)).toEqual(true);
  })

})


