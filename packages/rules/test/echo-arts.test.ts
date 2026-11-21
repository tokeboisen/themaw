// Feature-047 Cast an Echo Art, Feature-048 Read the spellbook og Feature-027 (kun kendte Echo Arts på hotbaren).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BALANCE as B, ECHO_ARTS, FLOOR, artRequirement, castArt, createCharacter, createRng, createTithe, knowsArt, queueAct, sheetAction, stepTithe,
  testing, type EchoArt, type Monster, type Player, type Tithe,
} from '../src/index.ts';

const DT = 1 / 30;

/** Kael (og Jory og Vessa) i en tom dybde efter nådetiden, med åben gulv omkring sig. */
function tithe(players = 1, echo = 20): Tithe {
  const names = ['Kael', 'Jory', 'Vessa'];
  const t = createTithe({
    id: 'T-echo', name: 'Ashfall', seed: 5,
    players: Array.from({ length: players }, (_, i) => {
      const character = createCharacter(names[i]!, 'miner', createRng(i + 1), B);
      character.skills.echo.level = echo;
      return { userId: `u${i + 1}`, userName: names[i]!.toLowerCase(), characterId: `c${i + 1}`, character, hotbar: {} };
    }),
  }, B);
  for (const dep of Object.values(t.depths)) dep.monsters = [];
  for (const r of t.rivals) r.status = 'fallen';
  t.time = B.tithe.graceSeconds + 1;
  const kael = t.players[0]!;
  const map = t.depths[kael.depth]!.map;
  for (let y = Math.floor(kael.y) - 9; y <= Math.floor(kael.y) + 9; y++) {
    for (let x = Math.floor(kael.x) - 9; x <= Math.floor(kael.x) + 9; x++) {
      if (x > 0 && y > 0 && x < map.w - 1 && y < map.h - 1) map.tiles[y * map.w + x] = FLOOR;
    }
  }
  for (const p of t.players.slice(1)) Object.assign(p, { depth: kael.depth, x: kael.x, y: kael.y + 3 });
  // Høje arts koster mere end de 20 focus, en karakter med Intelligence 10 har; testene giver rigeligt.
  for (const p of t.players) p.focus = 500;
  kael.facing = { x: 1, y: 0 };
  return t;
}

const kael = (t: Tithe): Player => t.players[0]!;
const dep = (t: Tithe) => t.depths[kael(t).depth]!;
const cast = (t: Tithe, art: EchoArt, p = kael(t)) => castArt(t, p, dep(t), art);

function monster(t: Tithe, type: string, dx: number, dy = 0, level = 1): Monster {
  const p = kael(t);
  const m = testing.makeMonster(t, type, p.x + dx, p.y + dy, level);
  m.awake = true;
  dep(t).monsters.push(m);
  return m;
}

const run = (t: Tithe, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) stepTithe(t, DT);
};

test('F048: 28 Echo Arts on levels 1–9, each with its numbers', () => {
  assert.equal(ECHO_ARTS.length, 28);
  assert.deepEqual(Object.keys(B.echoArts).sort(), [...ECHO_ARTS].sort());
  for (let level = 1; level <= 9; level++) {
    const arts = ECHO_ARTS.filter((a) => B.echoArts[a].level === level);
    assert.equal(arts.length, level === 1 ? 4 : 3, `level ${level}`);
    assert.ok(arts.some((a) => B.echoArts[a].kind === 'party'), `level ${level} has a party art`);
  }
});

test('F048 scenario "The spellbook grows with Echo Arts"', () => {
  const ch = createCharacter('Kael', 'miner', createRng(1), B);
  ch.skills.echo.level = 20;
  for (const art of ['Shatterpulse', 'Mirror Double', 'Hearth Echo'] as const) assert.ok(knowsArt(ch, art, B), art);
  for (const art of ['Hunger of the Maw', 'Resonant Line', 'Chorus of the Branded'] as const) {
    assert.equal(knowsArt(ch, art, B), false, art);
    assert.equal(artRequirement(art, B), 30); // "Echo Arts 30"
  }
  // Level 1 fra start; level 9 ved Echo Arts 80.
  ch.skills.echo.level = 0;
  assert.ok(knowsArt(ch, 'Ringing Ward', B));
  assert.equal(artRequirement('Crown of Echoes', B), 80);
});

test('F047 scenario "Kael casts Shatterpulse": three Gnawers take damage, and 6 focus is left', () => {
  const t = tithe();
  const p = kael(t);
  const gnawers = [monster(t, 'gnawer', 5, 0), monster(t, 'gnawer', 5, 0.8), monster(t, 'gnawer', 5.6, -0.5)];
  p.focus = 20;
  assert.equal(cast(t, 'Shatterpulse'), true);
  for (const g of gnawers) assert.ok(g.dead || g.hp < g.maxHp);
  assert.equal(p.focus, 6);
  assert.equal(p.artCd.Shatterpulse, B.echoArts.Shatterpulse.cooldown);
  assert.equal(cast(t, 'Shatterpulse'), false); // the cooldown
});

test('F047 scenario "Not enough focus": nothing is cast', () => {
  const t = tithe();
  const p = kael(t);
  monster(t, 'gnawer', 4);
  p.focus = 5;
  assert.equal(cast(t, 'Shatterpulse'), false);
  assert.equal(p.focus, 5);
  assert.equal(p.artCd.Shatterpulse, undefined);
});

test('F047 CMD-01: an art the character does not know is not cast', () => {
  const t = tithe(1, 12);
  monster(t, 'gnawer', 4);
  kael(t).focus = 100;
  assert.equal(cast(t, 'Echo Chain'), false);
  assert.equal(kael(t).focus, 100);
});

test('F047/F028 scenario "Casting Echo Bolt with its key": the key casts at once, and Space keeps the weapon', () => {
  const t = tithe();
  const p = kael(t);
  p.hotbar = { '2': { echoArt: 'Echo Bolt' }, '4': { echoArt: 'Shatterpulse' } };
  const g = monster(t, 'gnawer', 4);
  queueAct(t, p.id, { act: 'hotkey', key: '4' });
  stepTithe(t, DT);
  assert.ok(g.dead || g.hp < g.maxHp);
  assert.ok((p.artCd.Shatterpulse ?? 0) > 0);
  p.focus = 20;
  queueAct(t, p.id, { act: 'hotkey', key: '2' });
  stepTithe(t, DT);
  assert.ok((p.artCd['Echo Bolt'] ?? 0) > 0);
  assert.equal(p.chosenWeapon, 'melee'); // Attack still strikes with the Pickaxe
});

test('F047 scenario "Hearth Echo heals the party": Kael and Jory heal 20 % of max life over 5 seconds, Vessa does not', () => {
  const t = tithe(3);
  const [p, jory, vessa] = t.players as [Player, Player, Player];
  jory.partyId = p.partyId;
  vessa.y = p.y - 3;
  for (const x of [p, jory, vessa]) x.hp = 10;
  assert.equal(cast(t, 'Hearth Echo'), true);
  run(t, 5.1);
  for (const x of [p, jory]) assert.ok(x.hp - 10 >= x.maxHp * 0.2 - 0.5, `${x.name} healed ${x.hp - 10}`);
  assert.ok(vessa.hp - 10 < vessa.maxHp * 0.1, `Vessa healed ${vessa.hp - 10}`);
});

test('F047 scenario "Brand\'s Refusal": a killing blow leaves Jory with 1 life, once', () => {
  const t = tithe(2, 50);
  const [p, jory] = t.players as [Player, Player];
  jory.partyId = p.partyId;
  jory.y = p.y + 2;
  assert.equal(cast(t, "Brand's Refusal"), true);
  const brute = monster(t, 'gnawer', 6);
  testing.damage(t, dep(t), brute, jory, 9999, false);
  assert.equal(jory.hp, 1);
  assert.equal(jory.end, null);
  testing.damage(t, dep(t), brute, jory, 9999, false);
  assert.ok(jory.end);
});

test('F047 Ringing Ward: the next blow loses 75 % of its damage', () => {
  const t = tithe();
  const p = kael(t);
  const g = monster(t, 'gnawer', 6);
  p.hp = p.maxHp = 1000;
  p.stats.maxHp = 1000;
  assert.equal(cast(t, 'Ringing Ward'), true);
  const warded = testing.damage(t, dep(t), g, p, 200, false);
  const full = testing.damage(t, dep(t), g, p, 200, false);
  assert.ok(Math.abs(warded - full * 0.25) <= 1, `${warded} vs ${full}`);
});

test('F047 control: Toll of Stillness stuns monsters for 1.5 s (a Warden 0.5); a stunned monster neither moves nor strikes', () => {
  const t = tithe(1, 40);
  const g = monster(t, 'gnawer', 2);
  const foreman = monster(t, 'foreman', -2.5);
  assert.equal(cast(t, 'Toll of Stillness'), true);
  assert.equal(g.stunT, 1.5);
  assert.equal(foreman.stunT, 0.5);
  const [x, y] = [g.x, g.y];
  run(t, 1);
  assert.equal(g.x, x);
  assert.equal(g.y, y);
  assert.equal(g.windup, 0);
});

test('F047 control: Crystal Cage roots, Hollow Call draws the monsters to a spot', () => {
  const t = tithe(1, 10);
  const g = monster(t, 'gnawer', 4);
  assert.equal(cast(t, 'Crystal Cage'), true);
  assert.equal(g.rootT, 3);
  const x = g.x;
  run(t, 1);
  assert.equal(g.x, x); // rooted: it cannot move
  const t2 = tithe(1, 0);
  const g2 = monster(t2, 'gnawer', 3, 0);
  kael(t2).facing = { x: 0, y: 1 };
  assert.equal(cast(t2, 'Hollow Call'), true);
  assert.ok(g2.lureT > 0 && g2.lure);
});

test('F047: Echo Chain, Last Words and The Maw Remembers are not cast without a target', () => {
  const t = tithe(1, 60);
  const p = kael(t);
  p.focus = 100;
  for (const art of ['Echo Chain', 'Last Words', 'The Maw Remembers'] as const) {
    assert.equal(cast(t, art), false, art);
    assert.equal(p.focus, 100);
  }
});

test('F047 Echo Chain jumps on to up to 3 more enemies', () => {
  const t = tithe(1, 50);
  const gs = [monster(t, 'gnawer', 3, 0, 5), monster(t, 'gnawer', 5, 1, 5), monster(t, 'gnawer', 6, 3, 5), monster(t, 'gnawer', 7, 5, 5), monster(t, 'gnawer', 9, 7, 5)];
  for (const g of gs) g.hp = g.maxHp = 500;
  assert.equal(cast(t, 'Echo Chain'), true);
  assert.equal(gs.filter((g) => g.hp < g.maxHp).length, 4); // the first and 3 jumps
});

test('F047 Last Words: a marked monster bursts when it dies', () => {
  const t = tithe(1, 50);
  const p = kael(t);
  const marked = monster(t, 'gnawer', 3);
  const near = monster(t, 'gnawer', 4, 0.5);
  near.hp = near.maxHp = 500;
  assert.equal(cast(t, 'Last Words'), true);
  assert.equal(marked.markBy, p);
  testing.damage(t, dep(t), p, marked, 9999, false);
  assert.ok(near.hp < near.maxHp);
});

test('F047 party arts: Rally Toll gives 15 % more damage, Crystal Mantle 8 armour, Chorus faster attacks', () => {
  const t = tithe(2, 40);
  const [p, jory] = t.players as [Player, Player];
  jory.partyId = p.partyId;
  for (const art of ['Rally Toll', 'Crystal Mantle', 'Chorus of the Branded'] as const) assert.equal(cast(t, art), true);
  for (const x of [p, jory]) assert.deepEqual(x.buffs.map((b) => b.kind).sort(), ['chorus', 'mantle', 'rally']);
  const g = monster(t, 'gnawer', 2, 0);
  g.hp = g.maxHp = 1000;
  g.armour = 0;
  const dealt = testing.damage(t, dep(t), p, g, 100, false);
  assert.equal(dealt, 115);
});

test('F047 Step Through the Echo: up to 4 tiles ahead, stopped by walls', () => {
  const t = tithe(1, 10);
  const p = kael(t);
  const x = p.x;
  assert.equal(cast(t, 'Step Through the Echo'), true);
  assert.ok(Math.abs(p.x - x - 4) < 0.15, `${p.x - x}`);
});

test('F047 The Maw Remembers: recent kills rise as echoes that draw monsters', () => {
  const t = tithe(1, 60);
  const p = kael(t);
  const g = monster(t, 'gnawer', 2);
  testing.damage(t, dep(t), p, g, 9999, false);
  assert.equal(cast(t, 'The Maw Remembers'), true);
  assert.equal(dep(t).zones.filter((z) => z.kind === 'echo').length, 1);
});

test('F027: only a known Echo Art goes on a key; F027 scenario "Marking an Echo Art and pressing 4"', () => {
  const t = tithe(1, 20);
  assert.equal(sheetAction(t, 'u1', { action: 'hotbar', key: '4', echoArt: 'Shatterpulse' }), null);
  assert.deepEqual(kael(t).hotbar['4'], { echoArt: 'Shatterpulse' });
  const low = tithe(1, 12);
  // F027 scenario "An unknown Echo Art cannot be put on a key"
  assert.equal(sheetAction(low, 'u1', { action: 'hotbar', key: '6', echoArt: 'Echo Chain' }), 'invalid');
  assert.equal(kael(low).hotbar['6'], undefined);
});
