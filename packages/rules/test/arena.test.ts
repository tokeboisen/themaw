// Feature-045 Fight in the arena og Feature-046 Settle arena stakes: banen, siderne, nedtællingen, ringen, buskene,
// slutningen og udbetalingen.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ARENA_SPAWNS, ARENA_W, BALANCE as B, BUSH, TREE, TREE_BIG, arenaMap, arenaPayout, bfs, createCharacter, createRng, createTithe, hiddenFrom, isSolid,
  setInput, sheetAction, stepTithe, testing, type ArenaFormat, type ArenaSide, type Hotbar, type Player, type Tithe,
} from '../src/index.ts';

const DT = 1 / 30;

function arena(sides: ArenaSide[], format: ArenaFormat = '1v1', stake = 50): Tithe {
  return createTithe({
    id: 'A-test', name: 'Sand and Steel', reach: 'arena', seed: 3, arena: { format, stake },
    players: sides.map((side, i) => {
      const character = createCharacter(`Fighter${i}`, 'miner', createRng(i + 1), B);
      const hotbar: Hotbar = { '1': { weapon: character.equipment.melee!.id } };
      return { userId: `u${i + 1}`, userName: `p${i + 1}`, characterId: `c${i + 1}`, character, hotbar, side };
    }),
  }, B);
}

const fighter = (t: Tithe, i: number): Player => t.players[i]!;
const run = (t: Tithe, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) stepTithe(t, DT);
};

test('F045 AGG-01: an oval of sand ringed by the stands, the same on both halves, with rocks, trees and bushes', () => {
  const map = arenaMap();
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) assert.equal(map.tiles[y * map.w + x], map.tiles[y * map.w + (ARENA_W - 1 - x)]);
  const tiles = [...map.tiles];
  assert.ok(tiles.includes(TREE) && tiles.includes(BUSH));
  assert.equal(tiles.filter((x) => x === TREE_BIG).length % 4, 0); // big trees fill 2 × 2 tiles
  assert.ok(tiles.includes(TREE_BIG));
  assert.equal(isSolid(map, 0, 0), true); // the stands
  const [a, b] = [ARENA_SPAWNS[1][0]!, ARENA_SPAWNS[2][0]!];
  const reach = bfs(map, Math.floor(a.x), Math.floor(a.y));
  assert.ok(reach[Math.floor(b.y) * map.w + Math.floor(b.x)]! >= 0); // the sides can reach each other
  const tree = tiles.indexOf(TREE);
  const bush = tiles.indexOf(BUSH);
  assert.equal(isSolid(map, tree % map.w, Math.floor(tree / map.w)), true); // trees block
  assert.equal(isSolid(map, bush % map.w, Math.floor(bush / map.w)), false); // bushes do not
});

test('F045 CMD-01 Open the arena: no monsters or rivals; each side is a party at its end', () => {
  const t = arena([1, 2, 1, 2], '2v2');
  assert.equal(t.rivals.length, 0);
  assert.equal(t.depths[1]!.monsters.length, 0);
  assert.deepEqual(t.players.map((p) => p.side), [1, 2, 1, 2]);
  assert.equal(fighter(t, 0).partyId, fighter(t, 2).partyId);
  assert.notEqual(fighter(t, 0).partyId, fighter(t, 1).partyId);
  assert.ok(fighter(t, 0).x < 10 && fighter(t, 1).x > 30);
});

test('F045: no one can be hurt in the 5-second countdown; after it the sides fight', () => {
  const t = arena([1, 2]);
  const [kael, brann] = [fighter(t, 0), fighter(t, 1)];
  Object.assign(brann, { x: kael.x + 0.9, y: kael.y });
  setInput(t, kael.id, { moveX: 0, moveY: 0, attack: true });
  run(t, 1);
  assert.equal(brann.hp, brann.maxHp);
  t.time = B.arena.countdown;
  run(t, 1.5);
  assert.ok(brann.hp < brann.maxHp);
});

test('F045 scenario "Teammates do not hurt each other"', () => {
  const t = arena([1, 2, 1, 2], '2v2');
  const [kael, mira] = [fighter(t, 0), fighter(t, 2)];
  Object.assign(mira, { x: kael.x + 0.9, y: kael.y });
  t.time = B.arena.countdown + 1;
  setInput(t, kael.id, { moveX: 0, moveY: 0, attack: true });
  run(t, 1.5);
  assert.equal(mira.hp, mira.maxHp);
});

test('F045 scenario "Brann goes down": Side 1 wins, and nothing but the stake is at play', () => {
  const t = arena([1, 2]);
  const [kael, brann] = [fighter(t, 0), fighter(t, 1)];
  t.time = B.arena.countdown + 1;
  const echo = kael.ch.echo;
  const skills = JSON.stringify(kael.ch.skills);
  testing.kill(t, t.depths[1]!, kael, brann);
  stepTithe(t, DT);
  assert.deepEqual(t.arena!.result, { winner: 1 });
  assert.equal(t.closed, true);
  assert.equal(t.defeats.length, 0); // no gold spilled, no Player defeated
  assert.equal(kael.ch.echo, echo); // no Echo
  assert.equal(JSON.stringify(kael.ch.skills), skills); // no training
  assert.equal(kael.end, null); // Kael still stands
});

test('F045: leaving counts as down; both sides down at once, or 4 minutes, is a draw', () => {
  const left = arena([1, 2]);
  left.time = B.arena.countdown + 1;
  left.players[1]!.end = { kind: 'left', name: 'p2', time: left.time };
  stepTithe(left, DT);
  assert.deepEqual(left.arena!.result, { winner: 1 });

  const late = arena([1, 2]);
  late.time = B.arena.hardLimit - 0.01;
  stepTithe(late, DT);
  assert.deepEqual(late.arena!.result, { winner: null });
});

test('F045 scenario "The ring closes": outside the ring a fighter loses 8 % of max life a second', () => {
  const t = arena([1, 2]);
  const kael = fighter(t, 0);
  t.time = 180;
  Object.assign(kael, { x: 3.5, y: 14 }); // by the stands
  const before = kael.hp;
  run(t, 1);
  assert.ok(before - kael.hp > kael.maxHp * B.arena.ringDamage * 0.8, `${before} → ${kael.hp}`);
  const brann = fighter(t, 1);
  Object.assign(brann, { x: 20.5, y: 14.5 }); // the middle is safe
  const mid = brann.hp;
  run(t, 1);
  assert.ok(brann.hp >= mid);
});

test('F045 scenario "Hiding in a bush": hidden from the other side unless close or just after striking', () => {
  const t = arena([1, 2, 1, 2], '2v2');
  const [kael, brann, mira] = [fighter(t, 0), fighter(t, 1), fighter(t, 2)];
  const map = t.depths[1]!.map;
  const i = map.tiles.indexOf(BUSH);
  Object.assign(brann, { x: (i % map.w) + 0.5, y: Math.floor(i / map.w) + 0.5, revealT: 0 });
  Object.assign(kael, { x: brann.x + 5, y: brann.y });
  assert.equal(hiddenFrom(t, brann, kael), true);
  Object.assign(kael, { x: brann.x + 1.5 });
  assert.equal(hiddenFrom(t, brann, kael), false); // within 2 tiles
  Object.assign(kael, { x: brann.x + 5 });
  brann.revealT = B.arena.revealSeconds;
  assert.equal(hiddenFrom(t, brann, kael), false); // just struck
  brann.revealT = 0;
  const partner = fighter(t, 3);
  Object.assign(partner, { x: brann.x + 6, y: brann.y });
  assert.equal(hiddenFrom(t, brann, partner), false); // the own side always sees it
  assert.equal(hiddenFrom(t, mira, brann), false); // Mira is not in a bush
});

test('F045: nothing can be dropped in the arena', () => {
  const t = arena([1, 2]);
  const item = fighter(t, 0).ch.equipment.armour!;
  fighter(t, 0).ch.inventory.push(item);
  assert.equal(sheetAction(t, 'u1', { action: 'drop', itemId: item.id }), 'invalid');
});

test('F046 scenarios: the winner takes the pot, two against one, and a draw', () => {
  assert.equal(arenaPayout(50, 2, 1, 'won'), 100); // "The winner takes the pot"
  assert.equal(arenaPayout(50, 2, 1, 'lost'), 0);
  assert.equal(arenaPayout(40, 3, 2, 'won'), 60); // "Two against one"
  assert.equal(arenaPayout(50, 2, 0, 'draw'), 50); // "A draw"
});
