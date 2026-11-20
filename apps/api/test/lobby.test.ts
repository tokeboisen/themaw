// Lobby: scenarierne i Feature-036 Open a Tithe, -025 Join a Tithe og -037 Launch the Tithe, og låsen, der holder
// karakteren fast i en lobby og en Tithe (Feature-026, -038 og planen, afsnit 5).

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { EVENT, MESSAGES, type TitheLaunched } from '@maw/contracts';
import type { Pool } from '../src/db.ts';
import { createCharacter, fakeTithes, hasDatabase, named, setup, signUp } from './helpers.ts';

describe('Lobby', { skip: !hasDatabase }, () => {
  let pool: Pool;
  let app: FastifyInstance;
  before(async () => ({ pool, app } = await setup()));
  beforeEach(() => (fakeTithes.list = []));
  after(async () => {
    await app.close();
    await pool.end();
  });

  const post = (cookie: string, url: string, payload?: object) => app.inject({ method: 'POST', url, headers: { cookie }, ...(payload ? { payload } : {}) });
  const get = async (cookie: string, url: string) => (await app.inject({ method: 'GET', url, headers: { cookie } })).json();

  async function playerWithCharacter(name: string, character = 'Kael'): Promise<{ cookie: string; id: string }> {
    const cookie = await signUp(app, named(name));
    const id = await createCharacter(app, pool, cookie, character);
    return { cookie, id };
  }

  async function launchedEvent(name: string): Promise<TitheLaunched> {
    const { rows } = await pool.query<{ payload: TitheLaunched }>(`select payload from platform.outbox where type = $1 and payload->>'name' = $2`, [EVENT.titheLaunched, name]);
    return rows[0]!.payload;
  }

  test('F036 scenario "Kael opens Ashfall"', async () => {
    const kael = await playerWithCharacter('kael1');
    const name = named('Ashfall1');
    const response = await post(kael.cookie, '/api/tithes', { name });
    assert.equal(response.statusCode, 201);
    const lobby = response.json();
    assert.equal(lobby.state, 'lobby');
    assert.equal(lobby.tithe.name, name);
    assert.equal(lobby.tithe.isOpener, true); // VIEW-02 shows Launch
    assert.deepEqual(lobby.tithe.players.map((p: { userName: string }) => p.userName), [named('kael1')]);
    const list = await get(kael.cookie, '/api/tithes');
    assert.ok(list.tithes.some((t: { name: string }) => t.name === name)); // EVT-01: the Tithe shows for everyone
  });

  test('F036 scenario "Kael opens a Tithe in The Broken City", and the board shows the Reaches', async () => {
    const kael = await playerWithCharacter('kael8');
    const name = named('Rustgate');
    const response = await post(kael.cookie, '/api/tithes', { name, reach: 'city' });
    assert.equal(response.statusCode, 201);
    assert.equal(response.json().tithe.reachName, 'The Broken City');
    const board = await get(kael.cookie, '/api/tithes');
    assert.deepEqual(board.reaches.map((r: { name: string }) => r.name), ['The Old Mines', 'The Broken City']);
    assert.equal(board.tithes.find((t: { name: string }) => t.name === name).reach, 'city');
    await post(kael.cookie, `/api/tithes/${encodeURIComponent(name)}/launch`);
    assert.equal((await launchedEvent(name)).reach, 'city'); // F037: "Tithe launched" carries the Reach
    assert.equal((await post(kael.cookie, '/api/tithes', { name: named('Nowhere'), reach: 'moon' })).statusCode, 400);
  });

  test('F036 scenario "The name is taken" (also in other letter case), and a name must be 3–30 characters', async () => {
    const kael = await playerWithCharacter('kael2');
    const other = await playerWithCharacter('other2');
    const name = named('Cinder');
    await post(kael.cookie, '/api/tithes', { name });
    const response = await post(other.cookie, '/api/tithes', { name: name.toUpperCase() });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().message, MESSAGES.titheNameTaken);
    assert.equal((await get(other.cookie, '/api/tithes/current')).state, 'none'); // nothing is recorded
    assert.equal((await post(other.cookie, '/api/tithes', { name: 'Ab' })).statusCode, 400);
    assert.equal((await post(other.cookie, '/api/tithes', { name: 'x'.repeat(31) })).statusCode, 400);
  });

  test('F025 scenario "Brann joins Ashfall"', async () => {
    const kael = await playerWithCharacter('kael3');
    const brann = await playerWithCharacter('brann3', 'Brann');
    const name = named('Ashfall2');
    await post(kael.cookie, '/api/tithes', { name });
    const response = await post(brann.cookie, `/api/tithes/${encodeURIComponent(name)}/join`);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().tithe.players.map((p: { userName: string }) => p.userName), [named('kael3'), named('brann3')]);
    assert.equal(response.json().tithe.isOpener, false);
    const seenByKael = await get(kael.cookie, '/api/tithes/current');
    assert.equal(seenByKael.tithe.players.length, 2);
  });

  test('F025 scenario "A full Tithe"', async () => {
    const opener = await playerWithCharacter('full0');
    const name = named('Full');
    await post(opener.cookie, '/api/tithes', { name });
    for (let i = 1; i < 8; i++) {
      const p = await playerWithCharacter(`full${i}`);
      assert.equal((await post(p.cookie, `/api/tithes/${encodeURIComponent(name)}/join`)).statusCode, 200);
    }
    const ninth = await playerWithCharacter('full8');
    const response = await post(ninth.cookie, `/api/tithes/${encodeURIComponent(name)}/join`);
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().message, MESSAGES.titheFull);
    const list = await get(ninth.cookie, '/api/tithes');
    assert.equal(list.tithes.find((t: { name: string }) => t.name === name).full, true); // Join is disabled
  });

  test('F037 scenario "Kael launches Ashfall" with two players and six NPC places', async () => {
    const kael = await playerWithCharacter('kael4');
    const brann = await playerWithCharacter('brann4', 'Brann');
    const name = named('Ashfall3');
    await post(kael.cookie, '/api/tithes', { name });
    await post(brann.cookie, `/api/tithes/${encodeURIComponent(name)}/join`);
    // Scenario "Only the opener launches"
    assert.equal((await post(brann.cookie, `/api/tithes/${encodeURIComponent(name)}/launch`)).statusCode, 403);
    const response = await post(kael.cookie, `/api/tithes/${encodeURIComponent(name)}/launch`);
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().state, 'playing');
    assert.ok(response.json().ticket);
    const event = await launchedEvent(name);
    assert.equal(event.players.length, 2);
    assert.deepEqual(event.players.map((p) => p.character.name).sort(), ['Brann', 'Kael']);
    assert.ok(event.players.every((p) => p.character.equipment.melee && p.hotbar['1'] && p.ticket));
    assert.equal(event.players.find((p) => p.character.name === 'Kael')!.character.gold, 60);
    // The Tithe no longer shows in the list
    assert.ok(!(await get(kael.cookie, '/api/tithes')).tithes.some((t: { name: string }) => t.name === name));
  });

  test('F037 CMD-02: when the opener leaves, the Tithe is closed and the others are back at the list', async () => {
    const kael = await playerWithCharacter('kael5');
    const brann = await playerWithCharacter('brann5', 'Brann');
    const name = named('Closing');
    await post(kael.cookie, '/api/tithes', { name });
    await post(brann.cookie, `/api/tithes/${encodeURIComponent(name)}/join`);
    await post(brann.cookie, `/api/tithes/${encodeURIComponent(name)}/leave`);
    assert.equal((await get(brann.cookie, '/api/tithes/current')).state, 'none');
    assert.equal((await get(kael.cookie, '/api/tithes/current')).tithe.players.length, 1);
    await post(brann.cookie, `/api/tithes/${encodeURIComponent(name)}/join`);
    await post(kael.cookie, `/api/tithes/${encodeURIComponent(name)}/leave`);
    assert.equal((await get(brann.cookie, '/api/tithes/current')).state, 'none');
    assert.ok(!(await get(kael.cookie, '/api/tithes')).tithes.some((t: { name: string }) => t.name === name));
  });

  test('a player is in one lobby at a time', async () => {
    const kael = await playerWithCharacter('kael6');
    await post(kael.cookie, '/api/tithes', { name: named('One') });
    const response = await post(kael.cookie, '/api/tithes', { name: named('Two') });
    assert.equal(response.statusCode, 409);
  });

  test('F038, F026 and the plan, section 5: the character cannot be changed in a lobby or a Tithe', async () => {
    const kael = await playerWithCharacter('kael7');
    const name = named('Locked');
    await post(kael.cookie, '/api/tithes', { name });
    const busy = { message: MESSAGES.inLobbyOrTithe };
    assert.deepEqual((await app.inject({ method: 'DELETE', url: `/api/characters/${kael.id}`, headers: { cookie: kael.cookie } })).json(), busy);
    assert.deepEqual((await post(kael.cookie, `/api/characters/${kael.id}/apothecary/buy`, { kind: 'potion' })).json(), busy);
    assert.deepEqual((await post(kael.cookie, `/api/characters/${kael.id}/choose`)).json(), busy);
    // Når Tithen er startet og kører i tithe-server, er karakteren stadig låst …
    await post(kael.cookie, `/api/tithes/${encodeURIComponent(name)}/launch`);
    const event = await launchedEvent(name);
    const userId = event.players[0]!.userId;
    fakeTithes.list = [{ id: event.titheId, name, players: [userId] }];
    assert.equal((await post(kael.cookie, `/api/characters/${kael.id}/apothecary/buy`, { kind: 'potion' })).statusCode, 409);
    assert.equal((await get(kael.cookie, '/api/tithes/current')).state, 'playing');
    // … og når spillerens del er slut, er den fri igen, og navnet er ledigt.
    fakeTithes.list = [{ id: event.titheId, name, players: [] }];
    assert.equal((await get(kael.cookie, '/api/tithes/current')).state, 'none');
    assert.equal((await post(kael.cookie, `/api/characters/${kael.id}/apothecary/buy`, { kind: 'potion' })).statusCode, 200);
    assert.equal((await post(kael.cookie, '/api/tithes', { name })).statusCode, 201);
  });
});
