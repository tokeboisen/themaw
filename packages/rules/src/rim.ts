// The Rim: smedjen, apoteket, sponsorgaver og Kronens pengepung
// (Feature-009, -018 til -024). Overført fra prototypen; i serveren deles det mellem Gear, Market og Patronage.

import type { Balance } from './balance.ts';
import { derivedStats, sellItem as sellFromInventory } from './character.ts';
import { generateItem } from './items.ts';
import { createRng, type Rng } from './rng.ts';
import type { Character, Item, SkillId } from './types.ts';

export type OutcomeKind = 'champion' | 'rival-champion' | 'fell' | 'left';

export interface TitheRecord {
  kills: number;
  rivalsDefeated: number;
  renown: number;
  goldFound: number;
  maxDepth: number;
  wardenSlain: boolean;
  itemsFound: number;
}

/** Det, en Tithe efterlader for én spiller, når den slutter (Feature-016 End the Tithe). */
export interface TitheResult {
  id: string;
  seed: number;
  time: number;
  outcome: { kind: OutcomeKind; name: string };
  record: TitheRecord;
  start: { level: number; skills: Record<SkillId, number> };
}

export interface Gift {
  id: string;
  house: string;
  kind: 'item' | 'gold';
  item?: Item;
  gold?: number;
}

export interface TitheSummary {
  tithe: number;
  outcome: TitheResult['outcome'];
  seconds: number;
  record: TitheRecord;
  purse: number;
  goldFound: number;
  goldLost: number;
  lostItems: string[];
  gifts: number;
  marks: { from: number; to: number };
  skills: Record<string, { from: number; to: number }>;
}

export interface Save {
  version: 1;
  character: Character;
  rim: { stock: Item[]; gifts: Gift[]; lastResult: TitheSummary | null };
}

export type Result = { ok: true } | { ok: false; reason: string };

export function newSave(character: Character, rng: Rng, B: Balance): Save {
  return { version: 1, character, rim: { stock: forgeStock(rng, character, B), gifts: [], lastResult: null } };
}

export function forgeStock(rng: Rng, ch: Character, B: Balance): Item[] {
  const items: Item[] = [];
  for (let i = 0; i < B.rim.forgeItems; i++) {
    const rarity = rng.chance(B.rim.forgeRareChance) ? 'rare' : rng.chance(0.45) ? 'magic' : 'common';
    items.push(generateItem(rng, Math.max(1, ch.level), B, { rarity }));
  }
  return items;
}

function room(ch: Character, B: Balance): boolean {
  return ch.inventory.length < derivedStats(ch, B).capacity;
}

export function buyItem(save: Save, itemId: string, B: Balance): Result {
  const ch = save.character;
  const index = save.rim.stock.findIndex((i) => i.id === itemId);
  if (index < 0) return { ok: false, reason: 'Sold out.' };
  const item = save.rim.stock[index]!;
  if (ch.gold < item.value) return { ok: false, reason: 'Not enough gold.' };
  if (!room(ch, B)) return { ok: false, reason: 'Your inventory is full.' };
  ch.gold -= item.value;
  save.rim.stock.splice(index, 1);
  ch.inventory.push(item);
  return { ok: true };
}

export function sellAtForge(save: Save, itemId: string, B: Balance): number {
  return sellFromInventory(save.character, itemId, B);
}

export function buyConsumable(save: Save, kind: 'potion' | 'ration', B: Balance): Result {
  const ch = save.character;
  const price = kind === 'potion' ? B.rim.potionPrice : B.rim.rationPrice;
  const key = kind === 'potion' ? 'potions' : 'rations';
  if (ch.gold < price) return { ok: false, reason: 'Not enough gold.' };
  if (ch[key] >= B.character.maxConsumables) return { ok: false, reason: 'You cannot carry more.' };
  ch.gold -= price;
  ch[key] += 1;
  return { ok: true };
}

export function acceptGift(save: Save, giftId: string, B: Balance): Result {
  const ch = save.character;
  const index = save.rim.gifts.findIndex((g) => g.id === giftId);
  if (index < 0) return { ok: false, reason: 'The gift is gone.' };
  const gift = save.rim.gifts[index]!;
  if (gift.kind === 'item' && gift.item) {
    if (!room(ch, B)) return { ok: false, reason: 'Your inventory is full.' };
    ch.inventory.push(gift.item);
  } else {
    ch.gold += gift.gold ?? 0;
  }
  save.rim.gifts.splice(index, 1);
  return { ok: true };
}

/** Kronens pengepung (Feature-022): dybde, Warden, Renown og Champion; et fald eller at forlade halverer. */
export function crownsPurse(result: TitheResult, B: Balance): number {
  const P = B.rim.purse;
  const { record, outcome } = result;
  const lost = outcome.kind === 'fell' || outcome.kind === 'left';
  return Math.round(
    (record.maxDepth * P.perDepth + (record.wardenSlain ? P.warden : 0) + record.renown * P.perRenown +
      (outcome.kind === 'champion' ? P.champion : 0)) * (lost ? P.fallFactor : 1),
  );
}

/** Afslutter en Tithe for spilleren: pengepung, fundet guld, straf for at falde, sponsorgaver og ny smedje. */
export function finishTithe(save: Save, t: TitheResult, B: Balance): TitheSummary {
  const ch = save.character;
  const R = B.rim;
  const rec = t.record;
  const lost = t.outcome.kind === 'fell' || t.outcome.kind === 'left';
  const lose = lost && R.fallPenalty === 'lose-found';
  const rng = createRng((t.seed ^ 0x9e3779b9) >>> 0);

  const lostItems: string[] = [];
  if (lose) {
    for (const item of [...ch.inventory]) {
      if (item.found === t.id) {
        lostItems.push(item.name);
        ch.inventory.splice(ch.inventory.indexOf(item), 1);
      }
    }
    for (const slot of ['weapon', 'armour', 'ring'] as const) {
      const item = ch.equipment[slot];
      if (item && item.found === t.id) {
        lostItems.push(item.name);
        ch.equipment[slot] = null;
      }
    }
  }
  for (const item of [...ch.inventory, ...Object.values(ch.equipment)]) if (item) delete item.found;

  const goldFound = lose ? 0 : rec.goldFound;
  const purse = crownsPurse(t, B);
  ch.gold += goldFound + purse;
  ch.tithes += 1;
  if (t.outcome.kind === 'champion') ch.championships += 1;

  const giftCount = Math.min(R.maxGifts, Math.floor(rec.renown / R.giftPerRenown));
  for (let i = 0; i < giftCount; i++) {
    const house = rng.pick(R.houses);
    if (i % 2 === 0) {
      const rarity = i === 0 && rec.renown >= 3 * R.giftPerRenown ? 'rare' : 'magic';
      save.rim.gifts.push({ id: 'g' + rng.id(), house, kind: 'item', item: generateItem(rng, ch.level, B, { rarity }) });
    } else {
      save.rim.gifts.push({ id: 'g' + rng.id(), house, kind: 'gold', gold: Math.round(R.giftGold * (1 + 0.2 * ch.level)) });
    }
  }
  save.rim.stock = forgeStock(rng, ch, B);

  const skills = Object.fromEntries(
    (Object.entries(ch.skills) as [SkillId, { level: number }][]).map(([k, s]) => [k, { from: t.start.skills[k], to: s.level }]),
  );
  const summary: TitheSummary = {
    tithe: ch.tithes,
    outcome: t.outcome,
    seconds: Math.round(t.time),
    record: { ...rec },
    purse,
    goldFound,
    goldLost: lose ? rec.goldFound : 0,
    lostItems,
    gifts: giftCount,
    marks: { from: t.start.level, to: ch.level },
    skills,
  };
  save.rim.lastResult = summary;
  return summary;
}
