// Balance: alle tal, der styrer spillet. Startværdier fra prototypen (prototype/balance.js), som playtest justerer.
// Reglerne i Event Modellen nævner de samme tal; ændres et tal, der står i en feature, ændres featuren først.
// Tider er i sekunder, afstande i felter (tiles), og en egenskab starter på 10.

import type { AffixDef, Attribute, Background, ItemBase, Range, SkillId } from './types.ts';

// Egenskaber i rækkefølgen Strength, Dexterity, Stamina, Constitution, Intelligence; skills i rækkefølgen Blades,
// Heavy Weapons, Bows, Echo Arts. Et tal er en værdi, et par er [minimum, maksimum].
function attrs(str: number, dex: number, sta: number, con: number, int: number): Record<Attribute, number>;
function attrs(str: [number, number], dex: [number, number], sta: [number, number], con: [number, number], int: [number, number]): Record<Attribute, Range>;
function attrs(...v: (number | [number, number])[]): Record<Attribute, number | Range> {
  const keys: Attribute[] = ['strength', 'dexterity', 'stamina', 'constitution', 'intelligence'];
  return Object.fromEntries(keys.map((k, i) => [k, toValue(v[i]!)])) as Record<Attribute, number | Range>;
}
function skills(blades: number, heavy: number, bows: number, echo: number): Record<SkillId, number>;
function skills(blades: [number, number], heavy: [number, number], bows: [number, number], echo: [number, number]): Record<SkillId, Range>;
function skills(...v: (number | [number, number])[]): Record<SkillId, number | Range> {
  const keys: SkillId[] = ['blades', 'heavy', 'bows', 'echo'];
  return Object.fromEntries(keys.map((k, i) => [k, toValue(v[i]!)])) as Record<SkillId, number | Range>;
}
function toValue(v: number | [number, number]): number | Range {
  return typeof v === 'number' ? v : { min: v[0], max: v[1] };
}

export interface MonsterDef {
  name: string;
  hp: number;
  min: number;
  max: number;
  speed: number;
  radius: number;
  cooldown: number;
  windup: number;
  aggro: number;
  echo: number;
  weight?: number;
  reach?: number;
  range?: number;
  projectileSpeed?: number;
  ranged?: boolean;
  armour?: number;
  itemChance?: number;
  summonEvery?: number;
  summonMax?: number;
  warden?: boolean;
  /** Feature-011: hvilken Reach monstret hører til, og dybderne eller distrikterne, det findes i. */
  home?: 'mines' | 'city';
  areas?: [number, number];
  /** Til Bestiary i Help (Feature-030): hvordan det kæmper. */
  role?: string;
  color?: string;
  /** Afstandsmonstrenes projektil: spyt, pil, Echo, ild eller spind. */
  projectile?: 'spit' | 'arrow' | 'bolt' | 'fire' | 'web';
  /** Feature-013: monstrets særpræg, og hvad Bestiary siger om dem. */
  traits?: MonsterTrait[];
  special?: string;
  /** Hvor længe et slag gør spilleren langsom (s). */
  slow?: number;
}

/** Feature-013: særprægene. */
export type MonsterTrait =
  | 'flees' | 'area' | 'slows' | 'arrowResistant' | 'stuns' | 'corrodes' | 'regenerates' | 'pack' | 'dodges' | 'rises' | 'heals'
  | 'ambush' | 'flies' | 'echoWeak' | 'drains';

export interface RivalDef {
  id: string;
  name: string;
  weapon: SkillId;
  levelOffset: number;
  aggression: number;
  color: string;
}

const BACKGROUNDS: Background[] = [
  // Feature-001 Create character: styrker, svagheder, forslag og grænser pr. baggrund.
  {
    id: 'miner',
    name: 'Miner',
    text: 'Dug Echo crystals in the shafts of Cinderhollow. Strong and hard to kill.',
    strengths: ['Strength', 'Constitution', 'Heavy Weapons'],
    weaknesses: ['Dexterity', 'Intelligence', 'Echo Arts'],
    suggestion: { attributes: attrs(13, 10, 10, 12, 10), skills: skills(3, 10, 2, 1) },
    limits: {
      attributes: attrs([11, 16], [7, 12], [9, 13], [10, 15], [7, 12]),
      skills: skills([0, 8], [6, 12], [0, 6], [0, 4]),
    },
    weapon: 'pickaxe',
  },
  {
    id: 'poacher',
    name: 'Poacher',
    text: "Hunted the Crown's deer by night. Quick hands, sharp eyes.",
    strengths: ['Dexterity', 'Bows'],
    weaknesses: ['Constitution', 'Heavy Weapons'],
    suggestion: { attributes: attrs(10, 14, 11, 10, 10), skills: skills(4, 1, 10, 1) },
    limits: {
      attributes: attrs([8, 13], [12, 17], [9, 14], [7, 12], [8, 13]),
      skills: skills([0, 8], [0, 4], [6, 12], [0, 6]),
    },
    weapon: 'short_bow',
  },
  {
    id: 'acolyte',
    name: 'Temple Acolyte',
    text: 'Studied the Echo in the temple archives. Weak arm, bright mind.',
    strengths: ['Intelligence', 'Echo Arts'],
    weaknesses: ['Strength', 'Constitution', 'Heavy Weapons'],
    suggestion: { attributes: attrs(10, 10, 11, 10, 14), skills: skills(4, 0, 2, 10) },
    limits: {
      attributes: attrs([7, 12], [8, 13], [9, 14], [7, 12], [12, 17]),
      skills: skills([0, 8], [0, 4], [0, 6], [6, 12]),
    },
    weapon: 'dagger',
  },
  {
    id: 'runner',
    name: 'Street Runner',
    text: 'Ran messages and errands through every alley in Aurum. Never tires.',
    strengths: ['Stamina', 'Dexterity', 'Blades'],
    weaknesses: ['Intelligence', 'Echo Arts'],
    suggestion: { attributes: attrs(10, 12, 13, 10, 10), skills: skills(10, 2, 3, 1) },
    limits: {
      attributes: attrs([8, 13], [10, 15], [11, 16], [8, 13], [7, 12]),
      skills: skills([6, 12], [0, 6], [0, 8], [0, 4]),
    },
    weapon: 'rusty_sword',
  },
];

const ITEM_BASES: Record<string, ItemBase> = {
  dagger: { name: 'Dagger', slot: 'weapon', skill: 'blades', min: 3, max: 5, reach: 1.1, cooldown: 0.32, stamina: 4, arc: 80, price: 18, skillCap: 20 },
  rusty_sword: { name: 'Rusty Sword', slot: 'weapon', skill: 'blades', min: 4, max: 7, reach: 1.3, cooldown: 0.45, stamina: 6, arc: 100, price: 20, skillCap: 20 },
  short_sword: { name: 'Short Sword', slot: 'weapon', skill: 'blades', min: 6, max: 10, reach: 1.35, cooldown: 0.48, stamina: 7, arc: 100, price: 45, minLevel: 2, skillCap: 35 },
  pickaxe: { name: 'Pickaxe', slot: 'weapon', skill: 'heavy', min: 7, max: 12, reach: 1.45, cooldown: 0.8, stamina: 12, arc: 140, price: 22, skillCap: 20 },
  war_axe: { name: 'War Axe', slot: 'weapon', skill: 'heavy', min: 10, max: 16, reach: 1.5, cooldown: 0.85, stamina: 13, arc: 140, price: 55, minLevel: 2, skillCap: 40 },
  maul: { name: 'Maul', slot: 'weapon', skill: 'heavy', min: 14, max: 22, reach: 1.55, cooldown: 1.05, stamina: 16, arc: 150, price: 80, minLevel: 3, skillCap: 60 },
  short_bow: { name: 'Short Bow', slot: 'weapon', skill: 'bows', min: 4, max: 8, range: 7, cooldown: 0.6, stamina: 5, price: 25, skillCap: 20 },
  hunting_bow: { name: 'Hunting Bow', slot: 'weapon', skill: 'bows', min: 6, max: 11, range: 8, cooldown: 0.65, stamina: 6, price: 60, minLevel: 2, skillCap: 40 },
  fine_dagger: { name: 'Fine Dagger', slot: 'weapon', skill: 'blades', min: 5, max: 8, reach: 1.15, cooldown: 0.3, stamina: 4, arc: 80, price: 90, minLevel: 5, skillCap: 50 },
  longsword: { name: 'Longsword', slot: 'weapon', skill: 'blades', min: 9, max: 15, reach: 1.45, cooldown: 0.5, stamina: 8, arc: 110, price: 140, minLevel: 6, skillCap: 60 },
  greataxe: { name: 'Greataxe', slot: 'weapon', skill: 'heavy', min: 18, max: 28, reach: 1.6, cooldown: 1.1, stamina: 18, arc: 150, price: 190, minLevel: 8, skillCap: 80 },
  longbow: { name: 'Longbow', slot: 'weapon', skill: 'bows', min: 9, max: 15, range: 9, cooldown: 0.7, stamina: 7, price: 150, minLevel: 6, skillCap: 70 },
  padded_coat: { name: 'Padded Coat', slot: 'armour', armour: 4, price: 12 },
  leather_jerkin: { name: 'Leather Jerkin', slot: 'armour', armour: 7, price: 25 },
  mail_shirt: { name: 'Mail Shirt', slot: 'armour', armour: 14, price: 60, minLevel: 2 },
  scale_coat: { name: 'Scale Coat', slot: 'armour', armour: 22, price: 95, minLevel: 4 },
  iron_ring: { name: 'Iron Ring', slot: 'ring', price: 30 },
  bone_ring: { name: 'Bone Ring', slot: 'ring', price: 30 },
};

const ALL: ItemBase['slot'][] = ['weapon', 'armour', 'ring'];
const AFFIXES: Record<string, AffixDef> = {
  strength: { label: 'Strength', prefix: 'Mighty', suffix: 'of the Ox', min: 1, max: 3, perLevel: 0.5, slots: ALL },
  dexterity: { label: 'Dexterity', prefix: 'Nimble', suffix: 'of the Fox', min: 1, max: 3, perLevel: 0.5, slots: ALL },
  stamina: { label: 'Stamina', prefix: 'Tireless', suffix: 'of the Mule', min: 1, max: 3, perLevel: 0.5, slots: ALL },
  constitution: { label: 'Constitution', prefix: 'Sturdy', suffix: 'of the Bear', min: 1, max: 3, perLevel: 0.5, slots: ['armour', 'ring'] },
  intelligence: { label: 'Intelligence', prefix: 'Clever', suffix: 'of the Owl', min: 1, max: 3, perLevel: 0.5, slots: ALL },
  damagePct: { label: '% Damage', prefix: 'Cruel', suffix: 'of Slaughter', min: 5, max: 15, perLevel: 2, slots: ['weapon', 'ring'] },
  maxHp: { label: 'Life', prefix: 'Vital', suffix: 'of Life', min: 5, max: 12, perLevel: 2, slots: ['armour', 'ring'] },
  armour: { label: 'Armour', prefix: 'Reinforced', suffix: 'of Iron', min: 2, max: 6, perLevel: 1, slots: ['armour', 'ring'] },
  skill: { label: 'to weapon skill', prefix: 'Masterwork', suffix: 'of the Adept', min: 1, max: 3, perLevel: 0.4, slots: ['weapon'] },
  echoGain: { label: '% Echo gained', prefix: 'Hungry', suffix: 'of the Maw', min: 5, max: 12, perLevel: 1, slots: ['armour', 'ring'] },
};

// Feature-011: monstrene i hver Reach. areas er dybderne i minerne og distrikterne i byen.
const MONSTERS: Record<string, MonsterDef> = {
  // The Old Mines
  gnawer: { name: 'Gnawer', home: 'mines', areas: [1, 3], role: 'Fast and weak; hunts in packs.', color: '#8d7b68', hp: 10, min: 2, max: 4, speed: 3.3, radius: 0.3, reach: 0.9, cooldown: 0.9, windup: 0.25, aggro: 7, echo: 3, weight: 40 },
  goblin: { name: 'Tunnel Goblin', home: 'mines', areas: [1, 2], role: 'A skirmisher with a rusty knife.', color: '#6d8a3e', hp: 14, min: 3, max: 5, speed: 3.0, radius: 0.33, reach: 1.0, cooldown: 1.0, windup: 0.3, aggro: 8, echo: 4, weight: 30, traits: ['flees'], special: 'Flees below 25 % life.' },
  kobold: { name: 'Kobold Sapper', home: 'mines', areas: [1, 3], role: 'Throws fire pots from afar and keeps its distance.', color: '#b5653a', hp: 12, min: 4, max: 7, speed: 2.4, radius: 0.3, range: 5.5, cooldown: 2.0, windup: 0.45, aggro: 8, echo: 5, projectileSpeed: 6, ranged: true, projectile: 'fire', weight: 18, traits: ['area'], special: 'Fire pots burst over 1.3 tiles.' },
  spitter: { name: 'Crystal Spitter', home: 'mines', areas: [1, 3], role: 'Spits crystal shards from afar and keeps its distance.', color: '#9b6bd1', hp: 16, min: 3, max: 6, speed: 1.9, radius: 0.35, range: 6, cooldown: 1.7, windup: 0.35, aggro: 8, echo: 6, projectileSpeed: 7, ranged: true, projectile: 'spit', weight: 18 },
  spider: { name: 'Cave Spider', home: 'mines', areas: [2, 3], role: 'Shoots webs from the dark and keeps its distance.', color: '#3e3a4d', hp: 18, min: 2, max: 4, speed: 3.4, radius: 0.35, range: 5, cooldown: 1.8, windup: 0.3, aggro: 7, echo: 6, projectileSpeed: 8, ranged: true, projectile: 'web', weight: 16, traits: ['slows'], slow: 2, special: 'Its web slows you for 2 seconds.' },
  skeleton: { name: 'Skeleton Miner', home: 'mines', areas: [2, 3], role: 'A slow, armoured dead miner with a pick.', color: '#cfc6b0', hp: 26, min: 5, max: 8, speed: 2.2, radius: 0.4, reach: 1.1, cooldown: 1.3, windup: 0.4, aggro: 7, echo: 7, armour: 4, weight: 16, traits: ['arrowResistant'], special: 'Arrows do half damage.' },
  ghoul: { name: 'Ghoul', home: 'mines', areas: [2, 3], role: 'Quick claws and a hunger for the living.', color: '#7a8f6e', hp: 28, min: 5, max: 9, speed: 3.0, radius: 0.4, reach: 1.0, cooldown: 1.2, windup: 0.35, aggro: 8, echo: 8, weight: 14, traits: ['stuns'], special: 'Its claws stun for 0.6 seconds.' },
  ooze: { name: 'Rust Ooze', home: 'mines', areas: [2, 3], role: 'Slow and tough; it oozes after you.', color: '#a5552e', hp: 40, min: 4, max: 7, speed: 1.2, radius: 0.5, reach: 0.9, cooldown: 1.6, windup: 0.5, aggro: 5, echo: 8, armour: 2, weight: 10, traits: ['corrodes'], special: 'Eats 3 of your armour for 10 seconds.' },
  brute: { name: 'Tunnel Brute', home: 'mines', areas: [2, 3], role: 'Slow, strong and armoured.', color: '#8a3a2f', hp: 38, min: 6, max: 10, speed: 1.7, radius: 0.5, reach: 1.1, cooldown: 1.5, windup: 0.5, aggro: 6, echo: 9, armour: 6, itemChance: 0.3, weight: 12 },
  troll: { name: 'Cave Troll', home: 'mines', areas: [3, 3], role: 'Huge, hits hard and takes a lot to bring down.', color: '#4f6b4a', hp: 70, min: 9, max: 15, speed: 2.0, radius: 0.6, reach: 1.4, cooldown: 1.8, windup: 0.6, aggro: 7, echo: 14, armour: 4, itemChance: 0.4, weight: 6, traits: ['regenerates'], special: 'Heals 2 % of its life per second – unless an Echo Bolt hit it in the last 5 seconds.' },
  foreman: { name: 'The Foreman', home: 'mines', role: 'The Warden of the mines: a slam around him; calls Gnawers.', color: '#b0602d', hp: 300, min: 10, max: 18, speed: 1.5, radius: 0.9, reach: 2.4, cooldown: 2.4, windup: 0.85, aggro: 9, echo: 120, armour: 10, summonEvery: 14, summonMax: 6, warden: true },
  // The Broken City
  sewer_rat: { name: 'Sewer Rat', home: 'city', areas: [1, 2], role: 'Fast and weak; swarms out of the drains.', color: '#7d6f62', hp: 9, min: 2, max: 4, speed: 3.4, radius: 0.3, reach: 0.9, cooldown: 0.9, windup: 0.25, aggro: 7, echo: 3, weight: 34 },
  hound: { name: 'Feral Hound', home: 'city', areas: [1, 3], role: 'Very fast; runs in packs.', color: '#8b6a45', hp: 16, min: 3, max: 6, speed: 4.0, radius: 0.35, reach: 1.0, cooldown: 0.9, windup: 0.25, aggro: 9, echo: 5, weight: 24, traits: ['pack'], special: 'Hits 20 % harder for every other hound within 3 tiles.' },
  cutthroat: { name: 'Cutthroat', home: 'city', areas: [1, 3], role: 'A bandit with two blades; quick and nasty.', color: '#6b5b7a', hp: 22, min: 5, max: 8, speed: 3.2, radius: 0.36, reach: 1.1, cooldown: 0.9, windup: 0.3, aggro: 8, echo: 6, weight: 22, traits: ['dodges'], special: 'Sidesteps a blow now and then.' },
  bandit_archer: { name: 'Bandit Archer', home: 'city', areas: [1, 3], role: 'Shoots from rubble and windows; keeps away.', color: '#5f7a52', hp: 18, min: 4, max: 8, speed: 2.6, radius: 0.34, range: 7, cooldown: 1.6, windup: 0.4, aggro: 9, echo: 6, projectileSpeed: 11, ranged: true, projectile: 'arrow', weight: 18 },
  hollow: { name: 'Hollow', home: 'city', areas: [1, 3], role: 'The slow dead of the city, in large groups.', color: '#8c8c7a', hp: 30, min: 4, max: 7, speed: 1.6, radius: 0.4, reach: 1.0, cooldown: 1.4, windup: 0.5, aggro: 6, echo: 6, weight: 22, traits: ['rises'], special: 'Rises once with 40 % of its life.' },
  cultist: { name: 'Cultist of the Maw', home: 'city', areas: [2, 3], role: 'Hurls Echo from afar.', color: '#7a2f5a', hp: 20, min: 5, max: 9, speed: 2.4, radius: 0.35, range: 7, cooldown: 2.0, windup: 0.5, aggro: 8, echo: 8, projectileSpeed: 9, ranged: true, projectile: 'bolt', weight: 14, traits: ['heals'], special: 'Heals the monsters around it every 6 seconds. Kill it first.' },
  gargoyle: { name: 'Gargoyle', home: 'city', areas: [2, 3], role: 'Stone skin; hard to hurt.', color: '#6e6e74', hp: 36, min: 6, max: 10, speed: 2.6, radius: 0.45, reach: 1.1, cooldown: 1.4, windup: 0.45, aggro: 5, echo: 9, armour: 8, weight: 12, traits: ['ambush'], special: 'Stands still as a statue until you are within 3 tiles.' },
  harpy: { name: 'Harpy', home: 'city', areas: [2, 4], role: 'Fast and screeching; dives at you.', color: '#a58a5a', hp: 20, min: 4, max: 7, speed: 3.8, radius: 0.38, reach: 1.0, cooldown: 1.0, windup: 0.3, aggro: 9, echo: 7, weight: 12, traits: ['flies', 'slows'], slow: 1.5, special: 'Flies over rubble; its shriek slows you for 1.5 seconds.' },
  golem: { name: 'Scrap Golem', home: 'city', areas: [3, 4], role: 'A slow, heavily armoured heap of iron from the factories.', color: '#7a6a5a', hp: 60, min: 8, max: 14, speed: 1.4, radius: 0.6, reach: 1.3, cooldown: 1.8, windup: 0.6, aggro: 6, echo: 12, armour: 10, itemChance: 0.35, weight: 10, traits: ['echoWeak'], special: 'Echo Bolt does double damage.' },
  wraith: { name: 'Wraith', home: 'city', areas: [3, 4], role: 'A fast shade of the foundry\'s dead.', color: '#5a6b8a', hp: 34, min: 6, max: 11, speed: 3.2, radius: 0.4, reach: 1.1, cooldown: 1.2, windup: 0.35, aggro: 9, echo: 11, weight: 10, traits: ['drains'], special: 'Drains 20 stamina and 8 focus with every blow.' },
  smelter: { name: 'The Smelter', home: 'city', role: 'The Warden of the city: a slam around him; calls rats.', color: '#c4572a', hp: 300, min: 10, max: 18, speed: 1.5, radius: 0.9, reach: 2.4, cooldown: 2.4, windup: 0.85, aggro: 9, echo: 120, armour: 10, summonEvery: 14, summonMax: 6, warden: true },
};

const RIVALS: RivalDef[] = [
  { id: 'cassian', name: 'Cassian Morrow', weapon: 'heavy', levelOffset: 1, aggression: 0.9, color: '#d9534f' },
  { id: 'vessa', name: 'Vessa Thorne', weapon: 'bows', levelOffset: 0, aggression: 0.35, color: '#5cb85c' },
  { id: 'ash', name: 'Ash Kell', weapon: 'blades', levelOffset: 0, aggression: 0.6, color: '#e3a04b' },
  { id: 'rook', name: 'Rook Kell', weapon: 'blades', levelOffset: 0, aggression: 0.6, color: '#c98b3a' },
  { id: 'mira', name: 'Mira Silvertongue', weapon: 'echo', levelOffset: 0, aggression: 0.2, color: '#b48ce0' },
  { id: 'odo', name: 'Silent Odo', weapon: 'blades', levelOffset: 0, aggression: 0.15, color: '#8fa3b8' },
  { id: 'garrick', name: 'Garrick Vane', weapon: 'heavy', levelOffset: 1, aggression: 0.8, color: '#4a7fc9' },
];

const SKILL_WEIGHTS: Record<SkillId, Partial<Record<Attribute, number>>> = {
  blades: { dexterity: 0.7, strength: 0.3 },
  heavy: { strength: 0.8, constitution: 0.2 },
  bows: { dexterity: 0.7, strength: 0.3 },
  echo: { intelligence: 0.8, stamina: 0.2 },
};

/** Feature-010: de steder, en Tithe kan være i. */
export type ReachId = 'mines' | 'city';

export const BALANCE = {
  character: {
    startAttribute: 10,
    startGold: 60,
    startPotions: 2,
    startRations: 3,
    maxConsumables: 9,
    baseHp: 40,
    hpPerConstitution: 6,
    hpPerMark: 4,
    hpRegen: 0.3,
    baseStamina: 60,
    staminaPerStamina: 5,
    staminaRegen: 14,
    staminaRegenPerStamina: 0.7,
    baseFocus: 20,
    focusPerIntelligence: 4,
    focusRegen: 2.5,
    focusRegenPerIntelligence: 0.15,
    moveSpeed: 4.2,
    critChance: 0.05,
    critPerDexterity: 0.005,
    critMultiplier: 1.6,
    baseCapacity: 12,
    capacityPerTwoStrength: 1,
  },
  backgrounds: BACKGROUNDS,
  /** Feature-001: egenskaberne giver tilsammen 55 og skills 16; navnet er højst 20 tegn. */
  creation: { attributeTotal: 55, skillTotal: 16, nameMax: 20 },
  /** Feature-003: 300 × Mark^1,5 Echo pr. Mark, højst Mark 20. */
  marks: { echoBase: 300, echoExponent: 1.5, attributePoints: 3, skillPoints: 2, max: 20 },
  skills: {
    max: 100,
    levelsPerPoint: 2,
    /** Feature-002: 20 + 4 × niveau + 0,2 × niveau² erfaring pr. niveau. */
    xpBase: 20,
    xpPerLevel: 4,
    xpPerLevelSquared: 0.2,
    /** Feature-002: Mark'en sætter loftet over alle skills: 10 + 5 × Mark. */
    capBase: 10,
    capPerMark: 5,
    /** Feature-007: et magisk våben hæver sin skill cap med 10, et sjældent med 20; uden våben er loftet 20. */
    weaponCapBonus: { common: 0, magic: 10, rare: 20 },
    unarmedCap: 20,
    xpPerHit: 1,
    xpPerKill: 3,
    maxHitsPerSwing: 3,
    challengeMin: 0.25,
    challengeMax: 1.5,
    learningPerIntelligence: 0.02,
    attributeBonus: 1.5,
    damagePerSkill: 0.015,
    speedPerSkill: 0.004,
    maxSpeedBonus: 0.35,
    weights: SKILL_WEIGHTS,
  },
  hunger: { max: 100, drainPerSecond: 0.25, drainReductionPerStamina: 0.02, rationRestores: 45, starvingStaminaRegen: 0.4 },
  combat: {
    armourFactor: 50,
    dodgeDistance: 3,
    dodgeTime: 0.18,
    dodgeCost: 20,
    dodgeCooldown: 0.6,
    potionHeal: 0.4,
    potionCooldown: 1,
    arrowSpeed: 13,
    echoBolt: { min: 6, max: 10, focusCost: 8, cooldown: 0.55, range: 8, speed: 11 },
    unarmed: { min: 1, max: 3, reach: 1, cooldown: 0.4, stamina: 3, arc: 80 },
    /** Feature-028: et våben trækkes på 0,3 sekunder, og imens kan kandidaten ikke slå. */
    drawTime: 0.3,
  },
  monsters: {
    levelPerDepth: 1,
    /** Feature-011: liv +40 % og skade +30 % pr. level; grundværdierne er 40 % og 25 % højere end i prototypen. */
    hpPerLevel: 0.4,
    damagePerLevel: 0.3,
    hpFactor: 1.4,
    damageFactor: 1.25,
    /** Et monsters level er områdets −1 til +2; ca. 8 % er Veterans, 3 levels over området. */
    levelSpread: [-1, 2] as [number, number],
    veteranChance: 0.08,
    veteranLevels: 3,
    /** Feature-013: særprægenes tal. */
  traits: {
    fleeBelow: 0.25,
    areaRadius: 1.3,
    slowFactor: 0.6,
    stunSeconds: 0.6,
    corrodeArmour: 3,
    corrodeSeconds: 10,
    regenPerSecond: 0.02,
    regenStopSeconds: 5,
    packPerHound: 0.2,
    packMax: 0.6,
    packRange: 3,
    dodgeChance: 0.3,
    dodgeCooldown: 3,
    riseLife: 0.4,
    healEvery: 6,
    healShare: 0.15,
    healRange: 5,
    ambushRange: 3,
    echoWeakFactor: 2,
    arrowFactor: 0.5,
    drainStamina: 20,
    drainFocus: 8,
  },
  /** Feature-013: 2–5 monstre pr. rum i minerne og grupper i gangene. */
    perRoom: [2, 5] as [number, number],
    extraPerDepth: 1,
    corridorGroups: 4,
    types: MONSTERS,
  },
  loot: {
    goldChance: 0.4,
    goldPerLevel: [2, 6] as [number, number],
    itemChance: 0.12,
    consumableChance: 0.15,
    rarity: { magic: 0.28, rare: 0.07, perDepth: 0.03 },
    cachesPerDepth: 2,
  },
  items: {
    sellFactor: 0.3,
    damagePerItemLevel: 0.08,
    armourPerItemLevel: 0.1,
    pricePerItemLevel: 0.15,
    rarityPrice: { common: 1, magic: 2.2, rare: 4 },
    bases: ITEM_BASES,
    affixes: AFFIXES,
  },
  tithe: {
    depths: 3,
    /** Feature-010: 8 kandidater, spillere og NPC-rivaler. */
    candidates: 8,
    graceSeconds: 20,
    /** Feature-014: en fjendtlig NPC-rival angriber spillere inden for 6 felter. */
    rivalHuntRange: 6,
    /** Feature-029: en mistet forbindelse tæller som at forlade Tithen efter 60 sekunder. */
    reconnectSeconds: 60,
    rivalSpeed: 3.4,
    rivalHpBase: 100,
    rivalHpPerLevel: 16,
    rivalSkillPerLevel: 6,
    rivalArmour: 10,
    rivalSecondsPerDepth: 110,
    abstractWardenFight: 20,
    rivalWinChanceBase: 0.15,
    rivalWinChancePerLevel: 0.04,
    rivalWinChanceMax: 0.7,
    wardenWoundedFactor: 0.75,
    rivals: RIVALS,
  },
  mirrormaster: {
    sealTimes: [240, 480],
    minTimeOnEntry: 90,
    sealWarning: 30,
    sealDamagePerSecond: 0.03,
    boredAfter: 40,
    boredGnawers: 4,
    streakKills: 3,
    streakWindow: 8,
    sponsorCooldown: 30,
  },
  renown: { perMonsterLevel: 2, rival: 60, warden: 150, streak: 15, depth: 20 },
  rim: {
    forgeItems: 7,
    forgeRareChance: 0.1,
    potionPrice: 25,
    rationPrice: 10,
    purse: { perDepth: 40, warden: 150, perRenown: 0.3, champion: 300, fallFactor: 0.5 },
    giftPerRenown: 100,
    maxGifts: 4,
    giftGold: 40,
    houses: ['House Morrow', 'House Vane', 'House Ashgrave', 'House Lisle'],
    /** Besluttet 2026-11-18 (Feature-009): et fald koster det, der blev fundet i Tithen. */
    fallPenalty: 'lose-found' as 'lose-found' | 'none',
  },
  view: { visionRadius: 7 },
  /** Feature-010 og -036: stederne, en Tithe kan åbnes i. */
  reaches: [
    { id: 'mines', number: 1, name: 'The Old Mines', text: 'Three depths of tunnels and halls. The Foreman waits at the bottom.' },
    { id: 'city', number: 2, name: 'The Broken City', text: 'One great ruin of streets, houses and factories. The Smelter holds the foundry in the middle.' },
  ] as { id: ReachId; number: number; name: string; text: string }[],
  /** Feature-010, -017, -041: The Broken City. */
  city: {
    blocks: 7,
    block: 16,
    districts: 4,
    /** Yderringen forsegles efter 240 sekunder, den næste efter 420 og den tredje efter 600; støberiet aldrig. */
    sealTimes: [480, 840, 1200],
    wards: ['the outer ward', 'the second ward', 'the third ward', 'the foundry'],
    /** Rivalerne krydser byen på omtrent den tid, minernes tre dybder tager. */
    rivalDepths: 6,
    /** Rivalerne har mere liv i byen, hvor gaderne er fulde af monstre. */
    rivalHpFactor: 1.6,
    cachesOnGround: 8,
    monstersPerHouse: [1, 3] as [number, number],
    streetPacks: 40,
  },
  /** Feature-036 og -025: navnet på en Tithe og pladserne i den. */
  lobby: { nameMin: 3, nameMax: 30, maxPlayers: 8 },
};

export type Balance = typeof BALANCE;
