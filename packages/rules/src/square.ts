// Feature-042 Walk the Mustering Square: pladsen i the Rim, hvor de Branded samles mellem Tithes. Hesta Varns smedje mod
// vest, Mother Quills apotek mod øst, Patrons' Hall mod nord og Tithe Board i midten. Kortet er fast; tithe-server
// holder spillernes positioner, og webappen tegner pladsen og åbner stederne.

import { FLOOR, ROAD, WALL, moveWithCollision, type Circle, type DepthMap } from './dungeon.ts';

export type SquarePlace = 'forge' | 'apothecary' | 'patrons' | 'board';

export interface SquarePlaceInfo {
  id: SquarePlace;
  name: string;
  /** Hvor man står for at åbne stedet med F. */
  x: number;
  y: number;
}

export const SQUARE_W = 36;
export const SQUARE_H = 26;

/** Feature-042 VIEW-01: stederne på pladsen og navnene i "<name> – press F". */
export const SQUARE_PLACES: SquarePlaceInfo[] = [
  { id: 'forge', name: 'Forge', x: 6.5, y: 13 },
  { id: 'apothecary', name: 'Apothecary', x: 29.5, y: 13 },
  { id: 'patrons', name: "Patrons' Hall", x: 18, y: 5.5 },
  { id: 'board', name: 'Tithe Board', x: 18, y: 14.6 },
];

/** Bygningerne omkring pladsen, til tegningen: x, y, bredde, højde og navnet over døren. */
export const SQUARE_BUILDINGS = [
  { id: 'forge', x: 1, y: 9, w: 4, h: 8, label: "Hesta Varn's Forge" },
  { id: 'apothecary', x: 31, y: 9, w: 4, h: 8, label: "Mother Quill's Apothecary" },
  { id: 'patrons', x: 13, y: 1, w: 10, h: 3, label: "Patrons' Hall" },
] as const;

/** Tithe Board i midten: et solidt opslag, man går hen til. */
export const SQUARE_BOARD = { x: 17, y: 12, w: 2, h: 2 } as const;

/** Hvor en spiller kommer ind på pladsen: ved buen mod syd. */
export const SQUARE_ENTRY = { x: 18, y: 22.5 } as const;

let cached: DepthMap | null = null;

export function squareMap(): DepthMap {
  if (cached) return cached;
  const w = SQUARE_W;
  const h = SQUARE_H;
  const tiles = new Uint8Array(w * h).fill(ROAD);
  const rect = (x: number, y: number, rw: number, rh: number, v: number) => {
    for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) tiles[yy * w + xx] = v;
  };
  // Husene rundt om pladsen; kanten er mur.
  rect(0, 0, w, 1, WALL);
  rect(0, h - 1, w, 1, WALL);
  rect(0, 0, 1, h, WALL);
  rect(w - 1, 0, 1, h, WALL);
  for (const b of SQUARE_BUILDINGS) rect(b.x, b.y, b.w, b.h, WALL);
  // Husrækker mellem stederne, så pladsen har form.
  rect(1, 1, 11, 7, WALL);
  rect(24, 1, 11, 7, WALL);
  rect(1, 18, 13, 7, WALL);
  rect(22, 18, 13, 7, WALL);
  // Buen mod syd og brostenene foran stederne.
  rect(16, 21, 4, 4, ROAD);
  rect(SQUARE_BOARD.x, SQUARE_BOARD.y, SQUARE_BOARD.w, SQUARE_BOARD.h, WALL);
  for (const p of SQUARE_PLACES) tiles[Math.floor(p.y) * w + Math.floor(p.x)] = FLOOR;
  const room = { x: 1, y: 1, w: w - 2, h: h - 2, cx: 18, cy: 13 };
  cached = {
    w, h, tiles, rooms: [room], start: { x: SQUARE_ENTRY.x, y: SQUARE_ENTRY.y }, exit: { x: 18, y: 13 }, startRoom: room, exitRoom: room,
    wardenRoom: null, gate: null, gateOpen: false,
  };
  return cached;
}

/** Feature-042 VIEW-01: stedet, spilleren står ved, eller null. */
export function placeAt(x: number, y: number): SquarePlaceInfo | null {
  for (const p of SQUARE_PLACES) if (Math.hypot(p.x - x, p.y - y) < 1.7) return p;
  return null;
}

/** Feature-042 CMD-01 Walk the square: et skridt i retningen; mure, boder og tavlen spærrer vejen. */
export function walkSquare(e: Circle, moveX: number, moveY: number, speed: number, dt: number): void {
  let mx = Math.max(-1, Math.min(1, moveX));
  let my = Math.max(-1, Math.min(1, moveY));
  const len = Math.hypot(mx, my);
  if (len < 0.05) return;
  mx /= Math.max(1, len);
  my /= Math.max(1, len);
  moveWithCollision(squareMap(), e, mx * speed * dt, my * speed * dt);
}
