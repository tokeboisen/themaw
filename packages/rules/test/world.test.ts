// Tithen med flere kandidater: scenarierne i Feature-010 til -017, -002, -003, -006, -008, -028 og -029.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BALANCE as B, chosenKey, createCharacter, createRng, createTithe, generateItem, leaveTithe, playersIn, queueAct, sealInfo, setInput,
  sheetAction, stepTithe, testing, type Character, type Hotbar, type Monster, type Player, type Rival, type Tithe,
} from '../src/index.ts';

const DT = 1 / 30;

function kael(seed = 1): Character {
  return createCharacter('Kael', 'miner', createRng(seed), B);
}

function tithe(players = 1, seed = 7): Tithe {
  return createTithe({
    id: 'T-test',
    name: 'Ashfall',
    seed,
    players: Array.from({ length: players }, (_, i) => {
      const character = kael(i + 1);
      const hotbar: Hotbar = { '1': { weapon: character.equipment.weapon!.id }, '2': { echoArt: 'Echo Bolt' } };
      return { userId: `u${i + 1}`, userName: `player${i + 1}`, characterId: `c${i + 1}`, character, hotbar };
    }),
  }, B);
}

const player = (t: Tithe, i = 0) => t.players[i]!;
const depth = (t: Tithe, p: Player) => t.depths[p.depth]!;
/** Læser slutningen igen, så TypeScript ikke husker en tidligere indsnævring. */
const endOf = (p: Player) => p.end;

/** Rydder dybden for monstre og flytter rivalerne væk, så en test kan stille sin egen situation op. */
function quiet(t: Tithe): void {
  for (const dep of Object.values(t.depths)) dep.monsters = dep.monsters.filter((m) => m.def.warden);
  for (const r of t.rivals) r.status = 'fallen';
}

function monsterNextTo(t: Tithe, p: Player, type = 'gnawer', level = 1): Monster {
  const m = testing.makeMonster(t, type, p.x + 0.7, p.y, level);
  depth(t, p).monsters.push(m);
  p.facing = { x: 1, y: 0 };
  return m;
}

function steps(t: Tithe, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) stepTithe(t, DT);
}

test('F010 scenario: a Tithe with one player has seven NPC rivals, each candidate in a room of its own', () => {
  const t = tithe(1);
  assert.equal(t.players.length, 1);
  assert.equal(t.rivals.length, 7);
  const dep = t.depths[1]!;
  const roomOf = (c: { x: number; y: number }) => dep.map.rooms.findIndex((r) => c.x >= r.x && c.x <= r.x + r.w && c.y >= r.y && c.y <= r.y + r.h);
  const rooms = [...t.players, ...t.rivals].map(roomOf);
  assert.ok(rooms.every((r) => r >= 0));
  assert.equal(new Set(rooms).size, Math.min(8, dep.startRooms.length));
  assert.ok(t.messages.some((m) => m.text.includes('20 seconds of grace')));
});

test('F010 scenario "A Tithe with three players starts": three players and five NPC rivals', () => {
  const t = tithe(3);
  assert.equal(t.rivals.length, 5);
  assert.ok(t.players.every((p) => p.hp === p.stats.maxHp && p.hunger === B.hunger.max));
});

test('F010 EVT-02: no candidate may strike another in the grace', () => {
  const t = tithe(1);
  quiet(t);
  const p = player(t);
  const r = t.rivals[0]!;
  r.status = 'in';
  r.real = true;
  r.x = p.x + 0.7;
  r.y = p.y;
  const hp = r.hp;
  testing.damage(t, depth(t, p), p, r, 10, false);
  assert.equal(r.hp, hp);
  t.time = B.tithe.graceSeconds + 1;
  testing.damage(t, depth(t, p), p, r, 10, false);
  assert.ok(r.hp < hp);
});

test('F011 scenario "A blow slays a Gnawer"', () => {
  const t = tithe(1);
  quiet(t);
  const p = player(t);
  const m = monsterNextTo(t, p);
  m.hp = 1;
  setInput(t, p.id, { moveX: 0, moveY: 0, attack: true });
  stepTithe(t, DT);
  assert.equal(m.dead, true);
  assert.equal(p.record.kills, 1);
});

test('F011 scenario "Striking a peaceful rival makes her hostile"', () => {
  const t = tithe(1);
  quiet(t);
  t.time = B.tithe.graceSeconds + 1;
  const p = player(t);
  const vessa = t.rivals.find((r) => r.id === 'vessa') ?? t.rivals[0]!;
  Object.assign(vessa, { status: 'in', real: true, aggressive: false, x: p.x + 0.7, y: p.y, depth: 1 });
  setInput(t, p.id, { moveX: 0, moveY: 0, attack: true });
  stepTithe(t, DT);
  assert.ok(vessa.hostileTo.has(p.id));
});

test('F011 scenario "No focus, no bolt"', () => {
  const t = tithe(1);
  quiet(t);
  const p = player(t);
  p.focus = 5;
  queueAct(t, p.id, { act: 'hotkey', key: '2' }); // Echo Bolt is chosen …
  setInput(t, p.id, { moveX: 0, moveY: 0, attack: true }); // … and Attack casts it
  stepTithe(t, DT);
  assert.equal(depth(t, p).projectiles.length, 0);
  p.focus = 20;
  stepTithe(t, DT);
  assert.equal(depth(t, p).projectiles.length, 1);
});

test('F028 scenario "Choosing Echo Bolt"', () => {
  const t = tithe(1);
  quiet(t);
  const p = player(t);
  const pickaxe = p.ch.equipment.weapon!;
  queueAct(t, p.id, { act: 'hotkey', key: '2' });
  stepTithe(t, DT);
  assert.equal(depth(t, p).projectiles.length, 0); // no Echo Bolt is cast
  assert.equal(p.ch.equipment.weapon?.id, pickaxe.id); // Kael still holds the Pickaxe
  assert.equal(chosenKey(p), '2');
  setInput(t, p.id, { moveX: 0, moveY: 0, attack: true });
  stepTithe(t, DT);
  assert.equal(depth(t, p).projectiles[0]?.kind, 'bolt'); // Attack casts Echo Bolt
  // Key 1 chooses the Pickaxe again, and Attack swings it.
  queueAct(t, p.id, { act: 'hotkey', key: '1' });
  stepTithe(t, DT);
  assert.equal(chosenKey(p), '1');
});

test('F012 scenario "Kael descends": depth 2, its start room and 20 Renown', () => {
  const t = tithe(1);
  quiet(t);
  const p = player(t);
  const exit = depth(t, p).map.exit;
  p.x = exit.x + 0.5;
  p.y = exit.y + 0.5;
  stepTithe(t, DT);
  queueAct(t, p.id, { act: 'interact' });
  stepTithe(t, DT);
  assert.equal(p.depth, 2);
  const start = t.depths[2]!.map.start;
  assert.ok(Math.hypot(p.x - start.x - 0.5, p.y - start.y - 0.5) < 0.6);
  assert.equal(p.record.maxDepth, 2);
  assert.equal(p.record.renown, B.renown.depth);
});

test('F013 scenario "A potion heals" and F008 scenario "A potion is drunk"', () => {
  const t = tithe(1);
  quiet(t);
  const p = player(t);
  p.hp = 20;
  const potions = p.ch.potions;
  queueAct(t, p.id, { act: 'potion' });
  stepTithe(t, DT);
  const heal = Math.round(p.stats.maxHp * 0.4);
  assert.ok(Math.abs(p.hp - (20 + heal)) < 0.1);
  assert.equal(p.ch.potions, potions - 1);
});

test('F008 scenario "Full life keeps the potion"', () => {
  const t = tithe(1);
  quiet(t);
  const p = player(t);
  const potions = p.ch.potions;
  queueAct(t, p.id, { act: 'potion' });
  stepTithe(t, DT);
  assert.equal(p.ch.potions, potions);
});

test('F008 scenario "A ration is eaten"', () => {
  const t = tithe(1);
  quiet(t);
  const p = player(t);
  p.hunger = 30;
  const rations = p.ch.rations;
  queueAct(t, p.id, { act: 'ration' });
  stepTithe(t, DT);
  assert.equal(p.ch.rations, rations - 1);
  assert.ok(p.hunger > 74);
});

test('F013 scenario "The player falls", and F016: the Tithe closes when no player is left', () => {
  const t = tithe(1);
  quiet(t);
  const p = player(t);
  const m = monsterNextTo(t, p);
  p.hp = 3;
  testing.damage(t, depth(t, p), m, p, 50, false);
  assert.deepEqual(p.end && { kind: p.end.kind, name: p.end.name }, { kind: 'fell', name: 'Gnawer' });
  stepTithe(t, DT);
  assert.equal(t.closed, true);
});

test('F013 scenario "A sealed depth collapses": 3 % of max life per second', () => {
  const t = tithe(1);
  quiet(t);
  const p = player(t);
  p.hunger = 100;
  t.time = 240;
  const before = p.hp;
  steps(t, 1);
  // 3 % af max liv i sekundet, minus den naturlige heling på 0,3 i sekundet
  assert.ok(Math.abs(before - p.hp - (p.stats.maxHp * 0.03 - 0.3)) < 0.2, `${before - p.hp}`);
});

test('F014 scenario "A rival claims the Tithe" while the player is in depth 2', () => {
  const t = tithe(1);
  quiet(t);
  const p = player(t);
  testing.enterDepth(t, p, 2);
  const cassian = t.rivals[0]!;
  Object.assign(cassian, { status: 'in', real: false, depth: 3, progress: 1 });
  t.wardenHpFactor = 0.01; // så rivalen vinder med 95 %
  steps(t, B.tithe.abstractWardenFight + 1);
  assert.equal(t.champion, cassian.name);
  assert.deepEqual(p.end && { kind: p.end.kind, name: p.end.name }, { kind: 'rival-champion', name: cassian.name });
  assert.equal(t.closed, true);
});

test('F014 scenario "A sealed depth makes the rivals hurry"', () => {
  const t = tithe(1);
  quiet(t);
  const p = player(t);
  testing.enterDepth(t, p, 2);
  const vessa = t.rivals[1]!;
  Object.assign(vessa, { status: 'in', real: false, depth: 1, progress: 0 });
  stepTithe(t, DT);
  const slow = vessa.progress;
  vessa.progress = 0;
  t.time = 300;
  stepTithe(t, DT);
  assert.ok(Math.abs(vessa.progress - 3 * slow) < 1e-9);
});

test('F015 scenarios: the gate is closed while The Foreman lives, and the slayer claims the Tithe', () => {
  const t = tithe(2);
  quiet(t);
  const [kael, brann] = [player(t, 0), player(t, 1)];
  testing.enterDepth(t, kael, 3);
  const gate = depth(t, kael).map.gate!;
  kael.x = gate.x + 0.5;
  kael.y = gate.y + 1.2;
  queueAct(t, kael.id, { act: 'interact' });
  stepTithe(t, DT);
  assert.ok(!kael.end); // nothing is recorded
  const foreman = depth(t, kael).monsters.find((m) => m.def.warden)!;
  testing.kill(t, depth(t, kael), kael, foreman);
  assert.equal(kael.record.wardenSlain, true);
  stepTithe(t, DT);
  queueAct(t, kael.id, { act: 'interact' });
  stepTithe(t, DT);
  assert.equal(endOf(kael)?.kind, 'champion');
  assert.deepEqual(brann.end && { kind: brann.end.kind, name: brann.end.name }, { kind: 'rival-champion', name: 'Kael' });
  assert.equal(t.champion, 'Kael');
});

test('F017 scenario "A kill streak brings a sponsor gift" with 15 Renown', () => {
  const t = tithe(1);
  quiet(t);
  const p = player(t);
  t.time = 100;
  for (let i = 0; i < 3; i++) {
    const m = monsterNextTo(t, p);
    t.time += 1;
    testing.kill(t, depth(t, p), p, m);
  }
  assert.ok(t.messages.some((m) => m.text.includes('A gift falls from the offering shaft')));
  assert.equal(p.record.renown, 3 * 2 + B.renown.streak);
});

test('F017 scenario "A bored crowd gets beasts": 4 Gnawers that drop nothing', () => {
  const t = tithe(1, 11);
  quiet(t);
  const p = player(t);
  steps(t, B.mirrormaster.boredAfter + 0.5);
  const gnawers = depth(t, p).monsters.filter((m) => m.summoned);
  assert.equal(gnawers.length, 4);
  assert.ok(gnawers.every((m) => Math.hypot(m.x - p.x, m.y - p.y) >= 5));
});

test('F017 scenario "Depth 1 is sealed": announced 30 seconds before 240 seconds', () => {
  const t = tithe(1);
  quiet(t);
  const p = player(t);
  t.time = 209.9;
  p.mm.lastDamageAt = 1e9;
  stepTithe(t, 0.2);
  assert.ok(t.messages.some((m) => m.text === 'Depth 1 grows dull. I will seal it in 30 seconds.'));
  assert.equal(sealInfo(t, 1)?.sealed, false);
  t.time = 240;
  stepTithe(t, DT);
  assert.equal(sealInfo(t, 1)?.sealed, true);
});

test('F002 scenario "A blow raises the weapon\'s skill"', () => {
  const t = tithe(1);
  quiet(t);
  const p = player(t);
  p.ch.skills.heavy = { level: 10, xp: 11.5 };
  p.ch.attributes.intelligence = 10; // ingen bonus for Intelligence
  const m = monsterNextTo(t, p);
  testing.damage(t, depth(t, p), p, m, 1, false, { skill: 'heavy', train: true });
  assert.equal(p.ch.skills.heavy.level, 11);
});

test('F002 scenario "Weak enemies teach little": 0.25 experience at Mark 4', () => {
  const t = tithe(1);
  quiet(t);
  const p = player(t);
  p.ch.level = 4;
  p.ch.attributes.intelligence = 10;
  p.ch.skills.heavy = { level: 10, xp: 0 };
  const m = monsterNextTo(t, p);
  testing.damage(t, depth(t, p), p, m, 1, false, { skill: 'heavy', train: true });
  assert.equal(p.ch.skills.heavy.xp, 0.25);
});

test('F003 scenario "A Mark burns in"', () => {
  const t = tithe(1);
  quiet(t);
  const p = player(t);
  p.ch.echo = 15;
  const m = monsterNextTo(t, p, 'gnawer', 2);
  testing.kill(t, depth(t, p), p, m);
  assert.equal(p.ch.level, 2);
  assert.equal(p.ch.echo, 1);
  assert.equal(p.ch.attributePoints, 3);
  assert.equal(p.ch.skillPoints, 2);
});

test('F006 scenarios: an item is picked up and marked as found; a full pack leaves it on the floor', () => {
  const t = tithe(1);
  quiet(t);
  const p = player(t);
  const dep = depth(t, p);
  const axe = generateItem(createRng(3), 2, B, { baseId: 'war_axe', rarity: 'magic' });
  dep.loot.push({ id: 'l-axe', kind: 'item', item: axe, x: p.x, y: p.y });
  stepTithe(t, DT);
  assert.equal(p.ch.inventory.at(-1)?.found, t.id);
  for (let i = p.ch.inventory.length; i < p.stats.capacity; i++) p.ch.inventory.push(generateItem(createRng(i + 10), 1, B, { slot: 'ring' }));
  dep.loot.push({ id: 'l-ring', kind: 'item', item: generateItem(createRng(99), 1, B, { slot: 'ring' }), x: p.x, y: p.y });
  stepTithe(t, DT);
  assert.equal(dep.loot.length, 1);
  assert.ok(t.fx.some((f) => f.text === 'Inventory full'));
});

test('F006 EVT-03: gold found is counted, not added to the wallet', () => {
  const t = tithe(1);
  quiet(t);
  const p = player(t);
  const gold = p.ch.gold;
  depth(t, p).loot.push({ id: 'l-gold', kind: 'gold', amount: 33, x: p.x, y: p.y });
  stepTithe(t, DT);
  assert.equal(p.record.goldFound, 33);
  assert.equal(p.ch.gold, gold);
});

test('F028 scenario "Drawing the bow"', () => {
  const t = tithe(1);
  quiet(t);
  const p = player(t);
  const pickaxe = p.ch.equipment.weapon!;
  const bow = generateItem(createRng(5), 1, B, { baseId: 'short_bow', rarity: 'common' });
  p.ch.inventory.push(bow);
  assert.equal(sheetAction(t, p.id, { action: 'hotbar', key: '3', itemId: bow.id }), null);
  queueAct(t, p.id, { act: 'hotkey', key: '3' });
  stepTithe(t, DT);
  assert.equal(p.ch.equipment.weapon?.id, bow.id);
  assert.ok(p.ch.inventory.some((i) => i.id === pickaxe.id));
  assert.equal(p.stats.weapon.skill, 'bows'); // Attack shoots the Short Bow, and its arrows train Bows
  assert.equal(chosenKey(p), '3');
  assert.ok(p.drawT > 0); // cannot strike while drawing
});

test('F007 CMD-03: dropping during a Tithe removes the item and its hotbar key', () => {
  const t = tithe(1);
  quiet(t);
  const p = player(t);
  const bow = generateItem(createRng(5), 1, B, { baseId: 'short_bow', rarity: 'common' });
  p.ch.inventory.push(bow);
  sheetAction(t, p.id, { action: 'hotbar', key: '3', itemId: bow.id });
  assert.equal(sheetAction(t, p.id, { action: 'drop', itemId: bow.id }), null);
  assert.equal(p.ch.inventory.length, 0);
  assert.equal(p.hotbar['3'], undefined);
  assert.equal(sheetAction(t, p.id, { action: 'drop', itemId: bow.id }), 'invalid');
});

test('F029 scenario "Kael leaves": the Tithe goes on for the other candidates', () => {
  const t = tithe(2);
  const [kael, brann] = [player(t, 0), player(t, 1)];
  leaveTithe(t, kael.id);
  assert.equal(kael.end?.kind, 'left');
  stepTithe(t, DT);
  assert.equal(t.closed, false);
  assert.deepEqual(playersIn(t).map((p) => p.id), [brann.id]);
});

test('F014: an NPC rival never strikes another NPC rival', () => {
  const t = tithe(1);
  quiet(t);
  t.time = 100;
  const [a, b] = t.rivals as [Rival, Rival];
  const hp = b.hp;
  testing.damage(t, t.depths[1]!, a, b, 20, false);
  assert.equal(b.hp, hp);
});
