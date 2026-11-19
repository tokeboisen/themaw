// Kald til api'et. Afviste commands kommer tilbage med featurens UI-tekst ({ message, field? }).

import type { Refusal } from '@maw/contracts';
import type { Allocation, Background, Character, SkillState } from '@maw/rules';

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
};
