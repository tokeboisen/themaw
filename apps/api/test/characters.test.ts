// Characters: scenarierne i Feature-001 Create character, -026 Choose character, -038 Delete character og
// -004 Spend points.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { MESSAGES } from '@maw/contracts';
import { BALANCE as B, backgroundById, effectiveSkill, newCharacter, suggestedAllocation, type Allocation } from '@maw/rules';
import type { Pool } from '../src/db.ts';
import { hasDatabase, named, outboxTypes, setup, signUp } from './helpers.ts';

describe('Characters', { skip: !hasDatabase }, () => {
  let pool: Pool;
  let app: FastifyInstance;
  before(async () => ({ pool, app } = await setup()));
  after(async () => {
    await app.close();
    await pool.end();
  });

  const miner = () => suggestedAllocation(backgroundById(B, 'miner')!);
  const create = (cookie: string, name: string, background = 'miner', alloc: Allocation = miner()) =>
    app.inject({ method: 'POST', url: '/api/characters', headers: { cookie }, payload: { name, background, ...alloc } });
  const list = async (cookie: string) => (await app.inject({ method: 'GET', url: '/api/characters', headers: { cookie } })).json();

  test('F001 scenario "A Miner is created with the suggested points"', async () => {
    const cookie = await signUp(app, named('u1'));
    assert.deepEqual((await list(cookie)).characters, []); // Given the user has no characters
    const response = await create(cookie, 'Kael');
    assert.equal(response.statusCode, 201);
    const kael = response.json();
    assert.equal(kael.attributes.strength, 13);
    assert.equal(kael.attributes.constitution, 12);
    assert.equal(kael.skills.heavy.level, 10);
    assert.equal(kael.mark, 1);
    // EVT-01 "Character created" is recorded and goes over the bus; the new character is the one being played.
    assert.deepEqual(await outboxTypes(pool, kael.id), ['characters.character-created']);
    assert.equal((await list(cookie)).activeCharacterId, kael.id);
  });

  test('F001 scenario "Points are moved within the limits"', async () => {
    const cookie = await signUp(app, named('u2'));
    const alloc = miner();
    alloc.attributes.strength -= 2;
    alloc.attributes.dexterity += 2;
    const response = await create(cookie, 'Brann', 'miner', alloc);
    assert.equal(response.statusCode, 201);
    assert.equal(response.json().attributes.strength, 11);
    assert.equal(response.json().attributes.dexterity, 12);
  });

  test('F001 scenario "All points must be placed"', async () => {
    const cookie = await signUp(app, named('u3'));
    const alloc = miner();
    alloc.skills.blades -= 1;
    const response = await create(cookie, 'Kael', 'miner', alloc);
    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), { message: MESSAGES.placeAllPoints });
    assert.deepEqual((await list(cookie)).characters, []); // nothing is recorded
  });

  test('F001 CMD-01: a value beyond the background maximum is refused', async () => {
    const cookie = await signUp(app, named('u4'));
    const alloc = miner();
    alloc.attributes.strength = 17; // Miner: Strength 11–16
    alloc.attributes.dexterity -= 4;
    const response = await create(cookie, 'Kael', 'miner', alloc);
    assert.equal(response.statusCode, 400);
    assert.deepEqual((await list(cookie)).characters, []);
  });

  test('F026 scenario "Another character is chosen"', async () => {
    const cookie = await signUp(app, named('u5'));
    const kael = (await create(cookie, 'Kael')).json();
    const brann = (await create(cookie, 'Brann', 'poacher', suggestedAllocation(backgroundById(B, 'poacher')!))).json();
    await app.inject({ method: 'POST', url: `/api/characters/${kael.id}/choose`, headers: { cookie } }); // Kael is being played
    const response = await app.inject({ method: 'POST', url: `/api/characters/${brann.id}/choose`, headers: { cookie } });
    assert.equal(response.statusCode, 200);
    assert.equal((await list(cookie)).activeCharacterId, brann.id); // the Rim shows Brann
  });

  test('F026 scenario "A new user goes straight to Create character": the new user has no characters', async () => {
    const cookie = await signUp(app, named('u6'));
    assert.deepEqual(await list(cookie), { characters: [], activeCharacterId: null });
  });

  test('F026/F038: a user can neither see, choose nor delete another user\'s character', async () => {
    const owner = await signUp(app, named('u7'));
    const kael = (await create(owner, 'Kael')).json();
    const other = await signUp(app, named('u8'));
    assert.equal((await app.inject({ method: 'GET', url: `/api/characters/${kael.id}`, headers: { cookie: other } })).statusCode, 404);
    assert.equal((await app.inject({ method: 'POST', url: `/api/characters/${kael.id}/choose`, headers: { cookie: other } })).statusCode, 404);
    assert.equal((await app.inject({ method: 'DELETE', url: `/api/characters/${kael.id}`, headers: { cookie: other } })).statusCode, 404);
  });

  test('F038 scenario "Brann is deleted"', async () => {
    const cookie = await signUp(app, named('u9'));
    const kael = (await create(cookie, 'Kael')).json();
    const brann = (await create(cookie, 'Brann')).json(); // Brann is now being played
    const response = await app.inject({ method: 'DELETE', url: `/api/characters/${brann.id}`, headers: { cookie } });
    assert.equal(response.statusCode, 204);
    const after = await list(cookie);
    assert.deepEqual(after.characters.map((c: { name: string }) => c.name), ['Kael']); // the list shows only Kael
    assert.equal(after.activeCharacterId, null); // the player chooses another character or creates a new one
    assert.deepEqual(await outboxTypes(pool, brann.id), ['characters.character-created', 'characters.character-deleted']);
    assert.ok(kael.id);
  });

  test('F004 scenario "A point in Dexterity makes Bows better"', async () => {
    const cookie = await signUp(app, named('u10'));
    const alloc = miner();
    alloc.skills.bows = 1;
    alloc.skills.blades = 4;
    const kael = (await create(cookie, 'Kael', 'miner', alloc)).json();
    await pool.query('update characters.characters set attribute_points = 3 where id = $1', [kael.id]); // som efter et Mark
    const response = await app.inject({ method: 'POST', url: `/api/characters/${kael.id}/attribute-points`, headers: { cookie }, payload: { attribute: 'dexterity' } });
    assert.equal(response.statusCode, 200);
    const after = response.json();
    assert.equal(after.attributes.dexterity, 11);
    assert.equal(after.attributePoints, 2);
    const bg = backgroundById(B, 'miner')!;
    const before = effectiveSkill(newCharacter('Kael', bg, alloc), 'bows', B);
    const now = effectiveSkill(newCharacter('Kael', bg, { attributes: after.attributes, skills: alloc.skills }), 'bows', B);
    assert.ok(Math.abs(now - before - 1.05) < 1e-9);
  });

  test('F004 scenario "A skill point gives two levels"', async () => {
    const cookie = await signUp(app, named('u11'));
    const kael = (await create(cookie, 'Kael')).json();
    await pool.query(`update characters.characters set skill_points = 2, skills = jsonb_set(skills, '{heavy,level}', '15') where id = $1`, [kael.id]);
    const response = await app.inject({ method: 'POST', url: `/api/characters/${kael.id}/skill-points`, headers: { cookie }, payload: { skill: 'heavy' } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().skills.heavy.level, 17);
    assert.equal(response.json().skillPoints, 1);
  });

  test('F004 CMD-01: without points nothing is recorded', async () => {
    const cookie = await signUp(app, named('u12'));
    const kael = (await create(cookie, 'Kael')).json();
    const response = await app.inject({ method: 'POST', url: `/api/characters/${kael.id}/attribute-points`, headers: { cookie }, payload: { attribute: 'strength' } });
    assert.equal(response.statusCode, 409);
    assert.equal((await app.inject({ method: 'GET', url: `/api/characters/${kael.id}`, headers: { cookie } })).json().attributes.strength, 13);
  });

  test('every Characters endpoint needs a signed-in user', async () => {
    for (const [method, url] of [['GET', '/api/characters'], ['GET', '/api/backgrounds'], ['POST', '/api/characters']] as const) {
      assert.equal((await app.inject({ method, url })).statusCode, 401, `${method} ${url}`);
    }
  });
});
