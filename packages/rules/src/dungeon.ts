// Banerne: tilfældigt genererede dybder med rum og gange, afstandskort og kollision (Feature-010 Enter the Tithe).
// Koordinater er i felter. Felt (x, y) dækker [x, x+1) × [y, y+1), og midten er (x + 0,5, y + 0,5).

import type { Rng } from './rng.ts';

export const WALL = 0;
export const FLOOR = 1;
export const EXIT = 2; // trappen ned
export const GATE = 3; // porten bag Warden, lukket indtil Warden er død
// The Broken City (Feature-010, -041): trapper i husene, veje, gulve inden døre og murbrokker.
export const STAIRS = 4;
export const ROAD = 5;
export const INDOOR = 6;
export const RUBBLE = 7;
// Arenaen (Feature-045): træer spærrer for kæmpere og projektiler; buske skjuler den, der står i dem.
export const TREE = 8;
export const BUSH = 9;
export const MAP_SIZE = 64;

export interface Point {
  x: number;
  y: number;
}

export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export interface DepthMap {
  w: number;
  h: number;
  tiles: Uint8Array;
  rooms: Room[];
  start: Point;
  exit: Point;
  startRoom: Room;
  exitRoom: Room;
  wardenRoom: Room | null;
  gate: Point | null;
  gateOpen: boolean;
}

export interface Circle {
  x: number;
  y: number;
  r: number;
}

function makeRoom(x: number, y: number, w: number, h: number): Room {
  return { x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) };
}

export function generateDepth(rng: Rng, { warden = false }: { warden?: boolean } = {}): DepthMap {
  const w = MAP_SIZE;
  const h = MAP_SIZE;
  const tiles = new Uint8Array(w * h);
  const rooms: Room[] = [];
  const overlaps = (x: number, y: number, rw: number, rh: number) =>
    rooms.some((r) => x - 2 < r.x + r.w && x + rw + 2 > r.x && y - 2 < r.y + r.h && y + rh + 2 > r.y);

  let wardenRoom: Room | null = null;
  if (warden) {
    const rw = 16;
    const rh = 13;
    wardenRoom = makeRoom(rng.int(3, w - rw - 3), rng.int(4, h - rh - 3), rw, rh);
    rooms.push(wardenRoom);
  }
  const target = rng.int(10, 13);
  for (let attempts = 0; rooms.length < target && attempts < 600; attempts++) {
    const rw = rng.int(6, 11);
    const rh = rng.int(5, 9);
    const x = rng.int(2, w - rw - 2);
    const y = rng.int(2, h - rh - 2);
    if (!overlaps(x, y, rw, rh)) rooms.push(makeRoom(x, y, rw, rh));
  }

  const set = (x: number, y: number, v: number) => {
    if (x >= 1 && y >= 1 && x < w - 1 && y < h - 1) tiles[y * w + x] = v;
  };
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) set(x, y, FLOOR);

  // Gange, to felter brede.
  const carve = (a: Room, b: Room) => {
    const hLine = (x1: number, x2: number, y: number) => {
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2) + 1; x++) {
        set(x, y, FLOOR);
        set(x, y + 1, FLOOR);
      }
    };
    const vLine = (y1: number, y2: number, x: number) => {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2) + 1; y++) {
        set(x, y, FLOOR);
        set(x + 1, y, FLOOR);
      }
    };
    if (rng.chance(0.5)) {
      hLine(a.cx, b.cx, a.cy);
      vLine(a.cy, b.cy, b.cx);
    } else {
      vLine(a.cy, b.cy, a.cx);
      hLine(a.cx, b.cx, b.cy);
    }
  };
  // Forbind hvert rum med det nærmeste, der allerede er forbundet (et træ), og tilføj et par løkker.
  const connected: Room[] = [rooms[0]!];
  const rest = rooms.slice(1);
  while (rest.length) {
    let best: { a: Room; b: Room; d: number } | null = null;
    for (const a of rest) {
      for (const b of connected) {
        const d = Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy);
        if (!best || d < best.d) best = { a, b, d };
      }
    }
    carve(best!.a, best!.b);
    connected.push(best!.a);
    rest.splice(rest.indexOf(best!.a), 1);
  }
  for (let i = 0; i < 2; i++) {
    const a = rng.pick(rooms);
    const b = rng.pick(rooms);
    if (a !== b) carve(a, b);
  }

  const first = rooms[0]!;
  const map: DepthMap = {
    w, h, tiles, rooms, start: { x: first.cx, y: first.cy }, exit: { x: first.cx, y: first.cy },
    startRoom: first, exitRoom: first, wardenRoom, gate: null, gateOpen: false,
  };

  if (wardenRoom) {
    map.exitRoom = wardenRoom;
    map.gate = { x: wardenRoom.cx, y: wardenRoom.y };
    tiles[map.gate.y * w + map.gate.x] = GATE;
    const dist = bfs(map, wardenRoom.cx, wardenRoom.cy);
    map.startRoom = farthestRoom(map, rooms.filter((r) => r !== wardenRoom), dist);
  } else {
    map.startRoom = rng.pick(rooms);
    const dist = bfs(map, map.startRoom.cx, map.startRoom.cy);
    map.exitRoom = farthestRoom(map, rooms.filter((r) => r !== map.startRoom), dist);
    tiles[map.exitRoom.cy * w + map.exitRoom.cx] = EXIT;
  }
  map.start = { x: map.startRoom.cx, y: map.startRoom.cy };
  map.exit = { x: map.exitRoom.cx, y: map.exitRoom.cy };
  return map;
}

function farthestRoom(map: DepthMap, rooms: Room[], dist: Int16Array): Room {
  let best = rooms[0]!;
  for (const r of rooms) if (dist[r.cy * map.w + r.cx]! > dist[best.cy * map.w + best.cx]!) best = r;
  return best;
}

export function tileAt(map: DepthMap, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return WALL;
  return map.tiles[y * map.w + x]!;
}

export function isSolid(map: DepthMap, x: number, y: number): boolean {
  const t = tileAt(map, x, y);
  return t === WALL || t === RUBBLE || t === TREE || (t === GATE && !map.gateOpen);
}

/** Et felt, man kan stå og gå på, uden at det er en trappe, en udgang eller en port. */
export function isOpenFloor(t: number): boolean {
  return t === FLOOR || t === ROAD || t === INDOOR || t === BUSH;
}

/** Afstand i skridt fra et felt til alle andre (−1 = kan ikke nås). */
export function bfs(map: DepthMap, sx: number, sy: number): Int16Array {
  const { w, h } = map;
  const dist = new Int16Array(w * h).fill(-1);
  if (isSolid(map, sx, sy)) return dist;
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  dist[sy * w + sx] = 0;
  queue[tail++] = sy * w + sx;
  while (head < tail) {
    const i = queue[head++]!;
    const x = i % w;
    const y = (i / w) | 0;
    const d = dist[i]! + 1;
    const visit = (j: number, nx: number, ny: number) => {
      if (dist[j]! < 0 && !isSolid(map, nx, ny)) {
        dist[j] = d;
        queue[tail++] = j;
      }
    };
    if (x > 0) visit(i - 1, x - 1, y);
    if (x < w - 1) visit(i + 1, x + 1, y);
    if (y > 0) visit(i - w, x, y - 1);
    if (y < h - 1) visit(i + w, x, y + 1);
  }
  return dist;
}

export function lineOfSight(map: DepthMap, ax: number, ay: number, bx: number, by: number): boolean {
  const dist = Math.hypot(bx - ax, by - ay);
  const steps = Math.ceil(dist / 0.2);
  for (let i = 1; i < steps; i++) {
    const f = i / steps;
    if (isSolid(map, Math.floor(ax + (bx - ax) * f), Math.floor(ay + (by - ay) * f))) return false;
  }
  return true;
}

export function collides(map: DepthMap, x: number, y: number, r: number, flying = false): boolean {
  for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++) {
    for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
      if (!isSolid(map, tx, ty)) continue;
      // Feature-013: Harpies flyver over murbrokker.
      if (flying && tileAt(map, tx, ty) === RUBBLE) continue;
      const nx = Math.max(tx, Math.min(x, tx + 1));
      const ny = Math.max(ty, Math.min(y, ty + 1));
      if ((x - nx) ** 2 + (y - ny) ** 2 < r * r) return true;
    }
  }
  return false;
}

/** Flytter en cirkel og glider langs vægge. Returnerer den strækning, den faktisk flyttede sig. */
export function moveWithCollision(map: DepthMap, e: Circle, dx: number, dy: number, flying = false): number {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.2));
  const sx = dx / steps;
  const sy = dy / steps;
  const ox = e.x;
  const oy = e.y;
  for (let i = 0; i < steps; i++) {
    if (!collides(map, e.x + sx, e.y, e.r, flying)) e.x += sx;
    if (!collides(map, e.x, e.y + sy, e.r, flying)) e.y += sy;
  }
  return Math.hypot(e.x - ox, e.y - oy);
}

export function randomFloorInRoom(rng: Rng, map: DepthMap, room: Room): Point {
  for (let i = 0; i < 30; i++) {
    const x = rng.int(room.x + 1, room.x + room.w - 2);
    const y = rng.int(room.y + 1, room.y + room.h - 2);
    if (isOpenFloor(tileAt(map, x, y))) return { x, y };
  }
  return { x: room.cx, y: room.cy };
}
