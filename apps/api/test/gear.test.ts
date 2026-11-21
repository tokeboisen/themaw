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
  const post = (cookie: string, url: string, payload: object) => app.inject({ method: 'POST', url, headers: { cookie }, payload });

  /** Giver karakteren skill-niveauer og attributter, så den opfylder en tings krav. */
  async function meets(id: string, skills: Record<string, number>, attributes: Record<string, number> = {}) {
    for (const [s, level] of Object.entries(skills)) {
      await pool.query(`update characters.characters set skills = jsonb_set(skills, $2, $3::jsonb) where id = $1`, [id, `{${s},level}`, String(level)]);
    }
    for (const [a, value] of Object.entries(attributes)) {
      await pool.query(`update characters.characters set attributes = jsonb_set(attributes, $2, $3::jsonb) where id = $1`, [id, `{${a}}`, String(value)]);
    }
  }

  /** Lægger ting direkte i kisten (Feature-043). */
  async function putInChestDirectly(id: string, things: { id: string }[]) {
    for (const item of things) {
      await pool.query(`insert into gear.items (id, character_id, location, data) values ($1, $2, 'chest', $3)`, [item.id, id, JSON.stringify(item)]);
    }
  }

  test('F005 scenario "A new Miner gets the starting kit"', async () => {
    const cookie = await signUp(app, named('g1'));
    const id = await createCharacter(app, pool, cookie, 'Kael', 'miner');
    const inv = await inventory(cookie, id);
    assert.equal(inv.equipment.melee.baseId, 'pickaxe');
    assert.equal(inv.equipment.melee.rarity, 'common');
    assert.equal(inv.equipment.ranged, null);
    assert.equal(inv.equipment.armour.baseId, 'padded_coat');
    assert.equal(inv.potions, 2);
    assert.equal(inv.focusPotions, 1); // F005 v5: 1 focus potion
    assert.equal(inv.rations, 3);
    assert.deepEqual(inv.hotbar, { '1': { weapon: inv.equipment.melee.id }, '2': { echoArt: 'Echo Bolt' }, '3': { talent: 'berserk' } });
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
    const [sword] = items(1, { baseId: 'short_sword', rarity: 'common' }, 2); // Blades 9 og Dexterity 11
    await putInPack(pool, id, [sword!]);
    await meets(id, { blades: 9 }, { dexterity: 11 });
    const response = await app.inject({ method: 'POST', url: `/api/characters/${id}/equip`, headers: { cookie }, payload: { itemId: sword!.id } });
    assert.equal(response.statusCode, 200);
    const inv = response.json();
    assert.equal(inv.equipment.melee.id, sword!.id);
    assert.deepEqual(inv.pack.map((i: { baseId: string }) => i.baseId), ['pickaxe']); // the Pickaxe is in the pack
    assert.equal(inv.equipment.melee.skill, 'blades'); // Kael's blows now train Blades
  });

  test('F005: the Poacher\'s Short Bow is the ranged weapon', async () => {
    const cookie = await signUp(app, named('g12'));
    const id = await createCharacter(app, pool, cookie, 'Vessa', 'poacher');
    const inv = await inventory(cookie, id);
    assert.equal(inv.equipment.ranged.baseId, 'short_bow');
    assert.equal(inv.equipment.melee, null);
  });

  test('F007 scenarios "A bow goes into the ranged slot" and "A second ring"', async () => {
    const cookie = await signUp(app, named('g13'));
    const id = await createCharacter(app, pool, cookie);
    const [bow] = items(1, { baseId: 'short_bow', rarity: 'common' });
    const rings = items(3, { slot: 'ring' });
    await putInPack(pool, id, [bow!, ...rings]);
    const equip = async (payload: object) => (await app.inject({ method: 'POST', url: `/api/characters/${id}/equip`, headers: { cookie }, payload })).json();
    let inv = await equip({ itemId: bow!.id });
    assert.equal(inv.equipment.melee.baseId, 'pickaxe'); // Kael wears the Pickaxe and the Short Bow
    assert.equal(inv.equipment.ranged.id, bow!.id);
    await equip({ itemId: rings[0]!.id });
    inv = await equip({ itemId: rings[1]!.id });
    assert.deepEqual([inv.equipment.ring1.id, inv.equipment.ring2.id], [rings[0]!.id, rings[1]!.id]); // Kael wears both rings
    inv = await equip({ itemId: rings[2]!.id, ring: 'ring2' }); // med begge optaget vælger spilleren pladsen
    assert.deepEqual([inv.equipment.ring1.id, inv.equipment.ring2.id], [rings[0]!.id, rings[2]!.id]);
    assert.ok(inv.pack.some((i: { id: string }) => i.id === rings[1]!.id));
  });

  test('F007 scenario "Unequipping needs room"', async () => {
    const cookie = await signUp(app, named('g6'));
    const id = await createCharacter(app, pool, cookie);
    const [ring] = items(1, { slot: 'ring' });
    await putInPack(pool, id, [ring!]);
    await app.inject({ method: 'POST', url: `/api/characters/${id}/equip`, headers: { cookie }, payload: { itemId: ring!.id } });
    const capacity = (await inventory(cookie, id)).capacity;
    await putInPack(pool, id, items(capacity, { slot: 'armour', rarity: 'common' })); // Kael's pack is full
    const response = await app.inject({ method: 'POST', url: `/api/characters/${id}/unequip`, headers: { cookie }, payload: { slot: 'ring1' } });
    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.json(), { message: MESSAGES.inventoryFull });
    assert.equal((await inventory(cookie, id)).equipment.ring1.id, ring!.id); // nothing is recorded
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

  test('F027 scenario "An unknown Echo Art cannot be put on a key"; a known one can (Feature-048)', async () => {
    const cookie = await signUp(app, named('g8b'));
    const id = await createCharacter(app, pool, cookie);
    const unknown = await app.inject({ method: 'PUT', url: `/api/characters/${id}/hotbar/6`, headers: { cookie }, payload: { echoArt: 'Echo Chain' } });
    assert.equal(unknown.statusCode, 400);
    const known = await app.inject({ method: 'PUT', url: `/api/characters/${id}/hotbar/4`, headers: { cookie }, payload: { echoArt: 'Ringing Ward' } });
    assert.equal(known.statusCode, 200);
    assert.deepEqual(known.json().hotbar['4'], { echoArt: 'Ringing Ward' });
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

  test('F007 scenario "A weapon Kael is not ready for"', async () => {
    const cookie = await signUp(app, named('g20'));
    const id = await createCharacter(app, pool, cookie); // Miner: Heavy Weapons 10, Strength 13
    const [maul] = items(1, { baseId: 'maul', rarity: 'common' }, 3); // Heavy Weapons 20, Strength 17
    await putInPack(pool, id, [maul!]);
    const response = await post(cookie, `/api/characters/${id}/equip`, { itemId: maul!.id });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().message, MESSAGES.requirementsNotMet);
    const inv = await inventory(cookie, id);
    assert.equal(inv.equipment.melee.baseId, 'pickaxe'); // nothing changes
    assert.deepEqual(inv.pack.map((i: { id: string }) => i.id), [maul!.id]);
  });

  test('F043 scenario "Kael stores the War Axe"', async () => {
    const cookie = await signUp(app, named('g21'));
    const id = await createCharacter(app, pool, cookie);
    await putInChestDirectly(id, items(3, { slot: 'ring' }));
    const [axe] = items(1, { baseId: 'war_axe', rarity: 'common' });
    await putInPack(pool, id, [axe!]);
    const response = await post(cookie, `/api/characters/${id}/chest/put`, { itemId: axe!.id });
    assert.equal(response.statusCode, 200);
    const inv = response.json();
    assert.equal(inv.chest.length, 4); // the chest holds 4 of 12 items
    assert.equal(inv.chestSize, 12);
    assert.ok(inv.chest.some((i: { id: string }) => i.id === axe!.id));
    assert.deepEqual(inv.pack, []);
  });

  test('F043 scenario "A full chest"', async () => {
    const cookie = await signUp(app, named('g22'));
    const id = await createCharacter(app, pool, cookie);
    await putInChestDirectly(id, items(12, { slot: 'ring' }));
    const [ring] = items(1, { slot: 'ring' });
    await putInPack(pool, id, [ring!]);
    const response = await post(cookie, `/api/characters/${id}/chest/put`, { itemId: ring!.id });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().message, MESSAGES.chestFull);
    assert.equal((await inventory(cookie, id)).pack.length, 1);
  });

  test('F043 scenario "Taking needs room in the pack", and taking it with room', async () => {
    const cookie = await signUp(app, named('g23'));
    const id = await createCharacter(app, pool, cookie);
    const [axe] = items(1, { baseId: 'war_axe', rarity: 'common' });
    await putInChestDirectly(id, [axe!]);
    await putInPack(pool, id, items(13, { slot: 'ring' })); // the Miner's pack holds 13
    const full = await post(cookie, `/api/characters/${id}/chest/take`, { itemId: axe!.id });
    assert.equal(full.statusCode, 409);
    assert.equal(full.json().message, MESSAGES.inventoryFull);
    await pool.query(`delete from gear.items where character_id = $1 and location = 'pack'`, [id]);
    const taken = await post(cookie, `/api/characters/${id}/chest/take`, { itemId: axe!.id });
    assert.equal(taken.statusCode, 200);
    assert.deepEqual(taken.json().pack.map((i: { id: string }) => i.id), [axe!.id]);
    assert.deepEqual(taken.json().chest, []);
  });

  test('F043 and F027: a weapon put in the chest leaves its hotbar key; equipped items cannot go in', async () => {
    const cookie = await signUp(app, named('g24'));
    const id = await createCharacter(app, pool, cookie);
    const [bow] = items(1, { baseId: 'short_bow', rarity: 'common' });
    await putInPack(pool, id, [bow!]);
    await app.inject({ method: 'PUT', url: `/api/characters/${id}/hotbar/3`, headers: { cookie }, payload: { itemId: bow!.id } });
    const inv = (await post(cookie, `/api/characters/${id}/chest/put`, { itemId: bow!.id })).json();
    assert.equal(inv.hotbar['3'], undefined);
    const pickaxe = inv.equipment.melee;
    assert.equal((await post(cookie, `/api/characters/${id}/chest/put`, { itemId: pickaxe.id })).statusCode, 400);
  });

  test('F043: the chest cannot be used in a lobby', async () => {
    const cookie = await signUp(app, named('g25'));
    const id = await createCharacter(app, pool, cookie);
    const [ring] = items(1, { slot: 'ring' });
    await putInPack(pool, id, [ring!]);
    const opened = await post(cookie, '/api/tithes', { name: named('Chestlock'), reach: 'mines' });
    assert.equal(opened.statusCode, 201);
    const response = await post(cookie, `/api/characters/${id}/chest/put`, { itemId: ring!.id });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().message, MESSAGES.inLobbyOrTithe);
  });
});
