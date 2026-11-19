// Kald til api'et. Afviste commands kommer tilbage med featurens UI-tekst ({ message, field? }).

import type { Refusal } from '@maw/contracts';
import type { Allocation, Background, Character, Equipment, Hotbar, Item, SkillState } from '@maw/rules';

export interface CharacterView {
  id: string;
  name: string;
  background: string;
  mark: number;
  echo: number;
  attributes: Character['attributes'];
  skills: Record<string, SkillState>;
  attributePoints: number;
  skillPoints: number;
}

export interface BackgroundView extends Background {
  weaponName: string;
}

export interface InventoryView {
  equipment: Equipment;
  pack: Item[];
  potions: number;
  rations: number;
  hotbar: Hotbar;
  capacity: number;
}

export interface GiftView {
  id: string;
  house: string;
  kind: 'item' | 'gold';
  item: Item | null;
  gold: number | null;
}

export type Result<T> = { ok: true; data: T } | { ok: false; status: number; refusal: Refusal };

async function call<T>(method: string, url: string, body?: unknown): Promise<Result<T>> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;
  if (response.ok) return { ok: true, data: data as T };
  return { ok: false, status: response.status, refusal: (data as Refusal) ?? { message: response.statusText } };
}

export const api = {
  me: () => call<{ userName: string }>('GET', '/api/me'),
  createUser: (userName: string, password: string) => call<{ userName: string }>('POST', '/api/users', { userName, password }),
  logIn: (userName: string, password: string) => call<{ userName: string }>('POST', '/api/sessions', { userName, password }),
  logOut: () => call<void>('DELETE', '/api/sessions'),
  backgrounds: () => call<{ creation: { attributeTotal: number; skillTotal: number; nameMax: number }; backgrounds: BackgroundView[] }>('GET', '/api/backgrounds'),
  characters: () => call<{ characters: CharacterView[]; activeCharacterId: string | null }>('GET', '/api/characters'),
  character: (id: string) => call<CharacterView>('GET', `/api/characters/${id}`),
  createCharacter: (name: string, background: string, alloc: Allocation) =>
    call<CharacterView>('POST', '/api/characters', { name, background, ...alloc }),
  chooseCharacter: (id: string) => call<{ activeCharacterId: string }>('POST', `/api/characters/${id}/choose`),
  deleteCharacter: (id: string) => call<void>('DELETE', `/api/characters/${id}`),
  spendAttributePoint: (id: string, attribute: string) => call<CharacterView>('POST', `/api/characters/${id}/attribute-points`, { attribute }),
  spendSkillPoint: (id: string, skill: string) => call<CharacterView>('POST', `/api/characters/${id}/skill-points`, { skill }),
  // Gear (F007, F027)
  inventory: (id: string) => call<InventoryView>('GET', `/api/characters/${id}/inventory`),
  equip: (id: string, itemId: string) => call<InventoryView>('POST', `/api/characters/${id}/equip`, { itemId }),
  unequip: (id: string, slot: string) => call<InventoryView>('POST', `/api/characters/${id}/unequip`, { slot }),
  assignHotbar: (id: string, key: string, target: { itemId: string } | { echoArt: string }) =>
    call<InventoryView>('PUT', `/api/characters/${id}/hotbar/${key}`, target),
  clearHotbar: (id: string, key: string) => call<InventoryView>('DELETE', `/api/characters/${id}/hotbar/${key}`),
  // Market (F018, F019, F020)
  wallet: (id: string) => call<{ gold: number }>('GET', `/api/characters/${id}/wallet`),
  forge: (id: string) => call<{ gold: number; stock: Item[] }>('GET', `/api/characters/${id}/forge`),
  buy: (id: string, itemId: string) => call<{ gold: number; stock: Item[] }>('POST', `/api/characters/${id}/forge/buy`, { itemId }),
  sell: (id: string, itemId: string) => call<{ gold: number; sold: number }>('POST', `/api/characters/${id}/forge/sell`, { itemId }),
  buyConsumable: (id: string, kind: 'potion' | 'ration') => call<{ gold: number }>('POST', `/api/characters/${id}/apothecary/buy`, { kind }),
  // Patronage (F024)
  gifts: (id: string) => call<{ gifts: GiftView[] }>('GET', `/api/characters/${id}/gifts`),
  acceptGift: (id: string, giftId: string) => call<GiftView>('POST', `/api/characters/${id}/gifts/${giftId}/accept`),
};
