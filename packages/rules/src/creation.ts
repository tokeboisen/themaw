// Feature-001 Create character: point på egenskaber og skills inden for baggrundens grænser.
// Bruges af webappen (knapperne − og +, "Points left") og af api'et (CMD-01 Create character).

import type { Balance } from './balance.ts';
import { ATTRIBUTES, CREATION_SKILLS } from './character.ts';
import { emptyEquipment } from './items.ts';
import type { Allocation, Attribute, Background, Character, CreationSkill } from './types.ts';

export type PointKind = 'attributes' | 'skills';
export type CreationProblem = 'name' | 'background' | 'limits' | 'points';

export function backgroundById(B: Balance, id: string): Background | undefined {
  return B.backgrounds.find((b) => b.id === id);
}

/** Baggrundens forslag (Feature-001: "Choosing a background places its suggested points"). */
export function suggestedAllocation(bg: Background): Allocation {
  return { attributes: { ...bg.suggestion.attributes }, skills: { ...bg.suggestion.skills } };
}

function sum(values: Record<string, number>): number {
  return Object.values(values).reduce((a, b) => a + b, 0);
}

/** "Points left": de point, der ikke er placeret, for egenskaber og skills. */
export function pointsLeft(alloc: Allocation, B: Balance): Record<PointKind, number> {
  return {
    attributes: B.creation.attributeTotal - sum(alloc.attributes),
    skills: B.creation.skillTotal - sum(alloc.skills),
  };
}

function limitOf(bg: Background, kind: PointKind, key: string) {
  return kind === 'attributes' ? bg.limits.attributes[key as Attribute] : bg.limits.skills[key as CreationSkill];
}

function valueOf(alloc: Allocation, kind: PointKind, key: string): number {
  return kind === 'attributes' ? alloc.attributes[key as Attribute] : alloc.skills[key as CreationSkill];
}

/** + er slået fra ved baggrundens maksimum, og når der ikke er flere point. */
export function canRaise(bg: Background, alloc: Allocation, kind: PointKind, key: string, B: Balance): boolean {
  return valueOf(alloc, kind, key) < limitOf(bg, kind, key).max && pointsLeft(alloc, B)[kind] > 0;
}

/** − er slået fra ved baggrundens minimum. */
export function canLower(bg: Background, alloc: Allocation, kind: PointKind, key: string): boolean {
  return valueOf(alloc, kind, key) > limitOf(bg, kind, key).min;
}

export function raise(alloc: Allocation, kind: PointKind, key: string): Allocation {
  const next = { attributes: { ...alloc.attributes }, skills: { ...alloc.skills } };
  if (kind === 'attributes') next.attributes[key as Attribute] += 1;
  else next.skills[key as CreationSkill] += 1;
  return next;
}

export function lower(alloc: Allocation, kind: PointKind, key: string): Allocation {
  const next = { attributes: { ...alloc.attributes }, skills: { ...alloc.skills } };
  if (kind === 'attributes') next.attributes[key as Attribute] -= 1;
  else next.skills[key as CreationSkill] -= 1;
  return next;
}

export interface CreationInput {
  name: string;
  background: string;
  attributes: Record<string, unknown>;
  skills: Record<string, unknown>;
}

/** Hvad der forhindrer, at karakteren oprettes (Feature-001 CMD-01). En tom liste betyder, at den kan oprettes. */
export function creationProblems(input: CreationInput, B: Balance): CreationProblem[] {
  const problems: CreationProblem[] = [];
  const name = (input.name ?? '').trim();
  if (name.length < 1 || [...name].length > B.creation.nameMax) problems.push('name');
  const bg = backgroundById(B, input.background);
  if (!bg) return [...problems, 'background'];
  const inRange = (kind: PointKind, keys: string[], values: Record<string, unknown>) =>
    keys.every((k) => {
      const v = values?.[k];
      const range = limitOf(bg, kind, k);
      return Number.isInteger(v) && (v as number) >= range.min && (v as number) <= range.max;
    }) && Object.keys(values ?? {}).every((k) => keys.includes(k));
  if (!inRange('attributes', ATTRIBUTES, input.attributes) || !inRange('skills', CREATION_SKILLS, input.skills)) {
    return [...problems, 'limits'];
  }
  const left = pointsLeft({ attributes: input.attributes as Allocation['attributes'], skills: input.skills as Allocation['skills'] }, B);
  if (left.attributes !== 0 || left.skills !== 0) problems.push('points');
  return problems;
}

/** Den nye karakter: Mark 1, ingen Echo og ingen point (Feature-001 AGG-01). Udstyr og guld hører til Gear og Market. */
export function newCharacter(name: string, bg: Background, alloc: Allocation): Character {
  return {
    name: name.trim(),
    background: bg.id,
    level: 1,
    echo: 0,
    attributes: { ...alloc.attributes },
    skills: {
      ...Object.fromEntries(CREATION_SKILLS.map((s) => [s, { level: alloc.skills[s], xp: 0 }])), talent: { level: 0, xp: 0 }, reveal: { level: 0, xp: 0 },
    } as Character['skills'],
    attributePoints: 0,
    skillPoints: 0,
    gold: 0,
    potions: 0,
    focusPotions: 0,
    rations: 0,
    equipment: emptyEquipment(),
    inventory: [],
    tithes: 0,
    championships: 0,
  };
}
