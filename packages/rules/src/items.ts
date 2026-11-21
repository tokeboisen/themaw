// Udstyr: våben, rustning og ringe med tilfældige egenskaber (Feature-007 Manage equipment).

import type { Balance } from './balance.ts';
import type { Rng } from './rng.ts';
import type { Affix, AffixStat, Attribute, Character, EquipSlot, Equipment, Item, ItemBase, Rarity, SkillId, Slot, WeaponSlot } from './types.ts';

const ATTRIBUTE_IDS: Attribute[] = ['strength', 'dexterity', 'stamina', 'constitution', 'intelligence'];

export const SLOTS: Slot[] = ['weapon', 'armour', 'ring', 'amulet'];
export const SLOT_NAMES: Record<Slot, string> = { weapon: 'Weapon', armour: 'Armour', ring: 'Ring', amulet: 'Amulet' };

/** Feature-007: udstyrets pladser i den rækkefølge, karakterskærmen viser dem. */
export const EQUIP_SLOTS: EquipSlot[] = ['melee', 'ranged', 'armour', 'ring1', 'ring2', 'amulet'];
export const EQUIP_SLOT_NAMES: Record<EquipSlot, string> = {
  melee: 'Melee weapon', ranged: 'Ranged weapon', armour: 'Armour', ring1: 'Ring 1', ring2: 'Ring 2', amulet: 'Amulet',
};

export function emptyEquipment(): Equipment {
  return { melee: null, ranged: null, armour: null, ring1: null, ring2: null, amulet: null };
}

export function isEquipSlot(value: unknown): value is EquipSlot {
  return (EQUIP_SLOTS as unknown[]).includes(value);
}

/**
 * Udstyr i det ældre format med én våben- og én ringplads ({ weapon, armour, ring }), f.eks. fra en arbejdskopi, der
 * blev sendt før Feature-007 v3, lægges på de nye pladser. Udstyr i det nye format returneres uændret.
 */
export function normalizeEquipment(equipment: Equipment | Record<string, Item | null | undefined>, B: Balance): Equipment {
  const old = equipment as Record<string, Item | null | undefined>;
  if (!('weapon' in old) && !('ring' in old)) return equipment as Equipment;
  const eq = emptyEquipment();
  for (const slot of EQUIP_SLOTS) eq[slot] = old[slot] ?? null;
  const weapon = old.weapon;
  if (weapon) eq[weaponSlot(weapon, B)] = weapon;
  if (old.ring) eq.ring1 = old.ring;
  return eq;
}

/** Et våben med rækkevidde (en bue) er et afstandsvåben; de andre er nærkampsvåben. */
export function weaponSlot(item: Item, B: Balance): WeaponSlot {
  return itemBase(B, item.baseId).range ? 'ranged' : 'melee';
}

/**
 * Feature-007 CMD-01: pladsen, en ting kommer på. En ring kommer på en ledig ringplads; er begge optaget, vælger
 * spilleren (ringSlot), ellers erstatter den ring 1.
 */
export function targetSlot(equipment: Equipment, item: Item, B: Balance, ringSlot?: 'ring1' | 'ring2'): EquipSlot {
  if (item.slot === 'weapon') return weaponSlot(item, B);
  if (item.slot === 'armour') return 'armour';
  if (item.slot === 'amulet') return 'amulet';
  if (ringSlot) return ringSlot;
  if (!equipment.ring1) return 'ring1';
  if (!equipment.ring2) return 'ring2';
  return 'ring1';
}
export const RARITY_NAMES: Record<Rarity, string> = { common: 'Common', magic: 'Magic', rare: 'Rare' };
const SKILL_LABELS: Record<SkillId, string> = { blades: 'Blades', heavy: 'Heavy Weapons', bows: 'Bows', echo: 'Echo Arts', talent: 'Talent', reveal: 'Reveal' };

export function itemBase(B: Balance, baseId: string): ItemBase {
  const base = B.items.bases[baseId];
  if (!base) throw new Error(`Unknown item base: ${baseId}`);
  return base;
}

export function rollRarity(rng: Rng, level: number, B: Balance): Rarity {
  const r = B.loot.rarity;
  const bonus = r.perDepth * Math.max(0, level - 1);
  const x = rng.next();
  if (x < r.rare + bonus / 3) return 'rare';
  if (x < r.rare + r.magic + bonus) return 'magic';
  return 'common';
}

export interface ItemOptions {
  baseId?: string;
  slot?: Slot;
  rarity?: Rarity;
}

export function generateItem(rng: Rng, level: number, B: Balance, opts: ItemOptions = {}): Item {
  const ilvl = Math.max(1, Math.round(level));
  let rarity = opts.rarity ?? rollRarity(rng, ilvl, B);
  let baseId = opts.baseId;
  if (!baseId) {
    // Feature-007: en ring er aldrig almindelig, så en almindelig ting er et våben eller en rustning – ellers ville hver
    // fjerde ting blive en magisk ring (Feature-011: magiske ting er sjældne).
    const candidates = Object.entries(B.items.bases)
      .filter(([, b]) => (b.minLevel ?? 1) <= ilvl && (!opts.slot || b.slot === opts.slot)
        && (opts.slot || rarity !== 'common' || (b.slot !== 'ring' && b.slot !== 'amulet')))
      .map(([id]) => id);
    baseId = rng.pick(candidates);
  }
  const base = itemBase(B, baseId);
  // En ring eller en amulet uden egenskaber er intet værd (Feature-007: aldrig almindelige).
  if ((base.slot === 'ring' || base.slot === 'amulet') && rarity === 'common') rarity = 'magic';

  // ID'et skal være entydigt på hele serveren (gear.items): en UUID. Generatoren trækkes stadig to gange, så en bane
  // med samme seed stadig giver de samme ting.
  const legacyId = 'i' + rng.id() + rng.id();
  const item: Item = { id: globalThis.crypto?.randomUUID?.() ?? legacyId, baseId, slot: base.slot, ilvl, rarity, affixes: [], name: '', value: 0 };
  if (base.slot === 'weapon') {
    const scale = 1 + B.items.damagePerItemLevel * (ilvl - 1);
    item.skill = base.skill;
    item.min = Math.round((base.min ?? 1) * scale);
    item.max = Math.max(item.min + 1, Math.round((base.max ?? 2) * scale));
  }
  if (base.slot === 'armour') {
    item.armour = Math.round((base.armour ?? 0) * (1 + B.items.armourPerItemLevel * (ilvl - 1)));
  }

  const count = B.items.affixCount[rarity]; // Feature-007: Magic 1, Rare 2
  let pool = Object.entries(B.items.affixes).filter(([, a]) => a.slots.includes(base.slot) && (!a.rareOnly || rarity === 'rare'));
  // Feature-007: en ring eller en amulet giver til højst én attribut og én skill; aldrig haste og speed sammen.
  const jewel = base.slot === 'ring' || base.slot === 'amulet';
  const isAttribute = (stat: string) => (ATTRIBUTE_IDS as string[]).includes(stat);
  for (let i = 0; i < count && pool.length; i++) {
    const [stat, a] = pool.splice(Math.floor(rng.next() * pool.length), 1)[0]!;
    const value = Math.min(a.cap ?? Infinity, Math.max(1, Math.round(rng.range(a.min, a.max) + a.perLevel * (ilvl - 1))));
    const affix: Affix = { stat: stat as AffixStat, value };
    if (stat === 'skillBonus') affix.skill = rng.pick(['blades', 'heavy', 'bows', 'echo'] as const);
    item.affixes.push(affix);
    if (jewel && isAttribute(stat)) pool = pool.filter(([s]) => !isAttribute(s));
    if (stat === 'haste' || stat === 'speed') pool = pool.filter(([s]) => s !== 'haste' && s !== 'speed');
  }
  item.name = itemName(item, B);
  item.value = itemValue(item, B);
  return item;
}

export function itemName(item: Item, B: Balance): string {
  const base = itemBase(B, item.baseId).name;
  const [first, second] = item.affixes;
  const prefix = first ? `${B.items.affixes[first.stat]?.prefix} ` : '';
  const suffix = second ? ` ${B.items.affixes[second.stat]?.suffix}` : '';
  return prefix + base + suffix;
}

export function itemValue(item: Item, B: Balance): number {
  const base = itemBase(B, item.baseId);
  const level = 1 + B.items.pricePerItemLevel * (item.ilvl - 1);
  return Math.round(base.price * level * B.items.rarityPrice[item.rarity] + item.affixes.length * 8);
}

/** Feature-019: en uidentificeret ting sælges som en almindelig. */
export function sellValue(item: Item, B: Balance): number {
  const value = item.identified === false ? itemValue({ ...item, rarity: 'common', affixes: [] }, B) : item.value;
  return Math.max(1, Math.floor(value * B.items.sellFactor));
}

/** Feature-050: en uidentificeret ting hedder sin grundtype. */
export function displayName(item: Item, B: Balance): string {
  return item.identified === false ? itemBase(B, item.baseId).name : item.name;
}

/** Feature-050: chancen for at Reveal lykkes: 25 % + 4 % pr. point over 2 × item level, 5–100 %. */
export function revealChance(reveal: number, item: Item, B: Balance): number {
  const R = B.reveal;
  return Math.max(R.min, Math.min(1, R.base + R.perPoint * (reveal - R.levelFactor * item.ilvl)));
}

/** Feature-019: smedens pris for at identificere tingene: 10 + 3 × item level for hver uidentificeret ting. */
export function identifyPrice(items: Item[], B: Balance): { count: number; price: number } {
  const unknown = items.filter((i) => i.identified === false);
  return { count: unknown.length, price: unknown.reduce((sum, i) => sum + B.reveal.identifyBase + B.reveal.identifyPerLevel * i.ilvl, 0) };
}

/** Feature-007: hvad en ting kræver for at blive taget på; et krav på 0 er udeladt. */
export interface Requirements {
  skill?: { id: SkillId; level: number };
  attribute?: { id: Attribute; value: number };
}

/**
 * Feature-007 AGG-01: et våben kræver sin skill og en attribut (Blades og Bows Dexterity, Heavy Weapons Strength),
 * rustning Strength og ringe intet. Kravet ved item level 1 står på grundtypen; hvert level over 1 lægger 1 til
 * skill'en og 1 til attributten for hver 2 levels.
 */
export function itemRequirements(item: Item, B: Balance): Requirements {
  if (item.slot === 'ring' || item.slot === 'amulet') return {};
  const base = itemBase(B, item.baseId);
  const R = B.items.requirements;
  const above = Math.max(0, item.ilvl - 1);
  const out: Requirements = {};
  if (item.slot === 'weapon' && item.skill && item.skill !== 'echo') {
    const level = (base.reqSkill ?? 0) + above * R.skillPerLevel;
    if (level > 0) out.skill = { id: item.skill, level };
  }
  const kind = item.slot === 'armour' ? 'armour' : item.skill === 'blades' || item.skill === 'heavy' || item.skill === 'bows' ? item.skill : null;
  if (kind) {
    const value = (base.reqAttribute ?? 0) + Math.floor(above / R.levelsPerAttribute);
    if (value > 0) out.attribute = { id: R.attribute[kind], value };
  }
  return out;
}

/** Feature-007 CMD-01: beskeden, når karakteren ikke opfylder en tings krav. */
export const REQUIREMENTS_NOT_MET = 'You do not meet the requirements.';

/** Feature-007: kravene som tekst, fx "Requires Blades 8 · Dexterity 11", eller null uden krav. */
export function requirementText(r: Requirements): string | null {
  const parts: string[] = [];
  if (r.skill) parts.push(`${SKILL_LABELS[r.skill.id]} ${r.skill.level}`);
  if (r.attribute) parts.push(`${ATTRIBUTE_LABELS[r.attribute.id]} ${r.attribute.value}`);
  return parts.length ? `Requires ${parts.join(' · ')}` : null;
}

const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  strength: 'Strength', dexterity: 'Dexterity', stamina: 'Stamina', constitution: 'Constitution', intelligence: 'Intelligence',
};

/** Linjer til at vise et stykke udstyr i UI'et. */
export function describeItem(item: Item, B: Balance): string[] {
  const base = itemBase(B, item.baseId);
  const lines: string[] = [];
  if (item.slot === 'weapon' && item.skill) {
    lines.push(`${item.min}–${item.max} damage · ${SKILL_LABELS[item.skill]}`);
    lines.push(base.range ? `Range ${base.range} · ${base.cooldown}s` : `Reach ${base.reach} · ${base.cooldown}s`);
  }
  if (item.slot === 'armour') lines.push(`${item.armour} armour`);
  // Feature-007: kravene står på tingen.
  const requires = requirementText(itemRequirements(item, B));
  if (requires) lines.push(requires);
  // Feature-050: en uidentificeret tings affixes er skjulte.
  if (item.identified === false) lines.push('Unidentified');
  else for (const a of item.affixes) {
    const def = B.items.affixes[a.stat];
    if (!def) continue;
    if (a.stat === 'skill' && item.skill) lines.push(`+${a.value} ${SKILL_LABELS[item.skill]}`);
    else if (a.stat === 'skillBonus' && a.skill) lines.push(`+${a.value} ${SKILL_LABELS[a.skill]}`);
    else if (def.label.startsWith('%')) lines.push(`+${a.value}${def.label}`);
    else lines.push(`+${a.value} ${def.label}`);
  }
  // Feature-007: hver ting viser sin vægt.
  lines.push(`Weight ${itemWeight(item, B)}`);
  return lines;
}

/** Feature-007: tingens vægt efter dens grundtype. */
export function itemWeight(item: Item, B: Balance): number {
  return B.items.bases[item.baseId]?.weight ?? 0;
}

/**
 * Feature-007: det, karakteren bærer (det, den har på, og pakken – ikke kisten), hvad den bærer uden besvær, og hvor
 * meget dyrere stamina er: 3 % for hvert vægtpoint over.
 */
export function loadOf(ch: Pick<Character, 'equipment' | 'inventory'>, attributes: Record<Attribute, number>, B: Balance): { load: number; carry: number; staminaCostMult: number } {
  const L = B.items.load;
  const worn = (Object.values(ch.equipment) as (Item | null | undefined)[]).filter((i): i is Item => !!i);
  const load = Math.round([...worn, ...ch.inventory].reduce((sum, i) => sum + itemWeight(i, B), 0) * 10) / 10;
  const base = B.character.startAttribute;
  const carry = L.base + (attributes.strength - base) * L.perStrength + (attributes.constitution - base) * L.perConstitution;
  return { load, carry, staminaCostMult: 1 + Math.max(0, load - carry) * L.costPerPoint };
}
