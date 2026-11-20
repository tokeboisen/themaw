// Udstyr: våben, rustning og ringe med tilfældige egenskaber (Feature-007 Manage equipment).

import type { Balance } from './balance.ts';
import type { Rng } from './rng.ts';
import type { AffixStat, EquipSlot, Equipment, Item, ItemBase, Rarity, SkillId, Slot, WeaponSlot } from './types.ts';

export const SLOTS: Slot[] = ['weapon', 'armour', 'ring'];
export const SLOT_NAMES: Record<Slot, string> = { weapon: 'Weapon', armour: 'Armour', ring: 'Ring' };

/** Feature-007: udstyrets pladser i den rækkefølge, karakterskærmen viser dem. */
export const EQUIP_SLOTS: EquipSlot[] = ['melee', 'ranged', 'armour', 'ring1', 'ring2'];
export const EQUIP_SLOT_NAMES: Record<EquipSlot, string> = {
  melee: 'Melee weapon', ranged: 'Ranged weapon', armour: 'Armour', ring1: 'Ring 1', ring2: 'Ring 2',
};

export function emptyEquipment(): Equipment {
  return { melee: null, ranged: null, armour: null, ring1: null, ring2: null };
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
  if (ringSlot) return ringSlot;
  if (!equipment.ring1) return 'ring1';
  if (!equipment.ring2) return 'ring2';
  return 'ring1';
}
export const RARITY_NAMES: Record<Rarity, string> = { common: 'Common', magic: 'Magic', rare: 'Rare' };
const SKILL_LABELS: Record<SkillId, string> = { blades: 'Blades', heavy: 'Heavy Weapons', bows: 'Bows', echo: 'Echo Arts' };

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
  let baseId = opts.baseId;
  if (!baseId) {
    const candidates = Object.entries(B.items.bases)
      .filter(([, b]) => (b.minLevel ?? 1) <= ilvl && (!opts.slot || b.slot === opts.slot))
      .map(([id]) => id);
    baseId = rng.pick(candidates);
  }
  const base = itemBase(B, baseId);
  let rarity = opts.rarity ?? rollRarity(rng, ilvl, B);
  if (base.slot === 'ring' && rarity === 'common') rarity = 'magic'; // en ring uden egenskaber er intet værd

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

  const count = rarity === 'rare' ? 3 : rarity === 'magic' ? rng.int(1, 2) : 0;
  const pool = Object.entries(B.items.affixes).filter(([, a]) => a.slots.includes(base.slot));
  for (let i = 0; i < count && pool.length; i++) {
    const [stat, a] = pool.splice(Math.floor(rng.next() * pool.length), 1)[0]!;
    const value = Math.max(1, Math.round(rng.range(a.min, a.max) + a.perLevel * (ilvl - 1)));
    item.affixes.push({ stat: stat as AffixStat, value });
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

export function sellValue(item: Item, B: Balance): number {
  return Math.max(1, Math.floor(item.value * B.items.sellFactor));
}

/** Linjer til at vise et stykke udstyr i UI'et. */
export function describeItem(item: Item, B: Balance): string[] {
  const base = itemBase(B, item.baseId);
  const lines: string[] = [];
  if (item.slot === 'weapon' && item.skill) {
    lines.push(`${item.min}–${item.max} damage · ${SKILL_LABELS[item.skill]}`);
    lines.push(base.range ? `Range ${base.range} · ${base.cooldown}s` : `Reach ${base.reach} · ${base.cooldown}s`);
    // Feature-007: våbnets skill cap vises på våbnet.
    lines.push(`Skill cap ${(base.skillCap ?? B.skills.max) + B.skills.weaponCapBonus[item.rarity]}`);
  }
  if (item.slot === 'armour') lines.push(`${item.armour} armour`);
  for (const a of item.affixes) {
    const def = B.items.affixes[a.stat];
    if (!def) continue;
    if (a.stat === 'skill' && item.skill) lines.push(`+${a.value} ${SKILL_LABELS[item.skill]}`);
    else if (def.label.startsWith('%')) lines.push(`+${a.value}${def.label}`);
    else lines.push(`+${a.value} ${def.label}`);
  }
  return lines;
}
