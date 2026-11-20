// Market: scenarierne i Feature-018 Keep the wallet, -019 Trade at the Forge, -020 Shop at the Apothecary og
// -021 Restock the Forge.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { EVENT, MESSAGES } from '@maw/contracts';
import { envelope } from '@maw/platform';
import type { Item } from '@maw/rules';
import type { Pool } from '../src/db.ts';
import { enqueue } from '../src/outbox.ts';
import { createCharacter, deliverAll, hasDatabase, items, named, putInPack, setup, signUp } from './helpers.ts';

describe('Market', { skip: !hasDatabase }, () => {
  let pool: Pool;
  let app: FastifyInstance;
  before(async () => ({ pool, app } = await setup()));
  after(async () => {
    await app.close();
    await pool.end();
  });

  const get = async (cookie: string, url: string) => (await app.inject({ method: 'GET', url, headers: { cookie } })).json();
  const post = (cookie: string, url: string, payload: object) => app.inject({ method: 'POST', url, headers: { cookie }, payload });
  const setGold = (id: string, gold: number) => pool.query('update market.wallets set gold = $2 where character_id = $1', [id, gold]);
  async function sellsShortSwordFor(id: string, price: number): Promise<Item> {
    const [sword] = items(1, { baseId: 'short_sword', rarity: 'common' }, 2);
    sword!.value = price;
    await pool.query('update market.forges set stock = $2 where character_id = $1', [id, JSON.stringify([sword])]);
    return sword!;
  }

  test('F018 SVC-01 and F021 CMD-01: a new character has 60 gold and a Forge with 7 items at Mark 1', async () => {
    const cookie = await signUp(app, named('m1'));
    const id = await createCharacter(app, pool, cookie);
    const forge = await get(cookie, `/api/characters/${id}/forge`);
    assert.equal(forge.gold, 60);
    assert.equal(forge.stock.length, 7);
    assert.ok(forge.stock.every((i: Item) => i.ilvl === 1));
  });

  test('F018 scenario "The Crown pays"', async () => {
    const cookie = await signUp(app, named('m2'));
    const id = await createCharacter(app, pool, cookie);
    await enqueue(pool, envelope(EVENT.pursePaid, { characterId: id, gold: 690 }));
    await deliverAll(pool);
    assert.equal((await get(cookie, `/api/characters/${id}/wallet`)).gold, 750);
  });

  test('F019 scenario "An item is bought"', async () => {
    const cookie = await signUp(app, named('m3'));
    const id = await createCharacter(app, pool, cookie);
    await setGold(id, 100);
    const sword = await sellsShortSwordFor(id, 59);
    const response = await post(cookie, `/api/characters/${id}/forge/buy`, { itemId: sword.id });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().gold, 41); // EVT-02 "Gold spent" with 59 gold
    assert.deepEqual(response.json().stock, []); // a bought item leaves the stock
    await deliverAll(pool); // EVT-01 "Item bought" → Gear
    const inv = await get(cookie, `/api/characters/${id}/inventory`);
    assert.deepEqual(inv.pack.map((i: Item) => i.id), [sword.id]);
  });

  test('F019 scenario "Not enough gold"', async () => {
    const cookie = await signUp(app, named('m4'));
    const id = await createCharacter(app, pool, cookie);
    await setGold(id, 20);
    const sword = await sellsShortSwordFor(id, 59);
    const response = await post(cookie, `/api/characters/${id}/forge/buy`, { itemId: sword.id });
    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.json(), { message: MESSAGES.notEnoughGold });
    assert.equal((await get(cookie, `/api/characters/${id}/forge`)).stock.length, 1); // nothing is recorded
  });

  test('F019 CMD-01: a full pack refuses the purchase', async () => {
    const cookie = await signUp(app, named('m5'));
    const id = await createCharacter(app, pool, cookie);
    const sword = await sellsShortSwordFor(id, 20);
    await putInPack(pool, id, items(13, { slot: 'armour', rarity: 'common' }));
    const response = await post(cookie, `/api/characters/${id}/forge/buy`, { itemId: sword.id });
    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.json(), { message: MESSAGES.inventoryFull });
  });

  test('F019 scenario "An item is sold" (86 gold gives 25), and the weapon leaves its hotbar key (F027 AGG-01)', async () => {
    const cookie = await signUp(app, named('m6'));
    const id = await createCharacter(app, pool, cookie);
    const [jerkin] = items(1, { baseId: 'leather_jerkin', rarity: 'magic' }, 3);
    jerkin!.value = 86;
    const [bow] = items(1, { baseId: 'short_bow', rarity: 'common' });
    await putInPack(pool, id, [jerkin!, bow!]);
    await app.inject({ method: 'PUT', url: `/api/characters/${id}/hotbar/3`, headers: { cookie }, payload: { itemId: bow!.id } });
    const sold = await post(cookie, `/api/characters/${id}/forge/sell`, { itemId: jerkin!.id });
    assert.equal(sold.statusCode, 200);
    assert.equal(sold.json().sold, 25);
    assert.equal(sold.json().gold, 85);
    await post(cookie, `/api/characters/${id}/forge/sell`, { itemId: bow!.id });
    await deliverAll(pool); // EVT-03 "Item sold" → Gear removes the items
    const inv = await get(cookie, `/api/characters/${id}/inventory`);
    assert.deepEqual(inv.pack, []);
    assert.equal(inv.hotbar['3'], undefined);
    // Den samme ting kan ikke sælges to gange.
    assert.equal((await post(cookie, `/api/characters/${id}/forge/sell`, { itemId: jerkin!.id })).statusCode, 400);
  });

  test('F019 CMD-02: equipped items cannot be sold', async () => {
    const cookie = await signUp(app, named('m7'));
    const id = await createCharacter(app, pool, cookie);
    const weapon = (await get(cookie, `/api/characters/${id}/inventory`)).equipment.melee;
    assert.equal((await post(cookie, `/api/characters/${id}/forge/sell`, { itemId: weapon.id })).statusCode, 400);
  });

  test('F020 scenario "A potion is bought"', async () => {
    const cookie = await signUp(app, named('m8'));
    const id = await createCharacter(app, pool, cookie);
    await setGold(id, 40);
    await pool.query('update gear.inventories set potions = 1 where character_id = $1', [id]);
    const response = await post(cookie, `/api/characters/${id}/apothecary/buy`, { kind: 'potion' });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().gold, 15);
    await deliverAll(pool); // EVT-01 "Potion bought" → Gear
    assert.equal((await get(cookie, `/api/characters/${id}/inventory`)).potions, 2);
  });

  test('F020 scenario "Nine rations are enough"', async () => {
    const cookie = await signUp(app, named('m9'));
    const id = await createCharacter(app, pool, cookie);
    await pool.query('update gear.inventories set rations = 9 where character_id = $1', [id]);
    const response = await post(cookie, `/api/characters/${id}/apothecary/buy`, { kind: 'ration' });
    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.json(), { message: MESSAGES.cannotCarryMore });
    assert.equal((await get(cookie, `/api/characters/${id}/wallet`)).gold, 60);
  });

  test('F020 CMD-02: a ration needs 10 gold', async () => {
    const cookie = await signUp(app, named('m10'));
    const id = await createCharacter(app, pool, cookie);
    await setGold(id, 9);
    const response = await post(cookie, `/api/characters/${id}/apothecary/buy`, { kind: 'ration' });
    assert.deepEqual(response.json(), { message: MESSAGES.notEnoughGold });
  });

  test('F018 CMD-03 and F021 CMD-02: the wallet and the Forge go when the character is deleted', async () => {
    const cookie = await signUp(app, named('m11'));
    const id = await createCharacter(app, pool, cookie);
    await app.inject({ method: 'DELETE', url: `/api/characters/${id}`, headers: { cookie } });
    await deliverAll(pool);
    assert.equal((await pool.query('select 1 from market.wallets where character_id = $1 union all select 1 from market.forges where character_id = $1', [id])).rowCount, 0);
  });
});
