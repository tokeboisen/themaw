// Når en spillers del af en Tithe slutter: scenarierne i Feature-009 Settle found gear, -022 Pay the Crown's Purse,
// -023 Grant sponsor gifts, -021 Restock the Forge, -039 Keep player statistics, -040 View player statistics og
// Feature-016 (karakteren gemmes).

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { EVENT, type PlayerDefeated, type TitheEnded } from '@maw/contracts';
import { envelope } from '@maw/platform';
import { BALANCE as B, createRng, generateItem, type Item, type OutcomeKind } from '@maw/rules';
import type { Pool } from '../src/db.ts';
import { enqueue } from '../src/outbox.ts';
import { createCharacter, deliverAll, hasDatabase, named, setup, signUp } from './helpers.ts';

describe('Tithe ended', { skip: !hasDatabase }, () => {
  let pool: Pool;
  let app: FastifyInstance;
  before(async () => ({ pool, app } = await setup()));
  after(async () => {
    await app.close();
    await pool.end();
  });

  const get = async (cookie: string, url: string) => (await app.inject({ method: 'GET', url, headers: { cookie } })).json();

  async function kael(name: string) {
    const cookie = await signUp(app, named(name));
    const id = await createCharacter(app, pool, cookie);
    const { rows } = await pool.query<{ user_id: string }>('select user_id from characters.characters where id = $1', [id]);
    return { cookie, id, userId: rows[0]!.user_id };
  }

  /** "Tithe ended" for Kael med det, han havde med ned, og det, han fandt. */
  async function ended(k: { cookie: string; id: string; userId: string }, o: {
    kind: OutcomeKind; champion?: string; maxDepth?: number; renown?: number; goldFound?: number; wardenSlain?: boolean;
    found?: Item[]; mark?: number; kills?: number; rivals?: number;
  }): Promise<{ titheId: string; data: TitheEnded }> {
    const c = await get(k.cookie, `/api/characters/${k.id}`);
    const inv = await get(k.cookie, `/api/characters/${k.id}/inventory`);
    const titheId = randomUUID();
    const found = (o.found ?? []).map((i) => ({ ...i, found: titheId }));
    const data: TitheEnded = {
      titheId, titheName: 'Ashfall', characterId: k.id, userId: k.userId,
      outcome: { kind: o.kind, name: o.champion ?? 'Kael' }, seconds: 300,
      record: {
        kills: o.kills ?? 4, rivalsDefeated: o.rivals ?? 0, renown: o.renown ?? 0, goldFound: o.goldFound ?? 0, maxDepth: o.maxDepth ?? 1,
        wardenSlain: o.wardenSlain ?? false, itemsFound: found.length, playersDefeated: 0,
      },
      start: { mark: c.mark, skills: { blades: 1, heavy: 10, bows: 1, echo: 1 } },
      character: { level: o.mark ?? c.mark, echo: c.echo, attributes: c.attributes, skills: { ...c.skills, heavy: { level: 11, xp: 0.5 } }, attributePoints: c.attributePoints, skillPoints: c.skillPoints },
      gear: { equipment: inv.equipment, pack: [...inv.pack, ...found], potions: 1, rations: 2, hotbar: inv.hotbar },
    };
    await enqueue(pool, envelope(EVENT.titheEnded, data));
    await deliverAll(pool); // også "Found gear kept" og "Purse paid" videre til Market
    return { titheId, data };
  }

  const warAxe = () => generateItem(createRng(Math.floor(Math.random() * 1e9)), 2, B, { baseId: 'war_axe', rarity: 'magic' });

  test('F009 scenario "A fall loses what was found", and F022 scenario "A fall halves the purse" (55 gold)', async () => {
    const k = await kael('te1');
    const pickaxe = (await get(k.cookie, `/api/characters/${k.id}/inventory`)).equipment.melee;
    await ended(k, { kind: 'fell', found: [warAxe()], goldFound: 33, maxDepth: 2, renown: 100 });
    const inv = await get(k.cookie, `/api/characters/${k.id}/inventory`);
    assert.deepEqual(inv.pack, []);
    assert.equal(inv.equipment.melee.id, pickaxe.id); // Kael still has the Pickaxe
    assert.equal((await get(k.cookie, `/api/characters/${k.id}/wallet`)).gold, 60 + 55); // no found gold, half purse
  });

  test('F009 scenario "A Champion keeps what was found", and F022 scenario "The Champion\'s purse" (690 gold)', async () => {
    const k = await kael('te2');
    const axe = warAxe();
    await ended(k, { kind: 'champion', found: [axe], goldFound: 33, maxDepth: 3, renown: 400, wardenSlain: true });
    const inv = await get(k.cookie, `/api/characters/${k.id}/inventory`);
    assert.deepEqual(inv.pack.map((i: Item) => i.id), [axe.id]);
    assert.equal(inv.pack[0].found, undefined); // no longer marked as found
    assert.equal((await get(k.cookie, `/api/characters/${k.id}/wallet`)).gold, 60 + 33 + 690);
  });

  test('F043 scenario "The chest stays out of the Maw": a fall leaves the chest as it was', async () => {
    const k = await kael('techest');
    const maul = generateItem(createRng(Math.floor(Math.random() * 1e9)), 3, B, { baseId: 'maul', rarity: 'common' });
    await pool.query(`insert into gear.items (id, character_id, location, data) values ($1, $2, 'chest', $3)`, [maul.id, k.id, JSON.stringify(maul)]);
    await ended(k, { kind: 'fell', found: [warAxe()] });
    const inv = await get(k.cookie, `/api/characters/${k.id}/inventory`);
    assert.deepEqual(inv.chest.map((i: { id: string }) => i.id), [maul.id]); // the Maul is still in the chest
  });

  test('F009 scenario "Leaving loses what was found"', async () => {
    const k = await kael('te3');
    await ended(k, { kind: 'left', goldFound: 20 });
    // pengepungen for dybde 1 halveres: 40 × 1 × 0,5 = 20
    assert.equal((await get(k.cookie, `/api/characters/${k.id}/wallet`)).gold, 60 + 20);
  });

  test('F009: a found weapon that was lost leaves its hotbar key', async () => {
    const k = await kael('te4');
    const axe = warAxe();
    const c = await get(k.cookie, `/api/characters/${k.id}`);
    const titheId = randomUUID();
    const inv = await get(k.cookie, `/api/characters/${k.id}/inventory`);
    const data: TitheEnded = {
      titheId, titheName: 'Ashfall', characterId: k.id, userId: k.userId, outcome: { kind: 'fell', name: 'Gnawer' }, seconds: 30,
      record: { kills: 0, rivalsDefeated: 0, renown: 0, goldFound: 0, maxDepth: 1, wardenSlain: false, itemsFound: 1, playersDefeated: 0 },
      start: { mark: 1, skills: { blades: 1, heavy: 10, bows: 1, echo: 1 } },
      character: { level: 1, echo: 0, attributes: c.attributes, skills: c.skills, attributePoints: 0, skillPoints: 0 },
      gear: { equipment: inv.equipment, pack: [{ ...axe, found: titheId }], potions: 2, rations: 3, hotbar: { ...inv.hotbar, '3': { weapon: axe.id } } },
    };
    await enqueue(pool, envelope(EVENT.titheEnded, data));
    await deliverAll(pool);
    assert.equal((await get(k.cookie, `/api/characters/${k.id}/inventory`)).hotbar['3'], undefined);
  });

  test('F009: a Tithe that started before two weapons and two rings keeps its gear on the new slots', async () => {
    const k = await kael('te11');
    const inv = await get(k.cookie, `/api/characters/${k.id}/inventory`);
    const c = await get(k.cookie, `/api/characters/${k.id}`);
    const [ring] = (await import('./helpers.ts')).items(1, { slot: 'ring' });
    const old = { weapon: inv.equipment.melee, armour: inv.equipment.armour, ring: ring! };
    const data = {
      titheId: randomUUID(), titheName: 'Ashfall', characterId: k.id, userId: k.userId, outcome: { kind: 'champion', name: 'Kael' }, seconds: 30,
      record: { kills: 0, rivalsDefeated: 0, renown: 0, goldFound: 0, maxDepth: 1, wardenSlain: false, itemsFound: 0, playersDefeated: 0 },
      start: { mark: 1, skills: { blades: 1, heavy: 10, bows: 1, echo: 1 } },
      character: { level: 1, echo: 0, attributes: c.attributes, skills: c.skills, attributePoints: 0, skillPoints: 0 },
      gear: { equipment: old, pack: [], potions: 2, rations: 3, hotbar: inv.hotbar },
    } as unknown as TitheEnded;
    await enqueue(pool, envelope(EVENT.titheEnded, data));
    await deliverAll(pool);
    const after = await get(k.cookie, `/api/characters/${k.id}/inventory`);
    assert.equal(after.equipment.melee.id, inv.equipment.melee.id);
    assert.equal(after.equipment.ring1.id, ring!.id);
  });

  test('F023 scenario "Renown brings gifts": a rare item, 64 gold and a magic item at Mark 3 and 324 Renown', async () => {
    const k = await kael('te5');
    await ended(k, { kind: 'rival-champion', champion: 'Cassian Morrow', renown: 324, mark: 3 });
    const gifts = (await get(k.cookie, `/api/characters/${k.id}/gifts`)).gifts;
    assert.equal(gifts.length, 3);
    const kinds = gifts.map((g: { kind: string; item: Item | null; gold: number | null }) => (g.kind === 'gold' ? g.gold : g.item!.rarity)).sort();
    assert.deepEqual(kinds, [64, 'magic', 'rare'].sort());
  });

  test('F016 and F021: the character is saved, and the Forge is restocked at the new Mark', async () => {
    const k = await kael('te6');
    const before = (await get(k.cookie, `/api/characters/${k.id}/forge`)).stock.map((i: Item) => i.id);
    await ended(k, { kind: 'fell', mark: 2 });
    const c = await get(k.cookie, `/api/characters/${k.id}`);
    assert.equal(c.mark, 2);
    assert.equal(c.skills.heavy.level, 11);
    const after = (await get(k.cookie, `/api/characters/${k.id}/forge`)).stock;
    assert.equal(after.length, B.rim.forgeItems);
    assert.ok(after.every((i: Item) => !before.includes(i.id)));
    const inv = await get(k.cookie, `/api/characters/${k.id}/inventory`);
    assert.equal(inv.potions, 1);
    assert.equal(inv.rations, 2);
  });

  test('F039 CMD-01 and F040 VIEW-01: the Tithes are counted with their outcome', async () => {
    const k = await kael('te7');
    await ended(k, { kind: 'champion', maxDepth: 3, kills: 10, rivals: 2 });
    await ended(k, { kind: 'fell', maxDepth: 2, kills: 5 });
    await ended(k, { kind: 'left', maxDepth: 1, kills: 1 });
    const stats = (await get(k.cookie, '/api/statistics')).characters.find((c: { id: string }) => c.id === k.id);
    assert.deepEqual(
      { tithes: stats.tithes, champions: stats.champions, falls: stats.falls, left: stats.left, deepest: stats.deepest, monsters: stats.monsters, rivals: stats.rivals },
      { tithes: 3, champions: 1, falls: 1, left: 1, deepest: 3, monsters: 16, rivals: 2 },
    );
    const list = (await get(k.cookie, '/api/characters')).characters.find((c: { id: string }) => c.id === k.id);
    assert.deepEqual({ tithes: list.tithes, champions: list.champions }, { tithes: 3, champions: 1 });
  });

  test('F039 scenario "A Player kill" and F040 scenario "Kael\'s Player kills"', async () => {
    const k = await kael('te8');
    const brann = await kael('te9');
    const defeat = (gold: number): PlayerDefeated => ({ titheId: randomUUID(), characterId: brann.id, userId: brann.userId, byCharacterId: k.id, byUserId: k.userId, gold });
    await enqueue(pool, envelope(EVENT.playerDefeated, defeat(6)));
    await enqueue(pool, envelope(EVENT.playerDefeated, defeat(6)));
    await deliverAll(pool);
    const mine = (await get(k.cookie, '/api/statistics')).characters.find((c: { id: string }) => c.id === k.id);
    assert.equal(mine.playerKills, 2);
    const theirs = (await get(brann.cookie, '/api/statistics')).characters.find((c: { id: string }) => c.id === brann.id);
    assert.equal(theirs.killedByPlayers, 2);
    assert.equal((await get(brann.cookie, `/api/characters/${brann.id}/wallet`)).gold, 60 - 12); // F018: the spilled gold
    // Feature-040: players only see their own characters' statistics
    assert.ok(!(await get(brann.cookie, '/api/statistics')).characters.some((c: { id: string }) => c.id === k.id));
  });

  test('F039 CMD-02: statistics are removed with the character', async () => {
    const k = await kael('te10');
    await ended(k, { kind: 'fell' });
    await app.inject({ method: 'DELETE', url: `/api/characters/${k.id}`, headers: { cookie: k.cookie } });
    assert.equal((await pool.query('select 1 from characters.statistics where character_id = $1', [k.id])).rowCount, 0);
  });
});
