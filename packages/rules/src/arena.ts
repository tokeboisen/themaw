// Feature-045 Fight in the arena: banen – en oval af sand, 36 × 24 felter, omgivet af tribunerne – med klipper, træer
// og buske, der ligger ens på begge halvdele, og ringen, der lukker sig fra tribunerne ind mod midten.

import type { Balance } from './balance.ts';
import { BUSH, FLOOR, TREE, WALL, type DepthMap } from './dungeon.ts';

export type ArenaFormat = '1v1' | '2v1' | '2v2';
export type ArenaSide = 1 | 2;

export const ARENA_W = 40;
export const ARENA_H = 28;
/** Ovalens midte og halvakser i felter. */
export const ARENA_OVAL = { cx: 20, cy: 14, rx: 18, ry: 12 } as const;

/** Hvor hver sides kæmpere starter: i hver sin ende af ovalen. */
export const ARENA_SPAWNS: Record<ArenaSide, { x: number; y: number }[]> = {
  1: [{ x: 4.5, y: 12.5 }, { x: 4.5, y: 15.5 }],
  2: [{ x: 35.5, y: 12.5 }, { x: 35.5, y: 15.5 }],
};

// Venstre halvdel; højre halvdel er den samme spejlet om midten (x → 39 − x).
const ROCKS: [number, number][] = [[11, 13], [11, 14], [15, 8], [16, 8], [15, 19], [16, 19], [19, 13], [19, 14]];
const TREES: [number, number][] = [[8, 7], [7, 20], [13, 4], [13, 23], [17, 11], [17, 16]];
const BUSHES: [number, number][] = [
  [7, 9], [8, 9], [7, 10], [7, 17], [7, 18], [8, 18], [14, 13], [14, 14], [13, 14], [17, 5], [18, 5], [17, 22], [18, 22],
];

/** Står feltet inde i ovalen? */
export function inOval(x: number, y: number, oval: { cx: number; cy: number; rx: number; ry: number } = ARENA_OVAL): boolean {
  return ((x - oval.cx) / oval.rx) ** 2 + ((y - oval.cy) / oval.ry) ** 2 <= 1;
}

let cached: DepthMap | null = null;

/** Feature-045 AGG-01: arenaens kort. Udenfor ovalen er tribunerne (mur). */
export function arenaMap(): DepthMap {
  if (cached) return cached;
  const w = ARENA_W;
  const h = ARENA_H;
  const tiles = new Uint8Array(w * h).fill(WALL);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inOval(x + 0.5, y + 0.5)) tiles[y * w + x] = FLOOR;
  const put = (list: [number, number][], tile: number) => {
    for (const [x, y] of list) {
      tiles[y * w + x] = tile;
      tiles[y * w + (w - 1 - x)] = tile;
    }
  };
  put(ROCKS, WALL);
  put(TREES, TREE);
  put(BUSHES, BUSH);
  const room = { x: 2, y: 2, w: w - 4, h: h - 4, cx: ARENA_OVAL.cx, cy: ARENA_OVAL.cy };
  cached = {
    w, h, tiles, rooms: [room], start: { ...ARENA_SPAWNS[1][0]! }, exit: { x: ARENA_OVAL.cx, y: 2 }, startRoom: room, exitRoom: room,
    wardenRoom: null, gate: null, gateOpen: false,
  };
  return cached;
}

/**
 * Feature-045 AGG-02: ringen. Efter 2 minutter lukker den sig fra tribunerne; ved 3½ minut er kun den midterste
 * fjerdedel tilbage (halvakserne er halveret). Før det er ringen hele ovalen.
 */
export function arenaRing(time: number, B: Balance): { cx: number; cy: number; rx: number; ry: number } {
  const A = B.arena;
  const k = Math.max(0, Math.min(1, (time - A.shrinkFrom) / (A.shrinkTo - A.shrinkFrom)));
  const scale = 1 - (1 - A.minRing) * k;
  return { cx: ARENA_OVAL.cx, cy: ARENA_OVAL.cy, rx: ARENA_OVAL.rx * scale, ry: ARENA_OVAL.ry * scale };
}

/** Feature-044 AGG-01: pladserne på hver side i et format. */
export function arenaPlaces(format: ArenaFormat, B: Balance): Record<ArenaSide, number> {
  const [a, b] = B.arena.formats[format];
  return { 1: a, 2: b };
}

/**
 * Feature-046 CMD-02 Pay the winners: potten er indsatsen × kæmperne og deles ligeligt af vinderne, rundet ned.
 * Uafgjort giver hver kæmper indsatsen tilbage; den, der taber, får intet.
 */
export function arenaPayout(stake: number, fighters: number, winners: number, result: 'won' | 'lost' | 'draw'): number {
  if (result === 'draw') return stake;
  if (result === 'lost' || winners <= 0) return 0;
  return Math.floor((stake * fighters) / winners);
}

export const isArenaFormat = (x: unknown): x is ArenaFormat => x === '1v1' || x === '2v1' || x === '2v2';
