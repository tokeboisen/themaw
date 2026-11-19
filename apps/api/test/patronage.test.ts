// Patronage: scenarierne i Feature-024 Accept sponsor gifts og tilbagetrækningen i Feature-023.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { MESSAGES } from '@maw/contracts';
import type { Item } from '@maw/rules';
import type { Pool } from '../src/db.ts';
import { createCharacter, deliverAll, hasDatabase, items, named, putInPack, setup, signUp } from './helpers.ts';

describe('Patronage', { skip: !hasDatabase }, () => {
  let pool: Pool;
  let app: FastifyInstance;
  before(async () => ({ pool, app } = await setup()));
  after(async () => {
    await app.close();
    await pool.end();
  });

  async function grant(characterId: string, gift: { house: string; item?: Item; gold?: number }): Promise<string> {
    const id = randomUUID();
    const { rows } = await pool.query<{ user_id: string }>('select user_id from market.wallets where character_id = $1', [characterId]);
    await pool.query(
      'insert into patronage.gifts (id, character_id, user_id, house, kind, item, gold) values ($1, $2, $3, $4, $5, $6, $7)',
      [id, characterId, rows[0]!.user_id, gift.house, gift.item ? 'item' : 'gold', gift.item ? JSON.stringify(gift.item) : null, gift.gold ?? null],
    );
    return id;
  }
  const accept = (cookie: string, id: string, giftId: string) =>
    app.inject({ method: 'POST', url: `/api/characters/${id}/gifts/${giftId}/accept`, headers: { cookie } });
  const gifts = async (cookie: string, id: string) =>
    (await app.inject({ method: 'GET', url: `/api/characters/${id}/gifts`, headers: { cookie } })).json().gifts;

  test('F024 scenario "A gold gift is accepted"', async () => {
    const cookie = await signUp(app, named('p1'));
    const id = await createCharacter(app, pool, cookie);
    const giftId = await grant(id, { house: 'House Vane', gold: 64 });
    const response = await accept(cookie, id, giftId);
    assert.equal(response.statusCode, 200);
    await deliverAll(pool); // EVT-02 "Gold gift accepted" → Market
    const wallet = await app.inject({ method: 'GET', url: `/api/characters/${id}/wallet`, headers: { cookie } });
    assert.equal(wallet.json().gold, 124);
    assert.deepEqual(await gifts(cookie, id), []);
  });

  test('F024 EVT-01: an accepted item goes into the pack', async () => {
    const cookie = await signUp(app, named('p2'));
    const id = await createCharacter(app, pool, cookie);
    const [ring] = items(1, { slot: 'ring' });
    const giftId = await grant(id, { house: 'House Morrow', item: ring });
    assert.equal((await accept(cookie, id, giftId)).statusCode, 200);
    await deliverAll(pool);
    const inv = (await app.inject({ method: 'GET', url: `/api/characters/${id}/inventory`, headers: { cookie } })).json();
    assert.deepEqual(inv.pack.map((i: Item) => i.id), [ring!.id]);
  });

  test('F024 scenario "A full pack refuses an item gift"', async () => {
    const cookie = await signUp(app, named('p3'));
    const id = await createCharacter(app, pool, cookie);
    await putInPack(pool, id, items(13, { slot: 'armour', rarity: 'common' })); // Kael's pack is full
    const [ring] = items(1, { slot: 'ring' });
    const giftId = await grant(id, { house: 'House Morrow', item: ring });
    const response = await accept(cookie, id, giftId);
    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.json(), { message: MESSAGES.inventoryFull });
    assert.equal((await gifts(cookie, id)).length, 1); // the gift keeps waiting
  });

  test('F023 CMD-02: waiting gifts are withdrawn when the character is deleted', async () => {
    const cookie = await signUp(app, named('p4'));
    const id = await createCharacter(app, pool, cookie);
    await grant(id, { house: 'House Lisle', gold: 40 });
    await app.inject({ method: 'DELETE', url: `/api/characters/${id}`, headers: { cookie } });
    await deliverAll(pool);
    assert.equal((await pool.query('select 1 from patronage.gifts where character_id = $1', [id])).rowCount, 0);
  });

  test('a user cannot accept another user\'s gift', async () => {
    const owner = await signUp(app, named('p5'));
    const id = await createCharacter(app, pool, owner);
    const giftId = await grant(id, { house: 'House Vane', gold: 10 });
    const other = await signUp(app, named('p6'));
    assert.equal((await accept(other, id, giftId)).statusCode, 404);
  });
});
