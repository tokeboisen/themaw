// Balance: alle tal, der styrer spillet. Startværdier fra prototypen (prototype/balance.js), som playtest justerer.
// Reglerne i Event Modellen nævner de samme tal; ændres et tal, der står i en feature, ændres featuren først.
// Tider er i sekunder, afstande i felter (tiles), og en egenskab starter på 10.

import type { EchoArt } from './gear.ts';
import type { AffixDef, Attribute, Background, CreationSkill, ItemBase, Range, SkillId, TalentId } from './types.ts';

// Egenskaber i rækkefølgen Strength, Dexterity, Stamina, Constitution, Intelligence; skills i rækkefølgen Blades,
// Heavy Weapons, Bows, Echo Arts. Et tal er en værdi, et par er [minimum, maksimum].
function attrs(str: number, dex: number, sta: number, con: number, int: number): Record<Attribute, number>;
function attrs(str: [number, number], dex: [number, number], sta: [number, number], con: [number, number], int: [number, number]): Record<Attribute, Range>;
function attrs(...v: (number | [number, number])[]): Record<Attribute, number | Range> {
  const keys: Attribute[] = ['strength', 'dexterity', 'stamina', 'constitution', 'intelligence'];
  return Object.fromEntries(keys.map((k, i) => [k, toValue(v[i]!)])) as Record<Attribute, number | Range>;
}
function skills(blades: number, heavy: number, bows: number, echo: number): Record<CreationSkill, number>;
function skills(blades: [number, number], heavy: [number, number], bows: [number, number], echo: [number, number]): Record<CreationSkill, Range>;
function skills(...v: (number | [number, number])[]): Record<CreationSkill, number | Range> {
  const keys: CreationSkill[] = ['blades', 'heavy', 'bows', 'echo'];
  return Object.fromEntries(keys.map((k, i) => [k, toValue(v[i]!)])) as Record<CreationSkill, number | Range>;
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
  home?: 'mines' | 'city' | 'woods';
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
  weapon: CreationSkill;
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
    talent: 'berserk',
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
    talent: 'haste',
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
    talent: 'healing',
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
    talent: 'hide',
  },
];

const ITEM_BASES: Record<string, ItemBase> = {
  dagger: { name: 'Dagger', slot: 'weapon', skill: 'blades', min: 3, max: 5, reach: 1.1, cooldown: 0.32, stamina: 4, arc: 80, price: 18, weight: 1 },
  rusty_sword: { name: 'Rusty Sword', slot: 'weapon', skill: 'blades', min: 4, max: 7, reach: 1.3, cooldown: 0.45, stamina: 6, arc: 100, price: 20, weight: 2.5 },
  short_sword: { name: 'Short Sword', slot: 'weapon', skill: 'blades', min: 6, max: 10, reach: 1.35, cooldown: 0.48, stamina: 7, arc: 100, price: 45, minLevel: 2, reqSkill: 8, reqAttribute: 11, weight: 3 },
  pickaxe: { name: 'Pickaxe', slot: 'weapon', skill: 'heavy', min: 7, max: 12, reach: 1.45, cooldown: 0.8, stamina: 12, arc: 140, price: 22, weight: 4 },
  war_axe: { name: 'War Axe', slot: 'weapon', skill: 'heavy', min: 10, max: 16, reach: 1.5, cooldown: 0.85, stamina: 13, arc: 140, price: 55, minLevel: 2, reqSkill: 10, reqAttribute: 13, weight: 6 },
  maul: { name: 'Maul', slot: 'weapon', skill: 'heavy', min: 14, max: 22, reach: 1.55, cooldown: 1.05, stamina: 16, arc: 150, price: 80, minLevel: 3, reqSkill: 18, reqAttribute: 16, weight: 9 },
  short_bow: { name: 'Short Bow', slot: 'weapon', skill: 'bows', min: 4, max: 8, range: 7, cooldown: 0.6, stamina: 5, price: 25, weight: 1.5 },
  hunting_bow: { name: 'Hunting Bow', slot: 'weapon', skill: 'bows', min: 6, max: 11, range: 8, cooldown: 0.65, stamina: 6, price: 60, minLevel: 2, reqSkill: 10, reqAttribute: 13, weight: 2 },
  fine_dagger: { name: 'Fine Dagger', slot: 'weapon', skill: 'blades', min: 5, max: 8, reach: 1.15, cooldown: 0.3, stamina: 4, arc: 80, price: 90, minLevel: 5, reqSkill: 20, reqAttribute: 16, weight: 1 },
  longsword: { name: 'Longsword', slot: 'weapon', skill: 'blades', min: 9, max: 15, reach: 1.45, cooldown: 0.5, stamina: 8, arc: 110, price: 140, minLevel: 6, reqSkill: 26, reqAttribute: 15, weight: 4 },
  greataxe: { name: 'Greataxe', slot: 'weapon', skill: 'heavy', min: 18, max: 28, reach: 1.6, cooldown: 1.1, stamina: 18, arc: 150, price: 190, minLevel: 8, reqSkill: 32, reqAttribute: 20, weight: 10 },
  longbow: { name: 'Longbow', slot: 'weapon', skill: 'bows', min: 9, max: 15, range: 9, cooldown: 0.7, stamina: 7, price: 150, minLevel: 6, reqSkill: 26, reqAttribute: 17, weight: 2.5 },
  padded_coat: { name: 'Padded Coat', slot: 'armour', armour: 4, price: 12, weight: 4 },
  leather_jerkin: { name: 'Leather Jerkin', slot: 'armour', armour: 7, price: 25, reqAttribute: 9, weight: 6 },
  mail_shirt: { name: 'Mail Shirt', slot: 'armour', armour: 14, price: 60, minLevel: 2, reqAttribute: 13, weight: 12 },
  scale_coat: { name: 'Scale Coat', slot: 'armour', armour: 22, price: 95, minLevel: 4, reqAttribute: 17, weight: 16 },
  iron_ring: { name: 'Iron Ring', slot: 'ring', price: 30, weight: 0.1 },
  bone_ring: { name: 'Bone Ring', slot: 'ring', price: 30, weight: 0.1 },
  // Feature-007: amuletter, aldrig almindelige.
  silver_amulet: { name: 'Silver Amulet', slot: 'amulet', price: 45, weight: 0.2 },
  bone_amulet: { name: 'Bone Amulet', slot: 'amulet', price: 45, weight: 0.2 },
};

const ALL: ItemBase['slot'][] = ['weapon', 'armour', 'ring', 'amulet'];
/**
 * Feature-007: små affixes, der vokser langsomt med item level – karakteren skal bære spillet, ikke udstyret. % damage
 * findes kun på våben.
 */
const AFFIXES: Record<string, AffixDef> = {
  strength: { label: 'Strength', prefix: 'Mighty', suffix: 'of the Ox', min: 1, max: 2, perLevel: 0.15, slots: ALL },
  dexterity: { label: 'Dexterity', prefix: 'Nimble', suffix: 'of the Fox', min: 1, max: 2, perLevel: 0.15, slots: ALL },
  stamina: { label: 'Stamina', prefix: 'Tireless', suffix: 'of the Mule', min: 1, max: 2, perLevel: 0.15, slots: ALL },
  constitution: { label: 'Constitution', prefix: 'Sturdy', suffix: 'of the Bear', min: 1, max: 2, perLevel: 0.15, slots: ['armour', 'ring', 'amulet'] },
  intelligence: { label: 'Intelligence', prefix: 'Clever', suffix: 'of the Owl', min: 1, max: 2, perLevel: 0.15, slots: ALL },
  damagePct: { label: '% Damage', prefix: 'Cruel', suffix: 'of Slaughter', min: 3, max: 6, perLevel: 0.5, slots: ['weapon'] },
  maxHp: { label: 'Life', prefix: 'Vital', suffix: 'of Life', min: 3, max: 6, perLevel: 1, slots: ['armour', 'ring'] },
  armour: { label: 'Armour', prefix: 'Reinforced', suffix: 'of Iron', min: 1, max: 3, perLevel: 0.3, slots: ['armour', 'ring', 'amulet'] },
  skill: { label: 'to weapon skill', prefix: 'Masterwork', suffix: 'of the Adept', min: 1, max: 2, perLevel: 0.15, slots: ['weapon'] },
  echoGain: { label: '% Echo gained', prefix: 'Hungry', suffix: 'of the Maw', min: 3, max: 6, perLevel: 0.4, slots: ['armour', 'ring'] },
  // Feature-007: amuletter – + til én skill og de sjældne amuletters kræfter.
  skillBonus: { label: 'to a skill', prefix: 'Learned', suffix: 'of Lore', min: 1, max: 2, perLevel: 0.15, slots: ['amulet'] },
  haste: { label: '% Haste', prefix: 'Quickened', suffix: 'of Haste', min: 5, max: 5, perLevel: 4.5, cap: 50, slots: ['amulet'], rareOnly: true },
  speed: { label: '% Speed', prefix: 'Fleet', suffix: 'of the Wind', min: 5, max: 5, perLevel: 4.5, cap: 50, slots: ['amulet'], rareOnly: true },
  lifeRegen: { label: 'life a second', prefix: 'Mending', suffix: 'of Mending', min: 1, max: 1, perLevel: 0.3, slots: ['amulet'], rareOnly: true },
  staminaRegen: { label: 'stamina a second', prefix: 'Untiring', suffix: 'of Breath', min: 2, max: 2, perLevel: 0.5, slots: ['amulet'], rareOnly: true },
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
  brute: { name: 'Tunnel Brute', home: 'mines', areas: [2, 3], role: 'Slow, strong and armoured.', color: '#8a3a2f', hp: 38, min: 6, max: 10, speed: 1.7, radius: 0.5, reach: 1.1, cooldown: 1.5, windup: 0.5, aggro: 6, echo: 9, armour: 6, itemChance: 0.15, weight: 12 },
  troll: { name: 'Cave Troll', home: 'mines', areas: [3, 3], role: 'Huge, hits hard and takes a lot to bring down.', color: '#4f6b4a', hp: 70, min: 9, max: 15, speed: 2.0, radius: 0.6, reach: 1.4, cooldown: 1.8, windup: 0.6, aggro: 7, echo: 14, armour: 4, itemChance: 0.15, weight: 6, traits: ['regenerates'], special: 'Heals 2 % of its life per second – unless an Echo Bolt hit it in the last 5 seconds.' },
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
  golem: { name: 'Scrap Golem', home: 'city', areas: [3, 4], role: 'A slow, heavily armoured heap of iron from the factories.', color: '#7a6a5a', hp: 60, min: 8, max: 14, speed: 1.4, radius: 0.6, reach: 1.3, cooldown: 1.8, windup: 0.6, aggro: 6, echo: 12, armour: 10, itemChance: 0.15, weight: 10, traits: ['echoWeak'], special: 'Echo Bolt does double damage.' },
  wraith: { name: 'Wraith', home: 'city', areas: [3, 4], role: 'A fast shade of the foundry\'s dead.', color: '#5a6b8a', hp: 34, min: 6, max: 11, speed: 3.2, radius: 0.4, reach: 1.1, cooldown: 1.2, windup: 0.35, aggro: 9, echo: 11, weight: 10, traits: ['drains'], special: 'Drains 20 stamina and 8 focus with every blow.' },
  smelter: { name: 'The Smelter', home: 'city', role: 'The Warden of the city: a slam around him; calls rats.', color: '#c4572a', hp: 300, min: 10, max: 18, speed: 1.5, radius: 0.9, reach: 2.4, cooldown: 2.4, windup: 0.85, aggro: 9, echo: 120, armour: 10, summonEvery: 14, summonMax: 6, warden: true },
  // Reach 3, The Woods (Feature-011, -013): ulve og vildsvin, brigander ved bålene, levende krat og de døde fra gravhøjene.
  grey_wolf: { name: 'Grey Wolf', home: 'woods', areas: [1, 3], role: 'Fast; hunts in packs.', color: '#8994a1', hp: 14, min: 3, max: 6, speed: 3.9, radius: 0.35, reach: 1.0, cooldown: 0.9, windup: 0.25, aggro: 9, echo: 4, weight: 26, traits: ['pack'], special: 'Hits 20 % harder for every other wolf within 3 tiles.' },
  brigand: { name: 'Brigand', home: 'woods', areas: [1, 4], role: 'An outlaw with a hatchet; quick on the feet.', color: '#774c26', hp: 22, min: 5, max: 8, speed: 3.1, radius: 0.36, reach: 1.1, cooldown: 1.0, windup: 0.3, aggro: 8, echo: 6, weight: 18, traits: ['dodges'], special: 'Sidesteps a blow now and then.' },
  brigand_archer: { name: 'Brigand Archer', home: 'woods', areas: [1, 4], role: 'Shoots from between the trees; keeps away.', color: '#52663d', hp: 18, min: 4, max: 8, speed: 2.6, radius: 0.34, range: 7, cooldown: 1.6, windup: 0.4, aggro: 9, echo: 6, projectileSpeed: 11, ranged: true, projectile: 'arrow', weight: 14 },
  wild_boar: { name: 'Wild Boar', home: 'woods', areas: [1, 3], role: 'Charges headlong; a tough hide.', color: '#5c3727', hp: 30, min: 5, max: 9, speed: 3.4, radius: 0.42, reach: 1.0, cooldown: 1.3, windup: 0.4, aggro: 7, echo: 7, armour: 2, weight: 14, traits: ['stuns'], special: 'Its charge knocks you down for 0.6 seconds.' },
  thornling: { name: 'Thornling', home: 'woods', areas: [1, 3], role: 'A small knot of living briar; comes in swarms.', color: '#3f5232', hp: 12, min: 3, max: 5, speed: 3.0, radius: 0.3, reach: 0.9, cooldown: 0.9, windup: 0.25, aggro: 7, echo: 3, weight: 20, traits: ['slows'], slow: 1.5, special: 'Its thorns slow you for 1.5 seconds.' },
  bog_wisp: { name: 'Bog Wisp', home: 'woods', areas: [2, 4], role: 'A drifting light that spits cold fire from afar.', color: '#9ad1c0', hp: 16, min: 4, max: 7, speed: 2.4, radius: 0.32, range: 6, cooldown: 1.8, windup: 0.4, aggro: 8, echo: 7, projectileSpeed: 8, ranged: true, projectile: 'bolt', weight: 12, traits: ['flies', 'drains'], special: 'Flies over furniture; drains 20 stamina and 8 focus.' },
  mossback_bear: { name: 'Mossback Bear', home: 'woods', areas: [2, 4], role: 'Huge and slow to anger; hits like a falling tree.', color: '#523419', hp: 60, min: 9, max: 14, speed: 2.4, radius: 0.6, reach: 1.3, cooldown: 1.7, windup: 0.55, aggro: 6, echo: 12, armour: 4, itemChance: 0.15, weight: 9 },
  barrow_wight: { name: 'Barrow Wight', home: 'woods', areas: [2, 4], role: 'A dead lord from the old barrows.', color: '#a09284', hp: 32, min: 6, max: 10, speed: 2.2, radius: 0.4, reach: 1.1, cooldown: 1.3, windup: 0.45, aggro: 7, echo: 9, armour: 3, weight: 11, traits: ['rises'], special: 'Rises once with 40 % of its life.' },
  briar_treant: { name: 'Briar Treant', home: 'woods', areas: [3, 4], role: 'A walking thicket; slow, and hard to cut down.', color: '#34452a', hp: 75, min: 9, max: 15, speed: 1.3, radius: 0.6, reach: 1.4, cooldown: 1.9, windup: 0.6, aggro: 6, echo: 14, armour: 4, itemChance: 0.15, weight: 7, traits: ['regenerates', 'arrowResistant'], special: 'Heals 2 % of its life per second unless an Echo Bolt hit it in the last 5 seconds; arrows do half damage.' },
  fen_witch: { name: 'Fen Witch', home: 'woods', areas: [3, 4], role: 'Hurls bog-fire from afar and mends the beasts around it.', color: '#6b2420', hp: 22, min: 5, max: 9, speed: 2.4, radius: 0.35, range: 7, cooldown: 2.0, windup: 0.5, aggro: 8, echo: 9, projectileSpeed: 9, ranged: true, projectile: 'fire', weight: 8, traits: ['heals'], special: 'Heals the monsters around it every 6 seconds. Kill it first.' },
  antlered_king: { name: 'The Antlered King', home: 'woods', role: 'The Warden of the woods: a slam around it; calls Grey Wolves.', color: '#8c6420', hp: 300, min: 10, max: 18, speed: 1.6, radius: 0.9, reach: 2.4, cooldown: 2.4, windup: 0.85, aggro: 9, echo: 120, armour: 10, summonEvery: 14, summonMax: 6, warden: true },
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
  // Feature-049: et talents attributter står på talentet (TALENTS) og afhænger af baggrunden.
  talent: {},
  // Feature-050: Reveal får sin bonus fra Intelligence.
  reveal: { intelligence: 1 },
};

/** Feature-049: et talent – hvad det koster, hvor længe det venter, og hvilke attributter giver det bonus. */
export interface TalentDef {
  name: string;
  /** Den baggrund, der har talentet. */
  background: string;
  resource: 'focus' | 'stamina';
  cost: number;
  cooldown: number;
  weights: Partial<Record<Attribute, number>>;
  /** Spellbookens korte tekst. */
  text: string;
}

/** Feature-049: tallene står også i featurens regler (s = det effektive talent-niveau). */
const TALENTS: Record<TalentId, TalentDef> = {
  hide: { name: 'Hide', background: 'runner', resource: 'focus', cost: 12, cooldown: 12, weights: { dexterity: 0.6, intelligence: 0.4 },
    text: 'Fade from sight, also in plain sight: 50 + s % transparent for 5 + 0.2 × s seconds. Striking ends it.' },
  berserk: { name: 'Berserk', background: 'miner', resource: 'stamina', cost: 25, cooldown: 20, weights: { strength: 0.6, constitution: 0.4 },
    text: 'Rage: melee blows reach 20 + s % farther and swing wider, up to all around you, for 6 + 0.1 × s seconds.' },
  haste: { name: 'Haste', background: 'poacher', resource: 'stamina', cost: 20, cooldown: 18, weights: { dexterity: 0.6, stamina: 0.4 },
    text: 'Move, shoot and send arrows 15 + 0.5 × s % faster for 6 + 0.1 × s seconds.' },
  healing: { name: 'Healing Circle', background: 'acolyte', resource: 'focus', cost: 18, cooldown: 15, weights: { intelligence: 0.7, constitution: 0.3 },
    text: 'A glowing circle that heals you and your party in it by 15 + 0.5 × s % of max life over 5 seconds.' },
};

/** Feature-047: hvad en Echo Art er: skade, forsvar, kontrol, bevægelse eller for partiet. */
export type EchoArtKind = 'damage' | 'defence' | 'control' | 'movement' | 'party';

/**
 * Feature-047: en Echo Art – level 1–9, fokus, cooldown og tallene for dens virkning. Skaden vokser med Echo Arts som
 * Echo Bolts. `text` er spellbookens korte beskrivelse (Feature-048).
 */
export interface EchoArtDef {
  level: number;
  kind: EchoArtKind;
  focus: number;
  cooldown: number;
  text: string;
  min?: number;
  max?: number;
  /** Hvor langt væk et sted eller et mål må være. */
  range?: number;
  /** Områdets radius, eller hvor langt et billede eller ekko trækker monstre. */
  radius?: number;
  /** Sekunder, virkningen varer. */
  seconds?: number;
  /** Styrken: en andel, rustning, udholdenhed eller skade i sekundet. */
  value?: number;
  /** Sekunder for en Warden (Toll of Stillness, The Maw Holds Its Breath). */
  warden?: number;
  /** Hunger of the Maw: keglens bredde i grader. */
  arc?: number;
  /** Echo Chain: hvor mange gange den springer videre. */
  jumps?: number;
  /** Cinder Echo: hvor længe flammerne brænder; The Maw Remembers: hvor længe et drab huskes. */
  linger?: number;
  /** The Maw Remembers: radius for ekkoets skade. */
  hitRadius?: number;
  /** Crown of Echoes: andel af max liv tilbage i sekundet og Renown til den, der kaster. */
  regen?: number;
  renown?: number;
}

/** Feature-047: tallene står også i featurens regler; ændres et, ændres featuren først. */
const ECHO_ART_DEFS: Record<EchoArt, EchoArtDef> = {
  'Echo Bolt': { level: 1, kind: 'damage', focus: 8, cooldown: 0.55, text: 'A bolt of Echo that flies 8 tiles at the nearest enemy.' },
  'Ringing Ward': { level: 1, kind: 'defence', focus: 10, cooldown: 8, seconds: 4, value: 0.75, text: 'For 4 s the next blow on you loses 75 % of its damage.' },
  'Hollow Call': { level: 1, kind: 'control', focus: 8, cooldown: 10, range: 7, radius: 6, seconds: 3, text: 'Monsters within 6 tiles of a spot walk to it for 3 s.' },
  'Shared Breath': { level: 1, kind: 'party', focus: 8, cooldown: 12, value: 15, text: '15 stamina back for you and your party.' },
  'Crystal Cage': { level: 2, kind: 'control', focus: 12, cooldown: 10, range: 7, radius: 2, seconds: 3, text: 'Monsters within 2 tiles of a spot are rooted for 3 s.' },
  'Step Through the Echo': { level: 2, kind: 'movement', focus: 10, cooldown: 6, range: 4, text: 'Step up to 4 tiles ahead; walls stop you.' },
  'Rally Toll': { level: 2, kind: 'party', focus: 12, cooldown: 20, seconds: 10, value: 0.15, text: 'You and your party deal 15 % more damage for 10 s.' },
  'Shatterpulse': { level: 3, kind: 'damage', focus: 14, cooldown: 3, min: 10, max: 16, range: 7, radius: 2, text: '10–16 damage within 2 tiles of a spot.' },
  'Mirror Double': { level: 3, kind: 'control', focus: 14, cooldown: 14, range: 2, radius: 8, seconds: 5, text: 'A mirror image draws the monsters within 8 tiles for 5 s.' },
  'Hearth Echo': { level: 3, kind: 'party', focus: 14, cooldown: 18, seconds: 5, value: 0.2, text: 'You and your party heal 20 % of max life over 5 s.' },
  'Hunger of the Maw': { level: 4, kind: 'damage', focus: 16, cooldown: 4, min: 8, max: 12, range: 3, arc: 90, value: 0.3, text: '8–12 damage in a cone ahead; you heal 30 % of it.' },
  'Resonant Line': { level: 4, kind: 'damage', focus: 16, cooldown: 3.5, min: 12, max: 18, range: 8, text: 'A tone that flies 8 tiles: 12–18 to every enemy it passes.' },
  'Chorus of the Branded': { level: 4, kind: 'party', focus: 16, cooldown: 20, seconds: 8, value: 0.2, text: 'You and your party attack 20 % faster for 8 s.' },
  'Toll of Stillness': { level: 5, kind: 'control', focus: 18, cooldown: 12, radius: 3, seconds: 1.5, warden: 0.5, text: 'Monsters within 3 tiles are stunned for 1.5 s.' },
  'Cinder Echo': { level: 5, kind: 'damage', focus: 18, cooldown: 12, seconds: 6, linger: 2, value: 8, text: 'For 6 s you leave flames that burn 8 a second.' },
  'Crystal Mantle': { level: 5, kind: 'party', focus: 18, cooldown: 24, seconds: 15, value: 8, text: 'You and your party get 8 more armour for 15 s.' },
  'Echo Chain': { level: 6, kind: 'damage', focus: 22, cooldown: 5, min: 14, max: 22, range: 7, radius: 4, jumps: 3, text: '14–22 damage that jumps on to 3 more enemies.' },
  'Last Words': { level: 6, kind: 'damage', focus: 20, cooldown: 8, min: 20, max: 30, range: 7, radius: 2.5, seconds: 10, text: 'Marks a monster; when it dies it bursts for 20–30.' },
  "Brand's Refusal": { level: 6, kind: 'party', focus: 22, cooldown: 60, seconds: 60, text: 'For 60 s the next killing blow leaves 1 life instead.' },
  'Mirror Storm': { level: 7, kind: 'damage', focus: 26, cooldown: 30, seconds: 6, value: 1.5, text: 'Three mirror images strike with you: 150 % more damage for 6 s.' },
  'The Maw Remembers': { level: 7, kind: 'control', focus: 26, cooldown: 30, seconds: 8, linger: 5, radius: 4, hitRadius: 1.6, value: 10, text: 'Your kills of the last 5 s rise as echoes that draw and burn monsters.' },
  'Echo of Courage': { level: 7, kind: 'party', focus: 24, cooldown: 30, seconds: 8, value: 0.1, text: 'No slowing or stunning, and 10 % more damage, for 8 s.' },
  'Shatter the Depth': { level: 8, kind: 'damage', focus: 30, cooldown: 10, min: 22, max: 34, radius: 4, seconds: 3, text: '22–34 damage within 4 tiles of you; slows those hit.' },
  'Unmaking Note': { level: 8, kind: 'damage', focus: 30, cooldown: 8, min: 45, max: 65, range: 8, value: 2, text: '45–65 damage to the first enemy hit, double to an armoured one.' },
  'Kindled Brands': { level: 8, kind: 'party', focus: 30, cooldown: 40, value: 0.35, text: 'You and your party heal 35 % of max life and half of max focus.' },
  'The Maw Holds Its Breath': { level: 9, kind: 'control', focus: 36, cooldown: 60, seconds: 3, warden: 1, text: 'Every monster in the area stops for 3 s.' },
  'Requiem of the Tithed': { level: 9, kind: 'damage', focus: 36, cooldown: 25, min: 40, max: 60, radius: 6, text: '40–60 damage within 6 tiles of you.' },
  'Crown of Echoes': { level: 9, kind: 'party', focus: 36, cooldown: 60, seconds: 12, radius: 8, value: 0.25, regen: 0.02, renown: 50, text: '+25 % damage and speed and 2 % life a second for 12 s.' },
};

/** Feature-010: de steder, en Tithe kan være i. */
/** Feature-010: en Reach er et sted; arenaen (Feature-045) er ikke på Tithe Board. */
export type ReachId = 'mines' | 'city' | 'woods' | 'arena';

export const BALANCE = {
  character: {
    startAttribute: 10,
    startGold: 60,
    startPotions: 2,
    /** Feature-005: én focus potion fra start. */
    startFocusPotions: 1,
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
    /** Feature-008 CMD-03: en focus potion giver 40 % af max focus tilbage. */
    focusPotionRestore: 0.4,
    potionCooldown: 1,
    arrowSpeed: 13,
    echoBolt: { min: 6, max: 10, focusCost: 8, cooldown: 0.55, range: 8, speed: 11 },
    unarmed: { min: 1, max: 3, reach: 1, cooldown: 0.4, stamina: 3, arc: 80 },
    /** Feature-028: et våben trækkes på 0,3 sekunder, og imens kan kandidaten ikke slå. */
    drawTime: 0.3,
  },
  /** Feature-047: de 28 Echo Arts. */
  echoArts: ECHO_ART_DEFS,
  /** Feature-049: baggrundenes talents. */
  talents: TALENTS,
  /** Feature-050: Reveal koster 10 focus og lykkes 25 % + 4 % pr. point over 2 × item level (5–100 %); smeden tager 10 + 3 × item level. */
  reveal: { focus: 10, base: 0.25, perPoint: 0.04, levelFactor: 2, min: 0.05, xpPerTry: 3, identifyBase: 10, identifyPerLevel: 3 },
  talent: {
    /** Erfaring for hver brug (Feature-002). */
    xpPerUse: 3,
    hide: { base: 0.5, perSkill: 0.01, max: 0.9, seconds: 5, secondsPerSkill: 0.2, maxSeconds: 15, sightPerOpen: 10 },
    berserk: { reach: 0.2, reachPerSkill: 0.01, maxReach: 0.6, arc: 60, arcPerSkill: 6, seconds: 6, secondsPerSkill: 0.1, maxSeconds: 12 },
    haste: { base: 0.15, perSkill: 0.005, max: 0.5, seconds: 6, secondsPerSkill: 0.1, maxSeconds: 12 },
    healing: { radius: 3, radiusPerSkill: 0.04, maxRadius: 5, share: 0.15, sharePerSkill: 0.005, maxShare: 0.4, seconds: 5 },
    /** Feature-013: en kandidat i en busk toner frem fra 3 felter og er 80 % gennemsigtig ved 1 felt. */
    bushFadeFrom: 3,
    bushNear: 0.8,
  },
  echo: {
    /** Partiets arts når partiet inden for 6 felter (Crown of Echoes har sin egen radius). */
    partyRadius: 6,
    /** Et langsomt monster er 40 % langsommere. */
    slowFactor: 0.6,
    /** Uden et mål sigter en art 4 felter lige frem. */
    ahead: 4,
    /** Flammer og ekkoer gør skade hvert halve sekund. */
    zoneTick: 0.5,
    /** Fart for Resonant Lines tone og Unmaking Notes tone. */
    toneSpeed: 12,
    /** The Maw Remembers rejser højst så mange ekkoer. */
    maxEchoes: 6,
    /** Cinder Echo lægger en flamme så ofte, med denne radius. */
    cinderEvery: 0.25,
    cinderRadius: 0.7,
  },
  monsters: {
    levelPerDepth: 1,
    /** Feature-011: liv +40 % og skade +30 % pr. level; grundværdierne er 40 % og 25 % højere end i prototypen. */
    hpPerLevel: 0.4,
    damagePerLevel: 0.3,
    /** Feature-011: + 1 rustning pr. 2 levels, 2 % hurtigere slag (højst 30 %) og 1 % hurtigere fart (højst 20 %) pr. level over 1. */
    levelsPerArmour: 2,
    quickPerLevel: 0.02,
    maxQuick: 0.3,
    fleetPerLevel: 0.01,
    maxFleet: 0.2,
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
    /** Feature-011: lidt guld og få ting, så et magisk våben er et rigtigt fund (2026-11-21). */
    goldChance: 0.2,
    goldPerLevel: [1, 3] as [number, number],
    itemChance: 0.05,
    /** En Veteran: guld 60 %, en ting 50 % – magisk én gang ud af tolv, sjælden én ud af hundrede. */
    veteran: { goldChance: 0.6, itemChance: 0.5, magic: 0.08, rare: 0.01 },
    rivalItemChance: 0.25,
    /** Warden: én magisk ting, sjælden én gang ud af ti. */
    wardenRareChance: 0.1,
    /** Feature-017: sponsorgavens ting er magisk én gang ud af tre. */
    sponsorMagicChance: 0.33,
    /** Feature-017: sponsorgavens guld er 6 × områdets level. */
    sponsorGoldPerLevel: 6,
    /** Feature-011: potions og rations er sjældne – en fjerdedel af før (2026-11-20). */
    consumableChance: 0.04,
    veteranConsumableChance: 0.15,
    rivalConsumableChance: 0.15,
    cacheConsumableChance: 0.2,
    /** Feature-017 CMD-02: sponsorgaven – en magisk ting, en potion, en ration eller (resten) guld. */
    sponsorOdds: { item: 0.1, potion: 0.05, focusPotion: 0.05, ration: 0.05 },
    /** Feature-011: magisk 2 % og sjælden 0,3 %, lidt mere i de dybere dybder og distrikter (2026-11-21). */
    rarity: { magic: 0.02, rare: 0.003, perDepth: 0.005 },
    cachesPerDepth: 2,
  },
  items: {
    /**
     * Feature-007: krav for at tage udstyr på. Våben kræver deres skill og en attribut, rustning Strength, ringe intet.
     * Hvert item level over 1 lægger 1 til skill'en og 1 til attributten for hver 2 levels.
     */
    requirements: {
      attribute: { blades: 'dexterity', bows: 'dexterity', heavy: 'strength', armour: 'strength' } as Record<'blades' | 'bows' | 'heavy' | 'armour', Attribute>,
      skillPerLevel: 1,
      levelsPerAttribute: 2,
    },
    sellFactor: 0.3,
    damagePerItemLevel: 0.08,
    armourPerItemLevel: 0.1,
    pricePerItemLevel: 0.15,
    rarityPrice: { common: 1, magic: 2.2, rare: 4 },
    /**
     * Feature-007: vægten, en karakter bærer uden besvær – 20 + 2 pr. Strength og 1 pr. Constitution over 10 – og 3 %
     * dyrere stamina for hvert vægtpoint over.
     */
    load: { base: 20, perStrength: 2, perConstitution: 1, costPerPoint: 0.03 },
    /** Feature-007: Magic har 1 affix, Rare 2. */
    affixCount: { common: 0, magic: 1, rare: 2 },
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
    /** Feature-021: 2 % rare, ellers 12 % magic – et magisk våben i smedjen er sjældent og dyrt. */
    forgeRareChance: 0.02,
    forgeMagicChance: 0.12,
    potionPrice: 25,
    /** Feature-020: en focus draught koster som en healing draught. */
    focusPotionPrice: 25,
    rationPrice: 10,
    purse: { perDepth: 40, warden: 150, perRenown: 0.3, champion: 300, fallFactor: 0.5 },
    /** Feature-023: én gave for hver 150 Renown; tingene er almindelige, den første magisk ved 600 Renown. */
    giftPerRenown: 150,
    maxGifts: 4,
    giftGold: 25,
    giftMagicRenown: 600,
    houses: ['House Morrow', 'House Vane', 'House Ashgrave', 'House Lisle'],
    /** Besluttet 2026-11-18 (Feature-009): et fald koster det, der blev fundet i Tithen. */
    fallPenalty: 'lose-found' as 'lose-found' | 'none',
  },
  view: { visionRadius: 7 },
  /** Feature-010 og -036: stederne, en Tithe kan åbnes i. */
  reaches: [
    { id: 'mines', number: 1, name: 'The Old Mines', text: 'Three depths of tunnels and halls. The Foreman waits at the bottom.' },
    { id: 'city', number: 2, name: 'The Broken City', text: 'One great ruin of streets, houses and factories. The Smelter holds the foundry in the middle.' },
    { id: 'woods', number: 3, name: 'The Woods', text: 'An old forest of huts, clearings and brigand camps. The Antlered King rules the heart.' },
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
  /** Feature-010, -017: The Woods – én stor skov, der forsegles fra skovbrynet og ind som byen. */
  woods: {
    size: 112,
    districts: 4,
    /** Distrikternes grænser som andel af afstanden fra midten til kanten: skovbrynet, den gamle skov, den dybe skov. */
    rings: [0.68, 0.42, 0.16] as [number, number, number],
    sealTimes: [480, 840, 1200],
    wards: ['the forest edge', 'the old woods', 'the deep woods', 'the heart'],
    rivalDepths: 6,
    rivalHpFactor: 1.6,
    cachesOnGround: 6,
    monstersPerHouse: [1, 2] as [number, number],
    /** Flokke på stierne. */
    streetPacks: 30,
    startClearings: 10,
    clearings: 16,
    /** Lysninger med et bål og en bande brigander. */
    camps: 7,
    huts: 14,
    /** Træer, store træer og buske pr. felt skovbund, i distrikt 1–4. */
    trees: [0.09, 0.12, 0.16, 0.08] as number[],
    bigTrees: [0.012, 0.018, 0.024, 0.01] as number[],
    bushes: 0.06,
  },
  /** Feature-036 og -025: navnet på en Tithe og pladserne i den. */
  lobby: { nameMin: 3, nameMax: 30, maxPlayers: 8 },
  /** Feature-043: hver karakters kiste på Mustering Square. */
  chest: { size: 12 },
  /** Feature-044 Arrange an arena match og -045 Fight in the arena. */
  arena: {
    /** Pladserne på Side 1 og Side 2. */
    formats: { '1v1': [1, 1], '2v1': [2, 1], '2v2': [2, 2] } as Record<'1v1' | '2v1' | '2v2', [number, number]>,
    stakeMax: 1000,
    /** Sekunder, hvor ingen kan såres. */
    countdown: 5,
    /** Ringen lukker sig fra 2:00 til 3:30, til halvakserne er halveret (den midterste fjerdedel). */
    shrinkFrom: 120,
    shrinkTo: 210,
    minRing: 0.5,
    /** Udenfor ringen: 8 % af max liv i sekundet. */
    ringDamage: 0.08,
    /** Uafgjort ved 4:00. */
    hardLimit: 240,
    /** En kæmper i en busk ses af den anden side inden for 2 felter, eller 1,5 sekund efter et slag. */
    bushSight: 2,
    revealSeconds: 1.5,
  },
};

export type Balance = typeof BALANCE;
