// Feature-044 Arrange an arena match og Feature-046 Settle arena stakes: arena-tavlen, siderne, Start og indsatsen.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { EVENT, MESSAGES, type ArenaMatchEnded, type ArenaMatchStarted } from '@maw/contracts';
import { envelope } from '@maw/platform';
import type { Pool } from '../src/db.ts';
import { enqueue } from '../src/outbox.ts';
import { createCharacter, deliverAll, hasDatabase, named, setup, signUp } from './helpers.ts';

describe('Arena', { skip: !hasDatabase }, () => {
  let pool: Pool;
  let app: FastifyInstance;
  before(async () => ({ pool, app } = await setup()));
  after(async () => {
    await app.close();
    await pool.end();
  });

  const post = (cookie: string, url: string, payload?: object) => app.inject({ method: 'POST', url, headers: { cookie }, ...(payload ? { payload } : {}) });
  const get = async (cookie: string, url: string) => (await app.inject({ method: 'GET', url, headers: { cookie } })).json();

  async function fighter(name: string, character = 'Kael') {
    const cookie = await signUp(app, named(name));
    const id = await createCharacter(app, pool, cookie, character);
    return { cookie, id };
  }
  const wallet = async (id: string) => (await pool.query<{ gold: number }>('select gold from market.wallets where character_id = $1', [id])).rows[0]!.gold;
  const setGold = (id: string, gold: number) => pool.query('update market.wallets set gold = $2 where character_id = $1', [id, gold]);
  const startedEvent = async (name: string) => (await pool.query<{ payload: ArenaMatchStarted }>(
    `select payload from platform.outbox where type = $1 and payload->>'name' = $2`, [EVENT.arenaMatchStarted, name],
  )).rows[0]?.payload;

  test('F044 scenario "Kael opens a match for 50 gold"', async () => {
    const kael = await fighter('ar1');
    await setGold(kael.id, 120);
    const name = named('Sand1');
    const response = await post(kael.cookie, '/api/arena', { name, format: '1v1', stake: 50, side: 1 });
    assert.equal(response.statusCode, 201);
    const cur = response.json();
    assert.equal(cur.state, 'lobby');
    assert.equal(cur.tithe.reach, 'arena');
    assert.equal(cur.tithe.stake, 50);
    assert.equal(cur.tithe.sides[1].players[0].characterName, 'Kael'); // Kael on Side 1 …
    assert.deepEqual(cur.tithe.sides[2], { places: 1, players: [] }); // … and an open place on Side 2
    const board = await get(kael.cookie, '/api/arena');
    assert.ok(board.matches.some((m: { name: string }) => m.name === name));
    const tithes = await get(kael.cookie, '/api/tithes');
    assert.ok(!tithes.tithes.some((x: { name: string }) => x.name === name)); // not on the Tithe Board
  });

  test('F044 scenario "Not enough gold", and a full side', async () => {
    const kael = await fighter('ar2');
    const brann = await fighter('ar3', 'Brann');
    const mira = await fighter('ar4', 'Mira');
    const name = named('Sand2');
    await post(kael.cookie, '/api/arena', { name, format: '1v1', stake: 50, side: 1 });
    await setGold(brann.id, 30);
    const poor = await post(brann.cookie, `/api/arena/${encodeURIComponent(name)}/join`, { side: 2 });
    assert.equal(poor.statusCode, 409);
    assert.equal(poor.json().message, MESSAGES.notEnoughGold);
    const full = await post(mira.cookie, `/api/arena/${encodeURIComponent(name)}/join`, { side: 1 });
    assert.equal(full.statusCode, 409);
    assert.equal(full.json().message, MESSAGES.sideFull);
  });

  test('F044 scenario "Starting needs full sides"', async () => {
    const [kael, brann, mira] = [await fighter('ar5'), await fighter('ar6', 'Brann'), await fighter('ar7', 'Mira')];
    const name = named('Sand3');
    await post(kael.cookie, '/api/arena', { name, format: '2v2', stake: 0, side: 1 });
    await post(brann.cookie, `/api/arena/${encodeURIComponent(name)}/join`, { side: 2 });
    await post(mira.cookie, `/api/arena/${encodeURIComponent(name)}/join`, { side: 1 });
    const response = await post(kael.cookie, `/api/arena/${encodeURIComponent(name)}/start`);
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().message, MESSAGES.placesNotFilled);
  });

  test('F044 scenario "The match starts", and F046 scenario "The winner takes the pot"', async () => {
    const kael = await fighter('ar8');
    const brann = await fighter('ar9', 'Brann');
    const name = named('Sand4');
    await post(kael.cookie, '/api/arena', { name, format: '1v1', stake: 50, side: 1 });
    await post(brann.cookie, `/api/arena/${encodeURIComponent(name)}/join`, { side: 2 });
    // Fighters cannot change their characters while they wait (the lock of the lobby).
    assert.equal((await post(brann.cookie, `/api/characters/${brann.id}/forge/sell`, { itemId: 'x' })).statusCode, 409);
    const started = await post(kael.cookie, `/api/arena/${encodeURIComponent(name)}/start`);
    assert.equal(started.statusCode, 200);
    assert.equal(started.json().state, 'playing'); // Kael and Brann enter the arena
    const event = (await startedEvent(name))!;
    assert.equal(event.format, '1v1');
    assert.equal(event.stake, 50);
    assert.deepEqual(event.fighters.map((f) => [f.characterId, f.side]), [[kael.id, 1], [brann.id, 2]]);
    assert.ok(event.fighters.every((f) => f.ticket && f.character.name));

    // F046 CMD-01 Take the stakes
    await deliverAll(pool);
    assert.equal(await wallet(kael.id), 10);
    assert.equal(await wallet(brann.id), 10);
    // F046 CMD-02 Pay the winners
    const ended: ArenaMatchEnded = {
      matchId: event.matchId, name, stake: 50, winner: 1,
      fighters: event.fighters.map((f) => ({ userId: f.userId, userName: f.userName, characterId: f.characterId, side: f.side, result: f.side === 1 ? 'won' : 'lost' })),
    };
    await enqueue(pool, envelope(EVENT.arenaMatchEnded, ended));
    await deliverAll(pool);
    assert.equal(await wallet(kael.id), 110); // Kael's wallet gets 100 gold
    assert.equal(await wallet(brann.id), 10);
  });

  test('F046 scenario "A draw": every fighter gets the stake back', async () => {
    const kael = await fighter('ar10');
    const brann = await fighter('ar11', 'Brann');
    const ended: ArenaMatchEnded = {
      matchId: crypto.randomUUID(), name: named('Sand5'), stake: 50, winner: null,
      fighters: [
        { userId: 'u1', userName: 'kael', characterId: kael.id, side: 1, result: 'draw' },
        { userId: 'u2', userName: 'brann', characterId: brann.id, side: 2, result: 'draw' },
      ],
    };
    await enqueue(pool, envelope(EVENT.arenaMatchEnded, ended));
    await deliverAll(pool);
    assert.equal(await wallet(kael.id), 60 + 50);
    assert.equal(await wallet(brann.id), 60 + 50);
  });
});
