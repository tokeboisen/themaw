// Gear: startudstyret (Feature-005) og hotbaren med tasterne 1–8 (Feature-027).

import type { Balance } from './balance.ts';
import { generateItem } from './items.ts';
import type { Rng } from './rng.ts';
import type { Background, Character, Item, TalentId } from './types.ts';

export const HOTBAR_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;
export type HotbarKey = (typeof HOTBAR_KEYS)[number];
/** Feature-047: de 28 Echo Arts i spellbookens rækkefølge, level 1–9 (tallene står i BALANCE.echoArts). */
export const ECHO_ARTS = [
  'Echo Bolt', 'Ringing Ward', 'Hollow Call', 'Shared Breath',
  'Crystal Cage', 'Step Through the Echo', 'Rally Toll',
  'Shatterpulse', 'Mirror Double', 'Hearth Echo',
  'Hunger of the Maw', 'Resonant Line', 'Chorus of the Branded',
  'Toll of Stillness', 'Cinder Echo', 'Crystal Mantle',
  'Echo Chain', 'Last Words', "Brand's Refusal",
  'Mirror Storm', 'The Maw Remembers', 'Echo of Courage',
  'Shatter the Depth', 'Unmaking Note', 'Kindled Brands',
  'The Maw Holds Its Breath', 'Requiem of the Tithed', 'Crown of Echoes',
] as const;
export type EchoArt = (typeof ECHO_ARTS)[number];

/** Feature-027: en tast holder et våben, en Echo Art eller karakterens talent (Feature-049). */
export type HotbarSlot = { weapon: string } | { echoArt: EchoArt } | { talent: TalentId };
export type Hotbar = Partial<Record<HotbarKey, HotbarSlot>>;

export const isHotbarKey = (key: unknown): key is HotbarKey => HOTBAR_KEYS.includes(key as HotbarKey);

/** Navnet på det, der ligger på en tast: Echo Art'en, talentet eller våbnet. */
export function hotbarSlotName(slot: HotbarSlot, weaponName: (id: string) => string, B: Balance): string {
  if ('echoArt' in slot) return slot.echoArt;
  if ('talent' in slot) return B.talents[slot.talent].name;
  return weaponName(slot.weapon);
}
export const isEchoArt = (art: unknown): art is EchoArt => ECHO_ARTS.includes(art as EchoArt);

/** Feature-048: Echo Arts-niveauet, en Echo Art kræver: 10 × (level − 1). */
export function artRequirement(art: EchoArt, B: Balance): number {
  return 10 * (B.echoArts[art].level - 1);
}

/** Feature-048: en karakter kender en Echo Art, når dens Echo Arts er mindst 10 × (level − 1). */
export function knowsArt(ch: Pick<Character, 'skills'>, art: EchoArt, B: Balance): boolean {
  return ch.skills.echo.level >= artRequirement(art, B);
}

export interface StartingKit {
  weapon: Item;
  armour: Item;
  potions: number;
  focusPotions: number;
  rations: number;
  hotbar: Hotbar;
}

/** Feature-005: baggrundens våben og en Padded Coat, begge almindelige og taget på, 2 potions, 1 focus potion, 3 rations og en hotbar
 * med våbnet på tast 1 og Echo Bolt på tast 2. */
export function startingKit(bg: Background, rng: Rng, B: Balance): StartingKit {
  const weapon = generateItem(rng, 1, B, { baseId: bg.weapon, rarity: 'common' });
  const armour = generateItem(rng, 1, B, { baseId: 'padded_coat', rarity: 'common' });
  return {
    weapon,
    armour,
    potions: B.character.startPotions,
    focusPotions: B.character.startFocusPotions,
    rations: B.character.startRations,
    hotbar: { '1': { weapon: weapon.id }, '2': { echoArt: 'Echo Bolt' }, '3': { talent: bg.talent } },
  };
}

function sameSlot(a: HotbarSlot, b: HotbarSlot): boolean {
  return ('weapon' in a && 'weapon' in b && a.weapon === b.weapon) || ('echoArt' in a && 'echoArt' in b && a.echoArt === b.echoArt)
    || ('talent' in a && 'talent' in b);
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
