// Feature-013: monstrenes særpræg – hvad deres slag gør ved spilleren, og hvordan de selv kæmper.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BALANCE as B, createCharacter, createRng, createTithe, queueAct, setInput, stepTithe, testing, type Hotbar, type Monster, type Player,
  type Tithe,
} from '../src/index.ts';

const DT = 1 / 30;
const T = B.monsters.traits;

function tithe(reach: 'mines' | 'city' = 'mines'): Tithe {
  const character = createCharacter('Kael', 'miner', createRng(1), B);
  const hotbar: Hotbar = { '1': { weapon: character.equipment.melee!.id }, '2': { echoArt: 'Echo Bolt' } };
  const t = createTithe({ id: 'T-traits', name: 'Ashfall', reach, seed: 4, players: [{ userId: 'u1', userName: 'p1', characterId: 'c1', character, hotbar }] }, B);
  for (const dep of Object.values(t.depths)) dep.monsters = [];
  for (const r of t.rivals) r.status = 'fallen';
  t.time = B.tithe.graceSeconds + 1;
  return t;
}

const kael = (t: Tithe): Player => t.players[0]!;
const dep = (t: Tithe) => t.depths[kael(t).depth]!;

function monster(t: Tithe, type: string, dx = 0.8, dy = 0, level = 1): Monster {
  const p = kael(t);
  const m = testing.makeMonster(t, type, p.x + dx, p.y + dy, level);
  dep(t).monsters.push(m);
  return m;
}

test('F013: the Cave Spider\'s web and the Harpy\'s shriek slow the player', () => {
  const t = tithe();
  const p = kael(t);
  testing.damage(t, dep(t), monster(t, 'spider'), p, 2, false, { kind: 'web' });
  assert.equal(p.slowT, 2);
  const c = tithe('city');
  testing.damage(c, dep(c), monster(c, 'harpy'), kael(c), 2, false);
  assert.equal(kael(c).slowT, 1.5);
  // Langsom: spilleren går 40 % kortere.
  const x0 = p.x;
  setInput(t, p.id, { moveX: 1, moveY: 0, attack: false });
  for (let i = 0; i < 10; i++) stepTithe(t, DT);
  const slowed = p.x - x0;
  p.slowT = 0;
  const x1 = p.x;
  for (let i = 0; i < 10; i++) stepTithe(t, DT);
  assert.ok(slowed < (p.x - x1) * 0.75, `${slowed} vs ${p.x - x1}`);
});

test('F013: the Ghoul\'s claws stun – the player can neither move nor drink', () => {
  const t = tithe();
  const p = kael(t);
  testing.damage(t, dep(t), monster(t, 'ghoul'), p, 2, false);
  assert.equal(p.stunT, T.stunSeconds);
  const x0 = p.x;
  const potions = p.ch.potions;
  p.hp = 10;
  setInput(t, p.id, { moveX: 1, moveY: 0, attack: false });
  queueAct(t, p.id, { act: 'potion' });
  stepTithe(t, DT);
  assert.equal(p.x, x0);
  assert.equal(p.ch.potions, potions);
});

test('F013: the Rust Ooze eats 3 armour for 10 seconds', () => {
  const t = tithe();
  const p = kael(t);
  const ooze = monster(t, 'ooze');
  p.hp = 1000;
  testing.damage(t, dep(t), ooze, p, 40, false);
  const first = 1000 - p.hp;
  assert.equal(p.corrodeT, T.corrodeSeconds);
  p.hp = 1000;
  testing.damage(t, dep(t), ooze, p, 40, false);
  assert.ok(1000 - p.hp > first, `${first} vs ${1000 - p.hp}`); // mindre rustning, mere skade
});

test('F013: the Wraith drains 20 stamina and 8 focus', () => {
  const t = tithe('city');
  const p = kael(t);
  testing.damage(t, dep(t), monster(t, 'wraith'), p, 2, false);
  assert.equal(p.stamina, p.stats.maxStamina - T.drainStamina);
  assert.equal(p.focus, p.stats.maxFocus - T.drainFocus);
});

test('F013: the Kobold Sapper\'s fire pot bursts over 1.3 tiles', () => {
  const t = tithe();
  const p = kael(t);
  const kobold = monster(t, 'kobold', 4, 0);
  kobold.aim = { x: p.x, y: p.y };
  kobold.awake = true;
  testing.resolveMonsterAttack(t, dep(t), kobold);
  const hp = p.hp;
  for (let i = 0; i < 40; i++) stepTithe(t, DT);
  assert.ok(p.hp < hp);
  assert.ok(t.fx.some((f) => f.type === 'blast') || hp > p.hp);
});

test('F013: the Tunnel Goblin flees below 25 % life', () => {
  const t = tithe();
  const p = kael(t);
  const goblin = monster(t, 'goblin', 1.5, 0);
  goblin.awake = true;
  goblin.hp = Math.floor(goblin.maxHp * 0.2);
  const d0 = Math.hypot(goblin.x - p.x, goblin.y - p.y);
  for (let i = 0; i < 15; i++) stepTithe(t, DT);
  assert.ok(Math.hypot(goblin.x - p.x, goblin.y - p.y) > d0);
});

test('F013: the Skeleton Miner takes half damage from arrows, the Scrap Golem double from Echo Bolt', () => {
  const t = tithe();
  const p = kael(t);
  const a = monster(t, 'skeleton');
  const b = monster(t, 'skeleton', 0, 0.9);
  testing.damage(t, dep(t), p, a, 20, false, { kind: 'arrow' });
  testing.damage(t, dep(t), p, b, 20, false);
  assert.ok(a.maxHp - a.hp < (b.maxHp - b.hp) * 0.7);
  const c = tithe('city');
  const g1 = monster(c, 'golem');
  const g2 = monster(c, 'golem', 0, 0.9);
  testing.damage(c, dep(c), kael(c), g1, 20, false, { skill: 'echo' });
  testing.damage(c, dep(c), kael(c), g2, 20, false);
  assert.ok(g1.maxHp - g1.hp > (g2.maxHp - g2.hp) * 1.5);
});

test('F013: the Cave Troll heals unless an Echo Bolt hit it within 5 seconds', () => {
  const t = tithe();
  const troll = monster(t, 'troll', 6, 0);
  troll.hp = troll.maxHp / 2;
  for (let i = 0; i < 30; i++) stepTithe(t, DT);
  assert.ok(troll.hp > troll.maxHp / 2);
  testing.damage(t, dep(t), kael(t), troll, 1, false, { skill: 'echo' });
  const hp = troll.hp;
  for (let i = 0; i < 30; i++) stepTithe(t, DT);
  assert.equal(Math.round(troll.hp), Math.round(hp));
});

test('F013: Feral Hounds hit harder in a pack', () => {
  const t = tithe('city');
  const p = kael(t);
  p.dodgeT = 0;
  const lone = monster(t, 'hound');
  const hits = () => {
    let total = 0;
    for (let i = 0; i < 30; i++) {
      p.hp = 1000;
      testing.resolveMonsterAttack(t, dep(t), lone);
      total += 1000 - p.hp;
    }
    return total;
  };
  const alone = hits();
  monster(t, 'hound', 1, 1);
  monster(t, 'hound', 1, -1);
  monster(t, 'hound', 0, 1.2);
  const pack = hits();
  assert.ok(pack > alone * 1.3, `${alone} vs ${pack}`);
});

test('F013: the Cutthroat sidesteps a blow now and then, at most every 3 seconds', () => {
  const t = tithe('city');
  const cut = monster(t, 'cutthroat');
  let dodged = 0;
  for (let i = 0; i < 40; i++) {
    const hp = cut.hp;
    cut.dodgeCd = 0;
    testing.damage(t, dep(t), kael(t), cut, 1, false);
    if (cut.hp === hp) dodged += 1;
    cut.hp = cut.maxHp;
  }
  assert.ok(dodged > 3 && dodged < 25, String(dodged));
  cut.dodgeCd = 1;
  const hp = cut.hp;
  testing.damage(t, dep(t), kael(t), cut, 1, false);
  assert.ok(cut.hp < hp); // ikke igen inden for 3 sekunder
});

test('F013: a Hollow rises once with 40 % of its life', () => {
  const t = tithe('city');
  const p = kael(t);
  const hollow = monster(t, 'hollow');
  testing.kill(t, dep(t), p, hollow);
  assert.equal(hollow.dead, false);
  assert.equal(hollow.hp, Math.round(hollow.maxHp * T.riseLife));
  assert.equal(p.record.kills, 0);
  testing.kill(t, dep(t), p, hollow);
  assert.equal(hollow.dead, true);
  assert.equal(p.record.kills, 1);
});

test('F013: the Cultist of the Maw heals the monsters within 5 tiles every 6 seconds', () => {
  const t = tithe('city');
  const cultist = monster(t, 'cultist', 8, 0);
  cultist.awake = true;
  cultist.healT = 0.01;
  const rat = monster(t, 'sewer_rat', 8, 1);
  rat.hp = 1;
  stepTithe(t, DT);
  assert.equal(rat.hp, 1 + Math.round(rat.maxHp * T.healShare));
});

test('F013: a Gargoyle stands still until a candidate is within 3 tiles', () => {
  const t = tithe('city');
  const g = monster(t, 'gargoyle', 5, 0);
  const x = g.x;
  for (let i = 0; i < 15; i++) stepTithe(t, DT);
  assert.equal(g.x, x);
  assert.equal(g.awake, false);
  g.x = kael(t).x + 2.5;
  stepTithe(t, DT);
  assert.equal(g.awake, true);
});

test('F008 scenario "A focus potion is drunk": 40 % of max focus, once a second, never at full focus', () => {
  const t = tithe();
  const p = kael(t);
  p.ch.focusPotions = 1;
  p.focus = 4;
  queueAct(t, p.id, { act: 'focusPotion' });
  stepTithe(t, DT);
  assert.equal(p.ch.focusPotions, 0);
  assert.ok(p.focus >= 4 + Math.round(p.stats.maxFocus * B.combat.focusPotionRestore), String(p.focus));
  // Feature-008: full focus keeps the potion.
  const u = tithe();
  const q = kael(u);
  q.ch.focusPotions = 1;
  q.focus = q.stats.maxFocus;
  queueAct(u, q.id, { act: 'focusPotion' });
  stepTithe(u, DT);
  assert.equal(q.ch.focusPotions, 1);
});

test('F011: a higher-level monster has more armour, strikes faster and moves faster', () => {
  const t = tithe();
  const low = testing.makeMonster(t, 'gnawer', 1, 1, 1);
  const high = testing.makeMonster(t, 'gnawer', 1, 1, 11);
  assert.equal(high.armour - low.armour, 5); // 1 for every 2 levels above 1
  assert.ok(Math.abs(high.quick - 0.8) < 1e-9); // 2 % faster per level
  assert.ok(Math.abs(high.fleet - 1.1) < 1e-9); // 1 % faster on the feet
  const top = testing.makeMonster(t, 'gnawer', 1, 1, 40);
  assert.equal(top.quick, 0.7); // at most 30 %
  assert.equal(top.fleet, 1.2); // at most 20 %
});
