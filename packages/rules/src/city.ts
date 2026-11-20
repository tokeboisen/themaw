// Reach 2, The Broken City (Feature-010, -041, -017): ét stort kort af ruiner. Veje i et gitter deler byen i 7 × 7
// karréer med små og store huse, fabrikker og ruingrunde; støberiet i midten er den største fabrik med The Smelter og
// porten. Byen er delt i fire distrikter fra yderringen til støberiet. Store huse har én øvre etage og fabrikker to; en
// etage er sit eget lille kort, som trapperne fører til.

import type { Balance } from './balance.ts';
import { GATE, INDOOR, ROAD, RUBBLE, STAIRS, WALL, bfs, type DepthMap, type Point, type Room } from './dungeon.ts';
import type { Rng } from './rng.ts';

/** En trappe: feltet, man står på, og hvor den fører hen (et andet område og et felt dér). */
export interface StairLink {
  x: number;
  y: number;
  area: number;
  tx: number;
  ty: number;
  up: boolean;
}

export type BuildingKind = 'small' | 'large' | 'factory' | 'foundry';

export interface Building {
  id: number;
  kind: BuildingKind;
  /** Bygningens indre (uden ydermuren). */
  room: Room;
  district: number;
  /** Etager over gadeplan. */
  upper: number;
}

export interface FloorPlan {
  area: number;
  building: number;
  /** 2 for første sal, 3 for anden. */
  floor: number;
  district: number;
  map: DepthMap;
  stairs: StairLink[];
}

export interface CityPlan {
  ground: DepthMap;
  /** Distriktet for hvert felt på gadeplan: 1 (yderringen) til 4 (støberiet). */
  districts: Uint8Array;
  buildings: Building[];
  groundStairs: StairLink[];
  floors: FloorPlan[];
  /** Husene i yderringen, hvor kandidaterne starter. */
  startRooms: Room[];
}

/** Områdernes numre: gadeplan er 1, etagerne 100 og op. */
export const GROUND_AREA = 1;
export const FIRST_FLOOR_AREA = 100;

const makeRoom = (x: number, y: number, w: number, h: number): Room => ({ x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) });

export function generateCity(rng: Rng, B: Balance): CityPlan {
  const C = B.city;
  const n = C.blocks * C.block;
  const tiles = new Uint8Array(n * n).fill(ROAD);
  const set = (x: number, y: number, v: number) => {
    if (x >= 1 && y >= 1 && x < n - 1 && y < n - 1) tiles[y * n + x] = v;
  };
  const get = (x: number, y: number) => (x < 0 || y < 0 || x >= n || y >= n ? WALL : tiles[y * n + x]!);
  for (let i = 0; i < n; i++) {
    tiles[i] = WALL;
    tiles[(n - 1) * n + i] = WALL;
    tiles[i * n] = WALL;
    tiles[i * n + n - 1] = WALL;
  }
  const mid = Math.floor(C.blocks / 2);
  const ring = (bx: number, by: number) => Math.max(Math.abs(bx - mid), Math.abs(by - mid));
  const districtOfBlock = (bx: number, by: number) => Math.max(1, C.districts - ring(bx, by));

  const buildings: Building[] = [];
  const groundStairs: StairLink[] = [];
  const floors: FloorPlan[] = [];
  let nextArea = FIRST_FLOOR_AREA;

  /** En bygning: mur rundt om, gulv inden for, døre mod vejen og huller i ruinerne. */
  function building(kind: BuildingKind, x: number, y: number, w: number, h: number, district: number): Building {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, INDOOR);
    for (let xx = x; xx < x + w; xx++) {
      set(xx, y, WALL);
      set(xx, y + h - 1, WALL);
    }
    for (let yy = y; yy < y + h; yy++) {
      set(x, yy, WALL);
      set(x + w - 1, yy, WALL);
    }
    // Ruiner: et par huller i murene, aldrig i hjørnerne.
    const holes = kind === 'foundry' ? 0 : rng.int(0, kind === 'small' ? 1 : 3);
    for (let i = 0; i < holes; i++) {
      if (rng.chance(0.5)) set(rng.int(x + 2, x + w - 3), rng.chance(0.5) ? y : y + h - 1, INDOOR);
      else set(rng.chance(0.5) ? x : x + w - 1, rng.int(y + 2, y + h - 3), INDOOR);
    }
    // Døre: mindst én på hver side, der vender mod en vej, så man altid kan komme ind.
    const doorWidth = kind === 'factory' || kind === 'foundry' ? 3 : 1;
    const door = (side: number) => {
      const along = side < 2 ? rng.int(x + 1, x + w - 1 - doorWidth) : rng.int(y + 1, y + h - 1 - doorWidth);
      for (let i = 0; i < doorWidth; i++) {
        if (side === 0) set(along + i, y, INDOOR);
        if (side === 1) set(along + i, y + h - 1, INDOOR);
        if (side === 2) set(x, along + i, INDOOR);
        if (side === 3) set(x + w - 1, along + i, INDOOR);
      }
    };
    const sides = kind === 'foundry' ? [1, 2, 3] : [0, 1, 2, 3].filter(() => rng.chance(0.5));
    if (!sides.length) sides.push(rng.int(0, 3));
    for (const side of sides) door(side);
    const b: Building = { id: buildings.length, kind, room: makeRoom(x + 1, y + 1, w - 2, h - 2), district, upper: kind === 'large' ? 1 : kind === 'factory' ? 2 : 0 };
    buildings.push(b);
    return b;
  }

  /** En øvre etage: bygningens omrids som eget kort med en skillevæg, trappen ned og evt. trappen op. */
  function upperFloor(b: Building, floor: number, down: Point, up: Point | null): FloorPlan {
    const w = b.room.w + 2;
    const h = b.room.h + 2;
    const ft = new Uint8Array(w * h).fill(WALL);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) ft[y * w + x] = INDOOR;
    // En skillevæg med en åbning deler etagen i to rum.
    if (w > 8) {
      const wx = rng.int(3, w - 4);
      const gap = rng.int(1, h - 3);
      for (let y = 1; y < h - 1; y++) if (y !== gap && y !== gap + 1) ft[y * w + wx] = WALL;
    }
    const local = (p: Point) => ({ x: p.x - b.room.x + 1, y: p.y - b.room.y + 1 });
    const d = local(down);
    ft[d.y * w + d.x] = STAIRS;
    // Trappen og felterne omkring den holdes fri, så den altid kan nås.
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (ft[(d.y + dy) * w + d.x + dx] === WALL && d.x + dx > 0 && d.x + dx < w - 1 && d.y + dy > 0 && d.y + dy < h - 1) ft[(d.y + dy) * w + d.x + dx] = INDOOR;
    let u: Point | null = null;
    if (up) {
      u = local(up);
      ft[u.y * w + u.x] = STAIRS;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (ft[(u.y + dy) * w + u.x + dx] === WALL && u.x + dx > 0 && u.x + dx < w - 1 && u.y + dy > 0 && u.y + dy < h - 1) ft[(u.y + dy) * w + u.x + dx] = INDOOR;
    }
    const room = makeRoom(1, 1, w - 2, h - 2);
    const map: DepthMap = { w, h, tiles: ft, rooms: [room], start: d, exit: d, startRoom: room, exitRoom: room, wardenRoom: null, gate: null, gateOpen: false };
    const plan: FloorPlan = { area: nextArea++, building: b.id, floor, district: b.district, map, stairs: [] };
    floors.push(plan);
    return plan;
  }

  /** Trapper i et stort hus eller en fabrik: fra gadeplan op til første sal, og i en fabrik videre til anden. */
  function stairsFor(b: Building): void {
    if (!b.upper) return;
    const r = b.room;
    const a: Point = { x: r.x + 1, y: r.y + 1 };
    const c: Point = { x: r.x + r.w - 2, y: r.y + r.h - 2 };
    set(a.x, a.y, STAIRS);
    const first = upperFloor(b, 2, a, b.upper > 1 ? c : null);
    const off = (p: Point) => ({ x: p.x - r.x + 1, y: p.y - r.y + 1 });
    // Man lander ved siden af trappen, så man ikke straks går tilbage.
    groundStairs.push({ x: a.x, y: a.y, area: first.area, tx: off(a).x + 1, ty: off(a).y, up: true });
    first.stairs.push({ x: off(a).x, y: off(a).y, area: GROUND_AREA, tx: a.x + 1, ty: a.y, up: false });
    if (b.upper > 1) {
      const second = upperFloor(b, 3, c, null);
      first.stairs.push({ x: off(c).x, y: off(c).y, area: second.area, tx: off(c).x - 1, ty: off(c).y, up: true });
      second.stairs.push({ x: off(c).x, y: off(c).y, area: first.area, tx: off(c).x - 1, ty: off(c).y, up: false });
    }
  }

  // Karréerne. Vejene er 3 felter brede mellem dem.
  let foundry: Building | null = null;
  for (let by = 0; by < C.blocks; by++) {
    for (let bx = 0; bx < C.blocks; bx++) {
      const x0 = bx * C.block + 3;
      const y0 = by * C.block + 3;
      const size = C.block - 3;
      const district = districtOfBlock(bx, by);
      if (bx === mid && by === mid) {
        // Støberiet, den største fabrik: karréen og vejene omkring den.
        foundry = building('foundry', x0 - 3, y0 - 3, size + 6, size + 6, C.districts);
        continue;
      }
      if (district >= 2 && rng.chance(0.3)) {
        const factory = building('factory', x0, y0, size, size, district);
        stairsFor(factory);
        // Maskiner i fabrikshallen giver dækning, men aldrig midt i hallen.
        for (let i = 0; i < 3; i++) {
          const mx = rng.int(x0 + 3, x0 + size - 5);
          const my = rng.int(y0 + 3, y0 + size - 5);
          if (my === factory.room.cy && (mx === factory.room.cx || mx + 1 === factory.room.cx)) continue;
          set(mx, my, WALL);
          set(mx + 1, my, WALL);
        }
        continue;
      }
      // Fire grunde à 6 × 6 med et felt imellem: små huse, store huse over to grunde, eller ruingrunde.
      const cell = Math.floor((size - 1) / 2);
      const used = new Set<number>();
      for (let i = 0; i < 4; i++) {
        if (used.has(i)) continue;
        const cx = x0 + (i % 2) * (cell + 1);
        const cy = y0 + Math.floor(i / 2) * (cell + 1);
        const roll = rng.next();
        if (roll < 0.25 && i % 2 === 0 && !used.has(i + 1)) {
          used.add(i + 1);
          stairsFor(building('large', cx, cy, cell * 2 + 1, cell, district));
        } else if (roll < 0.65) {
          building('small', cx, cy, cell, cell, district);
        } else {
          // En ruingrund: murbrokker og stumper af mure.
          for (let k = 0; k < 7; k++) set(rng.int(cx, cx + cell - 1), rng.int(cy, cy + cell - 1), rng.chance(0.6) ? RUBBLE : WALL);
        }
      }
    }
  }
  // Spredte murbrokker på vejene, aldrig mere end ét felt på tværs, så vejene altid er farbare.
  for (let y = 1; y < n - 1; y++) {
    for (let x = 1; x < n - 1; x++) {
      const onRoad = x % C.block < 3 || y % C.block < 3;
      if (!onRoad || get(x, y) !== ROAD || !rng.chance(0.025)) continue;
      const crowded = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => get(x + dx!, y + dy!) === RUBBLE);
      if (!crowded) set(x, y, RUBBLE);
    }
  }
  const f = foundry!;
  // Søjler i støberiet giver dækning; The Smelter står i midten, og porten er i nordmuren.
  for (const [dx, dy] of [[-4, -4], [4, -4], [-4, 4], [4, 4]] as const) {
    set(f.room.cx + dx, f.room.cy + dy, WALL);
    set(f.room.cx + dx + 1, f.room.cy + dy, WALL);
  }
  const gate: Point = { x: f.room.cx, y: f.room.y - 1 };
  tiles[gate.y * n + gate.x] = GATE;

  const rooms = buildings.map((b) => b.room);
  const ground: DepthMap = {
    w: n, h: n, tiles, rooms, start: { x: 1, y: 1 }, exit: { x: f.room.cx, y: f.room.cy }, startRoom: rooms[0]!, exitRoom: f.room,
    wardenRoom: f.room, gate, gateOpen: false,
  };

  // Distrikterne pr. felt: karréens ring; støberiet er distrikt 4.
  const districts = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const bx = Math.min(C.blocks - 1, Math.floor(x / C.block));
      const by = Math.min(C.blocks - 1, Math.floor(y / C.block));
      const inFoundry = x >= f.room.x - 1 && x <= f.room.x + f.room.w && y >= f.room.y - 1 && y <= f.room.y + f.room.h;
      districts[y * n + x] = inFoundry ? C.districts : districtOfBlock(bx, by);
    }
  }

  // Huse, der ikke kan nås fra støberiet (en ruin kan have muret en dør til), får en dør mod nærmeste vej.
  const reach = bfs(ground, f.room.cx, f.room.cy);
  for (const b of buildings) {
    if ((reach[b.room.cy * n + b.room.cx] ?? -1) >= 0) continue;
    for (let x = b.room.x; x < b.room.x + b.room.w; x++) {
      set(x, b.room.y - 1, INDOOR);
      if (get(x, b.room.y - 2) === RUBBLE || get(x, b.room.y - 2) === WALL) set(x, b.room.y - 2, ROAD);
    }
  }
  const startRooms = buildings.filter((b) => b.district === 1 && (b.kind === 'small' || b.kind === 'large')).map((b) => b.room);
  ground.startRoom = startRooms[0] ?? rooms[0]!;
  ground.start = { x: ground.startRoom.cx, y: ground.startRoom.cy };
  return { ground, districts, buildings, groundStairs, floors, startRooms };
}
