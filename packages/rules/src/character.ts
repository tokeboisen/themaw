// Karakteren: egenskaber, skills, der vokser ved brug, Marks og udstyr
// (Feature-001 Create character, -002 Learn by use, -003 Earn Marks, -004 Spend points, -007 Manage equipment).
// Overført fra prototypen; tilpasses featurenes nuværende versioner i fase 1 og 2.

import type { Balance } from './balance.ts';
import { generateItem, itemBase, sellValue } from './items.ts';
import type { Rng } from './rng.ts';
import type { Attribute, Character, Item, SkillId, Slot } from './types.ts';

export const ATTRIBUTES: Attribute[] = ['strength', 'dexterity', 'stamina', 'constitution', 'intelligence'];
export const ATTRIBUTE_NAMES: Record<Attribute, string> = {
  strength: 'Strength',
  dexterity: 'Dexterity',
  stamina: 'Stamina',
  constitution: 'Constitution',
  intelligence: 'Intelligence',
};
export const SKILLS: SkillId[] = ['blades', 'heavy', 'bows', 'echo'];
export const SKILL_NAMES: Record<SkillId, string> = { blades: 'Blades', heavy: 'Heavy Weapons', bows: 'Bows', echo: 'Echo Arts' };

/**
 * En ny karakter med baggrundens forslag og startudstyr, som i prototypen (bruges af tests og den kommende Tithe).
 * Serveren opretter karakteren med newCharacter (creation.ts), og Gear giver startudstyret (Feature-005).
 */
export function createCharacter(name: string, backgroundId: string, rng: Rng, B: Balance): Character {
  const bg = B.backgrounds.find((b) => b.id === backgroundId) ?? B.backgrounds[0]!;
  const C = B.character;
  return {
    name: name || 'Nameless',
    background: bg.id,
    level: 1,
    echo: 0,
    attributes: { ...bg.suggestion.attributes },
    skills: Object.fromEntries(SKILLS.map((s) => [s, { level: bg.suggestion.skills[s], xp: 0 }])) as Character['skills'],
    attributePoints: 0,
    skillPoints: 0,
    gold: C.startGold,
    potions: C.startPotions,
    rations: C.startRations,
    equipment: {
      weapon: generateItem(rng, 1, B, { baseId: bg.weapon, rarity: 'common' }),
      armour: generateItem(rng, 1, B, { baseId: 'padded_coat', rarity: 'common' }),
      ring: null,
    },
    inventory: [],
    tithes: 0,
    championships: 0,
  };
}

// --- Skills vokser ved brug (Feature-002) ---------------------------------------------------------

export function skillXpToNext(level: number, B: Balance): number {
  return B.skills.xpBase + B.skills.xpPerLevel * level;
}

/** Lægger erfaring til en skill og returnerer, hvor mange niveauer den steg. */
export function addSkillXp(ch: Character, skill: SkillId, amount: number, B: Balance): number {
  const s = ch.skills[skill];
  if (s.level >= B.skills.max || amount <= 0) return 0;
  const intelligence = effectiveAttributes(ch).intelligence;
  const learning = 1 + Math.max(0, intelligence - B.character.startAttribute) * B.skills.learningPerIntelligence;
  s.xp += amount * learning;
  let gained = 0;
  while (s.level < B.skills.max && s.xp >= skillXpToNext(s.level, B)) {
    s.xp -= skillXpToNext(s.level, B);
    s.level += 1;
    gained += 1;
  }
  if (s.level >= B.skills.max) s.xp = 0;
  return gained;
}

// --- Marks (Feature-003) --------------------------------------------------------------------------

export function echoToNextMark(level: number, B: Balance): number {
  return Math.round(B.marks.echoBase * Math.pow(level, B.marks.echoExponent));
}

/** Lægger Echo til og returnerer, hvor mange nye Marks det gav. */
export function addEcho(ch: Character, amount: number, B: Balance): number {
  ch.echo += amount;
  let marks = 0;
  while (ch.echo >= echoToNextMark(ch.level, B)) {
    ch.echo -= echoToNextMark(ch.level, B);
    ch.level += 1;
    ch.attributePoints += B.marks.attributePoints;
    ch.skillPoints += B.marks.skillPoints;
    marks += 1;
  }
  return marks;
}

// --- Point (Feature-004) --------------------------------------------------------------------------

export function spendAttributePoint(ch: Character, attribute: Attribute): boolean {
  if (ch.attributePoints <= 0 || !ATTRIBUTES.includes(attribute)) return false;
  ch.attributes[attribute] += 1;
  ch.attributePoints -= 1;
  return true;
}

export function spendSkillPoint(ch: Character, skill: SkillId, B: Balance): boolean {
  const s = ch.skills[skill];
  if (ch.skillPoints <= 0 || !s || s.level >= B.skills.max) return false;
  s.level = Math.min(B.skills.max, s.level + B.skills.levelsPerPoint);
  if (s.level >= B.skills.max) s.xp = 0;
  ch.skillPoints -= 1;
  return true;
}

// --- Udstyr og afledte værdier --------------------------------------------------------------------

export interface ItemBonuses {
  attributes: Partial<Record<Attribute, number>>;
  skills: Partial<Record<SkillId, number>>;
  damagePct: number;
  maxHp: number;
  armour: number;
  echoGain: number;
}

export function itemBonuses(ch: Character): ItemBonuses {
  const b: ItemBonuses = { attributes: {}, skills: {}, damagePct: 0, maxHp: 0, armour: 0, echoGain: 0 };
  for (const item of Object.values(ch.equipment) as (Item | null)[]) {
    if (!item) continue;
    if (item.armour) b.armour += item.armour;
    for (const a of item.affixes) {
      if ((ATTRIBUTES as string[]).includes(a.stat)) {
        const attr = a.stat as Attribute;
        b.attributes[attr] = (b.attributes[attr] ?? 0) + a.value;
      } else if (a.stat === 'skill') {
        if (item.skill) b.skills[item.skill] = (b.skills[item.skill] ?? 0) + a.value;
      } else {
        b[a.stat as 'damagePct' | 'maxHp' | 'armour' | 'echoGain'] += a.value;
      }
    }
  }
  return b;
}

export function effectiveAttributes(ch: Character, bonuses: ItemBonuses = itemBonuses(ch)): Record<Attribute, number> {
  return Object.fromEntries(ATTRIBUTES.map((a) => [a, ch.attributes[a] + (bonuses.attributes[a] ?? 0)])) as Record<Attribute, number>;
}

/** Skill-bonus fra egenskaberne: vægt × (egenskab − 10) × attributeBonus. */
export function attributeBonus(attributes: Record<Attribute, number>, skill: SkillId, B: Balance): number {
  let sum = 0;
  for (const [a, w] of Object.entries(B.skills.weights[skill]) as [Attribute, number][]) {
    sum += w * (attributes[a] - B.character.startAttribute) * B.skills.attributeBonus;
  }
  return sum;
}

/** Det effektive skill-niveau, som kampen bruger: niveau + udstyr + egenskaber. */
export function effectiveSkill(ch: Character, skill: SkillId, B: Balance, bonuses: ItemBonuses = itemBonuses(ch)): number {
  const attributes = effectiveAttributes(ch, bonuses);
  return Math.max(0, ch.skills[skill].level + (bonuses.skills[skill] ?? 0) + attributeBonus(attributes, skill, B));
}

function attackSpeed(effective: number, B: Balance): number {
  return 1 - Math.min(B.skills.maxSpeedBonus, effective * B.skills.speedPerSkill);
}

export interface WeaponStats {
  skill: SkillId;
  min: number;
  max: number;
  reach: number;
  range: number;
  ranged: boolean;
  arc: number;
  staminaCost: number;
  cooldown: number;
  effective: number;
  damageMult: number;
}

export interface BoltStats {
  skill: 'echo';
  min: number;
  max: number;
  range: number;
  speed: number;
  focusCost: number;
  cooldown: number;
  effective: number;
  damageMult: number;
}

export interface DerivedStats {
  attributes: Record<Attribute, number>;
  maxHp: number;
  maxStamina: number;
  staminaRegen: number;
  maxFocus: number;
  focusRegen: number;
  armour: number;
  damageReduction: number;
  critChance: number;
  hungerDrain: number;
  capacity: number;
  echoGain: number;
  moveSpeed: number;
  weapon: WeaponStats;
  bolt: BoltStats;
}

export function derivedStats(ch: Character, B: Balance): DerivedStats {
  const bonuses = itemBonuses(ch);
  const a = effectiveAttributes(ch, bonuses);
  const C = B.character;
  const base = C.startAttribute;
  const item = ch.equipment.weapon;
  const wb = item ? itemBase(B, item.baseId) : null;
  const unarmed = B.combat.unarmed;
  const skill: SkillId = item?.skill ?? 'blades';
  const effective = effectiveSkill(ch, skill, B, bonuses);
  const damageMult = (1 + effective * B.skills.damagePerSkill) * (1 + bonuses.damagePct / 100);
  const echoEffective = effectiveSkill(ch, 'echo', B, bonuses);
  const bolt = B.combat.echoBolt;
  const armour = bonuses.armour;
  return {
    attributes: a,
    maxHp: Math.round(C.baseHp + (a.constitution - base) * C.hpPerConstitution + (ch.level - 1) * C.hpPerMark + bonuses.maxHp),
    maxStamina: Math.round(C.baseStamina + (a.stamina - base) * C.staminaPerStamina),
    staminaRegen: C.staminaRegen + (a.stamina - base) * C.staminaRegenPerStamina,
    maxFocus: Math.round(C.baseFocus + (a.intelligence - base) * C.focusPerIntelligence),
    focusRegen: C.focusRegen + (a.intelligence - base) * C.focusRegenPerIntelligence,
    armour,
    damageReduction: armour / (armour + B.combat.armourFactor),
    critChance: Math.max(0, C.critChance + (a.dexterity - base) * C.critPerDexterity),
    hungerDrain: B.hunger.drainPerSecond * Math.max(0.3, 1 - (a.stamina - base) * B.hunger.drainReductionPerStamina),
    capacity: C.baseCapacity + Math.floor(Math.max(0, a.strength - base) / 2) * C.capacityPerTwoStrength,
    echoGain: 1 + bonuses.echoGain / 100,
    moveSpeed: C.moveSpeed,
    weapon: {
      skill,
      min: item?.min ?? unarmed.min,
      max: item?.max ?? unarmed.max,
      reach: wb?.reach ?? unarmed.reach,
      range: wb?.range ?? 0,
      ranged: !!wb?.range,
      arc: wb?.arc ?? unarmed.arc,
      staminaCost: wb?.stamina ?? unarmed.stamina,
      cooldown: (wb?.cooldown ?? unarmed.cooldown) * attackSpeed(effective, B),
      effective,
      damageMult,
    },
    bolt: {
      skill: 'echo',
      min: bolt.min,
      max: bolt.max,
      range: bolt.range,
      speed: bolt.speed,
      focusCost: bolt.focusCost,
      cooldown: bolt.cooldown * attackSpeed(echoEffective, B),
      effective: echoEffective,
      damageMult: (1 + echoEffective * B.skills.damagePerSkill) * (1 + bonuses.damagePct / 100),
    },
  };
}

// --- Inventory ------------------------------------------------------------------------------------

export function hasRoom(ch: Character, B: Balance): boolean {
  return ch.inventory.length < derivedStats(ch, B).capacity;
}

/** Tager en ting på fra inventory; det, der sad på pladsen, kommer i inventory. */
export function equipItem(ch: Character, itemId: string): boolean {
  const index = ch.inventory.findIndex((i) => i.id === itemId);
  if (index < 0) return false;
  const item = ch.inventory[index]!;
  const old = ch.equipment[item.slot];
  ch.equipment[item.slot] = item;
  ch.inventory.splice(index, 1);
  if (old) ch.inventory.push(old);
  return true;
}

export function unequipItem(ch: Character, slot: Slot, B: Balance): boolean {
  const item = ch.equipment[slot];
  if (!item || !hasRoom(ch, B)) return false;
  ch.equipment[slot] = null;
  ch.inventory.push(item);
  return true;
}

export function sellItem(ch: Character, itemId: string, B: Balance): number {
  const index = ch.inventory.findIndex((i) => i.id === itemId);
  if (index < 0) return 0;
  const [item] = ch.inventory.splice(index, 1);
  const gold = sellValue(item!, B);
  ch.gold += gold;
  return gold;
}

export function dropItem(ch: Character, itemId: string): Item | null {
  const index = ch.inventory.findIndex((i) => i.id === itemId);
  if (index < 0) return null;
  return ch.inventory.splice(index, 1)[0] ?? null;
}
