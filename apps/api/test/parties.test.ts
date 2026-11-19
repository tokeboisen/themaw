// Feature-034 VIEW-01 Other players: spillerne, der er logget ind, med karakter og Tithe.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import type { Pool } from '../src/db.ts';
import { createCharacter, hasDatabase, named, setup, signUp } from './helpers.ts';

describe('Other players', { skip: !hasDatabase }, () => {
  let pool: Pool;
  let app: FastifyInstance;
  before(async () => ({ pool, app } = await setup()));
  after(async () => {
    await app.close();
    await pool.end();
  });

  const players = async (cookie: string) =>
    (await app.inject({ method: 'GET', url: '/api/players', headers: { cookie } })).json().players as {
      userName: string; character: { name: string; mark: number } | null; tithe: string | null; you: boolean;
    }[];

  test('F034 VIEW-01: signed-in players with the character they play and the Tithe they are in', async () => {
    const kael = await signUp(app, named('op-kael'));
    await createCharacter(app, pool, kael, 'Kael');
    const brann = await signUp(app, named('op-brann'));
    await createCharacter(app, pool, brann, 'Brann');
    const tithe = named('OP');
    await app.inject({ method: 'POST', url: '/api/tithes', headers: { cookie: brann }, payload: { name: tithe } });
    const list = await players(kael);
    const me = list.find((p) => p.userName === named('op-kael'))!;
    assert.deepEqual(me, { userName: named('op-kael'), character: { name: 'Kael', mark: 1 }, tithe: null, you: true });
    const other = list.find((p) => p.userName === named('op-brann'))!;
    assert.deepEqual(other, { userName: named('op-brann'), character: { name: 'Brann', mark: 1 }, tithe, you: false });
  });

  test('F034 VIEW-01: a user who has not been seen for a while is not signed in', async () => {
    const kael = await signUp(app, named('op-kael2'));
    const idle = await signUp(app, named('op-idle'));
    void idle;
    await pool.query(
      `update accounts.sessions set last_seen_at = now() - interval '10 minutes'
       where user_id = (select id from accounts.users where user_name = $1)`,
      [named('op-idle')],
    );
    assert.ok(!(await players(kael)).some((p) => p.userName === named('op-idle')));
  });
});
