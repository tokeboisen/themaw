// En Tithe i realtid med op til 8 kandidater: spillerne og NPC-rivalerne (Feature-010 til -017, -002, -003, -006, -008,
// -028 og -029). Overført fra prototype/js/core/world.js og skrevet om til flere spillere.
// Ingen DOM og intet netværk her: tithe-server kalder stepTithe 30 gange i sekundet og sender hver spiller det, den kan se.
// Partier dannes i de første 20 sekunder (Feature-034, -035), og spillere slår spillere uden for deres parti (Feature-011).

import type { Balance, EchoArtDef, MonsterDef, MonsterTrait, ReachId, RivalDef } from './balance.ts';
import { GROUND_AREA, generateCity, type StairLink } from './city.ts';
import { generateWoods } from './woods.ts';
import {
  addEcho, addSkillXp, defaultWeapon, derivedStats, dropItem, effectiveSkill, equipItem, meetsRequirements, normalizeSkills, skillName,
  spendAttributePoint, spendSkillPoint, talentOf, unequipItem, type DerivedStats,
} from './character.ts';
import { ARENA_SPAWNS, arenaMap, arenaRing, inOval, type ArenaFormat, type ArenaSide } from './arena.ts';
import {
  bfs, BUSH, collides, EXIT, generateDepth, isSolid, lineOfSight, moveWithCollision, randomFloorInRoom, STAIRS, tileAt, type DepthMap, type Room,
} from './dungeon.ts';
import {
  assignHotbarKey, clearHotbarKey, ECHO_ARTS, HOTBAR_KEYS, knowsArt, removeWeaponFromHotbar, type EchoArt, type Hotbar, type HotbarKey,
} from './gear.ts';
import { displayName, generateItem, isEquipSlot, REQUIREMENTS_NOT_MET, revealChance, type ItemOptions } from './items.ts';
import { CONSUMABLE_KEYS, type OutcomeKind, type TitheRecord } from './rim.ts';
import { createRng, type Rng } from './rng.ts';
import type { Attribute, Character, EquipSlot, Item, Rarity, SkillId, TalentId, WeaponSlot } from './types.ts';

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
  rivalLostWarden: '{name} fell to {warden}. He is wounded now...',
  warden: '{Warden} stirs. Who will face him?',
  wardenSlain: '{Warden} is dead! The gate opens for {name}. Walk through and claim the Tithe!',
  wardWarning: '{Ward} grows dull. I will seal it in {s} seconds.',
  wardSealed: '{Ward} is sealed! Anyone still in it... well. Run.',
  ward: '{Ward}. The crowd leans closer.',
  champion: 'Aurum, behold your Champion: {name}!',
  playerFell: '{name} falls. The Brand drags them back up... The Maw is not finished with them.',
  playerLeft: '{name} has left the Tithe. The Brand drags them back up.',
  joined: '{name} joined the party.',
  declined: '{name} declined.',
  depth: 'Depth {d}. The air grows heavier.',
  // Feature-045: arenaen.
  arenaStart: 'The sand is raked, the stands are full. Fight in {s} seconds!',
  arenaFight: 'Fight!',
  arenaRing: 'The ring closes in! Stay near the middle.',
  arenaWin: '{names} win the match! The stands roar.',
  arenaDraw: 'A draw! The crowd demands its money back.',
  fighterDown: '{name} is down!',
};

export const RARITY_COLORS: Record<Rarity, string> = { common: '#e8e2d6', magic: '#6aa6ff', rare: '#ffd84a' };

const fmt = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => {
  // {Warden} og {Ward} med stort begyndelsesbogstav.
  const value = values[k] ?? values[k.toLowerCase()];
  return k[0] === k[0]!.toUpperCase() && typeof value === 'string' ? value[0]!.toUpperCase() + value.slice(1) : String(value);
});
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
  /** Feature-011: en Veteran er 3 levels over området, med bedre loot. */
  veteran: boolean;
  /** Feature-013: Cave Troll heler ikke før dette tidspunkt (efter en Echo Bolt). */
  regenStopAt: number;
  /** Feature-013: Cultist of the Maw heler, når tælleren når 0; Cutthroat springer til side, når den er 0. */
  healT: number;
  dodgeCd: number;
  /** Feature-013: en Hollow, der allerede har rejst sig én gang. */
  risen: boolean;
  /** Feature-011: højere level slår hurtigere (ganges på ventetiden) og går hurtigere (ganges på farten). */
  quick: number;
  fleet: number;
  /** Feature-047: langsom, rodfæstet og lammet (sekunder tilbage). */
  slowT: number;
  rootT: number;
  stunT: number;
  /** Feature-047 Hollow Call: stedet, monstret går hen til, og hvor længe. */
  lure: Vec | null;
  lureT: number;
  /** Feature-047 Last Words: mærket af en spiller, og hvor længe. */
  markT: number;
  markBy: Player | null;
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
  | { act: 'focusPotion' }
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
  /** Partiet, spilleren kæmper i; alene er spilleren sit eget parti (Feature-034 AGG-01). */
  partyId: string;
  userId: string;
  userName: string;
  characterId: string;
  /** Arbejdskopien af karakteren (planen, afsnit 5). */
  ch: Character;
  hotbar: Hotbar;
  /** Det våben, Attack (Space) bruger: nærkamp eller afstand (Feature-028). */
  chosenWeapon: WeaponSlot;
  stats: DerivedStats;
  depth: number;
  stamina: number;
  focus: number;
  hunger: number;
  attackCd: number;
  /** Feature-047: cooldown tilbage for hver Echo Art, der er kastet. */
  artCd: Partial<Record<EchoArt, number>>;
  /** Feature-049: cooldown tilbage for talentet. */
  talentCd: number;
  /** Feature-047: virkningerne på spilleren fra Echo Arts. */
  buffs: Buff[];
  /** Feature-047 The Maw Remembers: hvor og hvornår spilleren slog monstre for nylig. */
  recentKills: { x: number; y: number; t: number }[];
  dodgeCd: number;
  dodgeT: number;
  dodgeDir: Vec;
  potionCd: number;
  /** Feature-008 CMD-03: focus potions har deres egen ventetid. */
  focusPotionCd: number;
  drawT: number;
  /** Feature-013: langsom, lammet og ætset rustning (sekunder tilbage). */
  slowT: number;
  stunT: number;
  corrodeT: number;
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
  interact: 'descend' | 'gate' | 'climb' | 'down' | null;
  field: Int16Array | null;
  fieldAge: number;
  /** Tælles op, når karakterskærmens indhold ændrer sig, så serveren ved, hvornår den skal sendes igen. */
  sheetVersion: number;
  warnedLoot: Set<string>;
  /** Feature-045: siden i arenaen; null i en Tithe. */
  side: ArenaSide | null;
  /** Feature-045: tid tilbage, hvor kæmperen ses i en busk efter et slag. */
  revealT: number;
}

/** Feature-047: en virkning fra en Echo Art – hvor længe den varer, og hvor stærk den er. */
export type BuffKind =
  | 'ward' | 'rally' | 'hearth' | 'chorus' | 'mantle' | 'cinder' | 'refusal' | 'storm' | 'courage' | 'crown'
  // Feature-049: talents.
  | 'hide' | 'berserk' | 'haste';

export interface Buff {
  kind: BuffKind;
  t: number;
  value: number;
  /** Cinder Echo: tid til næste flamme. */
  next?: number;
}

/** Feature-047 VIEW-01: navnene, HUD'en viser for virkningerne. */
export const BUFF_NAMES: Partial<Record<BuffKind, string>> = {
  ward: 'Warded', rally: 'Rallied', chorus: 'Quickened', mantle: 'Mantled', refusal: 'Refused', storm: 'Mirrored', courage: 'Courageous',
  crown: 'Crowned', hide: 'Hidden', berserk: 'Berserk', haste: 'Hasted',
};

/**
 * Feature-047: flammer (Cinder Echo), ekkoer (The Maw Remembers) og spejlbilleder (Mirror Double) på gulvet;
 * Feature-049: en Healing Circle, hvis dps er andelen af max liv, den heler i sekundet.
 */
export interface Zone extends Vec {
  id: string;
  kind: 'fire' | 'echo' | 'mirror' | 'heal';
  /** Radius for skaden. */
  r: number;
  /** Hvor langt zonen trækker monstre; 0 trækker ingen. */
  draw: number;
  dps: number;
  t: number;
  owner: Player;
}

export interface Loot extends Vec {
  id: string;
  kind: 'item' | 'gold' | 'potion' | 'focusPotion' | 'ration';
  item?: Item;
  amount?: number;
  /** Feature-006: kandidaten, der droppede tingen (Feature-007 CMD-03). */
  droppedBy?: string;
  /** Feature-006: den, der droppede tingen, samler den først op igen efter at have trådt væk fra den. */
  waitFor?: string;
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
  kind: 'arrow' | 'bolt' | 'spit' | 'fire' | 'web' | 'tone' | 'note';
  /** Feature-013: Kobold Sapperens ildkrukker springer over et område. */
  area?: number;
  /** Feature-047 Resonant Line: tonen flyver gennem alle, den rammer, én gang hver. */
  pierce?: Set<Body>;
  /** Feature-047 Unmaking Note: skaden ganges med dette mod en med rustning. */
  unmake?: number;
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
  /** Området med Warden og porten: minernes sidste dybde eller byens gadeplan. */
  warden: boolean;
  /** Trapperne i The Broken City (Feature-041). */
  stairs: StairLink[];
  /** Byens gadeplan: distriktet for hvert felt (1–4). */
  districts: Uint8Array | null;
  /** En etage i et hus: husets distrikt og etagens nummer (2 eller 3). */
  floorDistrict: number | null;
  floor: number;
  /** Feature-047: flammer, ekkoer og spejlbilleder på gulvet. */
  zones: Zone[];
  zoneTick: number;
}

/** Feature-034 EVT-01 Invitation sent: kan kun besvares i nådetiden (Feature-035). */
export interface Invitation {
  from: string;
  to: string;
  at: number;
}

/** Feature-011 EVT-06 Player defeated, til bussen: guldet, der blev spildt, og hvem der slog. */
export interface Defeat {
  userId: string;
  characterId: string;
  byUserId: string;
  byCharacterId: string;
  gold: number;
}

export interface Message {
  who: string;
  text: string;
  time: number;
  /** Kun til denne spiller; ellers til hele Tithen. */
  to?: string;
}

export interface Fx {
  type: 'float' | 'death' | 'shake' | 'hurt' | 'blast' | 'beam';
  depth: number;
  x?: number;
  y?: number;
  /** Feature-047 Echo Chain: strålens anden ende. */
  x2?: number;
  y2?: number;
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
  invitations: Invitation[];
  /** Spillere, der er slået ned af andre spillere, og som endnu ikke er sendt på bussen. */
  defeats: Defeat[];
  /** Feature-010: The Old Mines eller The Broken City. */
  reach: ReachId;
  /** Byens distrikter, der er varslet og forseglet (Feature-017). */
  wardsWarned: Set<number>;
  wardsSealed: Set<number>;
  /** Feature-045: arenakampen; null i en Tithe. */
  arena: ArenaState | null;
}

/** Feature-045 AGG-01: formatet, indsatsen og resultatet – vinderens side, eller null ved uafgjort. */
export interface ArenaState {
  format: ArenaFormat;
  stake: number;
  result: { winner: ArenaSide | null } | null;
  ringSaid: boolean;
  countdownSaid: number;
}

export interface TithePlayerSetup {
  userId: string;
  userName: string;
  characterId: string;
  character: Character;
  hotbar: Hotbar;
  /** Feature-044: siden i en arenakamp. */
  side?: ArenaSide;
}

export interface TitheSetup {
  id: string;
  name: string;
  reach?: ReachId;
  /** Feature-037: Mark hos den spiller, der startede Tithen. */
  level?: number;
  seed: number;
  players: TithePlayerSetup[];
  /** Feature-044: en arenakamps format og indsats (reach 'arena'). */
  arena?: { format: ArenaFormat; stake: number };
}

// --- Oprettelse (Feature-010 Enter the Tithe) ------------------------------------------------------

export function createTithe(setup: TitheSetup, B: Balance): Tithe {
  if (setup.reach === 'arena') return createArena(setup, B);
  const rng = createRng(setup.seed);
  // Feature-010: Tithens niveau er Mark hos den, der startede den; uden det den højeste Mark blandt spillerne.
  const mark = Math.max(1, setup.level ?? Math.max(1, ...setup.players.map((p) => p.character.level)));
  const t: Tithe = {
    id: setup.id, name: setup.name, seed: setup.seed, rng, B, time: 0, depths: {}, players: [], rivals: [], messages: [], fx: [],
    champion: null, closed: false, wardenAlive: true, wardenHpFactor: 1, gateOpenFor: new Set(), wardenSaid: false, mark, nextId: 1,
    invitations: [], defeats: [], reach: setup.reach === 'city' || setup.reach === 'woods' ? setup.reach : 'mines', wardsWarned: new Set(), wardsSealed: new Set(),
    arena: null,
  };
  t.players = setup.players.map((s) => makePlayer(t, s));
  // NPC-rivaler fylder pladserne op til 8, valgt blandt de syv (Feature-010 CMD-01).
  const pool = [...B.tithe.rivals];
  const count = Math.max(0, B.tithe.candidates - t.players.length);
  for (let i = 0; i < count && pool.length; i++) t.rivals.push(makeRival(t, pool.splice(Math.floor(rng.next() * pool.length), 1)[0]!));

  const dep = openReach(t) ? buildOpen(t) : buildDepth(t, 1);
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

/**
 * Feature-045 CMD-01 Open the arena: ingen monstre, rivaler eller loot. Hver side er et parti og starter i sin ende af
 * ovalen; hele arenaen er synlig på kortet.
 */
function createArena(setup: TitheSetup, B: Balance): Tithe {
  const rng = createRng(setup.seed);
  const t: Tithe = {
    id: setup.id, name: setup.name, seed: setup.seed, rng, B, time: 0, depths: {}, players: [], rivals: [], messages: [], fx: [],
    champion: null, closed: false, wardenAlive: false, wardenHpFactor: 1, gateOpenFor: new Set(), wardenSaid: true,
    mark: Math.max(1, ...setup.players.map((p) => p.character.level)), nextId: 1, invitations: [], defeats: [], reach: 'arena',
    wardsWarned: new Set(), wardsSealed: new Set(),
    arena: { format: setup.arena?.format ?? '1v1', stake: setup.arena?.stake ?? 0, result: null, ringSaid: false, countdownSaid: 0 },
  };
  const map = arenaMap();
  t.depths[1] = {
    level: 1, map, monsters: [], loot: [], caches: [], projectiles: [], zones: [], zoneTick: 0, toExit: new Int16Array(map.w * map.h), maxExitDist: 1,
    sealAt: null, warned: false, sealedSaid: false, startRooms: [], warden: false, stairs: [], districts: null, floorDistrict: null, floor: 1,
  };
  const placed: Record<ArenaSide, number> = { 1: 0, 2: 0 };
  t.players = setup.players.map((s, i) => {
    const p = makePlayer(t, s);
    const side: ArenaSide = s.side ?? (i % 2 === 0 ? 1 : 2);
    const spot = ARENA_SPAWNS[side][placed[side]++ % ARENA_SPAWNS[side].length]!;
    Object.assign(p, { side, partyId: `side-${side}`, x: spot.x, y: spot.y, facing: { x: side === 1 ? 1 : -1, y: 0 } });
    p.explored[1] = new Uint8Array(map.w * map.h).fill(1);
    p.revealed = Array.from({ length: map.w * map.h }, (_, k) => k);
    return p;
  });
  say(t, 'Mirrormaster', fmt(LINES.arenaStart, { s: B.arena.countdown }));
  return t;
}

/** Feature-045: en arenakamps skridt – kæmperne, projektilerne, ringen og slutningen. */
function stepArena(t: Tithe, dt: number): void {
  const A = t.B.arena;
  const arena = t.arena!;
  // Nedtællingen: 3 – 2 – 1 – Fight!
  const left = Math.ceil(A.countdown - t.time);
  if (left > 0 && left <= 3 && arena.countdownSaid !== left) {
    arena.countdownSaid = left;
    say(t, 'Mirrormaster', `${left}…`);
  } else if (left <= 0 && arena.countdownSaid !== -1) {
    arena.countdownSaid = -1;
    say(t, 'Mirrormaster', LINES.arenaFight);
  }
  for (const p of playersIn(t)) {
    updatePlayer(t, p, dt);
    p.hunger = t.B.hunger.max; // sulten tærer ikke i arenaen
  }
  const dep = t.depths[1]!;
  updateProjectiles(t, dep, dt);
  updateZones(t, dep, dt);
  separate(t, dep);
  // Feature-045 AGG-02: ringen lukker sig; udenfor den taber kæmperen 8 % af max liv i sekundet.
  if (t.time >= A.shrinkFrom) {
    if (!arena.ringSaid) {
      arena.ringSaid = true;
      say(t, 'Mirrormaster', LINES.arenaRing);
    }
    const ring = arenaRing(t.time, t.B);
    for (const p of playersIn(t)) {
      if (inOval(p.x, p.y, ring)) continue;
      p.hp -= p.maxHp * A.ringDamage * dt;
      p.flash = Math.max(p.flash, 0.05);
      if (p.hp <= 0) {
        p.hp = 0;
        say(t, 'Mirrormaster', fmt(LINES.fighterDown, { name: p.name }));
        endPlayer(t, p, 'fell', 'the ring');
      }
    }
  }
  arenaEnd(t);
}

/**
 * Feature-045 EVT-04 Arena match ended: når en side ikke har nogen kæmper stående, vinder den anden. Falder begge sider på
 * én gang, eller når kampen 4 minutter, er den uafgjort. De, der står tilbage, beholder deres plads; Tithen lukkes.
 */
function arenaEnd(t: Tithe): void {
  const arena = t.arena!;
  if (arena.result || t.time < t.B.arena.countdown) return;
  const standing = (side: ArenaSide) => t.players.some((p) => p.side === side && !p.end);
  const one = standing(1);
  const two = standing(2);
  let winner: ArenaSide | null | undefined;
  if (!one && !two) winner = null;
  else if (!one) winner = 2;
  else if (!two) winner = 1;
  else if (t.time >= t.B.arena.hardLimit) winner = null;
  if (winner === undefined) return;
  arena.result = { winner };
  const names = t.players.filter((p) => p.side === winner).map((p) => p.name).join(' and ');
  say(t, 'Mirrormaster', winner ? fmt(LINES.arenaWin, { names }) : LINES.arenaDraw);
  for (const p of t.players) p.input = { moveX: 0, moveY: 0, attack: false };
  t.closed = true;
}

/**
 * Feature-045 og -013: i arenaen og i The Woods er en kandidat i en busk skjult – for den anden side, for rivaler og i
 * skoven for monstre – undtagen tæt på eller lige efter et slag.
 */
/** Feature-013/-045: kandidaten står i en busk i The Woods eller arenaen. */
function inBush(t: Tithe, target: Player): boolean {
  if (t.reach !== 'arena' && t.reach !== 'woods') return false;
  const map = t.depths[target.depth]?.map;
  return !!map && tileAt(map, Math.floor(target.x), Math.floor(target.y)) === BUSH;
}

/** Feature-049 Hide: hvor tæt andre skal være for at se kandidaten: (100 − gennemsigtighed) / 10 felter. */
function hideSight(t: Tithe, hide: Buff): number {
  return (1 - hide.value) * t.B.talent.hide.sightPerOpen;
}

/**
 * Feature-013, -045 og -049: kandidaten kan ikke ses eller rammes af `viewer` – i en busk længere væk end 2 felter,
 * med Hide længere væk end Hide tillader – undtagen af sit eget parti og lige efter et slag eller et kast.
 */
export function hiddenFrom(t: Tithe, target: Player, viewer: Body): boolean {
  if (isPlayer(viewer) && sameParty(target, viewer)) return false;
  if (target.revealT > 0) return false;
  const d = Math.hypot(target.x - viewer.x, target.y - viewer.y);
  if (inBush(t, target) && d > t.B.arena.bushSight) return true;
  const hide = target.buffs.find((b) => b.kind === 'hide');
  return !!hide && d > hideSight(t, hide);
}

/**
 * Feature-013 og -049: hvor gennemsigtig kandidaten er for `viewer`: 0 er synlig, 1 usynlig. I en busk toner den frem
 * fra 3 felter og er 80 % gennemsigtig ved 1 felt; med Hide er den så gennemsigtig, som talentet gør den, og usynlig
 * længere væk, end Hide tillader.
 */
export function transparencyFor(t: Tithe, target: Player, viewer: Body): number {
  if (isPlayer(viewer) && sameParty(target, viewer)) return 0;
  if (target.revealT > 0) return 0;
  const T = t.B.talent;
  const d = Math.hypot(target.x - viewer.x, target.y - viewer.y);
  let out = 0;
  if (inBush(t, target)) {
    out = d >= T.bushFadeFrom ? 1 : d <= 1 ? T.bushNear : T.bushNear + ((1 - T.bushNear) * (d - 1)) / (T.bushFadeFrom - 1);
  }
  const hide = target.buffs.find((b) => b.kind === 'hide');
  if (hide) out = Math.max(out, d > hideSight(t, hide) ? 1 : hide.value);
  return out;
}

/** Feature-013/-049: kandidaten er skjult lige nu (i en busk eller med Hide) – til dens egen visning. */
export function concealed(t: Tithe, p: Player): boolean {
  return p.revealT <= 0 && (inBush(t, p) || p.buffs.some((b) => b.kind === 'hide'));
}

/** Feature-045/-049: et slag eller et kast afslører kandidaten i 1,5 sekund og ender Hide. */
function unhide(t: Tithe, p: Player): void {
  p.revealT = t.B.arena.revealSeconds;
  if (p.buffs.some((b) => b.kind === 'hide')) p.buffs = p.buffs.filter((b) => b.kind !== 'hide');
}

function nid(t: Tithe, prefix: string): string {
  t.nextId += 1;
  return `${prefix}${t.nextId}`;
}

function makePlayer(t: Tithe, s: TithePlayerSetup): Player {
  // En arbejdskopi fra før focus potions (Feature-008 v4) eller talentet (Feature-049) har ingen.
  s.character.focusPotions ??= 0;
  normalizeSkills(s.character);
  // Feature-028 AGG-01: en Tithe starter med nærkampsvåbnet valgt, ellers afstandsvåbnet.
  const chosenWeapon = defaultWeapon(s.character);
  const stats = derivedStats(s.character, t.B, chosenWeapon);
  return {
    kind: 'player', id: s.userId, partyId: s.userId, userId: s.userId, userName: s.userName, characterId: s.characterId, name: s.character.name,
    ch: s.character, hotbar: s.hotbar, chosenWeapon, stats, x: 0, y: 0, r: 0.35, hp: stats.maxHp, maxHp: stats.maxHp, level: s.character.level,
    armour: stats.armour, flash: 0, facing: { x: 1, y: 0 }, dead: false, depth: 1,
    stamina: stats.maxStamina, focus: stats.maxFocus, hunger: t.B.hunger.max,
    attackCd: 0, artCd: {}, talentCd: 0, buffs: [], recentKills: [], dodgeCd: 0, dodgeT: 0, dodgeDir: { x: 1, y: 0 }, potionCd: 0, focusPotionCd: 0, drawT: 0, slowT: 0, stunT: 0, corrodeT: 0,
    swing: 0, swingDir: { x: 1, y: 0 }, swingArc: 90, swingReach: 1,
    input: { moveX: 0, moveY: 0, attack: false }, acts: [], end: null,
    record: { kills: 0, rivalsDefeated: 0, renown: 0, goldFound: 0, maxDepth: 1, wardenSlain: false, itemsFound: 0, playersDefeated: 0 },
    start: { mark: s.character.level, skills: Object.fromEntries(Object.entries(s.character.skills).map(([k, v]) => [k, v.level])) as Record<SkillId, number> },
    mm: { lastDamageAt: 0, lastBoredAt: 0, killTimes: [], lastSponsorAt: -999 },
    explored: {}, revealed: [], interact: null, field: null, fieldAge: 99, sheetVersion: 1, warnedLoot: new Set(),
    side: null, revealT: 0,
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
  // Byens gader har langt flere monstre; rivalerne får et tillæg, så de kan nå frem (Feature-014).
  const maxHp = Math.round((B.tithe.rivalHpBase + level * B.tithe.rivalHpPerLevel) * (openReach(t) ? openCfg(t).rivalHpFactor : 1));
  return {
    kind: 'rival', id: def.id, name: def.name, color: def.color, def, level, x: 0, y: 0, r: 0.38, hp: maxHp, maxHp,
    armour: B.tithe.rivalArmour, weapon: rivalWeapon(def, level, B), aggressive: t.rng.chance(def.aggression), hostileTo: new Set(),
    potions: 1, status: 'in', depth: 1, progress: 0, real: false, attackCd: 1, windup: 0, aim: { x: 1, y: 0 }, flash: 0,
    facing: { x: 1, y: 0 }, dead: false,
    secondsPerDepth: (B.tithe.rivalSecondsPerDepth * t.rng.range(0.85, 1.2)) / (1 + level * 0.03),
    budget: 0, walking: false, stuckT: 0, lastX: 0, lastY: 0, jiggle: 0, jiggleDir: { x: 0, y: 0 }, fightT: 0,
  };
}

/** Feature-010: byen og skoven er hver ét stort kort, der forsegles udefra og ind; minerne har dybder. */
export function openReach(t: Pick<Tithe, 'reach'>): boolean {
  return t.reach === 'city' || t.reach === 'woods';
}

/** Indstillingerne for byen eller skoven (Feature-010, -017). */
function openCfg(t: Tithe): Balance['city'] | Balance['woods'] {
  return t.reach === 'woods' ? t.B.woods : t.B.city;
}

/** Feature-011: Warden i hver Reach, og det flokdyr, Warden og Mirrormaster kalder frem. */
const WARDEN_TYPE: Record<string, string> = { mines: 'foreman', city: 'smelter', woods: 'antlered_king' };
const SWARM_TYPE: Record<string, string> = { mines: 'gnawer', city: 'sewer_rat', woods: 'grey_wolf' };

/** Feature-012: minerne har tre dybder; byen og skoven er ét område, og deres distrikter tæller som dybder. */
export function depthCount(t: Tithe): number {
  return openReach(t) ? 1 : t.B.tithe.depths;
}

/** Distriktet (1–4) på et sted i byen; null i minerne. */
export function districtAt(t: Tithe, area: number, x: number, y: number): number | null {
  const dep = t.depths[area];
  if (!dep) return null;
  if (dep.floorDistrict !== null) return dep.floorDistrict;
  if (!dep.districts) return null;
  return dep.districts[Math.floor(y) * dep.map.w + Math.floor(x)] ?? 1;
}

/** Hvornår stedet forsegles: dybden i minerne, distriktet i byen (Feature-017). */
function sealAtPos(t: Tithe, area: number, x: number, y: number): number | null {
  const d = districtAt(t, area, x, y);
  if (d !== null) return openCfg(t).sealTimes[d - 1] ?? null;
  return t.depths[area]?.sealAt ?? null;
}

/** Feature-011: områdets level er Tithens level + 1 for hver dybde eller hvert distrikt efter det første. */
function monsterLevel(t: Tithe, d: number): number {
  return Math.max(1, t.mark + (d - 1) * t.B.monsters.levelPerDepth);
}

/** Et monsters level: områdets −1 til +2, og en gang imellem en Veteran 3 levels over området. */
function rollLevel(t: Tithe, area: number): { level: number; veteran: boolean } {
  const M = t.B.monsters;
  const base = monsterLevel(t, area);
  if (t.rng.chance(M.veteranChance)) return { level: base + M.veteranLevels, veteran: true };
  return { level: Math.max(1, base + t.rng.int(M.levelSpread[0], M.levelSpread[1])), veteran: false };
}

/** Feature-011: et monster fra Tithens Reach, der lever i dybden eller distriktet. */
function pickMonster(t: Tithe, area: number): string {
  const types = Object.entries(t.B.monsters.types).filter(([, m]) => !m.warden && m.home === t.reach && m.areas && area >= m.areas[0] && area <= m.areas[1]);
  const total = types.reduce((s, [, m]) => s + (m.weight ?? 1), 0);
  let x = t.rng.next() * total;
  for (const [id, m] of types) {
    x -= m.weight ?? 1;
    if (x <= 0) return id;
  }
  return types[0]?.[0] ?? SWARM_TYPE[t.reach] ?? 'gnawer';
}

/** Et monster af en tilfældig type og level for området. */
function spawnFor(t: Tithe, area: number, x: number, y: number, type = pickMonster(t, area)): Monster {
  const { level, veteran } = rollLevel(t, area);
  const m = makeMonster(t, type, x, y, level);
  m.veteran = veteran;
  return m;
}

/** Den svage flokdyrstype, som Wardens og Mirrormaster kalder frem. */
function summonType(t: Tithe): string {
  return SWARM_TYPE[t.reach] ?? 'gnawer';
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
  return populate(t, d, map, last, null);
}

/** Monstre, The Foreman eller The Smelter, og caches i et område med dets startrum. */
/**
 * Reach 2, The Broken City (Feature-010, -041): gadeplan med distrikter og etagerne i de store huse og fabrikker.
 * Monstrenes niveau følger distriktet, som tæller som en dybde.
 */
/** Feature-010: byens eller skovens store kort med monstre, flokke, lejre og etager. */
function buildOpen(t: Tithe): Depth {
  const B = t.B;
  const C = openCfg(t);
  const plan = t.reach === 'woods' ? generateWoods(t.rng, B) : generateCity(t.rng, B);
  const ground = populate(t, 1, plan.ground, true, plan.startRooms, C.cachesOnGround);
  ground.districts = plan.districts;
  ground.stairs = plan.groundStairs;
  const at = (x: number, y: number) => plan.districts[Math.floor(y) * plan.ground.w + Math.floor(x)] ?? 1;
  ground.monsters = ground.monsters.map((m) => {
    if (m.def.warden) {
      const warden = makeMonster(t, m.type, m.x, m.y, monsterLevel(t, C.districts));
      warden.hp = Math.round(warden.maxHp * t.wardenHpFactor);
      return warden;
    }
    return spawnFor(t, at(m.x, m.y), m.x, m.y);
  });
  // Bander på vejene og stierne: samme slags, 2–4 sammen, flest i de indre distrikter.
  const startSet = new Set(ground.startRooms.slice(0, t.players.length));
  for (let i = 0, tries = 0; i < C.streetPacks && tries < 500; tries++) {
    const x = t.rng.int(2, plan.ground.w - 3);
    const y = t.rng.int(2, plan.ground.h - 3);
    const d = at(x, y);
    if (d >= C.districts || plan.ground.tiles[y * plan.ground.w + x] !== 5) continue;
    if ([...startSet].some((r) => Math.hypot(r.cx - x, r.cy - y) < 12)) continue;
    const type = pickMonster(t, d);
    for (let k = 0; k < t.rng.int(2, 4); k++) ground.monsters.push(spawnFor(t, d, x + 0.5 + t.rng.range(-1, 1), y + 0.5 + t.rng.range(-1, 1), type));
    i += 1;
  }
  // The Woods: en bande brigander slår lejr ved hvert bål, og halvdelen af lejrene har en cache.
  for (const camp of plan.camps ?? []) {
    const inCamp = (m: Monster) => m.x >= camp.x - 1 && m.x <= camp.x + camp.w + 1 && m.y >= camp.y - 1 && m.y <= camp.y + camp.h + 1;
    ground.monsters = ground.monsters.filter((m) => m.def.warden || !inCamp(m));
    const d = at(camp.cx, camp.cy);
    const band = t.rng.int(3, 5);
    for (let k = 0; k < band; k++) {
      const a = (k / band) * Math.PI * 2 + 0.4;
      const type = k === 0 || t.rng.chance(0.3) ? 'brigand_archer' : 'brigand';
      ground.monsters.push(spawnFor(t, d, camp.cx + 0.5 + Math.cos(a) * 2, camp.cy + 0.5 + Math.sin(a) * 2, type));
    }
    if (t.rng.chance(0.5)) ground.caches.push({ id: nid(t, 'c'), x: camp.cx + 1.5, y: camp.cy + 0.5, opened: false });
  }
  for (const f of plan.floors) {
    const map = f.map;
    const room = map.rooms[0]!;
    const toExit = bfs(map, map.exit.x, map.exit.y);
    const dep: Depth = {
      level: f.area, map, monsters: [], loot: [], caches: [], projectiles: [], zones: [], zoneTick: 0, toExit, maxExitDist: 1, sealAt: null, warned: false,
      sealedSaid: false, startRooms: [room], warden: false, stairs: f.stairs, districts: null, floorDistrict: f.district, floor: f.floor,
    };
    for (let i = 0; i < t.rng.int(C.monstersPerHouse[0] + 1, C.monstersPerHouse[1] + 1); i++) {
      const pos = randomFloorInRoom(t.rng, map, room);
      if (Math.hypot(pos.x - map.start.x, pos.y - map.start.y) < 3) continue;
      dep.monsters.push(spawnFor(t, f.district, pos.x + 0.5, pos.y + 0.5));
    }
    // Feature-041 EVT-01: hver etage har en cache.
    const pos = randomFloorInRoom(t.rng, map, room);
    dep.caches.push({ id: nid(t, 'c'), x: pos.x + 0.5, y: pos.y + 0.5, opened: false });
    t.depths[f.area] = dep;
  }
  return ground;
}

function populate(t: Tithe, d: number, map: DepthMap, last: boolean, start: Room[] | null, caches = t.B.loot.cachesPerDepth): Depth {
  const B = t.B;
  const toExit = bfs(map, map.exit.x, map.exit.y);
  let maxExitDist = 1;
  for (const v of toExit) if (v > maxExitDist) maxExitDist = v;
  const startRooms = d === 1
    ? chooseStartRooms(start ? { ...map, rooms: start } : map, toExit, t.players.length + t.rivals.length, t.rng)
    : [map.startRoom];
  const playerRooms = new Set(d === 1 ? startRooms.slice(0, t.players.length) : [map.startRoom]);
  const dep: Depth = {
    level: d, map, monsters: [], loot: [], caches: [], projectiles: [], zones: [], zoneTick: 0, toExit, maxExitDist,
    sealAt: openReach(t) ? null : B.mirrormaster.sealTimes[d - 1] ?? null, warned: false, sealedSaid: false, startRooms,
    warden: last, stairs: [], districts: null, floorDistrict: null, floor: 1,
  };
  const level = monsterLevel(t, d);
  for (const room of map.rooms) {
    // Ingen monstre i spillernes startrum, Warden-hallen eller startrummet på de dybere dybder.
    if (playerRooms.has(room) || room === map.startRoom || room === map.wardenRoom) continue;
    const size = (room.w * room.h) / 60;
    const count = Math.round(t.rng.int(B.monsters.perRoom[0], B.monsters.perRoom[1]) * size + B.monsters.extraPerDepth * (d - 1));
    for (let i = 0; i < count; i++) {
      const pos = randomFloorInRoom(t.rng, map, room);
      dep.monsters.push(spawnFor(t, d, pos.x + 0.5, pos.y + 0.5));
    }
  }
  // Feature-013: grupper i minernes gange, aldrig tæt på spillernes startrum.
  if (!openReach(t)) {
    const inRoom = (x: number, y: number) => map.rooms.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
    const groups = B.monsters.corridorGroups + (d - 1);
    for (let i = 0, tries = 0; i < groups && tries < 400; tries++) {
      const x = t.rng.int(1, map.w - 2);
      const y = t.rng.int(1, map.h - 2);
      if (map.tiles[y * map.w + x] !== 1 || inRoom(x, y)) continue;
      if ([...playerRooms].some((r) => Math.hypot(r.cx - x, r.cy - y) < 12)) continue;
      const type = pickMonster(t, d);
      for (let k = 0; k < t.rng.int(2, 3); k++) dep.monsters.push(spawnFor(t, d, x + 0.5 + t.rng.range(-0.4, 0.4), y + 0.5 + t.rng.range(-0.4, 0.4), type));
      i += 1;
    }
  }
  if (map.wardenRoom) {
    const wr = map.wardenRoom;
    const foreman = makeMonster(t, WARDEN_TYPE[t.reach] ?? 'foreman', wr.cx + 0.5, wr.cy + 0.5, level);
    foreman.hp = Math.round(foreman.hp * t.wardenHpFactor);
    dep.monsters.push(foreman);
    for (let i = 0; i < 2; i++) {
      const pos = randomFloorInRoom(t.rng, map, wr);
      dep.monsters.push(makeMonster(t, summonType(t), pos.x + 0.5, pos.y + 0.5, level));
    }
  }
  const cacheRooms = map.rooms.filter((r) => r !== map.startRoom && r !== map.wardenRoom && !playerRooms.has(r));
  for (let i = 0; i < caches && cacheRooms.length; i++) {
    const room = cacheRooms.splice(Math.floor(t.rng.next() * cacheRooms.length), 1)[0]!;
    const pos = randomFloorInRoom(t.rng, map, room);
    dep.caches.push({ id: nid(t, 'c'), x: pos.x + 0.5, y: pos.y + 0.5, opened: false });
  }
  return dep;
}

function makeMonster(t: Tithe, type: string, x: number, y: number, level: number): Monster {
  const def = t.B.monsters.types[type]!;
  const M = t.B.monsters;
  // Feature-011: liv +40 % og skade +30 % pr. level, fra grundværdier, der er 40 % og 25 % højere.
  const hp = Math.round(def.hp * (def.warden ? 1 : M.hpFactor) * (1 + M.hpPerLevel * (level - 1)));
  const dmg = (def.warden ? 1 : M.damageFactor) * (1 + M.damagePerLevel * (level - 1));
  // Feature-011: for hvert level over 1 også 1 rustning pr. 2 levels, 2 % hurtigere slag (højst 30 %) og 1 % hurtigere (højst 20 %).
  const above = Math.max(0, level - 1);
  const quick = 1 - Math.min(M.maxQuick, M.quickPerLevel * above);
  const fleet = 1 + Math.min(M.maxFleet, M.fleetPerLevel * above);
  return {
    kind: 'monster', id: nid(t, 'm'), type, def, name: def.name, level, x, y, r: def.radius, hp, maxHp: hp,
    min: def.min * dmg, max: def.max * dmg, armour: (def.armour ?? 0) + Math.floor(above / M.levelsPerArmour), quick, fleet,
    attackCd: t.rng.range(0, def.cooldown * quick), windup: 0, aim: null,
    flash: 0, awake: false, summonT: def.summonEvery ?? 0, facing: { x: 1, y: 0 }, dead: false, summoned: false, veteran: false,
    regenStopAt: 0, healT: t.B.monsters.traits.healEvery, dodgeCd: 0, risen: false,
    slowT: 0, rootT: 0, stunT: 0, lure: null, lureT: 0, markT: 0, markBy: null,
  };
}

/** Feature-050: magiske og sjældne ting, der findes i en Tithe, er uidentificerede. */
function newItem(t: Tithe, level: number, opts: ItemOptions): Item {
  const item = generateItem(t.rng, level, t.B, opts);
  if (item.rarity !== 'common') item.identified = false;
  return item;
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
  // Feature-045: i arenaen er nådetiden nedtællingen.
  return t.time >= (t.reach === 'arena' ? t.B.arena.countdown : t.B.tithe.graceSeconds);
}

/**
 * Hvem må slå hvem: ingen kandidat slår en anden i nådetiden (Feature-010), rivaler slår ikke hinanden (Feature-014), og
 * et partis medlemmer rammer aldrig hinanden (Feature-011, -034).
 */
function canStrike(t: Tithe, attacker: Body, target: Body): boolean {
  const a = (attacker as { kind?: string }).kind;
  const b = (target as { kind?: string }).kind;
  const candidate = (k?: string) => k === 'player' || k === 'rival';
  if (candidate(a) && candidate(b)) {
    if (!graceOver(t)) return false;
    if (a === 'rival' && b === 'rival') return false;
    if (a === 'player' && b === 'player' && (attacker as Player).partyId === (target as Player).partyId) return false;
  }
  return true;
}

export function sameParty(a: Player, b: Player): boolean {
  return a.partyId === b.partyId;
}

function hostile(r: Rival, p: Player): boolean {
  return r.aggressive || r.hostileTo.has(p.id);
}

export function refreshStats(t: Tithe, p: Player): void {
  const old = p.stats;
  // Er afstandsvåbnet væk, bruger Attack igen nærkampsvåbnet (eller de bare næver).
  if (p.chosenWeapon === 'ranged' && !p.ch.equipment.ranged) p.chosenWeapon = 'melee';
  p.stats = derivedStats(p.ch, t.B, p.chosenWeapon);
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
    pos = randomFloorInRoom(t.rng, map, openReach(t) ? t.rng.pick(dep.startRooms) : map.startRoom);
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

/** Feature-012: i byen er et distrikt tættere på midten en dybere dybde, med Renown første gang. */
function reachWard(t: Tithe, p: Player): void {
  if (!openReach(t)) return;
  const d = districtAt(t, p.depth, p.x, p.y);
  if (d === null || d <= p.record.maxDepth) return;
  p.record.maxDepth = d;
  addRenown(t, p, t.B.renown.depth);
  say(t, 'Mirrormaster', fmt(LINES.ward, { ward: openCfg(t).wards[d - 1]! }), p.id);
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

// --- Partier (Feature-034 Form a party, Feature-035 Answer an invitation) ------------------------

export type PartyRefusal = 'tooLate' | 'invalid';

/** Feature-034 CMD-01 Invite player: kun spillere i samme Tithe, og kun i dens første 20 sekunder. */
export function invitePlayer(t: Tithe, fromId: string, toId: string): PartyRefusal | null {
  const from = t.players.find((x) => x.id === fromId);
  const to = t.players.find((x) => x.id === toId);
  if (!from || !to || from === to || from.end || to.end || t.reach === 'arena') return 'invalid';
  if (graceOver(t)) return 'tooLate';
  if (sameParty(from, to)) return 'invalid';
  t.invitations = t.invitations.filter((i) => !(i.from === fromId && i.to === toId));
  t.invitations.push({ from: fromId, to: toId, at: t.time });
  return null;
}

/**
 * Feature-035 CMD-01 Accept invitation og CMD-02 Decline invitation: kun i nådetiden. At tage imod forlader det parti,
 * spilleren var i. Den, der inviterede, får besked.
 */
export function answerInvitation(t: Tithe, toId: string, fromId: string, accept: boolean): PartyRefusal | null {
  const invitation = t.invitations.find((i) => i.from === fromId && i.to === toId);
  const from = t.players.find((x) => x.id === fromId);
  const to = t.players.find((x) => x.id === toId);
  if (!invitation || !from || !to || to.end || t.reach === 'arena') return 'invalid';
  if (graceOver(t)) return 'tooLate';
  t.invitations = t.invitations.filter((i) => i !== invitation);
  if (accept && !from.end) {
    to.partyId = from.partyId;
    say(t, 'Party', fmt(LINES.joined, { name: to.userName }), from.id);
  } else if (!accept) {
    say(t, 'Party', fmt(LINES.declined, { name: to.userName }), from.id);
  }
  return null;
}

/** Feature-034 CMD-02 Leave party: når som helst; bagefter kan de tidligere medlemmer slå spilleren og omvendt. */
export function leaveParty(t: Tithe, playerId: string): PartyRefusal | null {
  const p = t.players.find((x) => x.id === playerId);
  if (!p || p.end || t.reach === 'arena') return 'invalid';
  if (!t.players.some((x) => x !== p && !x.end && sameParty(x, p))) return null;
  p.partyId = nid(t, 'party');
  return null;
}

export type SheetAction =
  | { action: 'equip'; itemId: string; ring?: 'ring1' | 'ring2' }
  | { action: 'unequip'; slot: EquipSlot }
  | { action: 'drop'; itemId: string }
  | { action: 'hotbar'; key: HotbarKey; itemId?: string; echoArt?: EchoArt; talent?: TalentId }
  | { action: 'reveal'; itemId: string }
  | { action: 'clear'; key: HotbarKey }
  | { action: 'attribute'; attribute: Attribute }
  | { action: 'skill'; skill: SkillId };

export type SheetRefusal = 'inventoryFull' | 'requirements' | 'invalid';

/** Karakterskærmen under en Tithe: udstyr, drop, hotbar og point (Feature-007, -027, -004). */
export function sheetAction(t: Tithe, playerId: string, a: SheetAction): SheetRefusal | null {
  const p = t.players.find((x) => x.id === playerId);
  if (!p || p.end) return 'invalid';
  const ch = p.ch;
  const owns = (id: string) => ch.inventory.some((i) => i.id === id) || Object.values(ch.equipment).some((i) => i?.id === id);
  switch (a.action) {
    case 'equip': {
      // Feature-007 CMD-01: kun når karakteren opfylder tingens krav.
      const item = ch.inventory.find((i) => i.id === a.itemId);
      if (item && !meetsRequirements(ch, item, t.B)) return 'requirements';
      const slot = equipItem(ch, a.itemId, t.B, a.ring === 'ring1' || a.ring === 'ring2' ? a.ring : undefined);
      if (!slot) return 'invalid';
      // Feature-028 AGG-01: et våben, der tages på, vælges til Attack.
      if (slot === 'melee' || slot === 'ranged') p.chosenWeapon = slot;
      break;
    }
    case 'unequip':
      if (!isEquipSlot(a.slot) || !ch.equipment[a.slot]) return 'invalid';
      if (!unequipItem(ch, a.slot, t.B)) return 'inventoryFull';
      break;
    case 'drop': {
      if (t.reach === 'arena') return 'invalid'; // Feature-045: intet kan droppes i arenaen
      // Feature-007 CMD-03: kun under en Tithe; tingen lander på gulvet ved kandidatens fødder, hvor alle kan
      // samle den op (Feature-006).
      const dep = t.depths[p.depth];
      if (!dep) return 'invalid';
      const item = dropItem(ch, a.itemId);
      if (!item) return 'invalid';
      p.hotbar = removeWeaponFromHotbar(p.hotbar, item.id);
      dep.loot.push({ id: nid(t, 'l'), kind: 'item', item, x: p.x, y: p.y, droppedBy: p.id, waitFor: p.id });
      break;
    }
    case 'hotbar': {
      if (!HOTBAR_KEYS.includes(a.key)) return 'invalid';
      if (a.talent !== undefined) {
        // Feature-027: kun karakterens eget talent (Feature-049).
        if (a.talent !== talentOf(ch.background, t.B)) return 'invalid';
        p.hotbar = assignHotbarKey(p.hotbar, a.key, { talent: a.talent });
      } else if (a.echoArt !== undefined) {
        // Feature-027: kun en Echo Art, karakteren kender (Feature-048).
        if (!ECHO_ARTS.includes(a.echoArt) || !knowsArt(ch, a.echoArt, t.B)) return 'invalid';
        p.hotbar = assignHotbarKey(p.hotbar, a.key, { echoArt: a.echoArt });
      } else {
        const item = [...ch.inventory, ch.equipment.melee, ch.equipment.ranged].find((i) => i?.id === a.itemId);
        if (!item || item.slot !== 'weapon' || !owns(item.id)) return 'invalid';
        p.hotbar = assignHotbarKey(p.hotbar, a.key, { weapon: item.id });
      }
      break;
    }
    case 'reveal': {
      // Feature-050 CMD-01 Reveal item: 10 focus pr. forsøg, chancen vokser med Reveal, og hvert forsøg træner Reveal.
      const R = t.B.reveal;
      const item: Item | undefined = [...ch.inventory, ...(Object.values(ch.equipment) as (Item | null | undefined)[])].find((i): i is Item => i?.id === a.itemId);
      if (!item || item.identified !== false) return 'invalid';
      if (p.focus < R.focus) return null; // uden focus nok sker intet
      p.focus -= R.focus;
      const chance = revealChance(effectiveSkill(ch, 'reveal', t.B), item, t.B);
      if (t.reach !== 'arena') {
        const gained = addSkillXp(ch, 'reveal', R.xpPerTry, t.B);
        if (gained) float(t, p.depth, p.x, p.y - 1, `Reveal ${ch.skills.reveal.level}`, '#7fd1ff', 16, p.id);
      }
      if (t.rng.chance(chance)) {
        item.identified = true;
        float(t, p.depth, p.x, p.y - 0.6, item.name, RARITY_COLORS[item.rarity], 14, p.id);
      } else float(t, p.depth, p.x, p.y - 0.6, 'The item keeps its secrets.', '#c9c3b8', 13, p.id);
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

/** Feature-028 VIEW-01: tasten med det våben, Attack bruger, fremhæves. */
export function chosenKey(p: Player): HotbarKey | null {
  return HOTBAR_KEYS.find((k) => {
    const slot = p.hotbar[k];
    return !!slot && 'weapon' in slot && slot.weapon === p.ch.equipment[p.chosenWeapon]?.id;
  }) ?? null;
}

// --- Hovedløkken --------------------------------------------------------------------------------

export function stepTithe(t: Tithe, dt: number): void {
  if (t.closed) return;
  t.time += dt;
  if (t.reach === 'arena') return stepArena(t, dt);
  if (t.invitations.length && graceOver(t)) t.invitations = [];
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
    updateZones(t, dep, dt);
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
    reachWard(t, p);
  }
  if (!playersIn(t).length) t.closed = true;
}

function updatePlayer(t: Tithe, p: Player, dt: number): void {
  const s = p.stats;
  const B = t.B;
  p.attackCd = Math.max(0, p.attackCd - dt);
  p.talentCd = Math.max(0, p.talentCd - dt);
  // Feature-013/-045: et slag eller et kast afslører kandidaten i 1,5 sekund – også i The Woods.
  p.revealT = Math.max(0, p.revealT - dt);
  for (const art of Object.keys(p.artCd) as EchoArt[]) {
    const left = (p.artCd[art] ?? 0) - dt;
    if (left > 0) p.artCd[art] = left;
    else delete p.artCd[art];
  }
  updateBuffs(t, p, dt);
  p.dodgeCd = Math.max(0, p.dodgeCd - dt);
  p.potionCd = Math.max(0, p.potionCd - dt);
  p.focusPotionCd = Math.max(0, p.focusPotionCd - dt);
  p.drawT = Math.max(0, p.drawT - dt);
  p.flash = Math.max(0, p.flash - dt);
  p.swing = Math.max(0, p.swing - dt);
  p.slowT = Math.max(0, p.slowT - dt);
  p.corrodeT = Math.max(0, p.corrodeT - dt);
  // Feature-013: lammet kan spilleren hverken gå, slå eller bruge noget.
  if (p.stunT > 0) {
    p.stunT = Math.max(0, p.stunT - dt);
    p.acts = [];
    return;
  }
  const dep = t.depths[p.depth]!;

  // Feature-013 SVC-02: sult, udholdenhed, fokus og liv.
  p.hunger = Math.max(0, p.hunger - s.hungerDrain * dt);
  const starving = p.hunger <= 0;
  p.stamina = Math.min(s.maxStamina, p.stamina + s.staminaRegen * (starving ? B.hunger.starvingStaminaRegen : 1) * dt);
  p.focus = Math.min(s.maxFocus, p.focus + s.focusRegen * dt);
  if (!starving) p.hp = Math.min(s.maxHp, p.hp + s.hpRegen * dt); // Feature-007: med amulettens liv i sekundet

  let mx = p.input.moveX;
  let my = p.input.moveY;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  const acts = p.acts.splice(0);
  for (const a of acts) {
    const dodgeCost = B.combat.dodgeCost * s.staminaCostMult; // Feature-007: en tung last gør dodge dyrere
    if (a.act === 'dodge' && p.dodgeCd <= 0 && p.dodgeT <= 0 && p.stamina >= dodgeCost) {
      const l = Math.hypot(mx, my);
      p.dodgeDir = l > 0.1 ? { x: mx / l, y: my / l } : { ...p.facing };
      p.dodgeT = B.combat.dodgeTime;
      p.dodgeCd = B.combat.dodgeCooldown;
      p.stamina -= dodgeCost;
    } else if (a.act === 'potion') drinkPotion(t, p);
    else if (a.act === 'ration') eatRation(t, p);
    else if (a.act === 'focusPotion') drinkFocusPotion(t, p);
    else if (a.act === 'hotkey') useHotkey(t, p, a.key);
    else if (a.act === 'interact') {
      if (p.interact === 'descend' && p.depth < B.tithe.depths) {
        enterDepth(t, p, p.depth + 1);
        return;
      }
      if (p.interact === 'gate') {
        claimTithe(t, p);
        return;
      }
      if (p.interact === 'climb' || p.interact === 'down') {
        climbStairs(t, p);
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
    // Feature-047 Crown of Echoes: hurtigere til fods.
    const speed = s.moveSpeed * (p.slowT > 0 ? B.monsters.traits.slowFactor : 1) * (1 + buffValue(p, 'crown')) * (1 + buffValue(p, 'haste'));
    moveWithCollision(dep.map, p, mx * speed * dt, my * speed * dt);
  }
  // Feature-028 EVT-01: Attack (Space) slår altid med det valgte våben.
  if (p.input.attack && p.dodgeT <= 0) {
    const w = s.weapon;
    if (p.attackCd <= 0 && p.stamina >= w.staminaCost && p.drawT <= 0) playerAttack(t, p, dep);
  }
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

/** Feature-008 CMD-03 og Feature-013 CMD-04: 40 % af max focus, én gang i sekundet og kun, når focus ikke er fuld. */
function drinkFocusPotion(t: Tithe, p: Player): void {
  const s = p.stats;
  if ((p.ch.focusPotions ?? 0) <= 0 || p.focusPotionCd > 0 || p.focus >= s.maxFocus) return;
  p.ch.focusPotions -= 1;
  const gain = Math.round(s.maxFocus * t.B.combat.focusPotionRestore);
  p.focus = Math.min(s.maxFocus, p.focus + gain);
  p.focusPotionCd = t.B.combat.potionCooldown;
  p.sheetVersion += 1;
  float(t, p.depth, p.x, p.y - 0.6, `+${gain} focus`, '#8fc1ff', 15);
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

/**
 * Feature-028 CMD-01 Choose hotbar key: en tast med et våben vælger det våben, Attack bruger. Et våben, der er taget på,
 * vælges; et våben i pakken trækkes til sin plads – nærkamp eller afstand – på 0,3 sekunder. En tast med en Echo Art
 * eller talentet bruger den med det samme og ændrer ikke våbnet. En tom tast gør intet.
 */
function useHotkey(t: Tithe, p: Player, key: HotbarKey): void {
  const slot = p.hotbar[key];
  if (!slot) return;
  // Feature-028/-047: en tast med en Echo Art kaster den med det samme; våbnet til Attack bliver valgt.
  if ('echoArt' in slot) {
    const dep = t.depths[p.depth];
    if (dep) castArt(t, p, dep, slot.echoArt);
    return;
  }
  // Feature-028/-049: en tast med talentet bruger det med det samme og vælger intet.
  if ('talent' in slot) {
    useTalent(t, p);
    return;
  }
  const eq = p.ch.equipment;
  const worn: WeaponSlot | null = eq.melee?.id === slot.weapon ? 'melee' : eq.ranged?.id === slot.weapon ? 'ranged' : null;
  if (worn) {
    if (p.chosenWeapon === worn) return;
    p.chosenWeapon = worn;
  } else {
    // Feature-028: et våben, karakteren ikke opfylder kravene til, bliver i pakken.
    const item = p.ch.inventory.find((i) => i.id === slot.weapon);
    if (item && !meetsRequirements(p.ch, item, t.B)) {
      float(t, p.depth, p.x, p.y - 0.6, REQUIREMENTS_NOT_MET, '#ff9b9b', 13, p.id);
      return;
    }
    const placed = equipItem(p.ch, slot.weapon, t.B);
    if (placed !== 'melee' && placed !== 'ranged') return;
    p.chosenWeapon = placed;
  }
  p.drawT = t.B.combat.drawTime;
  refreshStats(t, p);
}

/** Feature-041 CMD-01 Climb the stairs: op til en øvre etage eller ned igen; etagen er sit eget kort. */
function climbStairs(t: Tithe, p: Player): void {
  const link = stairAt(t, p);
  if (!link || !t.depths[link.area]) return;
  p.depth = link.area;
  p.x = link.tx + 0.5;
  p.y = link.ty + 0.5;
  p.dodgeT = 0;
  p.field = null;
  p.fieldAge = 99;
  syncRivalPresence(t);
  reveal(t, p);
  updateInteract(t, p);
}

function stairAt(t: Tithe, p: Player): StairLink | null {
  const dep = t.depths[p.depth];
  if (!dep) return null;
  const x = Math.floor(p.x);
  const y = Math.floor(p.y);
  return dep.stairs.find((s) => s.x === x && s.y === y) ?? null;
}

/** Wardens navn: The Foreman i minerne, The Smelter i byen. */
export function wardenName(t: Tithe): string {
  return t.B.monsters.types[WARDEN_TYPE[t.reach] ?? 'foreman']!.name;
}

/** Feature-015 CMD-01: porten er kun åben for partiet hos den, der slog The Foreman. */
function claimTithe(t: Tithe, p: Player): void {
  if (!t.gateOpenFor.has(p.id)) return;
  // Feature-015 EVT-01: hvert medlem af partiet, der stadig er i Tithen, er Champion.
  const party = playersIn(t).filter((x) => sameParty(x, p));
  say(t, 'Mirrormaster', fmt(LINES.champion, { name: p.name }));
  t.champion = p.name;
  for (const x of playersIn(t)) endPlayer(t, x, party.includes(x) ? 'champion' : 'rival-champion', p.name);
  t.closed = true;
}

function targetsFor(t: Tithe, p: Player, dep: Depth): Body[] {
  const list: Body[] = dep.monsters.filter((m) => !m.dead);
  for (const r of realRivals(t, dep.level)) if (canStrike(t, p, r)) list.push(r);
  // Feature-045: en modstander, der gemmer sig i en busk, kan ikke sigtes på.
  for (const o of playersOn(t, dep.level)) if (o !== p && canStrike(t, p, o) && !hiddenFrom(t, o, p)) list.push(o);
  return list;
}

// Sigter automatisk: nærmeste monster eller fjendtlige rival; en anden spiller eller en fredelig rival kun, når intet
// andet er nær (Feature-011).
function pickTarget(t: Tithe, p: Player, dep: Depth, range: number): Body | null {
  let best: Body | null = null;
  let bestScore = Infinity;
  for (const e of targetsFor(t, p, dep)) {
    const d = dist(p, e) - e.r;
    if (d > range) continue;
    if (!lineOfSight(dep.map, p.x, p.y, e.x, e.y)) continue;
    const last = (isRival(e) && !hostile(e, p)) || isPlayer(e);
    const score = d + (last ? 100 : 0);
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
  const swing = meleeSwing(t, p);
  const target = pickTarget(t, p, dep, w.ranged ? w.range : swing.reach + 1.2);
  const dir = aimAt(p, target, p.facing);
  p.facing = dir;
  unhide(t, p); // Feature-045/-049: et slag afslører kæmperen i en busk og ender Hide
  // Feature-047 Chorus of the Branded og Feature-049 Haste (kun skud).
  const haste = w.ranged ? 1 + buffValue(p, 'haste') : 1;
  p.attackCd = w.cooldown / (1 + buffValue(p, 'chorus')) / haste;
  p.stamina -= w.staminaCost;
  if (w.ranged) {
    const roll = rollDamage(t, w.min, w.max, w.damageMult, p.stats.critChance);
    shoot(t, dep, p, dir, { ...roll, speed: t.B.combat.arrowSpeed * haste, range: w.range, skill: w.skill, kind: 'arrow', faction: 'player' });
    return;
  }
  p.swing = 0.15;
  p.swingDir = dir;
  p.swingArc = swing.arc;
  p.swingReach = swing.reach;
  const hits = meleeHits(dep, p, dir, swing.reach + 0.3, swing.arc, targetsFor(t, p, dep));
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
  unhide(t, p);
  p.artCd['Echo Bolt'] = b.cooldown / (1 + buffValue(p, 'chorus'));
  p.focus -= b.focusCost;
  const roll = rollDamage(t, b.min, b.max, b.damageMult, p.stats.critChance);
  shoot(t, dep, p, dir, { ...roll, speed: b.speed, range: b.range, skill: 'echo', kind: 'bolt', faction: 'player' });
}

// --- Talents (Feature-049 Use a talent) -----------------------------------------------------------

/** Feature-049 Berserk: nærkampens rækkevidde og bue, med Berserk når det varer. */
function meleeSwing(t: Tithe, p: Player): { reach: number; arc: number } {
  const w = p.stats.weapon;
  const berserk = p.buffs.find((b) => b.kind === 'berserk');
  if (!berserk || w.ranged) return { reach: w.reach, arc: w.arc };
  const T = t.B.talent.berserk;
  const s = berserk.value;
  return {
    reach: w.reach * (1 + Math.min(T.maxReach, T.reach + T.reachPerSkill * s)),
    arc: Math.min(360, w.arc + T.arc + T.arcPerSkill * s),
  };
}

const talentSeconds = (c: { seconds: number; secondsPerSkill: number; maxSeconds: number }, s: number) =>
  Math.min(c.maxSeconds, c.seconds + c.secondsPerSkill * s);

/**
 * Feature-049 CMD-01 Use talent: baggrundens talent bruges med det samme, når der er stamina eller focus nok, og
 * cooldown er ovre. Tallene vokser med det effektive talent-niveau, og brugen træner talentet (ikke i arenaen).
 */
export function useTalent(t: Tithe, p: Player): boolean {
  const id: TalentId = talentOf(p.ch.background, t.B);
  const def = t.B.talents[id];
  const dep = t.depths[p.depth];
  if (!dep || p.end || p.talentCd > 0) return false;
  // Feature-007: en tung last gør talents, der koster stamina, dyrere.
  const cost = def.resource === 'stamina' ? def.cost * p.stats.staminaCostMult : def.cost;
  if ((def.resource === 'focus' ? p.focus : p.stamina) < cost) return false;
  if (def.resource === 'focus') p.focus -= cost;
  else p.stamina -= cost;
  p.talentCd = def.cooldown;
  const s = effectiveSkill(p.ch, 'talent', t.B);
  const T = t.B.talent;
  if (id === 'hide') {
    addBuff(p, 'hide', talentSeconds(T.hide, s), Math.min(T.hide.max, T.hide.base + T.hide.perSkill * s));
    p.revealT = 0;
    blast(t, dep, p, 0.8, '#9fb4ff');
  } else if (id === 'berserk') {
    addBuff(p, 'berserk', talentSeconds(T.berserk, s), s);
    blast(t, dep, p, 1.2, '#ff6b4a');
  } else if (id === 'haste') {
    addBuff(p, 'haste', talentSeconds(T.haste, s), Math.min(T.haste.max, T.haste.base + T.haste.perSkill * s));
    blast(t, dep, p, 0.9, '#9fe0b0');
  } else {
    const H = T.healing;
    const share = Math.min(H.maxShare, H.share + H.sharePerSkill * s);
    dep.zones.push({
      id: nid(t, 'z'), kind: 'heal', x: p.x, y: p.y, r: Math.min(H.maxRadius, H.radius + H.radiusPerSkill * s), draw: 0, dps: share / H.seconds,
      t: H.seconds, owner: p,
    });
  }
  float(t, dep.level, p.x, p.y - p.r - 0.9, def.name, '#cfe8ff', 11);
  // Feature-002: brugen træner talentet; intet trænes i arenaen (Feature-045).
  if (t.reach !== 'arena') {
    const gained = addSkillXp(p.ch, 'talent', T.xpPerUse, t.B);
    p.sheetVersion += 1;
    if (gained) {
      refreshStats(t, p);
      float(t, p.depth, p.x, p.y - 1, `${def.name} ${p.ch.skills.talent.level}`, '#7fd1ff', 16, p.id);
    }
  }
  return true;
}

// --- Echo Arts (Feature-047 Cast an Echo Art) ------------------------------------------------------

/** Virkningens styrke, eller 0 uden den. */
function buffValue(p: Player, kind: BuffKind): number {
  return p.buffs.find((b) => b.kind === kind)?.value ?? 0;
}

/** En ny virkning af samme slags erstatter den gamle. */
function addBuff(p: Player, kind: BuffKind, seconds: number, value = 0): void {
  p.buffs = p.buffs.filter((b) => b.kind !== kind);
  p.buffs.push({ kind, t: seconds, value });
}

/** Rally Toll, Echo of Courage, Crown of Echoes og Mirror Storm giver mere skade. */
function artDamageMult(p: Player): number {
  return 1 + buffValue(p, 'rally') + buffValue(p, 'courage') + buffValue(p, 'crown') + buffValue(p, 'storm');
}

/** Virkningerne løber ud; Hearth Echo og Crown of Echoes heler, og Cinder Echo lægger flammer efter sig. */
function updateBuffs(t: Tithe, p: Player, dt: number): void {
  if (!p.buffs.length) return;
  const E = t.B.echoArts;
  for (const b of p.buffs) {
    b.t -= dt;
    if (b.kind === 'hearth') p.hp = Math.min(p.stats.maxHp, p.hp + b.value * dt);
    if (b.kind === 'crown') p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * (E['Crown of Echoes'].regen ?? 0) * dt);
    if (b.kind === 'cinder') {
      b.next = (b.next ?? 0) - dt;
      const dep = t.depths[p.depth];
      if (b.next <= 0 && dep && !p.end) {
        b.next = t.B.echo.cinderEvery;
        dep.zones.push({
          id: nid(t, 'z'), kind: 'fire', x: p.x, y: p.y, r: t.B.echo.cinderRadius, draw: 0, dps: b.value, t: E['Cinder Echo'].linger ?? 2, owner: p,
        });
      }
    }
  }
  p.buffs = p.buffs.filter((b) => b.t > 0);
}

/** Feature-047: Attack kaster den valgte Echo Art, når karakteren kender den, har fokus nok, og cooldown er ovre. */
export function castArt(t: Tithe, p: Player, dep: Depth, art: EchoArt): boolean {
  if ((p.artCd[art] ?? 0) > 0 || !knowsArt(p.ch, art, t.B)) return false;
  if (art === 'Echo Bolt') {
    if (p.focus < p.stats.bolt.focusCost) return false;
    playerBolt(t, p, dep);
    return true;
  }
  const def = t.B.echoArts[art];
  if (p.focus < def.focus) return false;
  p.focus -= def.focus;
  // Echo Chain, Last Words og The Maw Remembers kastes ikke uden et mål: fokus gives tilbage.
  if (!ART_EFFECTS[art](t, p, dep, def)) {
    p.focus += def.focus;
    return false;
  }
  p.artCd[art] = def.cooldown / (1 + p.stats.haste); // Feature-007: amulettens haste
  unhide(t, p); // Feature-045/-049: et kast afslører kæmperen i en busk og ender Hide
  float(t, dep.level, p.x, p.y - p.r - 0.9, art, '#cfe8ff', 11);
  return true;
}

function artRoll(t: Tithe, p: Player, def: EchoArtDef): { amount: number; crit: boolean } {
  return rollDamage(t, def.min ?? 0, def.max ?? 0, p.stats.bolt.damageMult, p.stats.critChance);
}

/** Et sted op til `distance` felter fra `from` i retningen `dir`, standset af vægge. */
function ahead(dep: Depth, from: Vec, distance: number, dir: Vec): Vec {
  let x = from.x;
  let y = from.y;
  for (let d = 0; d < distance; d += 0.1) {
    const nx = x + dir.x * 0.1;
    const ny = y + dir.y * 0.1;
    if (isSolid(dep.map, Math.floor(nx), Math.floor(ny))) break;
    x = nx;
    y = ny;
  }
  return { x, y };
}

/** En art, der sigter på et sted, sigter på nærmeste fjende inden for rækkevidde, ellers 4 felter lige frem. */
function artSpot(t: Tithe, p: Player, dep: Depth, range: number): Vec {
  const target = pickTarget(t, p, dep, range);
  if (target) {
    p.facing = aimAt(p, target, p.facing);
    return { x: target.x, y: target.y };
  }
  return ahead(dep, p, Math.min(range, t.B.echo.ahead), p.facing);
}

function blast(t: Tithe, dep: Depth, at: Vec, radius: number, color: string): void {
  t.fx.push({ type: 'blast', depth: dep.level, x: at.x, y: at.y, amount: radius, color });
}

/** Skade på alle fjender inden for `radius` af stedet, som stedet kan se; højst 3 af dem træner Echo Arts. */
function areaDamage(t: Tithe, p: Player, dep: Depth, at: Vec, radius: number, def: EchoArtDef): Body[] {
  const hit = targetsFor(t, p, dep).filter((v) => !v.dead && Math.hypot(v.x - at.x, v.y - at.y) <= radius + v.r
    && lineOfSight(dep.map, at.x, at.y, v.x, v.y));
  hit.forEach((v, i) => {
    const roll = artRoll(t, p, def);
    damage(t, dep, p, v, roll.amount, roll.crit, { skill: 'echo', train: i < t.B.skills.maxHitsPerSwing });
  });
  return hit;
}

/** Kontrol virker kun på monstre. */
function monstersNear(dep: Depth, at: Vec, radius: number): Monster[] {
  return dep.monsters.filter((m) => !m.dead && Math.hypot(m.x - at.x, m.y - at.y) <= radius + m.r);
}

/** Partiets arts når den, der kaster, og partiet inden for 6 felter – i arenaen siden; alene kun den, der kaster. */
function partyNear(t: Tithe, p: Player, radius = t.B.echo.partyRadius): Player[] {
  const list = playersOn(t, p.depth).filter((o) => !o.end && sameParty(o, p) && dist(o, p) <= radius);
  for (const o of list) t.fx.push({ type: 'blast', depth: p.depth, x: o.x, y: o.y, amount: 0.9, color: '#ffd84a' });
  return list;
}

function heal(t: Tithe, p: Player, amount: number): void {
  const gained = Math.round(Math.min(p.stats.maxHp - p.hp, amount));
  if (gained <= 0) return;
  p.hp += gained;
  float(t, p.depth, p.x, p.y - p.r - 0.4, `+${gained}`, '#6f6', 13);
}

/** Feature-047 Last Words: det mærkede monster springer for 20–30 skade inden for 2,5 felter. */
function lastWords(t: Tithe, dep: Depth, m: Monster): void {
  const by = m.markBy!;
  m.markT = 0;
  m.markBy = null;
  const def = t.B.echoArts['Last Words'];
  const radius = def.radius ?? 2.5;
  blast(t, dep, m, radius, '#b48ce0');
  const hit = targetsFor(t, by, dep).filter((v) => v !== m && !v.dead && dist(v, m) <= radius + v.r && lineOfSight(dep.map, m.x, m.y, v.x, v.y));
  hit.forEach((v, i) => {
    const roll = artRoll(t, by, def);
    damage(t, dep, by, v, roll.amount, roll.crit, { skill: 'echo', train: i < t.B.skills.maxHitsPerSwing });
  });
}

/** Feature-047: Hollow Call, et spejlbillede eller et ekko, der trækker monstret til sig. */
function drawnTo(dep: Depth, m: Monster): Vec | null {
  if (m.lureT > 0 && m.lure) return m.lure;
  let best: Zone | null = null;
  for (const z of dep.zones) {
    if (z.draw <= 0 || dist(z, m) > z.draw) continue;
    if (!best || dist(z, m) < dist(best, m)) best = z;
  }
  return best;
}

/** Feature-047: zonerne løber ud; flammer og ekkoer gør skade hvert halve sekund. Flammerne fra én ejer rammer kun én gang. */
function updateZones(t: Tithe, dep: Depth, dt: number): void {
  if (!dep.zones.length) return;
  for (const z of dep.zones) {
    z.t -= dt;
    // Feature-049: en Healing Circle flytter sig med den, der lavede den, så længe den er på samme dybde.
    if (z.kind === 'heal' && !z.owner.end && z.owner.depth === dep.level) {
      z.x = z.owner.x;
      z.y = z.owner.y;
    }
  }
  dep.zones = dep.zones.filter((z) => z.t > 0);
  dep.zoneTick -= dt;
  if (dep.zoneTick > 0) return;
  const tick = t.B.echo.zoneTick;
  dep.zoneTick = tick;
  const burned = new Map<Player, Set<Body>>();
  for (const z of dep.zones) {
    // Feature-049 Healing Circle: følger den, der lavede den, og heler den og dens parti, mens de står i cirklen.
    if (z.kind === 'heal') {
      for (const o of playersOn(t, dep.level)) if (sameParty(o, z.owner) && dist(o, z) <= z.r) heal(t, o, o.stats.maxHp * z.dps * tick);
      continue;
    }
    if (z.dps <= 0) continue;
    let trained = 0;
    for (const v of targetsFor(t, z.owner, dep)) {
      if (v.dead || Math.hypot(v.x - z.x, v.y - z.y) > z.r + v.r) continue;
      if (z.kind === 'fire') {
        const seen = burned.get(z.owner) ?? new Set<Body>();
        if (seen.has(v)) continue;
        seen.add(v);
        burned.set(z.owner, seen);
      }
      damage(t, dep, z.owner, v, z.dps * tick, false, { skill: 'echo', train: trained++ < t.B.skills.maxHitsPerSwing });
    }
  }
}

type ArtEffect = (t: Tithe, p: Player, dep: Depth, def: EchoArtDef) => boolean;

/** Feature-047: hvad hver Echo Art gør (Echo Bolt kastes som i Feature-011). Returnerer false, når den ikke kastes. */
const ART_EFFECTS: Record<Exclude<EchoArt, 'Echo Bolt'>, ArtEffect> = {
  'Ringing Ward': (t, p, dep, def) => {
    addBuff(p, 'ward', def.seconds ?? 4, def.value ?? 0.75);
    blast(t, dep, p, 0.8, '#bfe6ff');
    return true;
  },
  'Hollow Call': (t, p, dep, def) => {
    const spot = artSpot(t, p, dep, def.range ?? 7);
    for (const m of monstersNear(dep, spot, def.radius ?? 6)) {
      m.lure = { ...spot };
      m.lureT = def.seconds ?? 3;
      m.awake = true;
    }
    blast(t, dep, spot, 0.8, '#9fb4ff');
    return true;
  },
  'Shared Breath': (t, p, _dep, def) => {
    for (const o of partyNear(t, p)) o.stamina = Math.min(o.stats.maxStamina, o.stamina + (def.value ?? 15));
    return true;
  },
  'Crystal Cage': (t, p, dep, def) => {
    const spot = artSpot(t, p, dep, def.range ?? 7);
    for (const m of monstersNear(dep, spot, def.radius ?? 2)) m.rootT = Math.max(m.rootT, def.seconds ?? 3);
    blast(t, dep, spot, def.radius ?? 2, '#bfe6ff');
    return true;
  },
  'Step Through the Echo': (t, p, dep, def) => {
    const l = Math.hypot(p.input.moveX, p.input.moveY);
    const dir = l > 0.1 ? { x: p.input.moveX / l, y: p.input.moveY / l } : { ...p.facing };
    blast(t, dep, p, 0.6, '#cfe8ff');
    for (let d = 0; d < (def.range ?? 4); d += 0.1) {
      const nx = p.x + dir.x * 0.1;
      const ny = p.y + dir.y * 0.1;
      if (collides(dep.map, nx, ny, p.r)) break;
      p.x = nx;
      p.y = ny;
    }
    p.facing = dir;
    blast(t, dep, p, 0.6, '#cfe8ff');
    return true;
  },
  'Rally Toll': (t, p, _dep, def) => {
    for (const o of partyNear(t, p)) addBuff(o, 'rally', def.seconds ?? 10, def.value ?? 0.15);
    return true;
  },
  'Shatterpulse': (t, p, dep, def) => {
    const spot = artSpot(t, p, dep, def.range ?? 7);
    blast(t, dep, spot, def.radius ?? 2, '#cfe8ff');
    areaDamage(t, p, dep, spot, def.radius ?? 2, def);
    return true;
  },
  'Mirror Double': (t, p, dep, def) => {
    const spot = ahead(dep, p, def.range ?? 2, p.facing);
    dep.zones.push({ id: nid(t, 'z'), kind: 'mirror', x: spot.x, y: spot.y, r: 0.4, draw: def.radius ?? 8, dps: 0, t: def.seconds ?? 5, owner: p });
    blast(t, dep, spot, 0.8, '#cfe8ff');
    return true;
  },
  'Hearth Echo': (t, p, _dep, def) => {
    const seconds = def.seconds ?? 5;
    for (const o of partyNear(t, p)) addBuff(o, 'hearth', seconds, (o.stats.maxHp * (def.value ?? 0.2)) / seconds);
    return true;
  },
  'Hunger of the Maw': (t, p, dep, def) => {
    const reach = def.range ?? 3;
    const dir = aimAt(p, pickTarget(t, p, dep, reach), p.facing);
    Object.assign(p, { facing: dir, swing: 0.2, swingDir: dir, swingArc: def.arc ?? 90, swingReach: reach });
    let dealt = 0;
    meleeHits(dep, p, dir, reach, def.arc ?? 90, targetsFor(t, p, dep)).forEach((v, i) => {
      const roll = artRoll(t, p, def);
      dealt += damage(t, dep, p, v, roll.amount, roll.crit, { skill: 'echo', train: i < t.B.skills.maxHitsPerSwing });
    });
    heal(t, p, dealt * (def.value ?? 0.3));
    return true;
  },
  'Resonant Line': (t, p, dep, def) => {
    const dir = aimAt(p, pickTarget(t, p, dep, def.range ?? 8), p.facing);
    p.facing = dir;
    const roll = artRoll(t, p, def);
    shoot(t, dep, p, dir, { ...roll, speed: t.B.echo.toneSpeed, range: def.range ?? 8, skill: 'echo', kind: 'tone', faction: 'player', pierce: true });
    return true;
  },
  'Chorus of the Branded': (t, p, _dep, def) => {
    for (const o of partyNear(t, p)) addBuff(o, 'chorus', def.seconds ?? 8, def.value ?? 0.2);
    return true;
  },
  'Toll of Stillness': (t, p, dep, def) => {
    for (const m of monstersNear(dep, p, def.radius ?? 3)) m.stunT = Math.max(m.stunT, m.def.warden ? def.warden ?? 0.5 : def.seconds ?? 1.5);
    blast(t, dep, p, def.radius ?? 3, '#e8e2d6');
    return true;
  },
  'Cinder Echo': (_t, p, _dep, def) => {
    addBuff(p, 'cinder', def.seconds ?? 6, (def.value ?? 8) * p.stats.bolt.damageMult);
    return true;
  },
  'Crystal Mantle': (t, p, _dep, def) => {
    for (const o of partyNear(t, p)) addBuff(o, 'mantle', def.seconds ?? 15, def.value ?? 8);
    return true;
  },
  'Echo Chain': (t, p, dep, def) => {
    const first = pickTarget(t, p, dep, def.range ?? 7);
    if (!first) return false;
    p.facing = aimAt(p, first, p.facing);
    const hits: Body[] = [first];
    const all = targetsFor(t, p, dep);
    for (let j = 0; j < (def.jumps ?? 3); j++) {
      const last = hits[hits.length - 1]!;
      let next: Body | null = null;
      for (const e of all) {
        if (e.dead || hits.includes(e) || dist(e, last) > (def.radius ?? 4) || !lineOfSight(dep.map, last.x, last.y, e.x, e.y)) continue;
        if (!next || dist(e, last) < dist(next, last)) next = e;
      }
      if (!next) break;
      hits.push(next);
    }
    let from: Vec = p;
    hits.forEach((v, i) => {
      t.fx.push({ type: 'beam', depth: dep.level, x: from.x, y: from.y, x2: v.x, y2: v.y, color: '#9fd8ff' });
      from = { x: v.x, y: v.y };
      const roll = artRoll(t, p, def);
      damage(t, dep, p, v, roll.amount, roll.crit, { skill: 'echo', train: i < t.B.skills.maxHitsPerSwing });
    });
    return true;
  },
  'Last Words': (t, p, dep, def) => {
    let best: Monster | null = null;
    for (const m of dep.monsters) {
      if (m.dead || dist(m, p) - m.r > (def.range ?? 7) || !lineOfSight(dep.map, p.x, p.y, m.x, m.y)) continue;
      if (!best || dist(m, p) < dist(best, p)) best = m;
    }
    if (!best) return false;
    best.markT = def.seconds ?? 10;
    best.markBy = p;
    best.awake = true;
    float(t, dep.level, best.x, best.y - best.r - 0.5, 'Marked', '#b48ce0', 12);
    return true;
  },
  "Brand's Refusal": (t, p, _dep, def) => {
    for (const o of partyNear(t, p)) addBuff(o, 'refusal', def.seconds ?? 60);
    return true;
  },
  'Mirror Storm': (t, p, dep, def) => {
    addBuff(p, 'storm', def.seconds ?? 6, def.value ?? 1.5);
    blast(t, dep, p, 1.2, '#cfe8ff');
    return true;
  },
  'The Maw Remembers': (t, p, dep, def) => {
    const kills = p.recentKills.filter((k) => t.time - k.t <= (def.linger ?? 5)).slice(-t.B.echo.maxEchoes);
    if (!kills.length) return false;
    p.recentKills = [];
    for (const k of kills) {
      dep.zones.push({
        id: nid(t, 'z'), kind: 'echo', x: k.x, y: k.y, r: def.hitRadius ?? 1.6, draw: def.radius ?? 4, dps: (def.value ?? 10) * p.stats.bolt.damageMult,
        t: def.seconds ?? 8, owner: p,
      });
      blast(t, dep, k, 0.8, '#b48ce0');
    }
    return true;
  },
  'Echo of Courage': (t, p, _dep, def) => {
    for (const o of partyNear(t, p)) {
      addBuff(o, 'courage', def.seconds ?? 8, def.value ?? 0.1);
      o.slowT = 0;
      o.stunT = 0;
    }
    return true;
  },
  'Shatter the Depth': (t, p, dep, def) => {
    blast(t, dep, p, def.radius ?? 4, '#cfe8ff');
    t.fx.push({ type: 'shake', depth: dep.level, amount: 4 });
    for (const v of areaDamage(t, p, dep, p, def.radius ?? 4, def)) if (isMonster(v)) v.slowT = Math.max(v.slowT, def.seconds ?? 3);
    return true;
  },
  'Unmaking Note': (t, p, dep, def) => {
    const dir = aimAt(p, pickTarget(t, p, dep, def.range ?? 8), p.facing);
    p.facing = dir;
    const roll = artRoll(t, p, def);
    shoot(t, dep, p, dir, { ...roll, speed: t.B.echo.toneSpeed, range: def.range ?? 8, skill: 'echo', kind: 'note', faction: 'player', unmake: def.value ?? 2 });
    return true;
  },
  'Kindled Brands': (t, p, _dep, def) => {
    for (const o of partyNear(t, p)) {
      heal(t, o, o.stats.maxHp * (def.value ?? 0.35));
      o.focus = Math.min(o.stats.maxFocus, o.focus + o.stats.maxFocus / 2);
    }
    return true;
  },
  'The Maw Holds Its Breath': (t, p, dep, def) => {
    for (const m of dep.monsters) if (!m.dead) m.stunT = Math.max(m.stunT, m.def.warden ? def.warden ?? 1 : def.seconds ?? 3);
    blast(t, dep, p, 6, '#e8e2d6');
    t.fx.push({ type: 'shake', depth: dep.level, amount: 6 });
    return true;
  },
  'Requiem of the Tithed': (t, p, dep, def) => {
    blast(t, dep, p, def.radius ?? 6, '#b48ce0');
    t.fx.push({ type: 'shake', depth: dep.level, amount: 6 });
    areaDamage(t, p, dep, p, def.radius ?? 6, def);
    return true;
  },
  'Crown of Echoes': (t, p, _dep, def) => {
    for (const o of partyNear(t, p, def.radius ?? 8)) addBuff(o, 'crown', def.seconds ?? 12, def.value ?? 0.25);
    addRenown(t, p, def.renown ?? 50);
    return true;
  },
};

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
  area?: number;
  pierce?: boolean;
  unmake?: number;
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
    ...(o.skill ? { skill: o.skill } : {}), ...(o.area ? { area: o.area } : {}), ...(o.pierce ? { pierce: new Set<Body>() } : {}),
    ...(o.unmake ? { unmake: o.unmake } : {}),
  });
}

// --- Skade, drab og belønning (Feature-011, -002, -003, -017) ----------------------------------

const isPlayer = (b: Body | null | undefined): b is Player => (b as Player | undefined)?.kind === 'player';
const isRival = (b: Body | null | undefined): b is Rival => (b as Rival | undefined)?.kind === 'rival';
const isMonster = (b: Body | null | undefined): b is Monster => (b as Monster | undefined)?.kind === 'monster';

const has = (m: Monster, trait: MonsterTrait) => !!m.def.traits?.includes(trait);

/** Gør skade og returnerer den skade, der blev gjort (0, når slaget ikke ramte). */
function damage(
  t: Tithe, dep: Depth, attacker: Body | null, target: Body, amount: number, crit: boolean,
  opts: { skill?: SkillId; train?: boolean; kind?: Projectile['kind']; unmake?: number } = {},
): number {
  if (target.dead || t.closed) return 0;
  if (isPlayer(target) && target.end) return 0;
  if (attacker && !canStrike(t, attacker, target)) return 0;
  const B = t.B;
  const T = B.monsters.traits;
  if (isMonster(target)) {
    // Feature-013: Cutthroat springer til side; Skeleton Miner tåler pile; Scrap Golem tåler ikke Echo.
    if (has(target, 'dodges') && target.dodgeCd <= 0 && t.rng.chance(T.dodgeChance)) {
      target.dodgeCd = T.dodgeCooldown;
      float(t, dep.level, target.x, target.y - target.r - 0.2, 'Dodge', '#c9c3b8', 12);
      return 0;
    }
    if (opts.kind === 'arrow' && has(target, 'arrowResistant')) amount *= T.arrowFactor;
    if (opts.skill === 'echo') {
      if (has(target, 'echoWeak')) amount *= T.echoWeakFactor;
      if (has(target, 'regenerates')) target.regenStopAt = t.time + T.regenStopSeconds;
    }
  }
  // Feature-047: Rally Toll, Echo of Courage, Crown of Echoes og Mirror Storm giver mere skade.
  if (isPlayer(attacker)) amount *= artDamageMult(attacker);
  // Feature-047 Unmaking Note: dobbelt mod en med rustning.
  const targetArmour = isPlayer(target) ? target.stats.armour : target.armour;
  if (opts.unmake && targetArmour > 0) amount *= opts.unmake;
  if (isPlayer(target)) {
    if (target.dodgeT > 0) return 0; // Feature-013: et dodge kan ikke rammes
    // Feature-047 Ringing Ward: det næste slag mister 75 % af sin skade.
    const ward = target.buffs.find((b) => b.kind === 'ward');
    if (ward) {
      amount *= 1 - ward.value;
      target.buffs = target.buffs.filter((b) => b !== ward);
      float(t, dep.level, target.x, target.y - target.r - 0.6, 'Warded', '#bfe6ff', 12);
    }
    // Feature-013: Rust Ooze ætser rustningen; Feature-047 Crystal Mantle giver mere.
    const armour = Math.max(0, target.stats.armour + buffValue(target, 'mantle') - (target.corrodeT > 0 ? T.corrodeArmour : 0));
    amount *= 1 - armour / (armour + B.combat.armourFactor);
    if (isMonster(attacker)) afflict(t, attacker, target);
  } else {
    amount *= 1 - target.armour / (target.armour + B.combat.armourFactor);
  }
  amount = Math.max(1, Math.round(amount));
  // Feature-047 Brand's Refusal: det næste dræbende slag efterlader 1 liv.
  const refused = isPlayer(target) && target.hp - amount <= 0 && target.buffs.some((b) => b.kind === 'refusal');
  if (refused) {
    target.buffs = target.buffs.filter((b) => b.kind !== 'refusal');
    target.hp = 1;
    float(t, dep.level, target.x, target.y - target.r - 0.6, 'Refused!', '#ffd84a', 16);
  } else target.hp -= amount;
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
  return amount;
}

/** Feature-013: hvad et monsters slag gør ud over skade: langsom, lammet, ætset eller drænet. */
function afflict(t: Tithe, m: Monster, p: Player): void {
  const T = t.B.monsters.traits;
  // Feature-047 Echo of Courage: hverken langsom eller lammet.
  const brave = p.buffs.some((b) => b.kind === 'courage');
  if (has(m, 'slows') && !brave) p.slowT = Math.max(p.slowT, m.def.slow ?? 2);
  if (has(m, 'stuns') && !brave) p.stunT = Math.max(p.stunT, T.stunSeconds);
  if (has(m, 'corrodes')) p.corrodeT = T.corrodeSeconds;
  if (has(m, 'drains')) {
    p.stamina = Math.max(0, p.stamina - T.drainStamina);
    p.focus = Math.max(0, p.focus - T.drainFocus);
  }
}

/** Feature-002 CMD-01: erfaring × udfordring (fjendens niveau / Mark, mellem 0,25 og 1,5). */
function trainSkill(t: Tithe, p: Player, skill: SkillId, target: Body, amount: number): void {
  if (t.reach === 'arena') return; // Feature-045: intet fra arenaen beholdes
  const B = t.B;
  const challenge = clamp((target.level || 1) / Math.max(1, p.ch.level), B.skills.challengeMin, B.skills.challengeMax);
  // Feature-002: skill'en trænes op til Mark'ens loft; våbnet sætter intet loft (Feature-007).
  const gained = addSkillXp(p.ch, skill, amount * challenge, B);
  p.sheetVersion += 1;
  if (gained) {
    refreshStats(t, p);
    float(t, p.depth, p.x, p.y - 1, `${skillName(skill, p.ch.background, B)} ${p.ch.skills[skill].level}`, '#7fd1ff', 16, p.id);
  }
}

/** Feature-003 CMD-01 */
function gainEcho(t: Tithe, p: Player, amount: number): void {
  if (t.reach === 'arena') return;
  const marks = addEcho(p.ch, amount, t.B);
  p.sheetVersion += 1;
  if (marks) {
    refreshStats(t, p);
    say(t, 'The Maw', `A new Mark burns into your Brand. You are Mark ${p.ch.level}.`, p.id);
  }
}

/** Feature-017 CMD-01 */
function addRenown(t: Tithe, p: Player, amount: number): void {
  if (t.reach === 'arena') return;
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
  const odds = t.B.loot.sponsorOdds;
  // Feature-017: en ting, der er magisk én gang ud af tre.
  if (roll < odds.item) dep.loot.push({ id: nid(t, 'l'), kind: 'item', item: newItem(t, level, { rarity: rng.chance(t.B.loot.sponsorMagicChance) ? 'magic' : 'common' }), ...spot });
  else if (roll < odds.item + odds.potion) dep.loot.push({ id: nid(t, 'l'), kind: 'potion', ...spot });
  else if (roll < odds.item + odds.potion + odds.focusPotion) dep.loot.push({ id: nid(t, 'l'), kind: 'focusPotion', ...spot });
  else if (roll < odds.item + odds.potion + odds.focusPotion + odds.ration) dep.loot.push({ id: nid(t, 'l'), kind: 'ration', ...spot });
  else dep.loot.push({ id: nid(t, 'l'), kind: 'gold', amount: level * t.B.loot.sponsorGoldPerLevel, ...spot });
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

/** Feature-011: en Veteran giver guld (60 %) og en ting (50 %), oftere magisk end ellers, og en forsyning (15 %). */
function veteranLoot(t: Tithe): DropOptions {
  const V = t.B.loot.veteran;
  const roll = t.rng.next();
  const rarity: Rarity = roll < V.rare ? 'rare' : roll < V.rare + V.magic ? 'magic' : 'common';
  return { goldChance: V.goldChance, itemChance: V.itemChance, rarities: [rarity], consumableChance: t.B.loot.veteranConsumableChance };
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
    // Feature-011: en potion, en focus potion eller en ration, en tredjedel hver.
    const kind = rng.pick(['potion', 'focusPotion', 'ration'] as const);
    dep.loot.push({ id: nid(t, 'l'), kind, ...dropSpot(dep, x, y, rng) });
  }
}

function kill(t: Tithe, dep: Depth, killer: Body | null, target: Body, opts: { skill?: SkillId } = {}): void {
  // Feature-013: en Hollow rejser sig én gang med 40 % af sit liv.
  if (isMonster(target) && has(target, 'rises') && !target.risen) {
    target.risen = true;
    target.hp = Math.round(target.maxHp * t.B.monsters.traits.riseLife);
    float(t, dep.level, target.x, target.y - target.r - 0.4, 'Rises!', '#c9c3b8', 13);
    return;
  }
  target.dead = true;
  target.hp = 0;
  const B = t.B;
  const p = isPlayer(killer) ? killer : null;
  t.fx.push({ type: 'death', depth: dep.level, x: target.x, y: target.y, kind: (target as { kind?: string }).kind ?? 'monster' });

  if (isMonster(target)) {
    // Feature-047 Last Words: et mærket monster springer, når det dør.
    if (target.markT > 0 && target.markBy) lastWords(t, dep, target);
    if (p) {
      p.recentKills.push({ x: target.x, y: target.y, t: t.time });
      p.record.kills += 1;
      gainEcho(t, p, Math.round(target.def.echo * target.level * p.stats.echoGain));
      if (opts.skill) trainSkill(t, p, opts.skill, target, B.skills.xpPerKill);
      addRenown(t, p, B.renown.perMonsterLevel * target.level);
      // Monstre, som Mirrormaster eller The Foreman kalder frem, giver hverken loot eller drabsserie.
      if (!target.def.warden && !target.summoned) {
        dropLoot(t, dep, target.x, target.y, target.level, target.veteran
          ? veteranLoot(t)
          : target.def.itemChance !== undefined ? { itemChance: target.def.itemChance } : {});
        registerKill(t, p, dep);
      }
    }
    if (target.def.warden) {
      t.wardenAlive = false;
      if (p) {
        // Feature-011 EVT-04: porten åbner for den, der slog ham (og i fase 4 hans parti).
        dep.map.gateOpen = true;
        for (const x of t.players) if (sameParty(x, p)) t.gateOpenFor.add(x.id);
        p.record.wardenSlain = true;
        addRenown(t, p, B.renown.warden);
        // Feature-011: Warden giver guld og én magisk ting – sjælden én gang ud af fire.
        dropLoot(t, dep, target.x, target.y, target.level + 1, { goldChance: 1, items: 1, rarities: [t.rng.chance(B.loot.wardenRareChance) ? 'rare' : 'magic'], consumableChance: 1 });
        say(t, 'Mirrormaster', fmt(LINES.wardenSlain, { name: p.name, warden: wardenName(t) }));
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
      dropLoot(t, dep, target.x, target.y, target.level, { goldChance: 1, itemChance: B.loot.rivalItemChance, consumableChance: B.loot.rivalConsumableChance });
      registerKill(t, p, dep);
    }
    return;
  }

  if (isPlayer(target)) {
    // Feature-013 EVT-10: spilleren falder, og de andre kandidater fortsætter.
    // Feature-045: i arenaen er en kæmper bare nede – intet guld spildes, og intet Echo vindes.
    say(t, 'Mirrormaster', fmt(t.reach === 'arena' ? LINES.fighterDown : LINES.playerFell, { name: target.name }));
    if (p && t.reach !== 'arena') defeatPlayer(t, dep, p, target);
    endPlayer(t, target, 'fell', p ? p.userName : killer ? killer.name : 'the Maw');
  }
}

/**
 * Feature-011 EVT-06 Player defeated: den slåede spilder 10–20 % af guldet i tegnebogen på gulvet, hvor den faldt
 * (Feature-018), og den, der slog, får et Player kill (Feature-039), 60 Renown (Feature-017) og 12 × Mark i Echo (Feature-003).
 */
function defeatPlayer(t: Tithe, dep: Depth, by: Player, target: Player): void {
  const gold = Math.floor(Math.max(0, target.ch.gold) * t.rng.range(0.1, 0.2));
  if (gold > 0) {
    target.ch.gold -= gold;
    dep.loot.push({ id: nid(t, 'l'), kind: 'gold', amount: gold, x: target.x, y: target.y });
  }
  t.defeats.push({ userId: target.userId, characterId: target.characterId, byUserId: by.userId, byCharacterId: by.characterId, gold });
  by.record.playersDefeated += 1;
  addRenown(t, by, t.B.renown.rival);
  gainEcho(t, by, Math.round(12 * target.ch.level * by.stats.echoGain));
  registerKill(t, by, dep);
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
  const flying = isMonster(e) && has(e, 'flies');
  const dx = x - e.x;
  const dy = y - e.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-4) return 0;
  const step = Math.min(d, maxStep);
  e.facing = { x: dx / d, y: dy / d };
  return moveWithCollision(dep.map, e, (dx / d) * step, (dy / d) * step, flying);
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
    m.dodgeCd = Math.max(0, m.dodgeCd - dt);
    m.slowT = Math.max(0, m.slowT - dt);
    m.rootT = Math.max(0, m.rootT - dt);
    m.lureT = Math.max(0, m.lureT - dt);
    m.markT = Math.max(0, m.markT - dt);
    const T = t.B.monsters.traits;
    // Feature-047: lammet kan monstret hverken gå eller slå; et angreb på vej går tabt.
    if (m.stunT > 0) {
      m.stunT = Math.max(0, m.stunT - dt);
      m.windup = 0;
      continue;
    }
    // Feature-047: rodfæstet står det stille, langsomt går det 40 % langsommere.
    const speed = m.rootT > 0 ? 0 : def.speed * m.fleet * (m.slowT > 0 ? t.B.echo.slowFactor : 1);
    // Feature-013: Cave Troll heler, medmindre en Echo Bolt ramte den for nylig.
    if (has(m, 'regenerates') && t.time >= m.regenStopAt && m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * T.regenPerSecond * dt);
    // Feature-013: Cultist of the Maw heler monstrene omkring sig.
    if (has(m, 'heals') && m.awake) {
      m.healT -= dt;
      if (m.healT <= 0) {
        m.healT = T.healEvery;
        for (const o of dep.monsters) {
          if (o.dead || o.hp >= o.maxHp || dist(o, m) > T.healRange) continue;
          const heal = Math.round(Math.min(o.maxHp - o.hp, o.maxHp * T.healShare));
          o.hp += heal;
          float(t, dep.level, o.x, o.y - o.r - 0.2, `+${heal}`, '#6f6', 12);
        }
      }
    }
    if (m.windup > 0) {
      m.windup -= dt;
      if (m.windup <= 0) resolveMonsterAttack(t, dep, m);
      continue;
    }
    // Feature-047: Hollow Call, et spejlbillede eller et ekko trækker monstret til sig.
    const drawn = drawnTo(dep, m);
    if (drawn) {
      m.awake = true;
      if (speed > 0) moveToward(dep, m, drawn.x, drawn.y, speed * dt);
      continue;
    }
    // Nærmeste kandidat inden for aggro. Et sovende monster vågner kun ved synskontakt.
    let target: Body | null = null;
    let best = Infinity;
    // Feature-013: en Gargoyle står stille, til en kandidat er tæt på.
    const aggro = !m.awake && has(m, 'ambush') ? T.ambushRange : def.aggro * (m.awake ? 1.6 : 1);
    for (const c of victimsOf(t, dep)) {
      const d = dist(m, c);
      if (d > aggro || d >= best) continue;
      // Feature-013: i The Woods ser monstrene ikke en kandidat i en busk.
      if (isPlayer(c) && hiddenFrom(t, c, m)) continue;
      if (def.warden && dep.map.wardenRoom && !inRoom(dep.map.wardenRoom, c, 1)) continue;
      if (!m.awake && !lineOfSight(dep.map, m.x, m.y, c.x, c.y)) continue;
      best = d;
      target = c;
    }
    if (def.warden) {
      if (!target) {
        if (dep.map.wardenRoom) moveToward(dep, m, dep.map.wardenRoom.cx + 0.5, dep.map.wardenRoom.cy + 0.5, speed * dt);
        continue;
      }
      if (!t.wardenSaid && isPlayer(target)) {
        t.wardenSaid = true;
        say(t, 'Mirrormaster', fmt(LINES.warden, { warden: wardenName(t) }));
      }
      m.summonT -= dt;
      if (m.summonT <= 0) {
        m.summonT = def.summonEvery ?? 14;
        const gnawers = dep.monsters.filter((x) => !x.dead && x.type === summonType(t)).length;
        for (let i = 0; i < Math.min(3, (def.summonMax ?? 6) - gnawers); i++) {
          const pos = dropSpot(dep, m.x, m.y, t.rng);
          const g = makeMonster(t, summonType(t), pos.x, pos.y, Math.max(1, m.level - 2));
          g.awake = true;
          g.summoned = true;
          dep.monsters.push(g);
        }
      }
    }
    if (!target) continue;
    m.awake = true;
    const d = dist(m, target);
    // Feature-013: Tunnel Goblin flygter under 25 % liv.
    if (has(m, 'flees') && m.hp < m.maxHp * T.fleeBelow) {
      moveToward(dep, m, m.x - (target.x - m.x), m.y - (target.y - m.y), speed * dt);
      continue;
    }
    if (def.ranged) {
      const sees = lineOfSight(dep.map, m.x, m.y, target.x, target.y);
      if (d < 2.5) moveToward(dep, m, m.x - (target.x - m.x), m.y - (target.y - m.y), speed * dt);
      else if (d <= (def.range ?? 6) && sees) {
        if (m.attackCd <= 0) {
          m.windup = def.windup;
          m.aim = { x: target.x, y: target.y };
        }
      } else chase(dep, m, target, speed * dt);
      continue;
    }
    if (d <= (def.reach ?? 1) + target.r) {
      if (m.attackCd <= 0) {
        m.windup = def.windup;
        m.aim = aimAt(m, target, m.facing);
      }
    } else chase(dep, m, target, speed * dt);
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
  m.attackCd = def.cooldown * m.quick; // Feature-011: højere level slår hurtigere
  const victims = victimsOf(t, dep);
  if (def.ranged) {
    const dir = aimAt(m, m.aim, m.facing);
    const area = has(m, 'area') ? t.B.monsters.traits.areaRadius : undefined;
    shoot(t, dep, m, dir, {
      amount: t.rng.range(m.min, m.max), crit: false, speed: def.projectileSpeed ?? 7, range: area ? Math.min(dist(m, m.aim ?? m), (def.range ?? 6) + 2) : (def.range ?? 6) + 2,
      kind: def.projectile ?? 'spit', faction: 'monster', ...(area ? { area } : {}),
    });
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
  // Feature-013: Feral Hounds slår hårdere for hver anden hund tæt på.
  let mult = 1;
  if (has(m, 'pack')) {
    const T = t.B.monsters.traits;
    const others = dep.monsters.filter((o) => o !== m && !o.dead && o.type === m.type && dist(o, m) <= T.packRange).length;
    mult += Math.min(T.packMax, others * T.packPerHound);
  }
  if (best) damage(t, dep, m, best, t.rng.range(m.min, m.max) * mult, false);
}

// --- Rivaler (Feature-014 SVC-01) ---------------------------------------------------------------

function rivalVictims(t: Tithe, dep: Depth, r: Rival): Body[] {
  const list: Body[] = dep.monsters.filter((m) => !m.dead);
  for (const p of playersOn(t, dep.level)) if (hostile(r, p) && canStrike(t, r, p) && !hiddenFrom(t, p, r)) list.push(p);
  return list;
}

function updateRivals(t: Tithe, dep: Depth, dt: number): void {
  const B = t.B;
  const last = dep.warden;
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
        if (!hostile(r, p) || hiddenFrom(t, p, r)) continue;
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
    const sealAt = sealAtPos(t, dep.level, r.x, r.y);
    const sealed = sealAt != null && t.time >= sealAt;
    r.budget = Math.min(4, r.budget + (dt * dep.maxExitDist * (sealed ? 3 : 1)) / rivalSeconds(t, r));
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

function sealAtFor(t: Tithe, r: Rival): number | null {
  if (openReach(t)) return openCfg(t).sealTimes[rivalDistrict(t, r) - 1] ?? null;
  const d = r.depth;
  return t.depths[d] ? t.depths[d].sealAt : t.B.mirrormaster.sealTimes[d - 1] ?? null;
}

/** I byen krydser rivalerne hele byen på den tid, minernes tre dybder tager (Feature-014). */
function rivalSeconds(t: Tithe, r: Rival): number {
  return openReach(t) ? r.secondsPerDepth * openCfg(t).rivalDepths : r.secondsPerDepth;
}

/** Hvilket distrikt en rival i byen er i: hvor den står, eller hvor langt den er nået, når ingen ser den. */
export function rivalDistrict(t: Tithe, r: Rival): number {
  if (r.real) return districtAt(t, r.depth, r.x, r.y) ?? 1;
  const D = openCfg(t).districts;
  return r.progress >= 1 ? D : Math.min(D - 1, 1 + Math.floor(r.progress * (D - 1)));
}

/** Dybden, kandidatlisten viser: dybden i minerne, distriktet i byen (Feature-010 VIEW-01). */
export function shownDepth(t: Tithe, c: Player | Rival): number {
  if (!openReach(t)) return c.depth;
  if (c.kind === 'rival') return rivalDistrict(t, c);
  return districtAt(t, c.depth, c.x, c.y) ?? 1;
}

// Rivaler på dybder uden spillere skrider frem i tid i stedet for at blive simuleret.
function updateAbstractRivals(t: Tithe, dt: number): void {
  const B = t.B;
  for (const r of t.rivals) {
    if (r.real || r.status !== 'in' || t.closed) continue;
    const sealAt = sealAtFor(t, r);
    const sealed = sealAt != null && t.time >= sealAt;
    if (r.progress < 1) {
      r.progress += (dt / rivalSeconds(t, r)) * (sealed ? 3 : 1);
      continue;
    }
    if (r.depth < depthCount(t)) {
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
    const foreman = Object.values(t.depths).find((d) => d.warden)?.monsters.find((m) => m.def.warden);
    if (foreman) foreman.hp = Math.min(foreman.hp, Math.round(foreman.maxHp * t.wardenHpFactor));
    say(t, 'Mirrormaster', fmt(LINES.rivalLostWarden, { name: r.name, warden: wardenName(t) }));
  }
}

// --- Projektiler, skub og opsamling -------------------------------------------------------------

/** Feature-013: en ildkrukke springer og rammer alle kandidater i området. */
function burst(t: Tithe, dep: Depth, pr: Projectile): void {
  t.fx.push({ type: 'blast', depth: dep.level, x: pr.x, y: pr.y, amount: pr.area });
  for (const v of victimsOf(t, dep)) if (Math.hypot(v.x - pr.x, v.y - pr.y) <= (pr.area ?? 1) + v.r) damage(t, dep, pr.owner, v, pr.amount, false, { kind: pr.kind });
}

function updateProjectiles(t: Tithe, dep: Depth, dt: number): void {
  for (const pr of dep.projectiles) {
    if (pr.done) continue;
    const step = pr.speed * dt;
    pr.x += pr.vx * step;
    pr.y += pr.vy * step;
    pr.traveled += step;
    if (pr.traveled > pr.range || isSolid(dep.map, Math.floor(pr.x), Math.floor(pr.y))) {
      pr.done = true;
      if (pr.area) burst(t, dep, pr);
      continue;
    }
    let targets: Body[];
    if (pr.faction === 'player' && isPlayer(pr.owner)) targets = targetsFor(t, pr.owner, dep);
    else if (pr.faction === 'rival' && isRival(pr.owner)) targets = rivalVictims(t, dep, pr.owner);
    else targets = victimsOf(t, dep);
    for (const e of targets) {
      if (e === pr.owner || e.dead) continue;
      if (Math.hypot(e.x - pr.x, e.y - pr.y) < e.r + 0.15) {
        // Feature-047 Resonant Line: tonen flyver videre og rammer hver kun én gang.
        if (pr.pierce) {
          if (pr.pierce.has(e)) continue;
          pr.pierce.add(e);
          damage(t, dep, pr.owner, e, pr.amount, pr.crit, { skill: 'echo', train: pr.pierce.size <= t.B.skills.maxHitsPerSwing, kind: pr.kind });
          continue;
        }
        pr.done = true;
        if (pr.area) burst(t, dep, pr);
        else {
          damage(t, dep, pr.owner, e, pr.amount, pr.crit, {
            ...(pr.skill ? { skill: pr.skill, train: true } : {}), kind: pr.kind, ...(pr.unmake ? { unmake: pr.unmake } : {}),
          });
        }
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

/** Feature-006 CMD-01: så tæt på skal kandidaten være for at samle noget op. */
const PICKUP_RANGE = 0.7;

/** Feature-006 CMD-01: loot samles op ved at gå over det; en fuld pakke lader tingen ligge. */
function pickups(t: Tithe, dep: Depth): void {
  const max = t.B.character.maxConsumables;
  for (const p of playersOn(t, dep.level)) {
    const ch = p.ch;
    for (const l of dep.loot) {
      if (l.id === '') continue; // taget af en anden spiller i samme skridt
      if (l.waitFor === p.id) {
        // Feature-006: den, der droppede tingen, skal først træde væk fra den.
        if (Math.hypot(l.x - p.x, l.y - p.y) > PICKUP_RANGE + 0.3) delete l.waitFor;
        continue;
      }
      if (Math.hypot(l.x - p.x, l.y - p.y) > PICKUP_RANGE) continue;
      if (l.kind === 'gold') {
        // Feature-006 EVT-03: guldet kommer først i tegnebogen, når Tithen slutter.
        p.record.goldFound += l.amount ?? 0;
        float(t, dep.level, l.x, l.y - 0.3, `+${l.amount} gold`, '#ffd84a', 13, p.id);
        l.id = '';
      } else if (l.kind === 'potion' || l.kind === 'focusPotion' || l.kind === 'ration') {
        const key = CONSUMABLE_KEYS[l.kind];
        if ((ch[key] ?? 0) < max) {
          ch[key] = (ch[key] ?? 0) + 1;
          p.sheetVersion += 1;
          const name = { potion: '+1 Potion', focusPotion: '+1 Focus potion', ration: '+1 Ration' }[l.kind];
          float(t, dep.level, l.x, l.y - 0.3, name, '#b7f0b7', 13, p.id);
          l.id = '';
        }
      } else if (l.item) {
        if (ch.inventory.length < p.stats.capacity) {
          // Feature-006: samlet op igen af den, der droppede den, beholder tingen sit mærke (fundet eller medbragt).
          if (l.droppedBy !== p.id) {
            l.item.found = t.id;
            p.record.itemsFound += 1;
          }
          ch.inventory.push(l.item);
          p.sheetVersion += 1;
          float(t, dep.level, l.x, l.y - 0.3, displayName(l.item, t.B), RARITY_COLORS[l.item.rarity], 14);
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
      dropLoot(t, dep, c.x, c.y, monsterLevel(t, dep.level) + 1, { goldChance: 1, items: 1, consumableChance: t.B.loot.cacheConsumableChance });
    }
  }
}

// --- Mirrormaster (Feature-017) og sammenstyrtning (Feature-013) ------------------------------

/** Forseglingen dér, hvor spilleren står: dybden i minerne, distriktet i byen (Feature-017 og HUD'en). */
export function sealInfoAt(t: Tithe, area: number, x: number, y: number): { left: number; sealed: boolean } | null {
  const at = sealAtPos(t, area, x, y);
  if (at == null) return null;
  return { left: at - t.time, sealed: t.time >= at };
}

export function sealInfo(t: Tithe, depth: number): { left: number; sealed: boolean } | null {
  const dep = t.depths[depth];
  if (!dep || dep.sealAt == null) return null;
  return { left: dep.sealAt - t.time, sealed: t.time >= dep.sealAt };
}

/** Feature-013: en forseglet dybde sårer alle i den med 3 % af max liv i sekundet. */
function sealDamage(t: Tithe, dep: Depth, dt: number): void {
  const M = t.B.mirrormaster;
  const sealedAt = (x: number, y: number) => !!sealInfoAt(t, dep.level, x, y)?.sealed;
  for (const p of playersOn(t, dep.level)) {
    if (!sealedAt(p.x, p.y)) continue;
    p.hp -= p.stats.maxHp * M.sealDamagePerSecond * dt;
    if (p.hp <= 0) kill(t, dep, { name: 'the collapsing tunnels' } as Body, p);
  }
  for (const r of realRivals(t, dep.level)) {
    if (!sealedAt(r.x, r.y)) continue;
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
  // Feature-017 CMD-04: byens distrikter forsegles udefra og ind; Mirrormaster varsler 30 sekunder før.
  if (openReach(t)) {
    const C = openCfg(t);
    C.sealTimes.forEach((at, i) => {
      const d = i + 1;
      if (!t.wardsWarned.has(d) && t.time >= at - M.sealWarning) {
        t.wardsWarned.add(d);
        say(t, 'Mirrormaster', fmt(LINES.wardWarning, { ward: C.wards[i]!, s: Math.ceil(at - t.time) }));
      }
      if (!t.wardsSealed.has(d) && t.time >= at) {
        t.wardsSealed.add(d);
        say(t, 'Mirrormaster', fmt(LINES.wardSealed, { ward: C.wards[i]! }));
        for (const p of playersIn(t)) if (districtAt(t, p.depth, p.x, p.y) === d) t.fx.push({ type: 'shake', depth: p.depth, amount: 6, to: p.id });
      }
    });
  }
  // Feature-017 CMD-03: efter 40 sekunder uden skade keder publikum sig, og der kommer 4 Gnawers.
  for (const p of playersIn(t)) {
    if (t.time - p.mm.lastDamageAt > M.boredAfter && t.time - p.mm.lastBoredAt > M.boredAfter) {
      p.mm.lastBoredAt = t.time;
      say(t, 'Mirrormaster', t.rng.pick(LINES.bored));
      spawnNear(t, p, summonType(t), M.boredGnawers);
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
  const link = stairAt(t, p);
  if (link) p.interact = link.up ? 'climb' : 'down';
}

// --- Til tests ------------------------------------------------------------------------------------

/** Hjælpere, som testene bruger til at stille en situation op. Spillet bruger dem ikke. */
export const testing = { enterDepth, kill, damage, endPlayer, makeMonster, buildDepth, claimTithe, climbStairs, resolveMonsterAttack };
