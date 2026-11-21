// Feature-049 Use a talent og Feature-013/-045: at skjule sig i en busk, der toner frem, når andre kommer tættere på.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BALANCE as B, BUSH, FLOOR, createCharacter, createRng, createTithe, hiddenFrom, queueAct, refreshStats, setInput, stepTithe, testing, transparencyFor,
  useTalent, type Monster, type Player, type Tithe,
} from '../src/index.ts';

const DT = 1 / 30;

/** En spiller med baggrunden og talent-niveauet, Intelligence og de andre attributter på 10, i en tom, åben dybde. */
function tithe(background: string, talent: number, players = 1): Tithe {
  const t = createTithe({
    id: 'T-talent', name: 'Ashfall', seed: 6,
    players: Array.from({ length: players }, (_, i) => {
      const character = createCharacter(['Rook', 'Jory', 'Vessa'][i]!, i === 0 ? background : 'miner', createRng(i + 1), B);
      for (const a of Object.keys(character.attributes) as (keyof typeof character.attributes)[]) character.attributes[a] = 10;
      character.skills.talent = { level: talent, xp: 0 };
      return { userId: `u${i + 1}`, userName: `p${i + 1}`, characterId: `c${i + 1}`, character, hotbar: { '3': { talent: B.backgrounds.find((b) => b.id === background)!.talent } } };
    }),
  }, B);
  for (const dep of Object.values(t.depths)) dep.monsters = [];
  for (const r of t.rivals) r.status = 'fallen';
  t.time = B.tithe.graceSeconds + 1;
  const p = t.players[0]!;
  const map = t.depths[p.depth]!.map;
  for (let y = Math.floor(p.y) - 8; y <= Math.floor(p.y) + 8; y++) {
    for (let x = Math.floor(p.x) - 8; x <= Math.floor(p.x) + 8; x++) {
      if (x > 0 && y > 0 && x < map.w - 1 && y < map.h - 1) map.tiles[y * map.w + x] = FLOOR;
    }
  }
  for (const o of t.players.slice(1)) Object.assign(o, { depth: p.depth, x: p.x, y: p.y + 2 });
  for (const o of t.players) refreshStats(t, o);
  return t;
}

const me = (t: Tithe): Player => t.players[0]!;
const dep = (t: Tithe) => t.depths[me(t).depth]!;
function monster(t: Tithe, dx: number, dy = 0): Monster {
  const m = testing.makeMonster(t, 'gnawer', me(t).x + dx, me(t).y + dy, 1);
  m.awake = true;
  dep(t).monsters.push(m);
  return m;
}
const run = (t: Tithe, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) stepTithe(t, DT);
};

test('F049 scenario "Hiding in plain sight": 80 % transparent for 11 seconds, seen only within 2 tiles', () => {
  const t = tithe('runner', 30);
  const rook = me(t);
  rook.focus = 20;
  const gnawer = monster(t, 4);
  assert.equal(useTalent(t, rook), true);
  const hide = rook.buffs.find((b) => b.kind === 'hide')!;
  assert.equal(hide.value, 0.8);
  assert.ok(Math.abs(hide.t - 11) < 1e-9);
  assert.equal(rook.focus, 8);
  assert.equal(hiddenFrom(t, rook, gnawer), true);
  assert.equal(transparencyFor(t, rook, gnawer), 1);
  gnawer.x = rook.x + 1.9;
  assert.equal(hiddenFrom(t, rook, gnawer), false);
  assert.equal(transparencyFor(t, rook, gnawer), 0.8);
});

test('F049: striking ends Hide', () => {
  const t = tithe('runner', 10);
  const rook = me(t);
  useTalent(t, rook);
  monster(t, 1);
  setInput(t, rook.id, { moveX: 0, moveY: 0, attack: true });
  stepTithe(t, DT);
  assert.ok(!rook.buffs.some((b) => b.kind === 'hide'));
  assert.ok(rook.revealT > 0);
});

test('F049 scenario "Berserk all around": the swing hits on all sides', () => {
  const t = tithe('miner', 40);
  const kael = me(t);
  kael.stamina = 100;
  const around = [monster(t, 1.6, 0), monster(t, -1.6, 0), monster(t, 0, 1.6), monster(t, 0, -1.6)];
  for (const g of around) g.hp = g.maxHp = 500;
  assert.equal(useTalent(t, kael), true);
  setInput(t, kael.id, { moveX: 0, moveY: 0, attack: true });
  stepTithe(t, DT);
  assert.equal(kael.swingArc, 360);
  assert.ok(around.every((g) => g.hp < g.maxHp), around.map((g) => g.hp).join(','));
});

test('F049 scenario "Not enough stamina": nothing is used', () => {
  const t = tithe('poacher', 0);
  const vessa = me(t);
  vessa.stamina = 10;
  assert.equal(useTalent(t, vessa), false);
  assert.equal(vessa.talentCd, 0);
});

test('F049 Haste: faster on the feet', () => {
  const t = tithe('poacher', 20);
  const vessa = me(t);
  setInput(t, vessa.id, { moveX: 1, moveY: 0, attack: false });
  const x0 = vessa.x;
  run(t, 0.5);
  const slow = vessa.x - x0;
  useTalent(t, vessa);
  const x1 = vessa.x;
  run(t, 0.5);
  assert.ok(vessa.x - x1 > slow * 1.2, `${vessa.x - x1} vs ${slow}`);
});

test('F049 scenario "The Healing Circle heals the party"', () => {
  const t = tithe('acolyte', 0, 2);
  const [mira, jory] = t.players as [Player, Player];
  jory.partyId = mira.partyId;
  jory.hp = 20;
  mira.focus = 30;
  assert.equal(useTalent(t, mira), true);
  run(t, 5.2);
  assert.ok(jory.hp - 20 >= jory.maxHp * 0.15 - 1, `${jory.hp - 20} of ${jory.maxHp}`);
});

test('F028/F049: the talent key uses the talent at once, chooses nothing, and trains the talent', () => {
  const t = tithe('runner', 0);
  const rook = me(t);
  rook.focus = 20;
  queueAct(t, rook.id, { act: 'hotkey', key: '3' });
  stepTithe(t, DT);
  assert.ok(rook.buffs.some((b) => b.kind === 'hide'));
  assert.equal(rook.chosenArt, null);
  assert.ok(rook.ch.skills.talent.xp > 0);
});

test('F013/F045: a fighter in a bush fades in – invisible beyond 3 tiles, 80 % transparent at 1 tile', () => {
  const t = createTithe({
    id: 'A-bush', name: 'Sand', reach: 'arena', seed: 3, arena: { format: '1v1', stake: 0 },
    players: [1, 2].map((side) => {
      const character = createCharacter(`F${side}`, 'miner', createRng(side), B);
      return { userId: `u${side}`, userName: `p${side}`, characterId: `c${side}`, character, hotbar: {}, side: side as 1 | 2 };
    }),
  }, B);
  const [a, b] = t.players as [Player, Player];
  const map = t.depths[1]!.map;
  const i = map.tiles.indexOf(BUSH);
  Object.assign(b, { x: (i % map.w) + 0.5, y: Math.floor(i / map.w) + 0.5, revealT: 0 });
  const at = (d: number) => { Object.assign(a, { x: b.x + d, y: b.y }); return transparencyFor(t, b, a); };
  assert.equal(at(4), 1);
  assert.ok(Math.abs(at(2) - 0.9) < 1e-9);
  assert.equal(at(1), 0.8);
  Object.assign(a, { x: b.x + 2.5 });
  assert.equal(hiddenFrom(t, b, a), true); // seen faintly, but not to be struck before 2 tiles
});

test('F049: the Healing Circle moves with the Temple Acolyte', () => {
  const t = tithe('acolyte', 0);
  const mira = me(t);
  mira.focus = 30;
  useTalent(t, mira);
  const circle = dep(t).zones.find((z) => z.kind === 'heal')!;
  setInput(t, mira.id, { moveX: 1, moveY: 0, attack: false });
  run(t, 1);
  assert.ok(Math.abs(circle.x - mira.x) < 0.01 && Math.abs(circle.y - mira.y) < 0.01);
});
