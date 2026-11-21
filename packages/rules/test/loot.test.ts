// Feature-011, -021 og -023: lidt guld og få ting, og magiske ting er sjældne (2026-11-21).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BALANCE as B, createCharacter, createRng, createTithe, forgeStockAt, grantGifts, testing, type Tithe } from '../src/index.ts';

function mines(): Tithe {
  const character = createCharacter('Kael', 'miner', createRng(1), B);
  return createTithe({ id: 'T-loot', name: 'Ashfall', seed: 3, players: [{ userId: 'u1', userName: 'p1', characterId: 'c1', character, hotbar: {} }] }, B);
}

function slay(t: Tithe, count: number, veteran: boolean) {
  const dep = t.depths[1]!;
  const p = t.players[0]!;
  dep.loot = [];
  for (let i = 0; i < count; i++) {
    const m = testing.makeMonster(t, 'goblin', p.x + 10, p.y, 1);
    m.veteran = veteran;
    testing.kill(t, dep, p, m);
  }
  const items = dep.loot.filter((l) => l.kind === 'item');
  return {
    gold: dep.loot.filter((l) => l.kind === 'gold').length / count,
    items: items.length / count,
    magic: items.filter((l) => l.item!.rarity !== 'common').length / Math.max(1, items.length),
  };
}

test('F011: a slain monster drops gold 20 % and an item 5 % of the time, and few items are magic', () => {
  const r = slay(mines(), 6000, false);
  assert.ok(Math.abs(r.gold - 0.2) < 0.03, `gold ${r.gold}`);
  assert.ok(Math.abs(r.items - 0.05) < 0.015, `items ${r.items}`);
  assert.ok(r.magic < 0.06, `magic ${r.magic}`); // 2 % magic + 0.3 % rare
});

test('F011: a Veteran drops gold 60 % and an item 50 %, magic about one time in eleven', () => {
  const r = slay(mines(), 3000, true);
  assert.ok(Math.abs(r.gold - 0.6) < 0.05, `gold ${r.gold}`);
  assert.ok(Math.abs(r.items - 0.5) < 0.05, `items ${r.items}`);
  assert.ok(r.magic > 0.04 && r.magic < 0.15, `magic ${r.magic}`); // 8 % magic + 1 % rare
});

test('F021: the Forge rarely has magic items', () => {
  const rng = createRng(9);
  const stock = Array.from({ length: 300 }, () => forgeStockAt(rng, 3, B)).flat();
  const magic = stock.filter((i) => i.rarity !== 'common').length / stock.length;
  assert.ok(magic > 0.08 && magic < 0.2, String(magic)); // 2 % rare + 12 % magic
});

test('F023: one gift per 150 Renown; the items are common, the first magic from 600 Renown', () => {
  const kinds = (renown: number) => grantGifts(createRng(2), renown, 3, B).map((g) => (g.kind === 'gold' ? g.gold : g.item!.rarity));
  assert.deepEqual(kinds(149), []);
  assert.deepEqual(kinds(324), ['common', 40]);
  assert.deepEqual(kinds(640), ['magic', 40, 'common', 40]);
});
