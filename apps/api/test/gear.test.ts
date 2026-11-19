// Gear: scenarierne i Feature-005 Stock the inventory, -007 Manage equipment og -027 Assign hotbar keys.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { EVENT, MESSAGES } from '@maw/contracts';
import { envelope } from '@maw/platform';
import type { Pool } from '../src/db.ts';
import { enqueue } from '../src/outbox.ts';
import { createCharacter, deliverAll, hasDatabase, items, named, putInPack, setup, signUp } from './helpers.ts';

describe('Gear', { skip: !hasDatabase }, () => {
  let pool: Pool;
  let app: FastifyInstance;
  before(async () => ({ pool, app } = await setup()));
  after(async () => {
    await app.close();
    await pool.end();
  });

  const inventory = async (cookie: string, id: string) =>
    (await app.inject({ method: 'GET', url: `/api/characters/${id}/inventory`, headers: { cookie } })).json();

  test('F005 scenario "A new Miner gets the starting kit"', async () => {
    const cookie = await signUp(app, named('g1'));
    const id = await createCharacter(app, pool, cookie, 'Kael', 'miner');
    const inv = await inventory(cookie, id);
    assert.equal(inv.equipment.weapon.baseId, 'pickaxe');
    assert.equal(inv.equipment.weapon.rarity, 'common');
    assert.equal(inv.equipment.armour.baseId, 'padded_coat');
    assert.equal(inv.potions, 2);
    assert.equal(inv.rations, 3);
    assert.deepEqual(inv.hotbar, { '1': { weapon: inv.equipment.weapon.id }, '2': { echoArt: 'Echo Bolt' } });
    assert.deepEqual(inv.pack, []);
    assert.equal(inv.capacity, 13); // 12 + 1 for Strength 13
  });

  test('F005 scenario "A bought item lands in the pack"', async () => {
    const cookie = await signUp(app, named('g2'));
    const id = await createCharacter(app, pool, cookie);
    const [sword] = items(1, { baseId: 'short_sword', rarity: 'common' }, 2); // tilfældigt id: testdatabasen genbruges
    await enqueue(pool, envelope(EVENT.itemBought, { characterId: id, item: sword }));
    await deliverAll(pool);
    assert.deepEqual((await inventory(cookie, id)).pack.map((i: { name: string }) => i.name), ['Short Sword']);
  });

  test('F005 CMD-03: a character carries at most 9 potions', async () => {
    const cookie = await signUp(app, named('g3'));
    const id = await createCharacter(app, pool, cookie);
    await pool.query('update gear.inventories set potions = 9 where character_id = $1', [id]);
    await enqueue(pool, envelope(EVENT.potionBought, { characterId: id }));
    await deliverAll(pool);
    assert.equal((await inventory(cookie, id)).potions, 9);
  });

  test('F005 CMD-04: the inventory is emptied when the character is deleted', async () => {
    const cookie = await signUp(app, named('g4'));
    const id = await createCharacter(app, pool, cookie);
    await app.inject({ method: 'DELETE', url: `/api/characters/${id}`, headers: { cookie } });
    await deliverAll(pool);
    assert.equal((await app.inject({ method: 'GET', url: `/api/characters/${id}/inventory`, headers: { cookie } })).statusCode, 404);
    assert.equal((await pool.query('select 1 from gear.items where character_id = $1', [id])).rowCount, 0);
  });

  test('F007 scenario "Equipping swaps the weapon"', async () => {
    const cookie = await signUp(app, named('g5'));
    const id = await createCharacter(app, pool, cookie);
    const [sword] = items(1, { baseId: 'short_sword', rarity: 'common' }, 2);
    await putInPack(pool, id, [sword!]);
    const response = await app.inject({ method: 'POST', url: `/api/characters/${id}/equip`, headers: { cookie }, payload: { itemId: sword!.id } });
    assert.equal(response.statusCode, 200);
    const inv = response.json();
    assert.equal(inv.equipment.weapon.id, sword!.id);
    assert.deepEqual(inv.pack.map((i: { baseId: string }) => i.baseId), ['pickaxe']); // the Pickaxe is in the pack
    assert.equal(inv.equipment.weapon.skill, 'blades'); // Kael's blows now train Blades
  });

  test('F007 scenario "Unequipping needs room"', async () => {
    const cookie = await signUp(app, named('g6'));
    const id = await createCharacter(app, pool, cookie);
    const [ring] = items(1, { slot: 'ring' });
    await putInPack(pool, id, [ring!]);
    await app.inject({ method: 'POST', url: `/api/characters/${id}/equip`, headers: { cookie }, payload: { itemId: ring!.id } });
    const capacity = (await inventory(cookie, id)).capacity;
    await putInPack(pool, id, items(capacity, { slot: 'armour', rarity: 'common' })); // Kael's pack is full
    const response = await app.inject({ method: 'POST', url: `/api/characters/${id}/unequip`, headers: { cookie }, payload: { slot: 'ring' } });
    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.json(), { message: MESSAGES.inventoryFull });
    assert.equal((await inventory(cookie, id)).equipment.ring.id, ring!.id); // nothing is recorded
  });

  test('F027 scenario "A bow is put on key 3"', async () => {
    const cookie = await signUp(app, named('g7'));
    const id = await createCharacter(app, pool, cookie);
    const [bow] = items(1, { baseId: 'short_bow', rarity: 'common' });
    await putInPack(pool, id, [bow!]);
    const response = await app.inject({ method: 'PUT', url: `/api/characters/${id}/hotbar/3`, headers: { cookie }, payload: { itemId: bow!.id } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().hotbar['3'], { weapon: bow!.id });
  });

  test('F027 scenario "Moving Echo Bolt to another key"', async () => {
    const cookie = await signUp(app, named('g8'));
    const id = await createCharacter(app, pool, cookie);
    const response = await app.inject({ method: 'PUT', url: `/api/characters/${id}/hotbar/5`, headers: { cookie }, payload: { echoArt: 'Echo Bolt' } });
    assert.equal(response.statusCode, 200);
    const hotbar = response.json().hotbar;
    assert.deepEqual(hotbar['5'], { echoArt: 'Echo Bolt' });
    assert.equal(hotbar['2'], undefined); // key 2 is empty
  });

  test('F027 CMD-01/CMD-02: only owned weapons go on a key, and Clear empties it', async () => {
    const cookie = await signUp(app, named('g9'));
    const id = await createCharacter(app, pool, cookie);
    const [coat] = items(1, { baseId: 'leather_jerkin', rarity: 'common' });
    await putInPack(pool, id, [coat!]);
    assert.equal((await app.inject({ method: 'PUT', url: `/api/characters/${id}/hotbar/4`, headers: { cookie }, payload: { itemId: coat!.id } })).statusCode, 400);
    assert.equal((await app.inject({ method: 'PUT', url: `/api/characters/${id}/hotbar/9`, headers: { cookie }, payload: { echoArt: 'Echo Bolt' } })).statusCode, 400);
    const cleared = await app.inject({ method: 'DELETE', url: `/api/characters/${id}/hotbar/1`, headers: { cookie } });
    assert.equal(cleared.json().hotbar['1'], undefined);
  });

  test('a user cannot see or change another user\'s inventory', async () => {
    const owner = await signUp(app, named('g10'));
    const id = await createCharacter(app, pool, owner);
    const other = await signUp(app, named('g11'));
    assert.equal((await app.inject({ method: 'GET', url: `/api/characters/${id}/inventory`, headers: { cookie: other } })).statusCode, 404);
    assert.equal((await app.inject({ method: 'DELETE', url: `/api/characters/${id}/hotbar/1`, headers: { cookie: other } })).statusCode, 404);
  });
});
