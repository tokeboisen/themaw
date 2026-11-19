// En Tithe (én gennemspilning) i realtid: spilleren, monstrene, rivalerne, Mirrormaster og loot.
// Ingen DOM her. Klienten kalder stepTithe(t, dt, input) og læser t.events, t.messages og t.outcome.

import { createRng } from './rng.js';
import {
  generateDepth, bfs, lineOfSight, moveWithCollision, isSolid, tileAt, randomFloorInRoom, EXIT,
} from './dungeon.js';
import { derivedStats, addSkillXp, addEcho, echoToNextMark, SKILL_NAMES } from './character.js';
import { generateItem } from './items.js';

const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

const LINES = {
  start: [
    'Welcome, Branded, to the Tithe! Aurum is watching.',
    'The Mirrors are lit. Descend, and do try to be interesting.',
  ],
  grace: 'You have {s} seconds of grace before your rivals may strike. Use them.',
  sealWarning: 'Depth {d} grows dull. I will seal it in {s} seconds.',
  sealed: 'Depth {d} is sealed! Anyone still down there... well. Run.',
  bored: ['The crowd is yawning. Let us wake you up.', 'Boring! Have some company.', 'Nobody pays to watch you walk.'],
  sponsor: '{house} is pleased. A gift falls from the offering shaft!',
  rivalFell: '{name} falls, and the Brand drags them back up. The crowd roars!',
  rivalDepth: '{name} reaches depth {d}.',
  rivalLostWarden: '{name} fell to the Foreman. He is wounded now...',
  warden: 'The Foreman stirs. Who will face him?',
  wardenSlain: 'The Foreman is dead! The gate opens for {name}. Walk through and claim the Tithe!',
  champion: 'Aurum, behold your Champion: {name}!',
  playerFell: '{name} falls. The Brand drags them back up... The Maw is not finished with them.',
  depth: 'Depth {d}. The air grows heavier.',
};

const fmt = (text, values) => text.replace(/\{(\w+)\}/g, (_, k) => values[k]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// --- Oprettelse -------------------------------------------------------------------------------

export function createTithe(ch, B, seed) {
  const rng = createRng(seed);
  const stats = derivedStats(ch, B);
  const t = {
    id: `T${ch.tithes + 1}-${seed.toString(36)}`,
    seed,
    rng,
    B,
    ch,
    time: 0,
    depth: 0,
    depths: {},
    stats,
    player: {
      id: 'player', kind: 'player', name: ch.name, x: 0, y: 0, r: 0.35,
      hp: stats.maxHp, stamina: stats.maxStamina, focus: stats.maxFocus, hunger: B.hunger.max,
      facing: { x: 1, y: 0 }, attackCd: 0, boltCd: 0, dodgeCd: 0, dodgeT: 0, dodgeDir: { x: 1, y: 0 },
      potionCd: 0, flash: 0, swing: 0, swingDir: { x: 1, y: 0 }, swingArc: 90, swingReach: 1, dead: false,
    },
    rivals: [],
    outcome: null,
    events: [],
    messages: [],
    interact: null,
    wardenAlive: true,
    wardenHpFactor: 1,
    record: { kills: 0, rivalsDefeated: 0, renown: 0, goldFound: 0, maxDepth: 1, wardenSlain: false, itemsFound: 0 },
    mm: { lastDamageAt: 0, lastBoredAt: 0, killTimes: [], lastSponsorAt: -999, warned: {}, sealedSaid: {}, wardenSaid: false },
    god: false,
    nextId: 1,
    start: { level: ch.level, skills: Object.fromEntries(Object.entries(ch.skills).map(([k, s]) => [k, s.level])) },
  };
  t.rivals = B.tithe.rivals.map((def) => makeRival(t, def));
  enterDepth(t, 1);
  say(t, 'Mirrormaster', rng.pick(LINES.start));
  if (B.tithe.graceSeconds > 0) say(t, 'Mirrormaster', fmt(LINES.grace, { s: B.tithe.graceSeconds }));
  return t;
}

function nid(t) {
  t.nextId += 1;
  return t.nextId;
}

function say(t, who, text) {
  t.messages.push({ who, text, time: t.time });
  if (t.messages.length > 40) t.messages.shift();
  t.events.push({ type: 'message', who, text });
}

function float(t, x, y, text, color = '#fff', size = 14) {
  t.events.push({ type: 'float', x, y, text, color, size });
}

function end(t, type, name) {
  if (t.outcome) return;
  t.outcome = { type, name, time: t.time };
}

export function refreshStats(t) {
  const old = t.stats;
  t.stats = derivedStats(t.ch, t.B);
  const p = t.player;
  p.hp = Math.min(t.stats.maxHp, p.hp + Math.max(0, t.stats.maxHp - old.maxHp));
  p.stamina = Math.min(t.stats.maxStamina, p.stamina + Math.max(0, t.stats.maxStamina - old.maxStamina));
  p.focus = Math.min(t.stats.maxFocus, p.focus + Math.max(0, t.stats.maxFocus - old.maxFocus));
}

function monsterLevel(t, d) {
  const M = t.B.monsters;
  return Math.max(1, Math.round(d * M.levelPerDepth + Math.floor((t.ch.level - 1) * M.followPlayerLevel)));
}

function buildDepth(t, d) {
  const B = t.B;
  const last = d === B.tithe.depths;
  const map = generateDepth(t.rng, { warden: last });
  const toExit = bfs(map, map.exit.x, map.exit.y);
  let maxExitDist = 1;
  for (const v of toExit) if (v > maxExitDist) maxExitDist = v;
  const dep = {
    level: d,
    map,
    monsters: [],
    loot: [],
    caches: [],
    projectiles: [],
    explored: new Uint8Array(map.w * map.h),
    toExit,
    maxExitDist,
    toPlayer: null,
    toPlayerAge: 99,
    sealAt: B.mirrormaster.sealTimes[d - 1] ?? null,
  };
  const level = monsterLevel(t, d);
  const types = Object.entries(B.monsters.types).filter(([, m]) => !m.warden);
  const totalWeight = types.reduce((s, [, m]) => s + m.weight + (m.weight < 30 ? (d - 1) * 5 : 0), 0);
  const pickType = () => {
    let x = t.rng.next() * totalWeight;
    for (const [id, m] of types) {
      x -= m.weight + (m.weight < 30 ? (d - 1) * 5 : 0);
      if (x <= 0) return id;
    }
    return types[0][0];
  };
  for (const room of map.rooms) {
    if (room === map.startRoom || room === map.wardenRoom) continue;
    const size = (room.w * room.h) / 60;
    const count = Math.round(t.rng.int(B.monsters.perRoom[0], B.monsters.perRoom[1]) * size + B.monsters.extraPerDepth * (d - 1));
    for (let i = 0; i < count; i++) {
      const pos = randomFloorInRoom(t.rng, map, room);
      dep.monsters.push(makeMonster(t, pickType(), pos.x + 0.5, pos.y + 0.5, level));
    }
  }
  if (map.wardenRoom) {
    const wr = map.wardenRoom;
    const foreman = makeMonster(t, 'foreman', wr.cx + 0.5, wr.cy + 0.5, level);
    foreman.hp = Math.round(foreman.hp * t.wardenHpFactor);
    dep.monsters.push(foreman);
    for (let i = 0; i < 2; i++) {
      const pos = randomFloorInRoom(t.rng, map, wr);
      dep.monsters.push(makeMonster(t, 'gnawer', pos.x + 0.5, pos.y + 0.5, level));
    }
  }
  const cacheRooms = map.rooms.filter((r) => r !== map.startRoom && r !== map.wardenRoom);
  for (let i = 0; i < B.loot.cachesPerDepth && cacheRooms.length; i++) {
    const room = cacheRooms.splice(Math.floor(t.rng.next() * cacheRooms.length), 1)[0];
    const pos = randomFloorInRoom(t.rng, map, room);
    dep.caches.push({ id: nid(t), x: pos.x + 0.5, y: pos.y + 0.5, opened: false });
  }
  return dep;
}

function makeMonster(t, type, x, y, level) {
  const def = t.B.monsters.types[type];
  const M = t.B.monsters;
  const hp = Math.round(def.hp * (1 + M.hpPerLevel * (level - 1)));
  const dmg = 1 + M.damagePerLevel * (level - 1);
  return {
    id: nid(t), kind: 'monster', type, def, name: def.name, level, x, y, r: def.radius,
    hp, maxHp: hp, min: def.min * dmg, max: def.max * dmg, armour: def.armour || 0,
    attackCd: t.rng.range(0, def.cooldown), windup: 0, aim: null, flash: 0, awake: false,
    summonT: def.summonEvery || 0, facing: { x: 1, y: 0 }, dead: false,
  };
}

function rivalWeapon(def, level, B) {
  const effective = 5 + level * B.tithe.rivalSkillPerLevel;
  const mult = 1 + effective * B.skills.damagePerSkill;
  if (def.weapon === 'echo') {
    const b = B.combat.echoBolt;
    return { min: b.min, max: b.max, range: b.range, speed: b.speed, cooldown: b.cooldown * 1.8, ranged: true, kind: 'bolt', mult };
  }
  const baseId = {
    heavy: level >= 2 ? 'war_axe' : 'pickaxe',
    blades: level >= 2 ? 'short_sword' : 'rusty_sword',
    bows: level >= 2 ? 'hunting_bow' : 'short_bow',
  }[def.weapon];
  const base = B.items.bases[baseId];
  return {
    min: base.min, max: base.max, reach: base.reach || 1, range: base.range || 0, cooldown: base.cooldown * 1.25,
    ranged: !!base.range, kind: base.range ? 'arrow' : 'melee', speed: B.combat.arrowSpeed, mult,
  };
}

function makeRival(t, def) {
  const B = t.B;
  const level = Math.max(1, t.ch.level + def.levelOffset);
  const maxHp = B.tithe.rivalHpBase + level * B.tithe.rivalHpPerLevel;
  return {
    id: def.id, kind: 'rival', name: def.name, color: def.color, def, level, x: 0, y: 0, r: 0.38,
    hp: maxHp, maxHp, armour: B.tithe.rivalArmour, weapon: rivalWeapon(def, level, B),
    aggressive: t.rng.chance(def.aggression), potions: 1, status: 'in', depth: 1, progress: 0, real: false,
    attackCd: 1, windup: 0, aim: null, flash: 0, facing: { x: 1, y: 0 }, dead: false,
    secondsPerDepth: (B.tithe.rivalSecondsPerDepth * t.rng.range(0.85, 1.2)) / (1 + level * 0.03),
    stuckT: 0, lastX: 0, lastY: 0, jiggle: 0, jiggleDir: { x: 0, y: 0 }, fightT: 0,
  };
}

function placeRival(t, dep, r) {
  const map = dep.map;
  let pos = null;
  if (r.progress < 0.08) {
    pos = randomFloorInRoom(t.rng, map, map.startRoom);
  } else {
    const target = (1 - r.progress) * dep.maxExitDist;
    let bestScore = Infinity;
    for (let i = 0; i < 500; i++) {
      const x = t.rng.int(1, map.w - 2);
      const y = t.rng.int(1, map.h - 2);
      const d = dep.toExit[y * map.w + x];
      if (d < 0) continue;
      const tooClose = Math.hypot(x + 0.5 - t.player.x, y + 0.5 - t.player.y) < 9 ? 50 : 0;
      const score = Math.abs(d - target) + tooClose;
      if (score < bestScore) {
        bestScore = score;
        pos = { x, y };
      }
    }
    pos = pos || { ...map.start };
  }
  r.x = pos.x + 0.5;
  r.y = pos.y + 0.5;
  r.real = true;
  r.windup = 0;
  r.attackCd = 1;
}

function progressFromPos(dep, r) {
  const d = dep.toExit[Math.floor(r.y) * dep.map.w + Math.floor(r.x)];
  if (d < 0) return 0;
  return clamp(1 - d / dep.maxExitDist, 0, 0.98);
}

function enterDepth(t, d) {
  const prev = t.depths[t.depth];
  if (prev) {
    for (const r of t.rivals) {
      if (r.real) {
        r.real = false;
        r.progress = progressFromPos(prev, r);
      }
    }
    prev.projectiles = [];
  }
  t.depth = d;
  if (d > t.record.maxDepth) {
    t.record.maxDepth = d;
    addRenown(t, t.B.renown.depth);
  }
  if (!t.depths[d]) t.depths[d] = buildDepth(t, d);
  const dep = t.depths[d];
  const minTime = t.B.mirrormaster.minTimeOnEntry;
  if (dep.sealAt != null && dep.sealAt - t.time < minTime) dep.sealAt = t.time + minTime;
  t.player.x = dep.map.start.x + 0.5;
  t.player.y = dep.map.start.y + 0.5;
  t.player.dodgeT = 0;
  for (const r of t.rivals) if (r.status === 'in' && r.depth === d) placeRival(t, dep, r);
  dep.toPlayerAge = 99;
  reveal(t, dep);
  updateInteract(t, dep);
  if (d > 1) say(t, 'Mirrormaster', fmt(LINES.depth, { d }));
}

// --- Hovedløkken ------------------------------------------------------------------------------

// input: { moveX, moveY, attack, bolt, dodge, potion, ration, interact }
export function stepTithe(t, dt, input) {
  if (t.outcome) return;
  t.time += dt;
  const dep = t.depths[t.depth];
  dep.toPlayerAge += dt;
  if (dep.toPlayerAge > 0.25) {
    dep.toPlayer = bfs(dep.map, Math.floor(t.player.x), Math.floor(t.player.y));
    dep.toPlayerAge = 0;
  }
  updatePlayer(t, dep, dt, input);
  if (t.outcome || t.depths[t.depth] !== dep) return;
  updateMonsters(t, dep, dt);
  updateRivals(t, dep, dt);
  updateAbstractRivals(t, dt);
  updateProjectiles(t, dep, dt);
  dep.monsters = dep.monsters.filter((m) => !m.dead);
  separate(t, dep);
  pickups(t, dep);
  mirrormaster(t, dep, dt);
  reveal(t, dep);
  updateInteract(t, dep);
}

function updatePlayer(t, dep, dt, input) {
  const p = t.player;
  const s = t.stats;
  const B = t.B;
  for (const k of ['attackCd', 'boltCd', 'dodgeCd', 'potionCd', 'flash', 'swing']) p[k] = Math.max(0, p[k] - dt);

  p.hunger = Math.max(0, p.hunger - s.hungerDrain * dt);
  const starving = p.hunger <= 0;
  p.stamina = Math.min(s.maxStamina, p.stamina + s.staminaRegen * (starving ? B.hunger.starvingStaminaRegen : 1) * dt);
  p.focus = Math.min(s.maxFocus, p.focus + s.focusRegen * dt);
  if (!starving) p.hp = Math.min(s.maxHp, p.hp + B.character.hpRegen * dt);

  let mx = input.moveX || 0;
  let my = input.moveY || 0;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  if (input.dodge && p.dodgeCd <= 0 && p.dodgeT <= 0 && p.stamina >= B.combat.dodgeCost) {
    const l = Math.hypot(mx, my);
    p.dodgeDir = l > 0.1 ? { x: mx / l, y: my / l } : { ...p.facing };
    p.dodgeT = B.combat.dodgeTime;
    p.dodgeCd = B.combat.dodgeCooldown;
    p.stamina -= B.combat.dodgeCost;
  }
  if (p.dodgeT > 0) {
    p.dodgeT -= dt;
    const speed = B.combat.dodgeDistance / B.combat.dodgeTime;
    moveWithCollision(dep.map, p, p.dodgeDir.x * speed * dt, p.dodgeDir.y * speed * dt);
  } else if (len > 0.05) {
    const l = Math.hypot(mx, my);
    p.facing = { x: mx / l, y: my / l };
    moveWithCollision(dep.map, p, mx * s.moveSpeed * dt, my * s.moveSpeed * dt);
  }

  if (input.potion && t.ch.potions > 0 && p.potionCd <= 0 && p.hp < s.maxHp) {
    t.ch.potions -= 1;
    const heal = Math.round(s.maxHp * B.combat.potionHeal);
    p.hp = Math.min(s.maxHp, p.hp + heal);
    p.potionCd = B.combat.potionCooldown;
    float(t, p.x, p.y - 0.6, `+${heal}`, '#6f6', 15);
  }
  if (input.ration && t.ch.rations > 0 && p.hunger < B.hunger.max - 5) {
    t.ch.rations -= 1;
    p.hunger = Math.min(B.hunger.max, p.hunger + B.hunger.rationRestores);
    float(t, p.x, p.y - 0.6, 'Fed', '#d9b26f', 14);
  }

  const w = s.weapon;
  if (input.attack && p.attackCd <= 0 && p.stamina >= w.staminaCost && p.dodgeT <= 0) playerAttack(t, dep);
  if (input.bolt && p.boltCd <= 0 && p.focus >= s.bolt.focusCost && p.dodgeT <= 0) playerBolt(t, dep);

  if (input.interact && t.interact === 'descend' && t.depth < B.tithe.depths) {
    enterDepth(t, t.depth + 1);
    return;
  }
  if (input.interact && t.interact === 'gate') {
    say(t, 'Mirrormaster', fmt(LINES.champion, { name: t.ch.name }));
    end(t, 'champion', t.ch.name);
  }
}

function targetsForPlayer(t, dep) {
  const list = dep.monsters.filter((m) => !m.dead);
  for (const r of t.rivals) if (r.real && r.status === 'in') list.push(r);
  return list;
}

// Sigter automatisk: nærmeste fjende, og først en fredelig rival, hvis der ikke er andre.
function pickTarget(t, dep, range) {
  const p = t.player;
  let best = null;
  let bestScore = Infinity;
  for (const e of targetsForPlayer(t, dep)) {
    const d = dist(p, e) - e.r;
    if (d > range) continue;
    if (!lineOfSight(dep.map, p.x, p.y, e.x, e.y)) continue;
    const score = d + (e.kind === 'rival' && !e.aggressive ? 100 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

function rollDamage(t, min, max, mult, critChance = 0) {
  const crit = t.rng.chance(critChance);
  const amount = t.rng.range(min, max) * mult * (crit ? t.B.character.critMultiplier : 1);
  return { amount, crit };
}

function aimAt(from, target, fallback) {
  if (!target) return { ...fallback };
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}

function playerAttack(t, dep) {
  const p = t.player;
  const w = t.stats.weapon;
  const target = pickTarget(t, dep, w.ranged ? w.range : w.reach + 1.2);
  const dir = aimAt(p, target, p.facing);
  p.facing = dir;
  p.attackCd = w.cooldown;
  p.stamina -= w.staminaCost;
  if (w.ranged) {
    const roll = rollDamage(t, w.min, w.max, w.damageMult, t.stats.critChance);
    shoot(t, dep, p, dir, { ...roll, speed: t.B.combat.arrowSpeed, range: w.range, skill: w.skill, kind: 'arrow', faction: 'player' });
    return;
  }
  p.swing = 0.15;
  p.swingDir = dir;
  p.swingArc = w.arc;
  p.swingReach = w.reach;
  const hits = meleeHits(dep, p, dir, w.reach + 0.3, w.arc, targetsForPlayer(t, dep));
  hits.forEach((e, i) => {
    const roll = rollDamage(t, w.min, w.max, w.damageMult, t.stats.critChance);
    damage(t, dep, p, e, roll.amount, roll.crit, { skill: w.skill, train: i < t.B.skills.maxHitsPerSwing });
  });
}

function playerBolt(t, dep) {
  const p = t.player;
  const b = t.stats.bolt;
  const target = pickTarget(t, dep, b.range);
  const dir = aimAt(p, target, p.facing);
  p.facing = dir;
  p.boltCd = b.cooldown;
  p.focus -= b.focusCost;
  const roll = rollDamage(t, b.min, b.max, b.damageMult, t.stats.critChance);
  shoot(t, dep, p, dir, { ...roll, speed: b.speed, range: b.range, skill: 'echo', kind: 'bolt', faction: 'player' });
}

function meleeHits(dep, attacker, dir, reach, arcDeg, candidates) {
  const half = ((arcDeg / 2) * Math.PI) / 180;
  const hits = [];
  for (const e of candidates) {
    if (e === attacker || e.dead) continue;
    const dx = e.x - attacker.x;
    const dy = e.y - attacker.y;
    const d = Math.hypot(dx, dy);
    if (d - e.r > reach) continue;
    if (d > 0.01 && Math.acos(clamp((dx * dir.x + dy * dir.y) / d, -1, 1)) > half) continue;
    if (!lineOfSight(dep.map, attacker.x, attacker.y, e.x, e.y)) continue;
    hits.push(e);
  }
  return hits;
}

function shoot(t, dep, owner, dir, o) {
  dep.projectiles.push({
    id: nid(t), x: owner.x + dir.x * 0.4, y: owner.y + dir.y * 0.4, vx: dir.x, vy: dir.y,
    speed: o.speed, range: o.range, traveled: 0, amount: o.amount, crit: o.crit, skill: o.skill,
    kind: o.kind, faction: o.faction, owner, done: false,
  });
}

// --- Skade, drab og belønning ---------------------------------------------------------------

function damage(t, dep, attacker, target, amount, crit, opts = {}) {
  if (target.dead || t.outcome) return;
  const p = t.player;
  const B = t.B;
  if (target === p) {
    if (p.dodgeT > 0 || t.god) return;
    amount *= 1 - t.stats.damageReduction;
  } else {
    const armour = target.armour || 0;
    amount *= 1 - armour / (armour + B.combat.armourFactor);
  }
  amount = Math.max(1, Math.round(amount));
  target.hp -= amount;
  target.flash = 0.12;
  const color = target === p ? '#ff6b6b' : crit ? '#ffd84a' : '#ffffff';
  float(t, target.x, target.y - target.r - 0.2, String(amount), color, crit ? 18 : 14);
  if (target === p) t.events.push({ type: 'hurt', amount });
  if (attacker === p) {
    t.mm.lastDamageAt = t.time;
    if (opts.skill && opts.train) trainSkill(t, opts.skill, target, B.skills.xpPerHit);
  }
  if (target.kind === 'rival' && attacker === p) target.aggressive = true;
  if (target.kind === 'monster') target.awake = true;
  if (target.hp <= 0) kill(t, dep, attacker, target, opts);
}

function trainSkill(t, skill, target, amount) {
  const B = t.B;
  const challenge = clamp((target.level || 1) / Math.max(1, t.ch.level), B.skills.challengeMin, B.skills.challengeMax);
  const xp = amount * challenge;
  const gained = addSkillXp(t.ch, skill, xp, B);
  t.events.push({ type: 'xp', skill, amount: xp });
  if (gained) {
    refreshStats(t);
    const level = t.ch.skills[skill].level;
    t.events.push({ type: 'skill', skill, level });
    float(t, t.player.x, t.player.y - 1, `${SKILL_NAMES[skill]} ${level}`, '#7fd1ff', 16);
  }
}

function gainEcho(t, amount) {
  const marks = addEcho(t.ch, amount, t.B);
  if (marks) {
    refreshStats(t);
    t.events.push({ type: 'mark', level: t.ch.level });
    say(t, 'The Maw', `A new Mark burns into your Brand. You are Mark ${t.ch.level}.`);
  }
}

function addRenown(t, amount) {
  t.record.renown += amount;
  if (amount >= 10) float(t, t.player.x, t.player.y - 1.4, `+${amount} Renown`, '#d6a2ff', 13);
}

function registerKill(t) {
  const M = t.B.mirrormaster;
  t.mm.killTimes.push(t.time);
  t.mm.killTimes = t.mm.killTimes.filter((x) => t.time - x <= M.streakWindow);
  if (t.mm.killTimes.length >= M.streakKills && t.time - t.mm.lastSponsorAt >= M.sponsorCooldown) {
    t.mm.killTimes = [];
    t.mm.lastSponsorAt = t.time;
    sponsorDrop(t, t.depths[t.depth]);
  }
}

function sponsorDrop(t, dep) {
  const rng = t.rng;
  const house = rng.pick(t.B.rim.houses);
  const p = t.player;
  const level = monsterLevel(t, t.depth);
  const roll = rng.next();
  if (roll < 0.3) dep.loot.push({ id: nid(t), kind: 'item', item: generateItem(rng, level, t.B, { rarity: 'magic' }), ...dropSpot(dep, p.x, p.y, rng) });
  else if (roll < 0.55) dep.loot.push({ id: nid(t), kind: 'potion', ...dropSpot(dep, p.x, p.y, rng) });
  else if (roll < 0.75) dep.loot.push({ id: nid(t), kind: 'ration', ...dropSpot(dep, p.x, p.y, rng) });
  else dep.loot.push({ id: nid(t), kind: 'gold', amount: level * 12, ...dropSpot(dep, p.x, p.y, rng) });
  addRenown(t, t.B.renown.streak);
  say(t, 'Mirrormaster', fmt(LINES.sponsor, { house }));
  t.events.push({ type: 'shake', amount: 3 });
}

function dropSpot(dep, x, y, rng) {
  for (let i = 0; i < 6; i++) {
    const nx = x + rng.range(-0.8, 0.8);
    const ny = y + rng.range(-0.8, 0.8);
    if (!isSolid(dep.map, Math.floor(nx), Math.floor(ny))) return { x: nx, y: ny };
  }
  return { x, y };
}

function dropLoot(t, dep, x, y, level, opts = {}) {
  const L = t.B.loot;
  const rng = t.rng;
  if (rng.chance(opts.goldChance ?? L.goldChance)) {
    dep.loot.push({ id: nid(t), kind: 'gold', amount: rng.int(L.goldPerLevel[0] * level, L.goldPerLevel[1] * level), ...dropSpot(dep, x, y, rng) });
  }
  const rarities = opts.rarities || [];
  const count = opts.items ?? (rng.chance(opts.itemChance ?? L.itemChance) ? 1 : 0);
  for (let i = 0; i < count; i++) {
    dep.loot.push({ id: nid(t), kind: 'item', item: generateItem(rng, level, t.B, { rarity: rarities[i] }), ...dropSpot(dep, x, y, rng) });
  }
  if (rng.chance(opts.consumableChance ?? L.consumableChance)) {
    dep.loot.push({ id: nid(t), kind: rng.chance(0.5) ? 'potion' : 'ration', ...dropSpot(dep, x, y, rng) });
  }
}

function kill(t, dep, killer, target, opts = {}) {
  target.dead = true;
  target.hp = 0;
  const B = t.B;
  const p = t.player;
  const byPlayer = killer === p;
  t.events.push({ type: 'death', x: target.x, y: target.y, kind: target.kind });

  if (target.kind === 'monster') {
    if (byPlayer) {
      t.record.kills += 1;
      gainEcho(t, Math.round(target.def.echo * target.level * t.stats.echoGain));
      if (opts.skill) trainSkill(t, opts.skill, target, B.skills.xpPerKill);
      addRenown(t, B.renown.perMonsterLevel * target.level);
      // Monstre, som Mirrormaster eller Foreman kalder frem, giver hverken loot eller drabsserie,
      // så man ikke kan stå stille og høste sponsorgaver.
      if (!target.def.warden && !target.summoned) {
        dropLoot(t, dep, target.x, target.y, target.level, { itemChance: target.def.itemChance });
        registerKill(t);
      }
    }
    if (target.def.warden) {
      t.wardenAlive = false;
      if (byPlayer) {
        dep.map.gateOpen = true;
        t.record.wardenSlain = true;
        addRenown(t, B.renown.warden);
        dropLoot(t, dep, target.x, target.y, target.level + 1, { goldChance: 1, items: 3, rarities: ['rare', 'magic', 'magic'], consumableChance: 1 });
        say(t, 'Mirrormaster', fmt(LINES.wardenSlain, { name: t.ch.name }));
        t.events.push({ type: 'shake', amount: 8 });
      } else if (killer && killer.kind === 'rival') {
        killer.status = 'champion';
        say(t, 'Mirrormaster', fmt(LINES.champion, { name: killer.name }));
        end(t, 'rival-champion', killer.name);
      }
    }
    return;
  }

  if (target.kind === 'rival') {
    target.status = 'fallen';
    target.real = false;
    say(t, 'Mirrormaster', fmt(LINES.rivalFell, { name: target.name }));
    if (byPlayer) {
      t.record.rivalsDefeated += 1;
      addRenown(t, B.renown.rival);
      gainEcho(t, Math.round(target.level * 12 * t.stats.echoGain));
      dropLoot(t, dep, target.x, target.y, target.level, { goldChance: 1, itemChance: 0.5, consumableChance: 0.5 });
      registerKill(t);
    }
    return;
  }

  if (target === p) {
    p.dead = true;
    say(t, 'Mirrormaster', fmt(LINES.playerFell, { name: t.ch.name }));
    end(t, 'fell', killer ? killer.name : 'the Maw');
  }
}

// --- Monstre --------------------------------------------------------------------------------

function moveToward(dep, e, x, y, maxStep) {
  const dx = x - e.x;
  const dy = y - e.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-4) return 0;
  const step = Math.min(d, maxStep);
  e.facing = { x: dx / d, y: dy / d };
  return moveWithCollision(dep.map, e, (dx / d) * step, (dy / d) * step);
}

// Går et skridt ned ad et afstandskort (mod spilleren eller udgangen).
function stepAlongField(dep, e, field, maxStep) {
  const map = dep.map;
  const tx = Math.floor(e.x);
  const ty = Math.floor(e.y);
  const here = field[ty * map.w + tx];
  let best = null;
  let bestD = here < 0 ? Infinity : here;
  for (const [dx, dy] of DIRS8) {
    const nx = tx + dx;
    const ny = ty + dy;
    if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
    const d = field[ny * map.w + nx];
    if (d < 0) continue;
    if (dx && dy && (isSolid(map, tx + dx, ty) || isSolid(map, tx, ty + dy))) continue;
    if (d < bestD) {
      bestD = d;
      best = { x: nx + 0.5, y: ny + 0.5 };
    }
  }
  if (!best) return false;
  moveToward(dep, e, best.x, best.y, maxStep);
  return true;
}

function inRoom(room, e, margin = 0) {
  return e.x >= room.x - margin && e.x <= room.x + room.w + margin && e.y >= room.y - margin && e.y <= room.y + room.h + margin;
}

function updateMonsters(t, dep, dt) {
  const p = t.player;
  for (const m of dep.monsters) {
    if (m.dead) continue;
    const def = m.def;
    m.attackCd = Math.max(0, m.attackCd - dt);
    m.flash = Math.max(0, m.flash - dt);

    if (m.windup > 0) {
      m.windup -= dt;
      if (m.windup <= 0) resolveMonsterAttack(t, dep, m);
      continue;
    }

    // Vælg mål: nærmeste kandidat inden for aggro. Et sovende monster vågner kun ved synskontakt.
    let target = null;
    let best = Infinity;
    const aggro = def.aggro * (m.awake ? 1.6 : 1);
    const candidates = [];
    if (!p.dead) candidates.push(p);
    for (const r of t.rivals) if (r.real && r.status === 'in') candidates.push(r);
    for (const c of candidates) {
      const d = dist(m, c);
      if (d > aggro || d >= best) continue;
      if (def.warden && !inRoom(dep.map.wardenRoom, c, 1)) continue;
      if (!m.awake && !lineOfSight(dep.map, m.x, m.y, c.x, c.y)) continue;
      best = d;
      target = c;
    }

    if (def.warden) {
      if (!target) {
        moveToward(dep, m, dep.map.wardenRoom.cx + 0.5, dep.map.wardenRoom.cy + 0.5, def.speed * dt);
        continue;
      }
      if (!t.mm.wardenSaid && target === p) {
        t.mm.wardenSaid = true;
        say(t, 'Mirrormaster', LINES.warden);
      }
      m.summonT -= dt;
      if (m.summonT <= 0) {
        m.summonT = def.summonEvery;
        const gnawers = dep.monsters.filter((x) => !x.dead && x.type === 'gnawer').length;
        for (let i = 0; i < Math.min(3, def.summonMax - gnawers); i++) {
          const pos = dropSpot(dep, m.x, m.y, t.rng);
          const g = makeMonster(t, 'gnawer', pos.x, pos.y, m.level);
          g.awake = true;
          g.summoned = true;
          dep.monsters.push(g);
        }
      }
    }
    if (!target) continue;
    m.awake = true;
    const d = dist(m, target);

    if (def.ranged) {
      const sees = lineOfSight(dep.map, m.x, m.y, target.x, target.y);
      if (d < 2.5) {
        moveToward(dep, m, m.x - (target.x - m.x), m.y - (target.y - m.y), def.speed * dt);
      } else if (d <= def.range && sees) {
        if (m.attackCd <= 0) {
          m.windup = def.windup;
          m.aim = { x: target.x, y: target.y };
        }
      } else {
        chase(t, dep, m, target, def.speed * dt);
      }
      continue;
    }

    if (d <= def.reach + target.r) {
      if (m.attackCd <= 0) {
        m.windup = def.windup;
        m.aim = aimAt(m, target, m.facing);
      }
    } else {
      chase(t, dep, m, target, def.speed * dt);
    }
  }
}

function chase(t, dep, m, target, step) {
  if (target === t.player && dep.toPlayer && !(dist(m, target) < 2.5 && lineOfSight(dep.map, m.x, m.y, target.x, target.y))) {
    if (stepAlongField(dep, m, dep.toPlayer, step)) return;
  }
  moveToward(dep, m, target.x, target.y, step);
}

function resolveMonsterAttack(t, dep, m) {
  const def = m.def;
  m.attackCd = def.cooldown;
  const victims = [];
  if (!t.player.dead) victims.push(t.player);
  for (const r of t.rivals) if (r.real && r.status === 'in') victims.push(r);
  if (def.ranged) {
    const dir = aimAt(m, m.aim, m.facing);
    shoot(t, dep, m, dir, { amount: t.rng.range(m.min, m.max), crit: false, speed: def.projectileSpeed, range: def.range + 2, kind: 'spit', faction: 'monster' });
    return;
  }
  if (def.warden) {
    t.events.push({ type: 'shake', amount: 5 });
    for (const v of victims) if (dist(m, v) <= def.reach + v.r) damage(t, dep, m, v, t.rng.range(m.min, m.max), false);
    return;
  }
  let best = null;
  for (const v of victims) if (dist(m, v) <= def.reach + v.r + 0.35 && (!best || dist(m, v) < dist(m, best))) best = v;
  if (best) damage(t, dep, m, best, t.rng.range(m.min, m.max), false);
}

// --- Rivaler ----------------------------------------------------------------------------------

function updateRivals(t, dep, dt) {
  const B = t.B;
  const p = t.player;
  const last = t.depth === B.tithe.depths;
  for (const r of t.rivals) {
    if (!r.real || r.status !== 'in') continue;
    r.attackCd = Math.max(0, r.attackCd - dt);
    r.flash = Math.max(0, r.flash - dt);
    if (r.hp < r.maxHp * 0.3 && r.potions > 0) {
      r.potions -= 1;
      r.hp = Math.min(r.maxHp, r.hp + r.maxHp * 0.5);
      float(t, r.x, r.y - 0.6, 'Potion', '#6f6', 12);
    }
    if (r.windup > 0) {
      r.windup -= dt;
      if (r.windup <= 0) {
        r.attackCd = r.weapon.cooldown;
        const hits = meleeHits(dep, r, r.aim, r.weapon.reach + 0.3, 110, rivalVictims(t, dep, r));
        if (hits[0]) damage(t, dep, r, hits[0], rollDamage(t, r.weapon.min, r.weapon.max, r.weapon.mult).amount, false);
      }
      continue;
    }

    let target = null;
    let best = Infinity;
    const range = last && t.wardenAlive ? 9 : 5;
    for (const m of dep.monsters) {
      if (m.dead) continue;
      const d = dist(r, m);
      const limit = m.def.warden ? range : 5;
      if (d < limit && d < best && lineOfSight(dep.map, r.x, r.y, m.x, m.y)) {
        best = d;
        target = m;
      }
    }
    const graceOver = t.time >= (B.tithe.graceSeconds || 0);
    if (r.aggressive && graceOver && !p.dead) {
      const d = dist(r, p);
      if (d < 6 && d < best + 1 && lineOfSight(dep.map, r.x, r.y, p.x, p.y)) target = p;
    }

    if (target) {
      rivalFight(t, dep, r, target, dt);
      continue;
    }

    const exitTile = dep.toExit[Math.floor(r.y) * dep.map.w + Math.floor(r.x)];
    if (!last && exitTile >= 0 && exitTile <= 1) {
      r.real = false;
      r.depth += 1;
      r.progress = 0;
      r.hp = r.maxHp;
      say(t, 'Mirrormaster', fmt(LINES.rivalDepth, { name: r.name, d: r.depth }));
      continue;
    }
    if (r.jiggle > 0) {
      r.jiggle -= dt;
      moveWithCollision(dep.map, r, r.jiggleDir.x * B.tithe.rivalSpeed * dt, r.jiggleDir.y * B.tithe.rivalSpeed * dt);
      continue;
    }
    // Rivaler, du kan se, bruger samme tempo som dem, du ikke ser: de går i ryk og leder undervejs,
    // så de i gennemsnit er secondsPerDepth om en dybde.
    r.budget = Math.min(4, (r.budget || 0) + (dt * dep.maxExitDist) / r.secondsPerDepth);
    if (r.budget >= 4) r.walking = true;
    if (!r.walking || exitTile === 0) {
      r.stuckT = 0;
      r.lastX = r.x;
      r.lastY = r.y;
      continue;
    }
    const step = Math.min(B.tithe.rivalSpeed * dt, r.budget);
    r.budget -= step;
    if (r.budget <= 0.1) r.walking = false;
    stepAlongField(dep, r, dep.toExit, step);
    // Sidder rivalen fast, går den et øjeblik i en tilfældig retning.
    r.stuckT += dt;
    if (r.stuckT > 1) {
      if (Math.hypot(r.x - r.lastX, r.y - r.lastY) < 0.1 && exitTile > 1) {
        const a = t.rng.range(0, Math.PI * 2);
        r.jiggle = 0.5;
        r.jiggleDir = { x: Math.cos(a), y: Math.sin(a) };
      }
      r.stuckT = 0;
      r.lastX = r.x;
      r.lastY = r.y;
    }
  }
}

function rivalVictims(t, dep, r) {
  const list = dep.monsters.filter((m) => !m.dead);
  if (r.aggressive && !t.player.dead) list.push(t.player);
  return list;
}

function rivalFight(t, dep, r, target, dt) {
  const w = r.weapon;
  const speed = t.B.tithe.rivalSpeed * dt;
  const d = dist(r, target);
  r.facing = aimAt(r, target, r.facing);
  if (w.ranged) {
    if (d < 3) moveToward(dep, r, r.x - (target.x - r.x), r.y - (target.y - r.y), speed);
    else if (d > w.range - 1) moveToward(dep, r, target.x, target.y, speed);
    if (d <= w.range && r.attackCd <= 0 && lineOfSight(dep.map, r.x, r.y, target.x, target.y)) {
      r.attackCd = w.cooldown;
      const roll = rollDamage(t, w.min, w.max, w.mult);
      shoot(t, dep, r, aimAt(r, target, r.facing), { ...roll, speed: w.speed, range: w.range, kind: w.kind, faction: 'rival' });
    }
    return;
  }
  if (d <= w.reach + target.r) {
    if (r.attackCd <= 0) {
      r.windup = 0.25;
      r.aim = aimAt(r, target, r.facing);
    }
  } else {
    moveToward(dep, r, target.x, target.y, speed);
  }
}

function sealAtFor(t, d) {
  return t.depths[d] ? t.depths[d].sealAt : t.B.mirrormaster.sealTimes[d - 1] ?? null;
}

// Rivaler på andre dybder end din: de skrider frem i tid i stedet for at blive simuleret.
function updateAbstractRivals(t, dt) {
  const B = t.B;
  for (const r of t.rivals) {
    if (r.real || r.status !== 'in') continue;
    const sealAt = sealAtFor(t, r.depth);
    const sealed = sealAt != null && t.time >= sealAt;
    if (r.progress < 1) {
      r.progress += (dt / r.secondsPerDepth) * (sealed ? 3 : 1);
      continue;
    }
    if (r.depth < B.tithe.depths) {
      r.depth += 1;
      r.progress = 0;
      r.hp = r.maxHp;
      say(t, 'Mirrormaster', fmt(LINES.rivalDepth, { name: r.name, d: r.depth }));
      if (r.depth === t.depth) placeRival(t, t.depths[t.depth], r);
      continue;
    }
    if (!t.wardenAlive) continue;
    // Rivalen kæmper mod Warden, uden at du ser det.
    r.fightT += dt;
    if (r.fightT < B.tithe.abstractWardenFight) continue;
    r.fightT = 0;
    const chance = Math.min(B.tithe.rivalWinChanceMax, B.tithe.rivalWinChanceBase + r.level * B.tithe.rivalWinChancePerLevel) / t.wardenHpFactor;
    if (t.rng.chance(Math.min(0.95, chance))) {
      t.wardenAlive = false;
      r.status = 'champion';
      say(t, 'Mirrormaster', fmt(LINES.champion, { name: r.name }));
      end(t, 'rival-champion', r.name);
      return;
    }
    r.status = 'fallen';
    t.wardenHpFactor *= B.tithe.wardenWoundedFactor;
    say(t, 'Mirrormaster', fmt(LINES.rivalLostWarden, { name: r.name }));
  }
}

// --- Projektiler, skub og opsamling ---------------------------------------------------------

function updateProjectiles(t, dep, dt) {
  const p = t.player;
  for (const pr of dep.projectiles) {
    if (pr.done) continue;
    const step = pr.speed * dt;
    pr.x += pr.vx * step;
    pr.y += pr.vy * step;
    pr.traveled += step;
    if (pr.traveled > pr.range || isSolid(dep.map, Math.floor(pr.x), Math.floor(pr.y))) {
      pr.done = true;
      continue;
    }
    let targets;
    if (pr.faction === 'player') targets = targetsForPlayer(t, dep);
    else if (pr.faction === 'rival') targets = rivalVictims(t, dep, pr.owner);
    else {
      targets = p.dead ? [] : [p];
      for (const r of t.rivals) if (r.real && r.status === 'in') targets.push(r);
    }
    for (const e of targets) {
      if (e === pr.owner || e.dead) continue;
      if (Math.hypot(e.x - pr.x, e.y - pr.y) < e.r + 0.15) {
        pr.done = true;
        damage(t, dep, pr.owner, e, pr.amount, pr.crit, { skill: pr.skill, train: true });
        break;
      }
    }
  }
  dep.projectiles = dep.projectiles.filter((pr) => !pr.done);
}

function separate(t, dep) {
  const list = dep.monsters.filter((m) => !m.dead);
  for (const r of t.rivals) if (r.real && r.status === 'in') list.push(r);
  if (!t.player.dead) list.push(t.player);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const overlap = a.r + b.r - d;
      if (overlap <= 0) continue;
      const nx = d > 1e-4 ? dx / d : 1;
      const ny = d > 1e-4 ? dy / d : 0;
      const wa = a.def?.warden ? 0.1 : 0.5;
      const wb = b.def?.warden ? 0.1 : 0.5;
      moveWithCollision(dep.map, a, -nx * overlap * wa, -ny * overlap * wa);
      moveWithCollision(dep.map, b, nx * overlap * wb, ny * overlap * wb);
    }
  }
}

function pickups(t, dep) {
  const p = t.player;
  const ch = t.ch;
  const max = t.B.character.maxConsumables;
  for (const l of dep.loot) {
    if (l.taken || Math.hypot(l.x - p.x, l.y - p.y) > 0.7) continue;
    if (l.kind === 'gold') {
      t.record.goldFound += l.amount;
      float(t, l.x, l.y - 0.3, `+${l.amount} gold`, '#ffd84a', 13);
      l.taken = true;
    } else if (l.kind === 'potion' || l.kind === 'ration') {
      const key = l.kind === 'potion' ? 'potions' : 'rations';
      if (ch[key] < max) {
        ch[key] += 1;
        float(t, l.x, l.y - 0.3, l.kind === 'potion' ? '+1 Potion' : '+1 Ration', '#b7f0b7', 13);
        l.taken = true;
      }
    } else if (l.kind === 'item') {
      if (ch.inventory.length < t.stats.capacity) {
        l.item.found = t.id;
        ch.inventory.push(l.item);
        t.record.itemsFound += 1;
        t.events.push({ type: 'item', item: l.item });
        float(t, l.x, l.y - 0.3, l.item.name, RARITY_COLORS[l.item.rarity], 14);
        l.taken = true;
      } else if (!l.warned) {
        l.warned = true;
        float(t, l.x, l.y - 0.3, 'Inventory full', '#ff9b9b', 13);
      }
    }
  }
  dep.loot = dep.loot.filter((l) => !l.taken);

  for (const c of dep.caches) {
    if (c.opened || Math.hypot(c.x - p.x, c.y - p.y) > 0.9) continue;
    c.opened = true;
    float(t, c.x, c.y - 0.5, 'Cache!', '#ffd84a', 15);
    dropLoot(t, dep, c.x, c.y, monsterLevel(t, t.depth) + 1, { goldChance: 1, items: t.rng.chance(0.4) ? 2 : 1, consumableChance: 0.6 });
  }
}

export const RARITY_COLORS = { common: '#e8e2d6', magic: '#6aa6ff', rare: '#ffd84a' };

// --- Mirrormaster -----------------------------------------------------------------------------

export function sealInfo(t) {
  const dep = t.depths[t.depth];
  if (!dep || dep.sealAt == null) return null;
  return { left: dep.sealAt - t.time, sealed: t.time >= dep.sealAt };
}

function mirrormaster(t, dep, dt) {
  const M = t.B.mirrormaster;
  const p = t.player;
  const seal = sealInfo(t);
  if (seal) {
    if (!seal.sealed && seal.left <= M.sealWarning && !t.mm.warned[t.depth]) {
      t.mm.warned[t.depth] = true;
      say(t, 'Mirrormaster', fmt(LINES.sealWarning, { d: t.depth, s: Math.ceil(seal.left) }));
    }
    if (seal.sealed) {
      if (!t.mm.sealedSaid[t.depth]) {
        t.mm.sealedSaid[t.depth] = true;
        say(t, 'Mirrormaster', fmt(LINES.sealed, { d: t.depth }));
        t.events.push({ type: 'shake', amount: 6 });
      }
      if (!t.god) {
        p.hp -= t.stats.maxHp * M.sealDamagePerSecond * dt;
        if (p.hp <= 0) kill(t, dep, { name: 'the collapsing tunnels' }, p);
      }
      for (const r of t.rivals) {
        if (r.real && r.status === 'in') {
          r.hp -= r.maxHp * M.sealDamagePerSecond * dt;
          if (r.hp <= 0) kill(t, dep, null, r);
        }
      }
    }
  }
  if (t.time - t.mm.lastDamageAt > M.boredAfter && t.time - t.mm.lastBoredAt > M.boredAfter) {
    t.mm.lastBoredAt = t.time;
    say(t, 'Mirrormaster', t.rng.pick(LINES.bored));
    spawnNear(t, dep, 'gnawer', M.boredGnawers);
  }
}

function spawnNear(t, dep, type, count) {
  const map = dep.map;
  const p = t.player;
  const level = monsterLevel(t, t.depth);
  let spawned = 0;
  for (let i = 0; i < 300 && spawned < count; i++) {
    const x = Math.floor(p.x) + t.rng.int(-10, 10);
    const y = Math.floor(p.y) + t.rng.int(-10, 10);
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < 6 || d > 11 || isSolid(map, x, y)) continue;
    const steps = dep.toPlayer ? dep.toPlayer[y * map.w + x] : -1;
    if (steps < 0 || steps > 18) continue;
    const m = makeMonster(t, type, x + 0.5, y + 0.5, level);
    m.awake = true;
    m.summoned = true;
    dep.monsters.push(m);
    spawned += 1;
  }
}

function reveal(t, dep) {
  const R = t.B.view.visionRadius;
  const { map, explored } = dep;
  const px = Math.floor(t.player.x);
  const py = Math.floor(t.player.y);
  for (let y = py - R; y <= py + R; y++) {
    for (let x = px - R; x <= px + R; x++) {
      if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue;
      if ((x - px) ** 2 + (y - py) ** 2 <= R * R) explored[y * map.w + x] = 1;
    }
  }
}

function updateInteract(t, dep) {
  const p = t.player;
  const map = dep.map;
  t.interact = null;
  if (tileAt(map, Math.floor(p.x), Math.floor(p.y)) === EXIT || Math.hypot(map.exit.x + 0.5 - p.x, map.exit.y + 0.5 - p.y) < 0.9) {
    if (!map.wardenRoom) t.interact = 'descend';
  }
  if (map.gate && map.gateOpen && Math.hypot(map.gate.x + 0.5 - p.x, map.gate.y + 0.5 - p.y) < 1.6) t.interact = 'gate';
}

// --- Debug ------------------------------------------------------------------------------------

export const debug = {
  mark(t) {
    gainEcho(t, echoToNextMark(t.ch.level, t.B) - t.ch.echo);
  },
  heal(t) {
    const p = t.player;
    p.hp = t.stats.maxHp;
    p.stamina = t.stats.maxStamina;
    p.focus = t.stats.maxFocus;
    p.hunger = t.B.hunger.max;
  },
  killAll(t) {
    const dep = t.depths[t.depth];
    for (const m of dep.monsters) if (!m.dead && !m.def.warden) kill(t, dep, t.player, m, {});
    dep.monsters = dep.monsters.filter((m) => !m.dead);
  },
  reveal(t) {
    t.depths[t.depth].explored.fill(1);
  },
  nextDepth(t) {
    if (t.depth < t.B.tithe.depths) enterDepth(t, t.depth + 1);
  },
  win(t) {
    t.record.wardenSlain = true;
    end(t, 'champion', t.ch.name);
  },
};
