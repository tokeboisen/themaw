// Udstyr: våben, rustning og ringe med tilfældige egenskaber (Feature-007 Manage equipment).

import type { Balance } from './balance.ts';
import type { Rng } from './rng.ts';
import type { AffixStat, Item, ItemBase, Rarity, SkillId, Slot } from './types.ts';

export const SLOTS: Slot[] = ['weapon', 'armour', 'ring'];
export const SLOT_NAMES: Record<Slot, string> = { weapon: 'Weapon', armour: 'Armour', ring: 'Ring' };
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
