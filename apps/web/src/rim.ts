// The Rim's faner: Forge (Feature-019), Apothecary (Feature-020) og Patrons' Hall (Feature-024).

import { identifyPrice, BALANCE as B, sellValue, type Character, type Item } from '@maw/rules';
import type { GiftView, InventoryView } from './api.ts';
import { esc } from './dom.ts';
import { itemRow } from './items.ts';

export type RimTab = 'forge' | 'apothecary' | 'patrons';

export interface RimData {
  gold: number;
  stock: Item[];
  inventory: InventoryView | null;
  gifts: GiftView[];
}

const price = (gold: number) => `<span class="gold-text">${gold} gold</span>`;

export function forgeHtml(d: RimData, message: string, ch: Character | null = null): string {
  const stock = d.stock.length
    ? d.stock.map((item) => itemRow(item, `${price(item.value)}
        <button class="ghost small-btn" data-act="buy" data-id="${item.id}" ${d.gold < item.value ? 'disabled' : ''}>Buy</button>`, '', '', ch)).join('')
    : '<li class="muted">Nothing for sale.</li>';
  const pack = d.inventory?.pack ?? [];
  const sell = pack.length
    ? pack.map((item) => itemRow(item, `${price(sellValue(item, B))}
        <button class="ghost small-btn" data-act="sell" data-id="${item.id}">Sell</button>`, '', '', ch)).join('')
    : '<li class="muted">Your pack is empty.</li>';
  // Feature-019 VIEW-01: Identify all – hvor mange ting der er uidentificerede, og hvad det koster.
  const inv = d.inventory;
  const owned = inv ? [...Object.values(inv.equipment).filter((i): i is Item => !!i), ...inv.pack, ...inv.chest] : [];
  const id = identifyPrice(owned, B);
  const identify = `<div class="identify-row"><span>${id.count ? `${id.count} unidentified item${id.count > 1 ? 's' : ''} · ${price(id.price)}` : '<span class="muted">Nothing to identify.</span>'}</span>
      <button class="ghost small-btn" data-act="forge-identify" ${!id.count || d.gold < id.price ? 'disabled' : ''}>Identify all</button></div>`;
  return `<p class="quote">Hesta Varn, the smith: "Steel for the Branded. Coin first."</p>
    <div class="msg">${esc(message)}</div>
    <div class="cols">
      <div class="box"><h3>For sale</h3><ul class="items">${stock}</ul></div>
      <div class="box"><h3>Your inventory</h3><ul class="items">${sell}</ul>${identify}</div>
    </div>`;
}

/**
 * Feature-043 VIEW-01 Chest: tingene i kisten med Take og tingene i pakken med Put in chest, og hvor mange af de 12
 * pladser der er brugt.
 */
export function chestHtml(d: RimData, message: string, ch: Character | null = null): string {
  const inv = d.inventory;
  if (!inv) return '<p class="hint">The chest is on its way…</p>';
  const full = inv.chest.length >= inv.chestSize;
  const chest = inv.chest.length
    ? inv.chest.map((item) => itemRow(item, `<button class="ghost small-btn" data-act="chest-take" data-id="${item.id}">Take</button>`, '', '', ch)).join('')
    : '<li class="muted">The chest is empty.</li>';
  const pack = inv.pack.length
    ? inv.pack.map((item) => itemRow(item, `<button class="ghost small-btn" data-act="chest-put" data-id="${item.id}" ${full ? 'disabled' : ''}>Put in chest</button>`, '', '', ch)).join('')
    : '<li class="muted">Your pack is empty.</li>';
  return `<p class="quote">An iron-bound chest with your Brand burned into the lid. What lies here never goes into the Maw.</p>
    <div class="msg">${esc(message)}</div>
    <div class="cols">
      <div class="box"><h3>Chest · ${inv.chest.length} / ${inv.chestSize}</h3><ul class="items">${chest}</ul></div>
      <div class="box"><h3>Your pack · ${inv.pack.length} / ${inv.capacity}</h3><ul class="items">${pack}</ul></div>
    </div>`;
}

export function apothecaryHtml(d: RimData, message: string): string {
  const max = B.character.maxConsumables;
  const row = (kind: 'potion' | 'focusPotion' | 'ration', name: string, what: string, cost: number, have: number) =>
    `<li class="item"><div><div class="item-name">${name}</div><div class="hint">${what} You have ${have} / ${max}.</div></div>
      <div class="actions">${price(cost)}
        <button class="ghost small-btn" data-act="buy-consumable" data-id="${kind}" ${d.gold < cost || have >= max ? 'disabled' : ''}>Buy</button></div></li>`;
  return `<p class="quote">Mother Quill: "Drink before you need it, child. Eat before you starve."</p>
    <div class="msg">${esc(message)}</div>
    <div class="box"><ul class="items">
      ${row('potion', 'Healing Draught', `Restores ${Math.round(B.combat.potionHeal * 100)} % of your life.`, B.rim.potionPrice, d.inventory?.potions ?? 0)}
      ${row('focusPotion', 'Focus Draught', `Restores ${Math.round(B.combat.focusPotionRestore * 100)} % of your focus.`, B.rim.focusPotionPrice, d.inventory?.focusPotions ?? 0)}
      ${row('ration', 'Ration', `Restores ${B.hunger.rationRestores} hunger.`, B.rim.rationPrice, d.inventory?.rations ?? 0)}
    </ul></div>`;
}

export function patronsHtml(d: RimData, message: string): string {
  const gifts = d.gifts.length
    ? d.gifts.map((g) => g.kind === 'gold'
        ? `<li class="item"><div><div class="item-name">${esc(g.house)} sends ${g.gold} gold</div></div>
            <div class="actions"><button class="ghost small-btn" data-act="accept-gift" data-id="${g.id}">Accept</button></div></li>`
        : itemRow(g.item!, `<span class="hint">${esc(g.house)}</span>
            <button class="ghost small-btn" data-act="accept-gift" data-id="${g.id}">Accept</button>`)).join('')
    : '<li class="muted">No gifts are waiting.</li>';
  return `<p class="quote">The agents of the Noble Houses watch every Tithe through the Mirrors. They send one gift for every
      ${B.rim.giftPerRenown} Renown in a Tithe, at most ${B.rim.maxGifts}. The crowd loves kill streaks, defeated rivals and players,
      new depths and the Warden.</p>
    <div class="msg">${esc(message)}</div>
    <div class="box"><ul class="items">${gifts}</ul></div>`;
}
