// The Rim: smedjen, apoteket, sponsorgaver og Kronens pengepung
// (Feature-009, -018 til -024). Overført fra prototypen; i serveren deles det mellem Gear, Market og Patronage.

import type { Balance } from './balance.ts';
import { derivedStats, sellItem as sellFromInventory } from './character.ts';
import { EQUIP_SLOTS, generateItem } from './items.ts';
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
  /** Feature-011 EVT-06: spillere, som spilleren har slået ned (fase 4). */
  playersDefeated: number;
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
    const rarity = rng.chance(B.rim.forgeRareChance) ? 'rare' : rng.chance(B.rim.forgeMagicChance) ? 'magic' : 'common';
    items.push(generateItem(rng, Math.max(1, ch.level), B, { rarity }));
  }
  return items;
}

/** Feature-021 CMD-01: 7 ting med karakterens Mark som item level: 2 % rare, ellers 12 % magic, ellers common. */
export function forgeStockAt(rng: Rng, mark: number, B: Balance): Item[] {
  return forgeStock(rng, { level: mark } as Character, B);
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

/** Feature-020: hvad Apothecary sælger. */
export type ConsumableKind = 'potion' | 'focusPotion' | 'ration';
export const CONSUMABLE_KEYS = { potion: 'potions', focusPotion: 'focusPotions', ration: 'rations' } as const;

export function buyConsumable(save: Save, kind: ConsumableKind, B: Balance): Result {
  const ch = save.character;
  const price = kind === 'potion' ? B.rim.potionPrice : kind === 'focusPotion' ? B.rim.focusPotionPrice : B.rim.rationPrice;
  const key = CONSUMABLE_KEYS[kind];
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
export function crownsPurse(result: Pick<TitheResult, 'outcome' | 'record'>, B: Balance): number {
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

  const lostItems = settleFoundGear(ch, t.id, lose).lost.map((item) => item.name);

  const goldFound = lose ? 0 : rec.goldFound;
  const purse = crownsPurse(t, B);
  ch.gold += goldFound + purse;
  ch.tithes += 1;
  if (t.outcome.kind === 'champion') ch.championships += 1;

  const gifts = grantGifts(rng, rec.renown, ch.level, B);
  save.rim.gifts.push(...gifts);
  const giftCount = gifts.length;
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

/** Feature-023 CMD-01: én gave for hver 100 Renown, højst 4. */
export function giftCount(renown: number, B: Balance): number {
  return Math.min(B.rim.maxGifts, Math.floor(renown / B.rim.giftPerRenown));
}

/**
 * Feature-023 CMD-01: hver anden gave er en ting – den første sjælden ved 300 Renown eller mere, ellers magisk – og de
 * andre er guld: 40 × (1 + 0,2 × Mark).
 */
export function grantGifts(rng: Rng, renown: number, mark: number, B: Balance): Gift[] {
  const R = B.rim;
  const gifts: Gift[] = [];
  for (let i = 0; i < giftCount(renown, B); i++) {
    const house = rng.pick(R.houses);
    if (i % 2 === 0) {
      // Feature-023: almindelige ting; den første er magisk, når Tithen gav 600 Renown eller mere.
      const rarity = i === 0 && renown >= R.giftMagicRenown ? 'magic' : 'common';
      gifts.push({ id: 'g' + rng.id(), house, kind: 'item', item: generateItem(rng, mark, B, { rarity }) });
    } else {
      gifts.push({ id: 'g' + rng.id(), house, kind: 'gold', gold: Math.round(R.giftGold * (1 + 0.2 * mark)) });
    }
  }
  return gifts;
}

/**
 * Feature-009 CMD-01: ved et fald eller når spilleren forlader Tithen, mistes det, der er fundet i den – også fundne
 * ting, der er taget på – men aldrig det, kandidaten havde med ned. Bagefter er intet længere markeret som fundet.
 */
export function settleFoundGear(ch: Character, titheId: string, lose: boolean): { lost: Item[]; kept: Item[] } {
  const lost: Item[] = [];
  const kept: Item[] = [];
  for (const item of [...ch.inventory]) {
    if (item.found !== titheId) continue;
    if (lose) {
      lost.push(item);
      ch.inventory.splice(ch.inventory.indexOf(item), 1);
    } else kept.push(item);
  }
  for (const slot of EQUIP_SLOTS) {
    const item = ch.equipment[slot];
    if (!item || item.found !== titheId) continue;
    if (lose) {
      lost.push(item);
      ch.equipment[slot] = null;
    } else kept.push(item);
  }
  for (const item of [...ch.inventory, ...Object.values(ch.equipment)]) if (item) delete item.found;
  return { lost, kept };
}

/** Et fald eller at forlade Tithen koster det fundne (Feature-009, -029). */
export function losesFound(kind: OutcomeKind): boolean {
  return kind === 'fell' || kind === 'left';
}
