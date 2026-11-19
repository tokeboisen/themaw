// En Tithe i realtid med op til 8 kandidater: spillerne og NPC-rivalerne (Feature-010 til -017, -002, -003, -006, -008,
// -028 og -029). Overført fra prototype/js/core/world.js og skrevet om til flere spillere.
// Ingen DOM og intet netværk her: tithe-server kalder stepTithe 30 gange i sekundet og sender hver spiller det, den kan se.
// Spillere slår ikke spillere endnu; PvP og partier kommer i fase 4 (Feature-011, -034, -035).

import type { Balance, MonsterDef, RivalDef } from './balance.ts';
import {
  addEcho, addSkillXp, derivedStats, dropItem, equipItem, spendAttributePoint, spendSkillPoint, unequipItem, SKILL_NAMES,
  type DerivedStats,
} from './character.ts';
import {
  bfs, EXIT, generateDepth, isSolid, lineOfSight, moveWithCollision, randomFloorInRoom, tileAt, type DepthMap, type Room,
} from './dungeon.ts';
import { assignHotbarKey, clearHotbarKey, ECHO_ARTS, HOTBAR_KEYS, removeWeaponFromHotbar, type EchoArt, type Hotbar, type HotbarKey } from './gear.ts';
import { generateItem, type ItemOptions } from './items.ts';
import type { OutcomeKind, TitheRecord } from './rim.ts';
import { createRng, type Rng } from './rng.ts';
import type { Attribute, Character, Item, Rarity, SkillId, Slot } from './types.ts';

const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

const LINES = {
  start: ['Welcome, Branded, to the Tithe! Aurum is watching.', 'The Mirrors are lit. Descend, and do try to be interesting.'],
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
  playerLeft: '{name} has left the Tithe. The Brand drags them back up.',
  depth: 'Depth {d}. The air grows heavier.',
};

export const RARITY_COLORS: Record<Rarity, string> = { common: '#e8e2d6', magic: '#6aa6ff', rare: '#ffd84a' };

const fmt = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k]));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

// --- Typer ------------------------------------------------------------------------------------------

export interface Vec {
  x: number;
  y: number;
}

interface Body extends Vec {
  id: string;
  name: string;
  r: number;
  hp: number;
  maxHp: number;
  level: number;
  armour: number;
  flash: number;
  facing: Vec;
  dead: boolean;
}

export interface Monster extends Body {
  kind: 'monster';
  type: string;
  def: MonsterDef;
  min: number;
  max: number;
  attackCd: number;
  windup: number;
  aim: Vec | null;
  awake: boolean;
  summonT: number;
  /** Kaldt frem af Mirrormaster eller The Foreman: giver hverken loot eller drabsserie (Feature-011, -017). */
  summoned: boolean;
}

interface RivalWeapon {
  min: number;
  max: number;
  reach: number;
  range: number;
  speed: number;
  cooldown: number;
  ranged: boolean;
  kind: 'melee' | 'arrow' | 'bolt';
  mult: number;
}

export interface Rival extends Body {
  kind: 'rival';
  def: RivalDef;
  color: string;
  weapon: RivalWeapon;
  /** Fjendtlig mod alle spillere fra starten (Feature-014) … */
  aggressive: boolean;
  /** … eller mod de spillere, der har slået den. */
  hostileTo: Set<string>;
  potions: number;
  status: 'in' | 'fallen' | 'champion';
  depth: number;
  /** 0–1: hvor langt mod trappen rivalen er nået, når ingen spiller ser den. */
  progress: number;
  real: boolean;
  attackCd: number;
  windup: number;
  aim: Vec;
  secondsPerDepth: number;
  budget: number;
  walking: boolean;
  stuckT: number;
  lastX: number;
  lastY: number;
  jiggle: number;
  jiggleDir: Vec;
  fightT: number;
}

export interface PlayerInput {
  moveX: number;
  moveY: number;
  attack: boolean;
}

export type PlayerAct =
  | { act: 'dodge' }
  | { act: 'potion' }
  | { act: 'ration' }
  | { act: 'interact' }
  | { act: 'hotkey'; key: HotbarKey };

export interface PlayerEnd {
  kind: OutcomeKind;
  /** Hvem der er Champion, eller hvad spilleren faldt for. */
  name: string;
  time: number;
}

export interface Player extends Body {
  kind: 'player';
  userId: string;
  userName: string;
  characterId: string;
  /** Arbejdskopien af karakteren (planen, afsnit 5). */
  ch: Character;
  hotbar: Hotbar;
  stats: DerivedStats;
  depth: number;
  stamina: number;
  focus: number;
  hunger: number;
  attackCd: number;
  boltCd: number;
  dodgeCd: number;
  dodgeT: number;
  dodgeDir: Vec;
  potionCd: number;
  drawT: number;
  swing: number;
  swingDir: Vec;
  swingArc: number;
  swingReach: number;
  input: PlayerInput;
  acts: PlayerAct[];
  end: PlayerEnd | null;
  record: TitheRecord;
  start: { mark: number; skills: Record<SkillId, number> };
  mm: { lastDamageAt: number; lastBoredAt: number; killTimes: number[]; lastSponsorAt: number };
  explored: Record<number, Uint8Array>;
  /** Felter, spilleren har set siden sidste snapshot. */
  revealed: number[];
  interact: 'descend' | 'gate' | null;
  field: Int16Array | null;
  fieldAge: number;
  /** Tælles op, når karakterskærmens indhold ændrer sig, så serveren ved, hvornår den skal sendes igen. */
  sheetVersion: number;
  warnedLoot: Set<string>;
}

export interface Loot extends Vec {
  id: string;
  kind: 'item' | 'gold' | 'potion' | 'ration';
  item?: Item;
  amount?: number;
}

export interface Cache extends Vec {
  id: string;
  opened: boolean;
}

export interface Projectile extends Vec {
  id: string;
  vx: number;
  vy: number;
  speed: number;
  range: number;
  traveled: number;
  amount: number;
  crit: boolean;
  skill?: SkillId;
  kind: 'arrow' | 'bolt' | 'spit';
  faction: 'player' | 'rival' | 'monster';
  owner: Body;
  done: boolean;
}

export interface Depth {
  level: number;
  map: DepthMap;
  monsters: Monster[];
  loot: Loot[];
  caches: Cache[];
  projectiles: Projectile[];
  toExit: Int16Array;
  maxExitDist: number;
  sealAt: number | null;
  warned: boolean;
  sealedSaid: boolean;
  /** Dybde 1: kandidaternes egne startrum (Feature-010). */
  startRooms: Room[];
}

export interface Message {
  who: string;
  text: string;
  time: number;
  /** Kun til denne spiller; ellers til hele Tithen. */
  to?: string;
}

export interface Fx {
  type: 'float' | 'death' | 'shake' | 'hurt';
  depth: number;
  x?: number;
  y?: number;
  text?: string;
  color?: string;
  size?: number;
  amount?: number;
  kind?: string;
  to?: string;
}

export interface Tithe {
  id: string;
  name: string;
  seed: number;
  rng: Rng;
  B: Balance;
  time: number;
  depths: Record<number, Depth>;
  players: Player[];
  rivals: Rival[];
  messages: Message[];
  fx: Fx[];
  /** Navnet på Champion, når Tithen har en (Feature-015, -014). */
  champion: string | null;
  closed: boolean;
  wardenAlive: boolean;
  wardenHpFactor: number;
  /** Porten åbner for partiet hos den spiller, der slog The Foreman (Feature-015). */
  gateOpenFor: Set<string>;
  wardenSaid: boolean;
  /** Spillernes gennemsnitlige Mark, som rivalernes og monstrenes niveau følger (Feature-010, -011). */
  mark: number;
  nextId: number;
}

export interface TithePlayerSetup {
  userId: string;
  userName: string;
  characterId: string;
  character: Character;
  hotbar: Hotbar;
}

export interface TitheSetup {
  id: string;
  name: string;
  seed: number;
  players: TithePlayerSetup[];
}

// --- Oprettelse (Feature-010 Enter the Tithe) ------------------------------------------------------

export function createTithe(setup: TitheSetup, B: Balance): Tithe {
  const rng = createRng(setup.seed);
  const marks = setup.players.map((p) => p.character.level);
  const mark = Math.max(1, Math.round(marks.reduce((s, m) => s + m, 0) / Math.max(1, marks.length)));
  const t: Tithe = {
    id: setup.id, name: setup.name, seed: setup.seed, rng, B, time: 0, depths: {}, players: [], rivals: [], messages: [], fx: [],
    champion: null, closed: false, wardenAlive: true, wardenHpFactor: 1, gateOpenFor: new Set(), wardenSaid: false, mark, nextId: 1,
  };
  t.players = setup.players.map((s) => makePlayer(t, s));
  // NPC-rivaler fylder pladserne op til 8, valgt blandt de syv (Feature-010 CMD-01).
  const pool = [...B.tithe.rivals];
  const count = Math.max(0, B.tithe.candidates - t.players.length);
  for (let i = 0; i < count && pool.length; i++) t.rivals.push(makeRival(t, pool.splice(Math.floor(rng.next() * pool.length), 1)[0]!));

  const dep = buildDepth(t, 1);
  t.depths[1] = dep;
  // Hver kandidat starter i sit eget rum, omtrent lige langt fra trappen (Feature-010 AGG-01).
  const candidates: (Player | Rival)[] = [...t.players, ...t.rivals];
  candidates.forEach((c, i) => {
    const room = dep.startRooms[i % dep.startRooms.length]!;
    const pos = randomFloorInRoom(rng, dep.map, room);
    c.x = pos.x + 0.5;
    c.y = pos.y + 0.5;
    if (c.kind === 'rival') {
      c.real = true;
      c.progress = progressFromPos(dep, c);
    }
  });
  for (const p of t.players) {
    p.depth = 1;
    reveal(t, p);
    updateInteract(t, p);
  }
  say(t, 'Mirrormaster', rng.pick(LINES.start));
  if (B.tithe.graceSeconds > 0) say(t, 'Mirrormaster', fmt(LINES.grace, { s: B.tithe.graceSeconds }));
  return t;
}

function nid(t: Tithe, prefix: string): string {
  t.nextId += 1;
  return `${prefix}${t.nextId}`;
}

function makePlayer(t: Tithe, s: TithePlayerSetup): Player {
  const stats = derivedStats(s.character, t.B);
  return {
    kind: 'player', id: s.userId, userId: s.userId, userName: s.userName, characterId: s.characterId, name: s.character.name,
    ch: s.character, hotbar: s.hotbar, stats, x: 0, y: 0, r: 0.35, hp: stats.maxHp, maxHp: stats.maxHp, level: s.character.level,
    armour: stats.armour, flash: 0, facing: { x: 1, y: 0 }, dead: false, depth: 1,
    stamina: stats.maxStamina, focus: stats.maxFocus, hunger: t.B.hunger.max,
    attackCd: 0, boltCd: 0, dodgeCd: 0, dodgeT: 0, dodgeDir: { x: 1, y: 0 }, potionCd: 0, drawT: 0,
    swing: 0, swingDir: { x: 1, y: 0 }, swingArc: 90, swingReach: 1,
    input: { moveX: 0, moveY: 0, attack: false }, acts: [], end: null,
    record: { kills: 0, rivalsDefeated: 0, renown: 0, goldFound: 0, maxDepth: 1, wardenSlain: false, itemsFound: 0, playersDefeated: 0 },
    start: { mark: s.character.level, skills: Object.fromEntries(Object.entries(s.character.skills).map(([k, v]) => [k, v.level])) as Record<SkillId, number> },
    mm: { lastDamageAt: 0, lastBoredAt: 0, killTimes: [], lastSponsorAt: -999 },
    explored: {}, revealed: [], interact: null, field: null, fieldAge: 99, sheetVersion: 1, warnedLoot: new Set(),
  };
}

function rivalWeapon(def: RivalDef, level: number, B: Balance): RivalWeapon {
  const effective = 5 + level * B.tithe.rivalSkillPerLevel;
  const mult = 1 + effective * B.skills.damagePerSkill;
  if (def.weapon === 'echo') {
    const b = B.combat.echoBolt;
    return { min: b.min, max: b.max, reach: 1, range: b.range, speed: b.speed, cooldown: b.cooldown * 1.8, ranged: true, kind: 'bolt', mult };
  }
  const baseId = {
    heavy: level >= 2 ? 'war_axe' : 'pickaxe',
    blades: level >= 2 ? 'short_sword' : 'rusty_sword',
    bows: level >= 2 ? 'hunting_bow' : 'short_bow',
  }[def.weapon];
  const base = B.items.bases[baseId]!;
  return {
    min: base.min ?? 1, max: base.max ?? 3, reach: base.reach ?? 1, range: base.range ?? 0, cooldown: (base.cooldown ?? 1) * 1.25,
    ranged: !!base.range, kind: base.range ? 'arrow' : 'melee', speed: B.combat.arrowSpeed, mult,
  };
}

function makeRival(t: Tithe, def: RivalDef): Rival {
  const B = t.B;
  const level = Math.max(1, t.mark + def.levelOffset);
  const maxHp = B.tithe.rivalHpBase + level * B.tithe.rivalHpPerLevel;
  return {
    kind: 'rival', id: def.id, name: def.name, color: def.color, def, level, x: 0, y: 0, r: 0.38, hp: maxHp, maxHp,
    armour: B.tithe.rivalArmour, weapon: rivalWeapon(def, level, B), aggressive: t.rng.chance(def.aggression), hostileTo: new Set(),
    potions: 1, status: 'in', depth: 1, progress: 0, real: false, attackCd: 1, windup: 0, aim: { x: 1, y: 0 }, flash: 0,
    facing: { x: 1, y: 0 }, dead: false,
    secondsPerDepth: (B.tithe.rivalSecondsPerDepth * t.rng.range(0.85, 1.2)) / (1 + level * 0.03),
    budget: 0, walking: false, stuckT: 0, lastX: 0, lastY: 0, jiggle: 0, jiggleDir: { x: 0, y: 0 }, fightT: 0,
  };
}

function monsterLevel(t: Tithe, d: number): number {
  const M = t.B.monsters;
  return Math.max(1, Math.round(d * M.levelPerDepth + Math.floor((t.mark - 1) * M.followPlayerLevel)));
}

/** Startrummene i dybde 1: rum omtrent lige langt fra trappen, helst langt væk (Feature-010 AGG-01). */
function chooseStartRooms(map: DepthMap, toExit: Int16Array, count: number, rng: Rng): Room[] {
  const scored = map.rooms
    .filter((r) => r !== map.exitRoom && r !== map.wardenRoom)
    .map((r) => ({ r, d: toExit[r.cy * map.w + r.cx] ?? -1 }))
    .filter((x) => x.d >= 0)
    .sort((a, b) => b.d - a.d);
  if (!scored.length) return [map.startRoom];
  const n = Math.min(count, scored.length);
  let best = 0;
  let bestScore = Infinity;
  for (let i = 0; i + n <= scored.length; i++) {
    const spread = scored[i]!.d - scored[i + n - 1]!.d;
    const score = spread - 0.3 * scored[i + n - 1]!.d;
    if (score < bestScore - 1e-9) {
      bestScore = score;
      best = i;
    }
  }
  const rooms = scored.slice(best, best + n).map((x) => x.r);
  for (let i = rooms.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [rooms[i], rooms[j]] = [rooms[j]!, rooms[i]!];
  }
  return rooms;
}

function buildDepth(t: Tithe, d: number): Depth {
  const B = t.B;
  const last = d === B.tithe.depths;
  const map = generateDepth(t.rng, { warden: last });
  const toExit = bfs(map, map.exit.x, map.exit.y);
  let maxExitDist = 1;
  for (const v of toExit) if (v > maxExitDist) maxExitDist = v;
  const startRooms = d === 1 ? chooseStartRooms(map, toExit, t.players.length + t.rivals.length, t.rng) : [map.startRoom];
  const playerRooms = new Set(d === 1 ? startRooms.slice(0, t.players.length) : [map.startRoom]);
  const dep: Depth = {
    level: d, map, monsters: [], loot: [], caches: [], projectiles: [], toExit, maxExitDist,
    sealAt: B.mirrormaster.sealTimes[d - 1] ?? null, warned: false, sealedSaid: false, startRooms,
  };
  const level = monsterLevel(t, d);
  const types = Object.entries(B.monsters.types).filter(([, m]) => !m.warden);
  const weight = (m: MonsterDef) => (m.weight ?? 0) + ((m.weight ?? 0) < 30 ? (d - 1) * 5 : 0);
  const totalWeight = types.reduce((s, [, m]) => s + weight(m), 0);
  const pickType = () => {
    let x = t.rng.next() * totalWeight;
    for (const [id, m] of types) {
      x -= weight(m);
      if (x <= 0) return id;
    }
    return types[0]![0];
  };
  for (const room of map.rooms) {
    // Ingen monstre i spillernes startrum, Warden-hallen eller startrummet på de dybere dybder.
    if (playerRooms.has(room) || room === map.startRoom || room === map.wardenRoom) continue;
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
  const cacheRooms = map.rooms.filter((r) => r !== map.startRoom && r !== map.wardenRoom && !playerRooms.has(r));
  for (let i = 0; i < B.loot.cachesPerDepth && cacheRooms.length; i++) {
    const room = cacheRooms.splice(Math.floor(t.rng.next() * cacheRooms.length), 1)[0]!;
    const pos = randomFloorInRoom(t.rng, map, room);
    dep.caches.push({ id: nid(t, 'c'), x: pos.x + 0.5, y: pos.y + 0.5, opened: false });
  }
  return dep;
}

function makeMonster(t: Tithe, type: string, x: number, y: number, level: number): Monster {
  const def = t.B.monsters.types[type]!;
  const M = t.B.monsters;
  const hp = Math.round(def.hp * (1 + M.hpPerLevel * (level - 1)));
  const dmg = 1 + M.damagePerLevel * (level - 1);
  return {
    kind: 'monster', id: nid(t, 'm'), type, def, name: def.name, level, x, y, r: def.radius, hp, maxHp: hp,
    min: def.min * dmg, max: def.max * dmg, armour: def.armour ?? 0, attackCd: t.rng.range(0, def.cooldown), windup: 0, aim: null,
    flash: 0, awake: false, summonT: def.summonEvery ?? 0, facing: { x: 1, y: 0 }, dead: false, summoned: false,
  };
}

function newItem(t: Tithe, level: number, opts: ItemOptions): Item {
  return generateItem(t.rng, level, t.B, opts);
}

// --- Hjælpere -----------------------------------------------------------------------------------

function say(t: Tithe, who: string, text: string, to?: string): void {
  t.messages.push(to ? { who, text, time: t.time, to } : { who, text, time: t.time });
}

function float(t: Tithe, depth: number, x: number, y: number, text: string, color = '#fff', size = 14, to?: string): void {
  t.fx.push(to ? { type: 'float', depth, x, y, text, color, size, to } : { type: 'float', depth, x, y, text, color, size });
}

export function playersIn(t: Tithe): Player[] {
  return t.players.filter((p) => !p.end);
}

function playersOn(t: Tithe, depth: number): Player[] {
  return t.players.filter((p) => !p.end && p.depth === depth);
}

function realRivals(t: Tithe, depth: number): Rival[] {
  return t.rivals.filter((r) => r.real && r.status === 'in' && r.depth === depth);
}

function graceOver(t: Tithe): boolean {
  return t.time >= t.B.tithe.graceSeconds;
}

/** Hvem må slå hvem: ingen kandidat slår en anden i nådetiden, rivaler slår ikke hinanden, og spillere ikke spillere (fase 4). */
function canStrike(t: Tithe, attacker: Body, target: Body): boolean {
  const a = (attacker as { kind?: string }).kind;
  const b = (target as { kind?: string }).kind;
  const candidate = (k?: string) => k === 'player' || k === 'rival';
  if (candidate(a) && candidate(b)) {
    if (!graceOver(t)) return false;
    if (a === 'rival' && b === 'rival') return false;
    if (a === 'player' && b === 'player') return false;
  }
  return true;
}

function hostile(r: Rival, p: Player): boolean {
  return r.aggressive || r.hostileTo.has(p.id);
}

export function refreshStats(t: Tithe, p: Player): void {
  const old = p.stats;
  p.stats = derivedStats(p.ch, t.B);
  p.maxHp = p.stats.maxHp;
  p.armour = p.stats.armour;
  p.level = p.ch.level;
  p.hp = Math.min(p.stats.maxHp, p.hp + Math.max(0, p.stats.maxHp - old.maxHp));
  p.stamina = Math.min(p.stats.maxStamina, p.stamina + Math.max(0, p.stats.maxStamina - old.maxStamina));
  p.focus = Math.min(p.stats.maxFocus, p.focus + Math.max(0, p.stats.maxFocus - old.maxFocus));
  p.sheetVersion += 1;
}

function placeRival(t: Tithe, dep: Depth, r: Rival): void {
  const map = dep.map;
  const players = playersOn(t, dep.level);
  let pos: { x: number; y: number } | null = null;
  if (r.progress < 0.08) {
    pos = randomFloorInRoom(t.rng, map, map.startRoom);
  } else {
    const target = (1 - r.progress) * dep.maxExitDist;
    let bestScore = Infinity;
    for (let i = 0; i < 500; i++) {
      const x = t.rng.int(1, map.w - 2);
      const y = t.rng.int(1, map.h - 2);
      const d = dep.toExit[y * map.w + x] ?? -1;
      if (d < 0) continue;
      const tooClose = players.some((p) => Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) < 9) ? 50 : 0;
      const score = Math.abs(d - target) + tooClose;
      if (score < bestScore) {
        bestScore = score;
        pos = { x, y };
      }
    }
    pos = pos ?? { ...map.start };
  }
  r.x = pos.x + 0.5;
  r.y = pos.y + 0.5;
  r.real = true;
  r.windup = 0;
  r.attackCd = 1;
}

function progressFromPos(dep: Depth, r: Rival): number {
  const d = dep.toExit[Math.floor(r.y) * dep.map.w + Math.floor(r.x)] ?? -1;
  if (d < 0) return 0;
  return clamp(1 - d / dep.maxExitDist, 0, 0.98);
}

/** Rivaler simuleres kun på dybder med spillere; på de andre skrider de frem i tid (Feature-014 SVC-01). */
function syncRivalPresence(t: Tithe): void {
  for (const r of t.rivals) {
    if (r.status !== 'in') continue;
    const watched = playersOn(t, r.depth).length > 0;
    const dep = t.depths[r.depth];
    if (r.real && !watched) {
      r.real = false;
      if (dep) r.progress = progressFromPos(dep, r);
    } else if (!r.real && watched && dep) {
      placeRival(t, dep, r);
    }
  }
  for (const [d, dep] of Object.entries(t.depths)) if (!playersOn(t, Number(d)).length) dep.projectiles = [];
}

function enterDepth(t: Tithe, p: Player, d: number): void {
  p.depth = d;
  if (d > p.record.maxDepth) {
    p.record.maxDepth = d;
    addRenown(t, p, t.B.renown.depth);
  }
  if (!t.depths[d]) t.depths[d] = buildDepth(t, d);
  const dep = t.depths[d];
  const minTime = t.B.mirrormaster.minTimeOnEntry;
  if (dep.sealAt != null && dep.sealAt - t.time < minTime) dep.sealAt = t.time + minTime;
  p.x = dep.map.start.x + 0.5;
  p.y = dep.map.start.y + 0.5;
  p.dodgeT = 0;
  p.field = null;
  p.fieldAge = 99;
  syncRivalPresence(t);
  reveal(t, p);
  updateInteract(t, p);
  say(t, 'Mirrormaster', fmt(LINES.depth, { d }), p.id);
}

// --- Spillernes handlinger ----------------------------------------------------------------------

/** Lægger en handling i køen til næste skridt (Feature-012, -015, -008, -013, -028). */
export function queueAct(t: Tithe, playerId: string, act: PlayerAct): void {
  const p = t.players.find((x) => x.id === playerId);
  if (p && !p.end && p.acts.length < 16) p.acts.push(act);
}

export function setInput(t: Tithe, playerId: string, input: PlayerInput): void {
  const p = t.players.find((x) => x.id === playerId);
  if (!p) return;
  p.input = { moveX: clamp(Number(input.moveX) || 0, -1, 1), moveY: clamp(Number(input.moveY) || 0, -1, 1), attack: !!input.attack };
}

/** Feature-029 CMD-01: at forlade Tithen er at tabe; det tæller som et fald, og de andre fortsætter. */
export function leaveTithe(t: Tithe, playerId: string): void {
  const p = t.players.find((x) => x.id === playerId);
  if (!p || p.end) return;
  say(t, 'Mirrormaster', fmt(LINES.playerLeft, { name: p.name }));
  endPlayer(t, p, 'left', p.name);
}

export type SheetAction =
  | { action: 'equip'; itemId: string }
  | { action: 'unequip'; slot: Slot }
  | { action: 'drop'; itemId: string }
  | { action: 'hotbar'; key: HotbarKey; itemId?: string; echoArt?: EchoArt }
  | { action: 'clear'; key: HotbarKey }
  | { action: 'attribute'; attribute: Attribute }
  | { action: 'skill'; skill: SkillId };

export type SheetRefusal = 'inventoryFull' | 'invalid';

/** Karakterskærmen under en Tithe: udstyr, drop, hotbar og point (Feature-007, -027, -004). */
export function sheetAction(t: Tithe, playerId: string, a: SheetAction): SheetRefusal | null {
  const p = t.players.find((x) => x.id === playerId);
  if (!p || p.end) return 'invalid';
  const ch = p.ch;
  const owns = (id: string) => ch.inventory.some((i) => i.id === id) || Object.values(ch.equipment).some((i) => i?.id === id);
  switch (a.action) {
    case 'equip':
      if (!equipItem(ch, a.itemId)) return 'invalid';
      break;
    case 'unequip':
      if (!['weapon', 'armour', 'ring'].includes(a.slot) || !ch.equipment[a.slot]) return 'invalid';
      if (!unequipItem(ch, a.slot, t.B)) return 'inventoryFull';
      break;
    case 'drop': {
      // Feature-007 CMD-03: kun under en Tithe, og tingen er væk.
      const item = dropItem(ch, a.itemId);
      if (!item) return 'invalid';
      p.hotbar = removeWeaponFromHotbar(p.hotbar, item.id);
      break;
    }
    case 'hotbar': {
      if (!HOTBAR_KEYS.includes(a.key)) return 'invalid';
      if (a.echoArt !== undefined) {
        if (!ECHO_ARTS.includes(a.echoArt)) return 'invalid';
        p.hotbar = assignHotbarKey(p.hotbar, a.key, { echoArt: a.echoArt });
      } else {
        const item = [...ch.inventory, ch.equipment.weapon].find((i) => i?.id === a.itemId);
        if (!item || item.slot !== 'weapon' || !owns(item.id)) return 'invalid';
        p.hotbar = assignHotbarKey(p.hotbar, a.key, { weapon: item.id });
      }
      break;
    }
    case 'clear':
      if (!HOTBAR_KEYS.includes(a.key)) return 'invalid';
      p.hotbar = clearHotbarKey(p.hotbar, a.key);
      break;
    case 'attribute':
      if (!spendAttributePoint(ch, a.attribute)) return 'invalid';
      break;
    case 'skill':
      if (!spendSkillPoint(ch, a.skill, t.B)) return 'invalid';
      break;
    default:
      return 'invalid';
  }
  refreshStats(t, p);
  return null;
}

// --- Hovedløkken --------------------------------------------------------------------------------

export function stepTithe(t: Tithe, dt: number): void {
  if (t.closed) return;
  t.time += dt;
  syncRivalPresence(t);
  for (const p of playersIn(t)) {
    p.fieldAge += dt;
    if (p.fieldAge > 0.25) {
      const dep = t.depths[p.depth]!;
      p.field = bfs(dep.map, Math.floor(p.x), Math.floor(p.y));
      p.fieldAge = 0;
    }
  }
  for (const p of playersIn(t)) updatePlayer(t, p, dt);
  if (t.closed) return;
  syncRivalPresence(t);
  const active = [...new Set(playersIn(t).map((p) => p.depth))];
  for (const d of active) {
    const dep = t.depths[d]!;
    updateMonsters(t, dep, dt);
    updateRivals(t, dep, dt);
    updateProjectiles(t, dep, dt);
    dep.monsters = dep.monsters.filter((m) => !m.dead);
    separate(t, dep);
    pickups(t, dep);
    sealDamage(t, dep, dt);
    if (t.closed) return;
  }
  updateAbstractRivals(t, dt);
  mirrormaster(t, dt);
  for (const p of playersIn(t)) {
    reveal(t, p);
    updateInteract(t, p);
  }
  if (!playersIn(t).length) t.closed = true;
}

function updatePlayer(t: Tithe, p: Player, dt: number): void {
  const s = p.stats;
  const B = t.B;
  p.attackCd = Math.max(0, p.attackCd - dt);
  p.boltCd = Math.max(0, p.boltCd - dt);
  p.dodgeCd = Math.max(0, p.dodgeCd - dt);
  p.potionCd = Math.max(0, p.potionCd - dt);
  p.drawT = Math.max(0, p.drawT - dt);
  p.flash = Math.max(0, p.flash - dt);
  p.swing = Math.max(0, p.swing - dt);
  const dep = t.depths[p.depth]!;

  // Feature-013 SVC-02: sult, udholdenhed, fokus og liv.
  p.hunger = Math.max(0, p.hunger - s.hungerDrain * dt);
  const starving = p.hunger <= 0;
  p.stamina = Math.min(s.maxStamina, p.stamina + s.staminaRegen * (starving ? B.hunger.starvingStaminaRegen : 1) * dt);
  p.focus = Math.min(s.maxFocus, p.focus + s.focusRegen * dt);
  if (!starving) p.hp = Math.min(s.maxHp, p.hp + B.character.hpRegen * dt);

  let mx = p.input.moveX;
  let my = p.input.moveY;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  const acts = p.acts.splice(0);
  for (const a of acts) {
    if (a.act === 'dodge' && p.dodgeCd <= 0 && p.dodgeT <= 0 && p.stamina >= B.combat.dodgeCost) {
      const l = Math.hypot(mx, my);
      p.dodgeDir = l > 0.1 ? { x: mx / l, y: my / l } : { ...p.facing };
      p.dodgeT = B.combat.dodgeTime;
      p.dodgeCd = B.combat.dodgeCooldown;
      p.stamina -= B.combat.dodgeCost;
    } else if (a.act === 'potion') drinkPotion(t, p);
    else if (a.act === 'ration') eatRation(t, p);
    else if (a.act === 'hotkey') useHotkey(t, p, dep, a.key);
    else if (a.act === 'interact') {
      if (p.interact === 'descend' && p.depth < B.tithe.depths) {
        enterDepth(t, p, p.depth + 1);
        return;
      }
      if (p.interact === 'gate') {
        claimTithe(t, p);
        return;
      }
    }
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
  const w = s.weapon;
  if (p.input.attack && p.attackCd <= 0 && p.stamina >= w.staminaCost && p.dodgeT <= 0 && p.drawT <= 0) playerAttack(t, p, dep);
}

/** Feature-008 CMD-01: 40 % af max liv, én gang i sekundet og kun, når livet ikke er fuldt. */
function drinkPotion(t: Tithe, p: Player): void {
  const s = p.stats;
  if (p.ch.potions <= 0 || p.potionCd > 0 || p.hp >= s.maxHp) return;
  p.ch.potions -= 1;
  const heal = Math.round(s.maxHp * t.B.combat.potionHeal);
  p.hp = Math.min(s.maxHp, p.hp + heal);
  p.potionCd = t.B.combat.potionCooldown;
  p.sheetVersion += 1;
  float(t, p.depth, p.x, p.y - 0.6, `+${heal}`, '#6f6', 15);
}

/** Feature-008 CMD-02: 45 sult, og kun når sulten er under 95 af 100. */
function eatRation(t: Tithe, p: Player): void {
  const H = t.B.hunger;
  if (p.ch.rations <= 0 || p.hunger >= H.max - 5) return;
  p.ch.rations -= 1;
  p.hunger = Math.min(H.max, p.hunger + H.rationRestores);
  p.sheetVersion += 1;
  float(t, p.depth, p.x, p.y - 0.6, 'Fed', '#d9b26f', 14);
}

/** Feature-028 CMD-01: et våben på tasten trækkes, en Echo Art kastes, og en tom tast gør intet. */
function useHotkey(t: Tithe, p: Player, dep: Depth, key: HotbarKey): void {
  const slot = p.hotbar[key];
  if (!slot) return;
  if ('echoArt' in slot) {
    if (p.boltCd <= 0 && p.focus >= p.stats.bolt.focusCost && p.dodgeT <= 0) playerBolt(t, p, dep);
    return;
  }
  if (p.ch.equipment.weapon?.id === slot.weapon) return;
  if (!equipItem(p.ch, slot.weapon)) return;
  p.drawT = t.B.combat.drawTime;
  refreshStats(t, p);
}

/** Feature-015 CMD-01: porten er kun åben for partiet hos den, der slog The Foreman. */
function claimTithe(t: Tithe, p: Player): void {
  if (!t.gateOpenFor.has(p.id)) return;
  const party = [p];
  say(t, 'Mirrormaster', fmt(LINES.champion, { name: p.name }));
  t.champion = p.name;
  for (const x of playersIn(t)) endPlayer(t, x, party.includes(x) ? 'champion' : 'rival-champion', p.name);
  t.closed = true;
}

function targetsFor(t: Tithe, p: Player, dep: Depth): Body[] {
  const list: Body[] = dep.monsters.filter((m) => !m.dead);
  for (const r of realRivals(t, dep.level)) if (canStrike(t, p, r)) list.push(r);
  return list;
}

// Sigter automatisk: nærmeste fjende, og først en fredelig rival, hvis der ikke er andre (Feature-011).
function pickTarget(t: Tithe, p: Player, dep: Depth, range: number): Body | null {
  let best: Body | null = null;
  let bestScore = Infinity;
  for (const e of targetsFor(t, p, dep)) {
    const d = dist(p, e) - e.r;
    if (d > range) continue;
    if (!lineOfSight(dep.map, p.x, p.y, e.x, e.y)) continue;
    const peaceful = isRival(e) && !hostile(e, p);
    const score = d + (peaceful ? 100 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

function rollDamage(t: Tithe, min: number, max: number, mult: number, critChance = 0): { amount: number; crit: boolean } {
  const crit = t.rng.chance(critChance);
  return { amount: t.rng.range(min, max) * mult * (crit ? t.B.character.critMultiplier : 1), crit };
}

function aimAt(from: Vec, target: Vec | null, fallback: Vec): Vec {
  if (!target) return { ...fallback };
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}

function playerAttack(t: Tithe, p: Player, dep: Depth): void {
  const w = p.stats.weapon;
  const target = pickTarget(t, p, dep, w.ranged ? w.range : w.reach + 1.2);
  const dir = aimAt(p, target, p.facing);
  p.facing = dir;
  p.attackCd = w.cooldown;
  p.stamina -= w.staminaCost;
  if (w.ranged) {
    const roll = rollDamage(t, w.min, w.max, w.damageMult, p.stats.critChance);
    shoot(t, dep, p, dir, { ...roll, speed: t.B.combat.arrowSpeed, range: w.range, skill: w.skill, kind: 'arrow', faction: 'player' });
    return;
  }
  p.swing = 0.15;
  p.swingDir = dir;
  p.swingArc = w.arc;
  p.swingReach = w.reach;
  const hits = meleeHits(dep, p, dir, w.reach + 0.3, w.arc, targetsFor(t, p, dep));
  hits.forEach((e, i) => {
    const roll = rollDamage(t, w.min, w.max, w.damageMult, p.stats.critChance);
    damage(t, dep, p, e, roll.amount, roll.crit, { skill: w.skill, train: i < t.B.skills.maxHitsPerSwing });
  });
}

/** Feature-011 CMD-02: Echo Bolt koster 8 fokus, flyver 8 felter og træner Echo Arts. */
function playerBolt(t: Tithe, p: Player, dep: Depth): void {
  const b = p.stats.bolt;
  const target = pickTarget(t, p, dep, b.range);
  const dir = aimAt(p, target, p.facing);
  p.facing = dir;
  p.boltCd = b.cooldown;
  p.focus -= b.focusCost;
  const roll = rollDamage(t, b.min, b.max, b.damageMult, p.stats.critChance);
  shoot(t, dep, p, dir, { ...roll, speed: b.speed, range: b.range, skill: 'echo', kind: 'bolt', faction: 'player' });
}

function meleeHits(dep: Depth, attacker: Body, dir: Vec, reach: number, arcDeg: number, candidates: Body[]): Body[] {
  const half = ((arcDeg / 2) * Math.PI) / 180;
  const hits: Body[] = [];
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

interface Shot {
  amount: number;
  crit: boolean;
  speed: number;
  range: number;
  skill?: SkillId;
  kind: Projectile['kind'];
  faction: Projectile['faction'];
}

function shoot(t: Tithe, dep: Depth, owner: Body, dir: Vec, o: Shot): void {
  dep.projectiles.push({
    id: nid(t, 'p'), x: owner.x + dir.x * 0.4, y: owner.y + dir.y * 0.4, vx: dir.x, vy: dir.y, speed: o.speed, range: o.range,
    traveled: 0, amount: o.amount, crit: o.crit, kind: o.kind, faction: o.faction, owner, done: false,
    ...(o.skill ? { skill: o.skill } : {}),
  });
}

// --- Skade, drab og belønning (Feature-011, -002, -003, -017) ----------------------------------

const isPlayer = (b: Body | null | undefined): b is Player => (b as Player | undefined)?.kind === 'player';
const isRival = (b: Body | null | undefined): b is Rival => (b as Rival | undefined)?.kind === 'rival';
const isMonster = (b: Body | null | undefined): b is Monster => (b as Monster | undefined)?.kind === 'monster';

function damage(t: Tithe, dep: Depth, attacker: Body | null, target: Body, amount: number, crit: boolean, opts: { skill?: SkillId; train?: boolean } = {}): void {
  if (target.dead || t.closed) return;
  if (isPlayer(target) && target.end) return;
  if (attacker && !canStrike(t, attacker, target)) return;
  const B = t.B;
  if (isPlayer(target)) {
    if (target.dodgeT > 0) return; // Feature-013: et dodge kan ikke rammes
    amount *= 1 - target.stats.damageReduction;
  } else {
    amount *= 1 - target.armour / (target.armour + B.combat.armourFactor);
  }
  amount = Math.max(1, Math.round(amount));
  target.hp -= amount;
  target.flash = 0.12;
  const color = isPlayer(target) ? '#ff6b6b' : crit ? '#ffd84a' : '#ffffff';
  float(t, dep.level, target.x, target.y - target.r - 0.2, String(amount), color, crit ? 18 : 14);
  if (isPlayer(target)) t.fx.push({ type: 'hurt', depth: dep.level, amount, to: target.id });
  if (isPlayer(attacker)) {
    attacker.mm.lastDamageAt = t.time;
    if (opts.skill && opts.train) trainSkill(t, attacker, opts.skill, target, B.skills.xpPerHit);
  }
  if (isRival(target) && isPlayer(attacker)) target.hostileTo.add(attacker.id);
  if (isMonster(target)) target.awake = true;
  if (target.hp <= 0) kill(t, dep, attacker, target, opts);
}

/** Feature-002 CMD-01: erfaring × udfordring (fjendens niveau / Mark, mellem 0,25 og 1,5). */
function trainSkill(t: Tithe, p: Player, skill: SkillId, target: Body, amount: number): void {
  const B = t.B;
  const challenge = clamp((target.level || 1) / Math.max(1, p.ch.level), B.skills.challengeMin, B.skills.challengeMax);
  const gained = addSkillXp(p.ch, skill, amount * challenge, B);
  p.sheetVersion += 1;
  if (gained) {
    refreshStats(t, p);
    float(t, p.depth, p.x, p.y - 1, `${SKILL_NAMES[skill]} ${p.ch.skills[skill].level}`, '#7fd1ff', 16, p.id);
  }
}

/** Feature-003 CMD-01 */
function gainEcho(t: Tithe, p: Player, amount: number): void {
  const marks = addEcho(p.ch, amount, t.B);
  p.sheetVersion += 1;
  if (marks) {
    refreshStats(t, p);
    say(t, 'The Maw', `A new Mark burns into your Brand. You are Mark ${p.ch.level}.`, p.id);
  }
}

/** Feature-017 CMD-01 */
function addRenown(t: Tithe, p: Player, amount: number): void {
  p.record.renown += amount;
  if (amount >= 10) float(t, p.depth, p.x, p.y - 1.4, `+${amount} Renown`, '#d6a2ff', 13, p.id);
}

/** Feature-017 CMD-02: tre drab på 8 sekunder, højst hvert 30. sekund, giver en sponsorgave. */
function registerKill(t: Tithe, p: Player, dep: Depth): void {
  const M = t.B.mirrormaster;
  p.mm.killTimes.push(t.time);
  p.mm.killTimes = p.mm.killTimes.filter((x) => t.time - x <= M.streakWindow);
  if (p.mm.killTimes.length >= M.streakKills && t.time - p.mm.lastSponsorAt >= M.sponsorCooldown) {
    p.mm.killTimes = [];
    p.mm.lastSponsorAt = t.time;
    sponsorDrop(t, p, dep);
  }
}

function sponsorDrop(t: Tithe, p: Player, dep: Depth): void {
  const rng = t.rng;
  const house = rng.pick(t.B.rim.houses);
  const level = monsterLevel(t, dep.level);
  const roll = rng.next();
  const spot = dropSpot(dep, p.x, p.y, rng);
  if (roll < 0.3) dep.loot.push({ id: nid(t, 'l'), kind: 'item', item: newItem(t, level, { rarity: 'magic' }), ...spot });
  else if (roll < 0.55) dep.loot.push({ id: nid(t, 'l'), kind: 'potion', ...spot });
  else if (roll < 0.75) dep.loot.push({ id: nid(t, 'l'), kind: 'ration', ...spot });
  else dep.loot.push({ id: nid(t, 'l'), kind: 'gold', amount: level * 12, ...spot });
  addRenown(t, p, t.B.renown.streak);
  say(t, 'Mirrormaster', fmt(LINES.sponsor, { house }));
  t.fx.push({ type: 'shake', depth: dep.level, amount: 3, to: p.id });
}

function dropSpot(dep: Depth, x: number, y: number, rng: Rng): Vec {
  for (let i = 0; i < 6; i++) {
    const nx = x + rng.range(-0.8, 0.8);
    const ny = y + rng.range(-0.8, 0.8);
    if (!isSolid(dep.map, Math.floor(nx), Math.floor(ny))) return { x: nx, y: ny };
  }
  return { x, y };
}

interface DropOptions {
  goldChance?: number;
  itemChance?: number;
  items?: number;
  rarities?: Rarity[];
  consumableChance?: number;
}

function dropLoot(t: Tithe, dep: Depth, x: number, y: number, level: number, opts: DropOptions = {}): void {
  const L = t.B.loot;
  const rng = t.rng;
  if (rng.chance(opts.goldChance ?? L.goldChance)) {
    dep.loot.push({ id: nid(t, 'l'), kind: 'gold', amount: rng.int(L.goldPerLevel[0] * level, L.goldPerLevel[1] * level), ...dropSpot(dep, x, y, rng) });
  }
  const rarities = opts.rarities ?? [];
  const count = opts.items ?? (rng.chance(opts.itemChance ?? L.itemChance) ? 1 : 0);
  for (let i = 0; i < count; i++) {
    const rarity = rarities[i];
    dep.loot.push({ id: nid(t, 'l'), kind: 'item', item: newItem(t, level, rarity ? { rarity } : {}), ...dropSpot(dep, x, y, rng) });
  }
  if (rng.chance(opts.consumableChance ?? L.consumableChance)) {
    dep.loot.push({ id: nid(t, 'l'), kind: rng.chance(0.5) ? 'potion' : 'ration', ...dropSpot(dep, x, y, rng) });
  }
}

function kill(t: Tithe, dep: Depth, killer: Body | null, target: Body, opts: { skill?: SkillId } = {}): void {
  target.dead = true;
  target.hp = 0;
  const B = t.B;
  const p = isPlayer(killer) ? killer : null;
  t.fx.push({ type: 'death', depth: dep.level, x: target.x, y: target.y, kind: (target as { kind?: string }).kind ?? 'monster' });

  if (isMonster(target)) {
    if (p) {
      p.record.kills += 1;
      gainEcho(t, p, Math.round(target.def.echo * target.level * p.stats.echoGain));
      if (opts.skill) trainSkill(t, p, opts.skill, target, B.skills.xpPerKill);
      addRenown(t, p, B.renown.perMonsterLevel * target.level);
      // Monstre, som Mirrormaster eller The Foreman kalder frem, giver hverken loot eller drabsserie.
      if (!target.def.warden && !target.summoned) {
        dropLoot(t, dep, target.x, target.y, target.level, target.def.itemChance !== undefined ? { itemChance: target.def.itemChance } : {});
        registerKill(t, p, dep);
      }
    }
    if (target.def.warden) {
      t.wardenAlive = false;
      if (p) {
        // Feature-011 EVT-04: porten åbner for den, der slog ham (og i fase 4 hans parti).
        dep.map.gateOpen = true;
        t.gateOpenFor.add(p.id);
        p.record.wardenSlain = true;
        addRenown(t, p, B.renown.warden);
        dropLoot(t, dep, target.x, target.y, target.level + 1, { goldChance: 1, items: 3, rarities: ['rare', 'magic', 'magic'], consumableChance: 1 });
        say(t, 'Mirrormaster', fmt(LINES.wardenSlain, { name: p.name }));
        t.fx.push({ type: 'shake', depth: dep.level, amount: 8 });
      } else if (isRival(killer)) {
        rivalChampion(t, killer);
      }
    }
    return;
  }

  if (isRival(target)) {
    target.status = 'fallen';
    target.real = false;
    say(t, 'Mirrormaster', fmt(LINES.rivalFell, { name: target.name }));
    if (p) {
      p.record.rivalsDefeated += 1;
      addRenown(t, p, B.renown.rival);
      gainEcho(t, p, Math.round(target.level * 12 * p.stats.echoGain));
      dropLoot(t, dep, target.x, target.y, target.level, { goldChance: 1, itemChance: 0.5, consumableChance: 0.5 });
      registerKill(t, p, dep);
    }
    return;
  }

  if (isPlayer(target)) {
    // Feature-013 EVT-10: spilleren falder, og de andre kandidater fortsætter.
    say(t, 'Mirrormaster', fmt(LINES.playerFell, { name: target.name }));
    endPlayer(t, target, 'fell', killer ? killer.name : 'the Maw');
  }
}

/** Feature-014 EVT-06: en NPC-rival vinder, og Tithen slutter for alle spillere. */
function rivalChampion(t: Tithe, r: Rival): void {
  r.status = 'champion';
  t.wardenAlive = false;
  t.champion = r.name;
  say(t, 'Mirrormaster', fmt(LINES.champion, { name: r.name }));
  for (const p of playersIn(t)) endPlayer(t, p, 'rival-champion', r.name);
  t.closed = true;
}

/** Feature-016 CMD-01: spillerens del af Tithen slutter. */
function endPlayer(t: Tithe, p: Player, kind: OutcomeKind, name: string): void {
  if (p.end) return;
  p.end = { kind, name, time: t.time };
  if (kind === 'fell' || kind === 'left') p.dead = true;
  p.input = { moveX: 0, moveY: 0, attack: false };
  p.acts = [];
}

// --- Monstre (Feature-013 SVC-01) ---------------------------------------------------------------

function moveToward(dep: Depth, e: Body, x: number, y: number, maxStep: number): number {
  const dx = x - e.x;
  const dy = y - e.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-4) return 0;
  const step = Math.min(d, maxStep);
  e.facing = { x: dx / d, y: dy / d };
  return moveWithCollision(dep.map, e, (dx / d) * step, (dy / d) * step);
}

// Går et skridt ned ad et afstandskort (mod en spiller eller trappen).
function stepAlongField(dep: Depth, e: Body, field: Int16Array, maxStep: number): boolean {
  const map = dep.map;
  const tx = Math.floor(e.x);
  const ty = Math.floor(e.y);
  const here = field[ty * map.w + tx] ?? -1;
  let best: Vec | null = null;
  let bestD = here < 0 ? Infinity : here;
  for (const [dx, dy] of DIRS8) {
    const nx = tx + dx;
    const ny = ty + dy;
    if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
    const d = field[ny * map.w + nx] ?? -1;
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

function inRoom(room: Room, e: Vec, margin = 0): boolean {
  return e.x >= room.x - margin && e.x <= room.x + room.w + margin && e.y >= room.y - margin && e.y <= room.y + room.h + margin;
}

function victimsOf(t: Tithe, dep: Depth): Body[] {
  const list: Body[] = playersOn(t, dep.level);
  for (const r of realRivals(t, dep.level)) list.push(r);
  return list;
}

function updateMonsters(t: Tithe, dep: Depth, dt: number): void {
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
    // Nærmeste kandidat inden for aggro. Et sovende monster vågner kun ved synskontakt.
    let target: Body | null = null;
    let best = Infinity;
    const aggro = def.aggro * (m.awake ? 1.6 : 1);
    for (const c of victimsOf(t, dep)) {
      const d = dist(m, c);
      if (d > aggro || d >= best) continue;
      if (def.warden && dep.map.wardenRoom && !inRoom(dep.map.wardenRoom, c, 1)) continue;
      if (!m.awake && !lineOfSight(dep.map, m.x, m.y, c.x, c.y)) continue;
      best = d;
      target = c;
    }
    if (def.warden) {
      if (!target) {
        if (dep.map.wardenRoom) moveToward(dep, m, dep.map.wardenRoom.cx + 0.5, dep.map.wardenRoom.cy + 0.5, def.speed * dt);
        continue;
      }
      if (!t.wardenSaid && isPlayer(target)) {
        t.wardenSaid = true;
        say(t, 'Mirrormaster', LINES.warden);
      }
      m.summonT -= dt;
      if (m.summonT <= 0) {
        m.summonT = def.summonEvery ?? 14;
        const gnawers = dep.monsters.filter((x) => !x.dead && x.type === 'gnawer').length;
        for (let i = 0; i < Math.min(3, (def.summonMax ?? 6) - gnawers); i++) {
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
      if (d < 2.5) moveToward(dep, m, m.x - (target.x - m.x), m.y - (target.y - m.y), def.speed * dt);
      else if (d <= (def.range ?? 6) && sees) {
        if (m.attackCd <= 0) {
          m.windup = def.windup;
          m.aim = { x: target.x, y: target.y };
        }
      } else chase(dep, m, target, def.speed * dt);
      continue;
    }
    if (d <= (def.reach ?? 1) + target.r) {
      if (m.attackCd <= 0) {
        m.windup = def.windup;
        m.aim = aimAt(m, target, m.facing);
      }
    } else chase(dep, m, target, def.speed * dt);
  }
}

function chase(dep: Depth, m: Monster, target: Body, step: number): void {
  if (isPlayer(target) && target.field && !(dist(m, target) < 2.5 && lineOfSight(dep.map, m.x, m.y, target.x, target.y))) {
    if (stepAlongField(dep, m, target.field, step)) return;
  }
  moveToward(dep, m, target.x, target.y, step);
}

function resolveMonsterAttack(t: Tithe, dep: Depth, m: Monster): void {
  const def = m.def;
  m.attackCd = def.cooldown;
  const victims = victimsOf(t, dep);
  if (def.ranged) {
    const dir = aimAt(m, m.aim, m.facing);
    shoot(t, dep, m, dir, { amount: t.rng.range(m.min, m.max), crit: false, speed: def.projectileSpeed ?? 7, range: (def.range ?? 6) + 2, kind: 'spit', faction: 'monster' });
    return;
  }
  const reach = def.reach ?? 1;
  if (def.warden) {
    t.fx.push({ type: 'shake', depth: dep.level, amount: 5 });
    for (const v of victims) if (dist(m, v) <= reach + v.r) damage(t, dep, m, v, t.rng.range(m.min, m.max), false);
    return;
  }
  let best: Body | null = null;
  for (const v of victims) if (dist(m, v) <= reach + v.r + 0.35 && (!best || dist(m, v) < dist(m, best))) best = v;
  if (best) damage(t, dep, m, best, t.rng.range(m.min, m.max), false);
}

// --- Rivaler (Feature-014 SVC-01) ---------------------------------------------------------------

function rivalVictims(t: Tithe, dep: Depth, r: Rival): Body[] {
  const list: Body[] = dep.monsters.filter((m) => !m.dead);
  for (const p of playersOn(t, dep.level)) if (hostile(r, p) && canStrike(t, r, p)) list.push(p);
  return list;
}

function updateRivals(t: Tithe, dep: Depth, dt: number): void {
  const B = t.B;
  const last = dep.level === B.tithe.depths;
  for (const r of realRivals(t, dep.level)) {
    r.attackCd = Math.max(0, r.attackCd - dt);
    r.flash = Math.max(0, r.flash - dt);
    if (r.hp < r.maxHp * 0.3 && r.potions > 0) {
      r.potions -= 1;
      r.hp = Math.min(r.maxHp, r.hp + r.maxHp * 0.5);
      float(t, dep.level, r.x, r.y - 0.6, 'Potion', '#6f6', 12);
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
    let target: Body | null = null;
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
    if (graceOver(t)) {
      for (const p of playersOn(t, dep.level)) {
        if (!hostile(r, p)) continue;
        const d = dist(r, p);
        if (d < B.tithe.rivalHuntRange && d < best + 1 && lineOfSight(dep.map, r.x, r.y, p.x, p.y)) {
          best = d;
          target = p;
        }
      }
    }
    if (target) {
      rivalFight(t, dep, r, target, dt);
      continue;
    }
    const exitTile = dep.toExit[Math.floor(r.y) * dep.map.w + Math.floor(r.x)] ?? -1;
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
    // Rivaler, du kan se, går i ryk og leder undervejs, så de i gennemsnit er secondsPerDepth om en dybde.
    const sealed = dep.sealAt != null && t.time >= dep.sealAt;
    r.budget = Math.min(4, r.budget + (dt * dep.maxExitDist * (sealed ? 3 : 1)) / r.secondsPerDepth);
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

function rivalFight(t: Tithe, dep: Depth, r: Rival, target: Body, dt: number): void {
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
      shoot(t, dep, r, aimAt(r, target, r.facing), { ...roll, speed: w.speed, range: w.range, kind: w.kind === 'melee' ? 'arrow' : w.kind, faction: 'rival' });
    }
    return;
  }
  if (d <= w.reach + target.r) {
    if (r.attackCd <= 0) {
      r.windup = 0.25;
      r.aim = aimAt(r, target, r.facing);
    }
  } else moveToward(dep, r, target.x, target.y, speed);
}

function sealAtFor(t: Tithe, d: number): number | null {
  return t.depths[d] ? t.depths[d].sealAt : t.B.mirrormaster.sealTimes[d - 1] ?? null;
}

// Rivaler på dybder uden spillere skrider frem i tid i stedet for at blive simuleret.
function updateAbstractRivals(t: Tithe, dt: number): void {
  const B = t.B;
  for (const r of t.rivals) {
    if (r.real || r.status !== 'in' || t.closed) continue;
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
      continue;
    }
    if (!t.wardenAlive) continue;
    // Feature-014: rivalen kæmper mod The Foreman i 20 sekunder, uden at nogen ser det.
    r.fightT += dt;
    if (r.fightT < B.tithe.abstractWardenFight) continue;
    r.fightT = 0;
    const chance = Math.min(B.tithe.rivalWinChanceMax, B.tithe.rivalWinChanceBase + r.level * B.tithe.rivalWinChancePerLevel) / t.wardenHpFactor;
    if (t.rng.chance(Math.min(0.95, chance))) {
      rivalChampion(t, r);
      return;
    }
    r.status = 'fallen';
    t.wardenHpFactor *= B.tithe.wardenWoundedFactor;
    const foreman = t.depths[B.tithe.depths]?.monsters.find((m) => m.def.warden);
    if (foreman) foreman.hp = Math.min(foreman.hp, Math.round(foreman.maxHp * t.wardenHpFactor));
    say(t, 'Mirrormaster', fmt(LINES.rivalLostWarden, { name: r.name }));
  }
}

// --- Projektiler, skub og opsamling -------------------------------------------------------------

function updateProjectiles(t: Tithe, dep: Depth, dt: number): void {
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
    let targets: Body[];
    if (pr.faction === 'player' && isPlayer(pr.owner)) targets = targetsFor(t, pr.owner, dep);
    else if (pr.faction === 'rival' && isRival(pr.owner)) targets = rivalVictims(t, dep, pr.owner);
    else targets = victimsOf(t, dep);
    for (const e of targets) {
      if (e === pr.owner || e.dead) continue;
      if (Math.hypot(e.x - pr.x, e.y - pr.y) < e.r + 0.15) {
        pr.done = true;
        damage(t, dep, pr.owner, e, pr.amount, pr.crit, pr.skill ? { skill: pr.skill, train: true } : {});
        break;
      }
    }
  }
  dep.projectiles = dep.projectiles.filter((pr) => !pr.done);
}

function separate(t: Tithe, dep: Depth): void {
  const list: Body[] = dep.monsters.filter((m) => !m.dead);
  for (const r of realRivals(t, dep.level)) list.push(r);
  for (const p of playersOn(t, dep.level)) list.push(p);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!;
      const b = list[j]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const overlap = a.r + b.r - d;
      if (overlap <= 0) continue;
      const nx = d > 1e-4 ? dx / d : 1;
      const ny = d > 1e-4 ? dy / d : 0;
      const wa = isMonster(a) && a.def.warden ? 0.1 : 0.5;
      const wb = isMonster(b) && b.def.warden ? 0.1 : 0.5;
      moveWithCollision(dep.map, a, -nx * overlap * wa, -ny * overlap * wa);
      moveWithCollision(dep.map, b, nx * overlap * wb, ny * overlap * wb);
    }
  }
}

/** Feature-006 CMD-01: loot samles op ved at gå over det; en fuld pakke lader tingen ligge. */
function pickups(t: Tithe, dep: Depth): void {
  const max = t.B.character.maxConsumables;
  for (const p of playersOn(t, dep.level)) {
    const ch = p.ch;
    for (const l of dep.loot) {
      if (l.id === '') continue; // taget af en anden spiller i samme skridt
      if (Math.hypot(l.x - p.x, l.y - p.y) > 0.7) continue;
      if (l.kind === 'gold') {
        // Feature-006 EVT-03: guldet kommer først i tegnebogen, når Tithen slutter.
        p.record.goldFound += l.amount ?? 0;
        float(t, dep.level, l.x, l.y - 0.3, `+${l.amount} gold`, '#ffd84a', 13, p.id);
        l.id = '';
      } else if (l.kind === 'potion' || l.kind === 'ration') {
        const key = l.kind === 'potion' ? 'potions' : 'rations';
        if (ch[key] < max) {
          ch[key] += 1;
          p.sheetVersion += 1;
          float(t, dep.level, l.x, l.y - 0.3, l.kind === 'potion' ? '+1 Potion' : '+1 Ration', '#b7f0b7', 13, p.id);
          l.id = '';
        }
      } else if (l.item) {
        if (ch.inventory.length < p.stats.capacity) {
          l.item.found = t.id;
          ch.inventory.push(l.item);
          p.record.itemsFound += 1;
          p.sheetVersion += 1;
          float(t, dep.level, l.x, l.y - 0.3, l.item.name, RARITY_COLORS[l.item.rarity], 14);
          l.id = '';
        } else if (!p.warnedLoot.has(l.id)) {
          p.warnedLoot.add(l.id);
          float(t, dep.level, l.x, l.y - 0.3, 'Inventory full', '#ff9b9b', 13, p.id);
        }
      }
    }
    dep.loot = dep.loot.filter((l) => l.id !== '');
    for (const c of dep.caches) {
      if (c.opened || Math.hypot(c.x - p.x, c.y - p.y) > 0.9) continue;
      c.opened = true;
      float(t, dep.level, c.x, c.y - 0.5, 'Cache!', '#ffd84a', 15);
      dropLoot(t, dep, c.x, c.y, monsterLevel(t, dep.level) + 1, { goldChance: 1, items: t.rng.chance(0.4) ? 2 : 1, consumableChance: 0.6 });
    }
  }
}

// --- Mirrormaster (Feature-017) og sammenstyrtning (Feature-013) ------------------------------

export function sealInfo(t: Tithe, depth: number): { left: number; sealed: boolean } | null {
  const dep = t.depths[depth];
  if (!dep || dep.sealAt == null) return null;
  return { left: dep.sealAt - t.time, sealed: t.time >= dep.sealAt };
}

/** Feature-013: en forseglet dybde sårer alle i den med 3 % af max liv i sekundet. */
function sealDamage(t: Tithe, dep: Depth, dt: number): void {
  const seal = sealInfo(t, dep.level);
  if (!seal?.sealed) return;
  const M = t.B.mirrormaster;
  for (const p of playersOn(t, dep.level)) {
    p.hp -= p.stats.maxHp * M.sealDamagePerSecond * dt;
    if (p.hp <= 0) kill(t, dep, { name: 'the collapsing tunnels' } as Body, p);
  }
  for (const r of realRivals(t, dep.level)) {
    r.hp -= r.maxHp * M.sealDamagePerSecond * dt;
    if (r.hp <= 0) kill(t, dep, null, r);
  }
}

function mirrormaster(t: Tithe, dt: number): void {
  const M = t.B.mirrormaster;
  void dt;
  for (const [key, dep] of Object.entries(t.depths)) {
    const d = Number(key);
    if (!playersOn(t, d).length) continue;
    const seal = sealInfo(t, d);
    if (!seal) continue;
    if (!seal.sealed && seal.left <= M.sealWarning && !dep.warned) {
      dep.warned = true;
      say(t, 'Mirrormaster', fmt(LINES.sealWarning, { d, s: Math.ceil(seal.left) }));
    }
    if (seal.sealed && !dep.sealedSaid) {
      dep.sealedSaid = true;
      say(t, 'Mirrormaster', fmt(LINES.sealed, { d }));
      t.fx.push({ type: 'shake', depth: d, amount: 6 });
    }
  }
  // Feature-017 CMD-03: efter 40 sekunder uden skade keder publikum sig, og der kommer 4 Gnawers.
  for (const p of playersIn(t)) {
    if (t.time - p.mm.lastDamageAt > M.boredAfter && t.time - p.mm.lastBoredAt > M.boredAfter) {
      p.mm.lastBoredAt = t.time;
      say(t, 'Mirrormaster', t.rng.pick(LINES.bored));
      spawnNear(t, p, 'gnawer', M.boredGnawers);
    }
  }
}

function spawnNear(t: Tithe, p: Player, type: string, count: number): void {
  const dep = t.depths[p.depth]!;
  const map = dep.map;
  const level = monsterLevel(t, p.depth);
  let spawned = 0;
  for (let i = 0; i < 300 && spawned < count; i++) {
    const x = Math.floor(p.x) + t.rng.int(-10, 10);
    const y = Math.floor(p.y) + t.rng.int(-10, 10);
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < 6 || d > 11 || isSolid(map, x, y)) continue;
    const steps = p.field ? p.field[y * map.w + x] ?? -1 : -1;
    if (steps < 0 || steps > 18) continue;
    const m = makeMonster(t, type, x + 0.5, y + 0.5, level);
    m.awake = true;
    m.summoned = true;
    dep.monsters.push(m);
    spawned += 1;
  }
}

function reveal(t: Tithe, p: Player): void {
  const R = t.B.view.visionRadius;
  const dep = t.depths[p.depth]!;
  const { map } = dep;
  const explored = (p.explored[p.depth] ??= new Uint8Array(map.w * map.h));
  const px = Math.floor(p.x);
  const py = Math.floor(p.y);
  for (let y = py - R; y <= py + R; y++) {
    for (let x = px - R; x <= px + R; x++) {
      if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue;
      const i = y * map.w + x;
      if (!explored[i] && (x - px) ** 2 + (y - py) ** 2 <= R * R) {
        explored[i] = 1;
        p.revealed.push(i);
      }
    }
  }
}

function updateInteract(t: Tithe, p: Player): void {
  const map = t.depths[p.depth]!.map;
  p.interact = null;
  if (tileAt(map, Math.floor(p.x), Math.floor(p.y)) === EXIT || Math.hypot(map.exit.x + 0.5 - p.x, map.exit.y + 0.5 - p.y) < 0.9) {
    if (!map.wardenRoom) p.interact = 'descend';
  }
  if (map.gate && t.gateOpenFor.has(p.id) && Math.hypot(map.gate.x + 0.5 - p.x, map.gate.y + 0.5 - p.y) < 1.6) p.interact = 'gate';
}

// --- Til tests ------------------------------------------------------------------------------------

/** Hjælpere, som testene bruger til at stille en situation op. Spillet bruger dem ikke. */
export const testing = { enterDepth, kill, damage, endPlayer, makeMonster, buildDepth };
