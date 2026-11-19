// Karakteren: egenskaber, skills, der vokser ved brug, Marks (niveauer) og udstyr.
// Ingen DOM her, så reglerne kan testes i Node og senere køre på en server.

import { generateItem, sellValue } from './items.js';

export const ATTRIBUTES = ['strength', 'dexterity', 'stamina', 'constitution', 'intelligence'];
export const ATTRIBUTE_NAMES = {
  strength: 'Strength',
  dexterity: 'Dexterity',
  stamina: 'Stamina',
  constitution: 'Constitution',
  intelligence: 'Intelligence',
};
export const SKILLS = ['blades', 'heavy', 'bows', 'echo'];
export const SKILL_NAMES = { blades: 'Blades', heavy: 'Heavy Weapons', bows: 'Bows', echo: 'Echo Arts' };

export function createCharacter(name, backgroundId, rng, B) {
  const bg = B.backgrounds.find((b) => b.id === backgroundId) || B.backgrounds[0];
  const C = B.character;
  const ch = {
    name: name || 'Nameless',
    background: bg.id,
    level: 1,
    echo: 0,
    attributes: Object.fromEntries(ATTRIBUTES.map((a) => [a, C.startAttribute + (bg.attributes[a] || 0)])),
    skills: Object.fromEntries(SKILLS.map((s) => [s, { level: bg.skills[s] || 0, xp: 0 }])),
    attributePoints: 0,
    skillPoints: 0,
    gold: C.startGold,
    potions: C.startPotions,
    rations: C.startRations,
    equipment: { weapon: null, armour: null, ring: null },
    inventory: [],
    tithes: 0,
    championships: 0,
  };
  ch.equipment.weapon = generateItem(rng, 1, B, { baseId: bg.weapon, rarity: 'common' });
  ch.equipment.armour = generateItem(rng, 1, B, { baseId: 'padded_coat', rarity: 'common' });
  return ch;
}

// --- Skills vokser ved brug -------------------------------------------------------------------

export function skillXpToNext(level, B) {
  return B.skills.xpBase + B.skills.xpPerLevel * level;
}

// Lægger XP til en skill og returnerer, hvor mange niveauer den steg.
export function addSkillXp(ch, skill, amount, B) {
  const s = ch.skills[skill];
  if (!s || s.level >= B.skills.max || amount <= 0) return 0;
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

// --- Marks (niveauer) -------------------------------------------------------------------------

export function echoToNextMark(level, B) {
  return Math.round(B.marks.echoBase * Math.pow(level, B.marks.echoExponent));
}

// Lægger Echo til og returnerer, hvor mange nye Marks det gav.
export function addEcho(ch, amount, B) {
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

export function spendAttributePoint(ch, attribute) {
  if (ch.attributePoints <= 0 || !ATTRIBUTES.includes(attribute)) return false;
  ch.attributes[attribute] += 1;
  ch.attributePoints -= 1;
  return true;
}

export function spendSkillPoint(ch, skill, B) {
  const s = ch.skills[skill];
  if (ch.skillPoints <= 0 || !s || s.level >= B.skills.max) return false;
  s.level = Math.min(B.skills.max, s.level + B.skills.levelsPerPoint);
  if (s.level >= B.skills.max) s.xp = 0;
  ch.skillPoints -= 1;
  return true;
}

// --- Udstyr og afledte værdier ----------------------------------------------------------------

export function itemBonuses(ch) {
  const b = { attributes: {}, skills: {}, damagePct: 0, maxHp: 0, armour: 0, echoGain: 0 };
  for (const item of Object.values(ch.equipment)) {
    if (!item) continue;
    if (item.armour) b.armour += item.armour;
    for (const a of item.affixes) {
      if (ATTRIBUTES.includes(a.stat)) b.attributes[a.stat] = (b.attributes[a.stat] || 0) + a.value;
      else if (a.stat === 'skill') b.skills[item.skill] = (b.skills[item.skill] || 0) + a.value;
      else b[a.stat] += a.value;
    }
  }
  return b;
}

export function effectiveAttributes(ch, bonuses = itemBonuses(ch)) {
  return Object.fromEntries(ATTRIBUTES.map((a) => [a, ch.attributes[a] + (bonuses.attributes[a] || 0)]));
}

// Skill-bonus fra egenskaberne: vægt × (egenskab − 10) × attributeBonus.
export function attributeBonus(attributes, skill, B) {
  const weights = B.skills.weights[skill];
  let sum = 0;
  for (const [a, w] of Object.entries(weights)) sum += w * (attributes[a] - B.character.startAttribute) * B.skills.attributeBonus;
  return sum;
}

// Det effektive skill-niveau, som kampen bruger: niveau + udstyr + egenskaber.
export function effectiveSkill(ch, skill, B, bonuses = itemBonuses(ch)) {
  const attributes = effectiveAttributes(ch, bonuses);
  return Math.max(0, ch.skills[skill].level + (bonuses.skills[skill] || 0) + attributeBonus(attributes, skill, B));
}

function attackSpeed(effective, B) {
  return 1 - Math.min(B.skills.maxSpeedBonus, effective * B.skills.speedPerSkill);
}

export function derivedStats(ch, B) {
  const bonuses = itemBonuses(ch);
  const a = effectiveAttributes(ch, bonuses);
  const C = B.character;
  const base = C.startAttribute;
  const item = ch.equipment.weapon;
  const wb = item ? B.items.bases[item.baseId] : B.combat.unarmed;
  const skill = item ? item.skill : 'blades';
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
      min: item ? item.min : wb.min,
      max: item ? item.max : wb.max,
      reach: wb.reach || 1,
      range: wb.range || 0,
      ranged: !!wb.range,
      arc: wb.arc || 90,
      staminaCost: wb.stamina,
      cooldown: wb.cooldown * attackSpeed(effective, B),
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

// --- Inventory --------------------------------------------------------------------------------

export function hasRoom(ch, B) {
  return ch.inventory.length < derivedStats(ch, B).capacity;
}

// Tager et stykke udstyr på fra inventory; det, der sad på pladsen, kommer i inventory.
export function equipItem(ch, itemId) {
  const index = ch.inventory.findIndex((i) => i.id === itemId);
  if (index < 0) return false;
  const item = ch.inventory[index];
  const old = ch.equipment[item.slot];
  ch.equipment[item.slot] = item;
  ch.inventory.splice(index, 1);
  if (old) ch.inventory.push(old);
  return true;
}

export function unequipItem(ch, slot, B) {
  const item = ch.equipment[slot];
  if (!item || !hasRoom(ch, B)) return false;
  ch.equipment[slot] = null;
  ch.inventory.push(item);
  return true;
}

export function sellItem(ch, itemId, B) {
  const index = ch.inventory.findIndex((i) => i.id === itemId);
  if (index < 0) return 0;
  const [item] = ch.inventory.splice(index, 1);
  const gold = sellValue(item, B);
  ch.gold += gold;
  return gold;
}

export function dropItem(ch, itemId) {
  const index = ch.inventory.findIndex((i) => i.id === itemId);
  if (index < 0) return null;
  return ch.inventory.splice(index, 1)[0];
}
