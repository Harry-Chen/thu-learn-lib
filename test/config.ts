import * as dotenv from 'dotenv';

dotenv.config({ path: 'test/.env' });

export const U = process.env.U!; // username
export const P = process.env.P!; // password

export const config = { provider: () => ({ username: U, password: P }) };
