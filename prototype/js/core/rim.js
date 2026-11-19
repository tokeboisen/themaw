// The Rim: byen mellem Tithes. Smedjen, apoteket, sponsorgaver og Kronens pengepung.
// Et "save" er { version, character, rim: { stock, gifts, lastResult } }.

import { generateItem } from './items.js';
import { createRng } from './rng.js';
import { derivedStats, sellItem as sellFromInventory } from './character.js';

export const SAVE_VERSION = 1;

export function newSave(character, rng, B) {
  return { version: SAVE_VERSION, character, rim: { stock: forgeStock(rng, character, B), gifts: [], lastResult: null } };
}

export function forgeStock(rng, ch, B) {
  const items = [];
  for (let i = 0; i < B.rim.forgeItems; i++) {
    const rarity = rng.chance(B.rim.forgeRareChance) ? 'rare' : rng.chance(0.45) ? 'magic' : 'common';
    items.push(generateItem(rng, Math.max(1, ch.level), B, { rarity }));
  }
  return items;
}

function room(ch, B) {
  return ch.inventory.length < derivedStats(ch, B).capacity;
}

export function buyItem(save, itemId, B) {
  const ch = save.character;
  const index = save.rim.stock.findIndex((i) => i.id === itemId);
  if (index < 0) return { ok: false, reason: 'Sold out.' };
  const item = save.rim.stock[index];
  if (ch.gold < item.value) return { ok: false, reason: 'Not enough gold.' };
  if (!room(ch, B)) return { ok: false, reason: 'Your inventory is full.' };
  ch.gold -= item.value;
  save.rim.stock.splice(index, 1);
  ch.inventory.push(item);
  return { ok: true };
}

export function sellItem(save, itemId, B) {
  return sellFromInventory(save.character, itemId, B);
}

export function buyConsumable(save, kind, B) {
  const ch = save.character;
  const price = kind === 'potion' ? B.rim.potionPrice : B.rim.rationPrice;
  const key = kind === 'potion' ? 'potions' : 'rations';
  if (ch.gold < price) return { ok: false, reason: 'Not enough gold.' };
  if (ch[key] >= B.character.maxConsumables) return { ok: false, reason: 'You cannot carry more.' };
  ch.gold -= price;
  ch[key] += 1;
  return { ok: true };
}

export function acceptGift(save, giftId, B) {
  const ch = save.character;
  const index = save.rim.gifts.findIndex((g) => g.id === giftId);
  if (index < 0) return { ok: false, reason: 'The gift is gone.' };
  const gift = save.rim.gifts[index];
  if (gift.kind === 'item') {
    if (!room(ch, B)) return { ok: false, reason: 'Your inventory is full.' };
    ch.inventory.push(gift.item);
  } else {
    ch.gold += gift.gold;
  }
  save.rim.gifts.splice(index, 1);
  return { ok: true };
}

// Afslutter en Tithe: Kronens pengepung, fundet guld, straf for at falde, sponsorgaver og ny smedje.
export function finishTithe(save, t, B) {
  const ch = save.character;
  const R = B.rim;
  const rec = t.record;
  const outcome = t.outcome || { type: 'fell', name: 'unknown' };
  const fell = outcome.type === 'fell';
  const lose = fell && R.fallPenalty === 'lose-found';
  const rng = createRng((t.seed ^ 0x9e3779b9) >>> 0);

  const lostItems = [];
  if (lose) {
    for (const item of [...ch.inventory]) {
      if (item.found === t.id) {
        lostItems.push(item.name);
        ch.inventory.splice(ch.inventory.indexOf(item), 1);
      }
    }
    for (const slot of Object.keys(ch.equipment)) {
      const item = ch.equipment[slot];
      if (item && item.found === t.id) {
        lostItems.push(item.name);
        ch.equipment[slot] = null;
      }
    }
  }
  for (const item of [...ch.inventory, ...Object.values(ch.equipment)]) if (item) delete item.found;

  const goldFound = lose ? 0 : rec.goldFound;
  const P = R.purse;
  const purse = Math.round(
    (rec.maxDepth * P.perDepth + (rec.wardenSlain ? P.warden : 0) + rec.renown * P.perRenown + (outcome.type === 'champion' ? P.champion : 0)) *
      (fell ? P.fallFactor : 1),
  );
  ch.gold += goldFound + purse;
  ch.tithes += 1;
  if (outcome.type === 'champion') ch.championships += 1;

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

  const skills = Object.fromEntries(Object.entries(ch.skills).map(([k, s]) => [k, { from: t.start.skills[k], to: s.level }]));
  const summary = {
    tithe: ch.tithes,
    outcome,
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
