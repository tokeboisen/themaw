// Gear: startudstyret (Feature-005) og hotbaren med tasterne 1–8 (Feature-027).

import type { Balance } from './balance.ts';
import { generateItem } from './items.ts';
import type { Rng } from './rng.ts';
import type { Background, Item } from './types.ts';

export const HOTBAR_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;
export type HotbarKey = (typeof HOTBAR_KEYS)[number];
/** Den eneste Echo Art indtil videre (Feature-027). */
export const ECHO_ARTS = ['Echo Bolt'] as const;
export type EchoArt = (typeof ECHO_ARTS)[number];

export type HotbarSlot = { weapon: string } | { echoArt: EchoArt };
export type Hotbar = Partial<Record<HotbarKey, HotbarSlot>>;

export const isHotbarKey = (key: unknown): key is HotbarKey => HOTBAR_KEYS.includes(key as HotbarKey);
export const isEchoArt = (art: unknown): art is EchoArt => ECHO_ARTS.includes(art as EchoArt);

export interface StartingKit {
  weapon: Item;
  armour: Item;
  potions: number;
  rations: number;
  hotbar: Hotbar;
}

/** Feature-005: baggrundens våben og en Padded Coat, begge almindelige og taget på, 2 potions, 3 rations og en hotbar
 * med våbnet på tast 1 og Echo Bolt på tast 2. */
export function startingKit(bg: Background, rng: Rng, B: Balance): StartingKit {
  const weapon = generateItem(rng, 1, B, { baseId: bg.weapon, rarity: 'common' });
  const armour = generateItem(rng, 1, B, { baseId: 'padded_coat', rarity: 'common' });
  return {
    weapon,
    armour,
    potions: B.character.startPotions,
    rations: B.character.startRations,
    hotbar: { '1': { weapon: weapon.id }, '2': { echoArt: 'Echo Bolt' } },
  };
}

function sameSlot(a: HotbarSlot, b: HotbarSlot): boolean {
  return ('weapon' in a && 'weapon' in b && a.weapon === b.weapon) || ('echoArt' in a && 'echoArt' in b && a.echoArt === b.echoArt);
}

/** Feature-027 CMD-01: et våben eller en Echo Art er på højst én tast; lægges den på en anden, flyttes den. */
export function assignHotbarKey(hotbar: Hotbar, key: HotbarKey, slot: HotbarSlot): Hotbar {
  const next: Hotbar = {};
  for (const k of HOTBAR_KEYS) {
    const current = hotbar[k];
    if (current && !sameSlot(current, slot)) next[k] = current;
  }
  next[key] = slot;
  return next;
}

/** Feature-027 CMD-02 */
export function clearHotbarKey(hotbar: Hotbar, key: HotbarKey): Hotbar {
  const next = { ...hotbar };
  delete next[key];
  return next;
}

/** Feature-027 AGG-01: når et våben forlader inventaret, tømmes dets tast. */
export function removeWeaponFromHotbar(hotbar: Hotbar, itemId: string): Hotbar {
  const next: Hotbar = {};
  for (const k of HOTBAR_KEYS) {
    const slot = hotbar[k];
    if (slot && !('weapon' in slot && slot.weapon === itemId)) next[k] = slot;
  }
  return next;
}
