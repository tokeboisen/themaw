// Accounts: scenarierne i Feature-031 Create user, -032 Log in og -033 Log out.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { MESSAGES } from '@maw/contracts';
import type { Pool } from '../src/db.ts';
import { cookieOf, hasDatabase, named, setup, signUp } from './helpers.ts';

describe('Accounts', { skip: !hasDatabase }, () => {
  let pool: Pool;
  let app: FastifyInstance;
  before(async () => ({ pool, app } = await setup()));
  after(async () => {
    await app.close();
    await pool.end();
  });

  const createUser = (userName: string, password: string) =>
    app.inject({ method: 'POST', url: '/api/users', payload: { userName, password } });
  const me = (cookie: string) => app.inject({ method: 'GET', url: '/api/me', headers: { cookie } });

  test('F031 scenario "A user is created": EVT-01 is recorded and the player is signed in', async () => {
    const userName = named('kael');
    const response = await createUser(userName, '0123456789');
    assert.equal(response.statusCode, 201);
    const cookie = cookieOf(response.headers['set-cookie']);
    assert.match(response.headers['set-cookie'] as string, /HttpOnly; SameSite=Lax/);
    assert.equal((await me(cookie)).json().userName, userName);
  });

  test('F031 scenario "The user name is taken", regardless of upper and lower case', async () => {
    await signUp(app, named('Rook'));
    const response = await createUser(named('rook'), 'another password');
    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.json(), { field: 'userName', message: MESSAGES.userNameTaken });
  });

  test('F031 scenario "A short password"', async () => {
    const response = await createUser(named('brann'), '1234567');
    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), { field: 'password', message: MESSAGES.passwordShort });
  });

  test('F031 CMD-01: a user name with a space is refused under the field', async () => {
    const response = await createUser('two words', 'long enough');
    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), { field: 'userName', message: MESSAGES.userNameInvalid });
  });

  test('F031 AGG-01: the password is stored only as a hash', async () => {
    const userName = named('hash');
    await signUp(app, userName, 'plain text secret');
    const { rows } = await pool.query<{ password_hash: string }>('select password_hash from accounts.users where user_name = $1', [userName]);
    assert.match(rows[0]!.password_hash, /^scrypt\$/);
    assert.ok(!rows[0]!.password_hash.includes('plain text secret'));
  });

  test('F032 scenario "Kael logs in": EVT-01 User logged in is recorded', async () => {
    const userName = named('kael2');
    await signUp(app, userName, 'right password');
    const response = await app.inject({ method: 'POST', url: '/api/sessions', payload: { userName: userName.toUpperCase(), password: 'right password' } });
    assert.equal(response.statusCode, 200);
    assert.equal((await me(cookieOf(response.headers['set-cookie']))).json().userName, userName);
  });

  test('F032 scenario "A wrong password": nothing is recorded, and the same message for an unknown user', async () => {
    const userName = named('kael3');
    await signUp(app, userName, 'right password');
    for (const payload of [{ userName, password: 'wrong password' }, { userName: named('nobody'), password: 'right password' }]) {
      const response = await app.inject({ method: 'POST', url: '/api/sessions', payload });
      assert.equal(response.statusCode, 401);
      assert.deepEqual(response.json(), { message: MESSAGES.wrongLogin });
      assert.equal(response.headers['set-cookie'], undefined);
    }
  });

  test('F033 scenario "Kael logs out": EVT-01 is recorded and the session no longer works', async () => {
    const cookie = await signUp(app, named('kael4'));
    const response = await app.inject({ method: 'DELETE', url: '/api/sessions', headers: { cookie } });
    assert.equal(response.statusCode, 204);
    assert.match(response.headers['set-cookie'] as string, /Max-Age=0/);
    assert.equal((await me(cookie)).statusCode, 401);
  });
});
