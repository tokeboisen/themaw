// Reach 3, The Woods (Feature-010, -017): én stor skov på samme størrelse som The Broken City. Træer på 1 og 2 × 2
// felter, buske, bugtede stier, lysninger – nogle med et bål, hvor en bande brigander slår lejr – og små hytter med
// møbler og et ildsted. Skoven er delt i fire distrikter fra skovbrynet til hjertet, en ring af stående sten i midten,
// hvor The Antlered King vogter porten. Kandidaterne starter i hver sin lysning ved skovbrynet.

import type { Balance } from './balance.ts';
import type { Building, CityPlan } from './city.ts';
import {
  BUSH, CAMPFIRE, FLOOR, FURNITURE, GATE, HEARTH, INDOOR, ROAD, RUBBLE, TREE, TREE_BIG, WALL, bfs, isSolid, type DepthMap, type Point, type Room,
} from './dungeon.ts';
import type { Rng } from './rng.ts';

const makeRoom = (x: number, y: number, w: number, h: number): Room => ({ x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) });

export function generateWoods(rng: Rng, B: Balance): CityPlan {
  const W = B.woods;
  const n = W.size;
  const tiles = new Uint8Array(n * n).fill(FLOOR);
  const districts = new Uint8Array(n * n);
  /** Felter, hvor der ikke må stå træer: stier, lysninger, hytter og hjertet. */
  const kept = new Uint8Array(n * n);
  const c = Math.floor(n / 2);
  const R = n / 2;
  const inside = (x: number, y: number) => x >= 1 && y >= 1 && x < n - 1 && y < n - 1;
  const at = (x: number, y: number) => tiles[y * n + x]!;
  const put = (x: number, y: number, v: number) => {
    if (inside(x, y)) tiles[y * n + x] = v;
  };
  const keep = (x: number, y: number) => {
    if (inside(x, y)) kept[y * n + x] = 1;
  };

  // Distrikterne: ringe efter afstanden til midten.
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const r = Math.hypot(x - c, y - c) / R;
      districts[y * n + x] = r < W.rings[2] ? 4 : r < W.rings[1] ? 3 : r < W.rings[0] ? 2 : 1;
    }
  }

  // Skovbrynet mod verden udenfor: et tæt krat to felter bredt.
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (x < 2 || y < 2 || x >= n - 2 || y >= n - 2) tiles[y * n + x] = x === 0 || y === 0 || x === n - 1 || y === n - 1 ? WALL : TREE;

  const disc = (cx: number, cy: number, r: number, tile = FLOOR) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (!inside(x, y) || Math.hypot(x - cx, y - cy) > r) continue;
        put(x, y, tile);
        keep(x, y);
      }
    }
  };

  // Hjertet: en lysning med en ring af stående sten, åbninger mod syd, øst og vest og porten mod nord.
  const heartR = Math.max(6, Math.round(W.rings[2] * R) - 1);
  disc(c, c, heartR + 1.5);
  const openings: Point[] = [{ x: c, y: c + heartR }, { x: c + heartR, y: c }, { x: c - heartR, y: c }];
  for (let y = c - heartR - 1; y <= c + heartR + 1; y++) {
    for (let x = c - heartR - 1; x <= c + heartR + 1; x++) {
      const d = Math.hypot(x - c, y - c);
      if (Math.abs(d - heartR) > 0.5) continue;
      if (openings.some((o) => Math.abs(o.x - x) + Math.abs(o.y - y) <= 1)) continue;
      put(x, y, RUBBLE);
    }
  }
  const gate: Point = { x: c, y: c - heartR };
  put(gate.x, gate.y, GATE);
  put(gate.x - 1, gate.y, RUBBLE);
  put(gate.x + 1, gate.y, RUBBLE);
  const heart = makeRoom(c - heartR + 2, c - heartR + 2, 2 * heartR - 3, 2 * heartR - 3);

  // Et stort træ, som en sti går igennem, fældes helt, så der aldrig står et halvt træ.
  const fell = (x: number, y: number) => {
    for (let ty = y - 1; ty <= y; ty++) {
      for (let tx = x - 1; tx <= x; tx++) {
        if ([[0, 0], [1, 0], [0, 1], [1, 1]].every(([ox, oy]) => inside(tx + ox!, ty + oy!) && at(tx + ox!, ty + oy!) === TREE_BIG)) {
          for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) put(tx + ox, ty + oy, FLOOR);
          return;
        }
      }
    }
  };

  // En bugtet sti, to felter bred, fra et sted til et andet.
  const path = (from: Point, to: Point) => {
    let { x, y } = from;
    for (let steps = 0; steps < n * 4 && (x !== to.x || y !== to.y); steps++) {
      const dx = Math.sign(to.x - x);
      const dy = Math.sign(to.y - y);
      if (rng.chance(0.25)) {
        // Et skridt til siden, så stien bugter sig.
        if (Math.abs(to.x - x) > Math.abs(to.y - y)) y += rng.chance(0.5) ? 1 : -1;
        else x += rng.chance(0.5) ? 1 : -1;
      } else if (Math.abs(to.x - x) > Math.abs(to.y - y)) x += dx;
      else y += dy;
      x = Math.max(2, Math.min(n - 3, x));
      y = Math.max(2, Math.min(n - 3, y));
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
        const t = at(x + ox, y + oy);
        if (t === RUBBLE || t === GATE || t === WALL || t === INDOOR || t === HEARTH || t === FURNITURE || t === CAMPFIRE) continue;
        if (t === TREE_BIG) fell(x + ox, y + oy);
        put(x + ox, y + oy, ROAD);
        keep(x + ox, y + oy);
      }
    }
  };
  const nearestOpening = (p: Point) => openings.reduce((a, b) => (Math.hypot(a.x - p.x, a.y - p.y) <= Math.hypot(b.x - p.x, b.y - p.y) ? a : b));
  const outside = (o: Point) => ({ x: o.x + Math.sign(o.x - c) * 2, y: o.y + Math.sign(o.y - c) * 2 });

  // Startlysningerne ved skovbrynet, jævnt rundt, hver med en sti mod hjertet.
  const startRooms: Room[] = [];
  const offset = rng.next() * Math.PI * 2;
  for (let k = 0; k < W.startClearings; k++) {
    const a = offset + (k / W.startClearings) * Math.PI * 2;
    const r = (W.rings[0] + 1) / 2 * R + rng.range(-2, 2);
    const cx = Math.round(c + Math.cos(a) * r);
    const cy = Math.round(c + Math.sin(a) * r);
    disc(cx, cy, 3.2);
    startRooms.push(makeRoom(cx - 2, cy - 2, 5, 5));
    path({ x: cx, y: cy }, outside(nearestOpening({ x: cx, y: cy })));
  }

  // Lysningerne inde i skoven; nogle er lejre med et bål.
  const taken: { x: number; y: number; r: number }[] = [...startRooms.map((s) => ({ x: s.cx, y: s.cy, r: 5 })), { x: c, y: c, r: heartR + 4 }];
  const free = (x: number, y: number, r: number) => taken.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + r + 3);
  const clearings: Room[] = [];
  const camps: Room[] = [];
  for (let tries = 0; clearings.length < W.clearings && tries < 2000; tries++) {
    const r = rng.int(3, 5);
    const x = rng.int(6 + r, n - 7 - r);
    const y = rng.int(6 + r, n - 7 - r);
    const d = districts[y * n + x]!;
    if (d >= 4 || !free(x, y, r)) continue;
    taken.push({ x, y, r });
    disc(x, y, r + 0.3);
    const room = makeRoom(x - r + 1, y - r + 1, 2 * r - 1, 2 * r - 1);
    clearings.push(room);
    if (camps.length < W.camps && d >= 2) {
      // Et bål midt i lejren, med en bænk af træstammer ved siden af.
      put(x, y, CAMPFIRE);
      put(x - 2, y + 1, FURNITURE);
      camps.push(room);
    }
    path({ x, y }, outside(nearestOpening({ x, y })));
  }

  // Små hytter med bjælkevægge, en dør, møbler og et ildsted.
  const buildings: Building[] = [];
  for (let tries = 0; buildings.length < W.huts && tries < 3000; tries++) {
    const w = rng.int(7, 9);
    const h = rng.int(6, 7);
    const x0 = rng.int(4, n - w - 5);
    const y0 = rng.int(4, n - h - 5);
    const d = districts[(y0 + Math.floor(h / 2)) * n + x0 + Math.floor(w / 2)]!;
    if (d >= 4) continue;
    let clear = true;
    for (let y = y0 - 1; y <= y0 + h && clear; y++) for (let x = x0 - 1; x <= x0 + w && clear; x++) if (kept[y * n + x] || at(x, y) !== FLOOR) clear = false;
    if (!clear) continue;
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const wall = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
        put(x, y, wall ? WALL : INDOOR);
        keep(x, y);
      }
    }
    // Døren midt på en af siderne, og et fri felt udenfor den.
    const side = rng.int(0, 3);
    const door: Point = side === 0 ? { x: x0 + Math.floor(w / 2), y: y0 } : side === 1 ? { x: x0 + w - 1, y: y0 + Math.floor(h / 2) }
      : side === 2 ? { x: x0 + Math.floor(w / 2), y: y0 + h - 1 } : { x: x0, y: y0 + Math.floor(h / 2) };
    put(door.x, door.y, INDOOR);
    const out: Point = { x: door.x + (side === 1 ? 1 : side === 3 ? -1 : 0), y: door.y + (side === 0 ? -1 : side === 2 ? 1 : 0) };
    put(out.x, out.y, FLOOR);
    keep(out.x, out.y);
    // Ildstedet i hjørnet længst fra døren, et bord i midten og en seng langs væggen.
    const ix = x0 + 1;
    const iy = y0 + 1;
    const iw = w - 2;
    const ih = h - 2;
    const corners: Point[] = [{ x: ix, y: iy }, { x: ix + iw - 1, y: iy }, { x: ix, y: iy + ih - 1 }, { x: ix + iw - 1, y: iy + ih - 1 }];
    corners.sort((a, b) => Math.hypot(b.x - door.x, b.y - door.y) - Math.hypot(a.x - door.x, a.y - door.y));
    put(corners[0]!.x, corners[0]!.y, HEARTH);
    const bed = corners[1]!;
    put(bed.x, bed.y, FURNITURE);
    put(bed.x, bed.y + (bed.y === iy ? 1 : -1), FURNITURE);
    put(ix + Math.floor(iw / 2) + 1, iy + Math.floor(ih / 2), FURNITURE); // bordet, ved siden af hyttens midte
    const room = makeRoom(ix, iy, iw, ih);
    buildings.push({ id: buildings.length, kind: 'small', room, district: d, upper: 0 });
    taken.push({ x: room.cx, y: room.cy, r: 4 });
    path(out, outside(nearestOpening(out)));
  }

  // Træer, store træer og buske på den frie skovbund – tættere jo dybere i skoven.
  for (let y = 3; y < n - 4; y++) {
    for (let x = 3; x < n - 4; x++) {
      const d = districts[y * n + x]! - 1;
      if (!rng.chance(W.bigTrees[d] ?? 0.01)) continue;
      let ok = true;
      for (let yy = y - 1; yy <= y + 2 && ok; yy++) for (let xx = x - 1; xx <= x + 2 && ok; xx++) if (kept[yy * n + xx] || at(xx, yy) !== FLOOR) ok = false;
      if (!ok) continue;
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) put(x + ox, y + oy, TREE_BIG);
    }
  }
  for (let y = 2; y < n - 2; y++) {
    for (let x = 2; x < n - 2; x++) {
      if (kept[y * n + x] || at(x, y) !== FLOOR) continue;
      const d = districts[y * n + x]! - 1;
      const roll = rng.next();
      if (roll < (W.trees[d] ?? 0.1)) put(x, y, TREE);
      else if (roll < (W.trees[d] ?? 0.1) + W.bushes) put(x, y, BUSH);
    }
  }

  const rooms = [...startRooms, ...clearings, ...buildings.map((b) => b.room), heart];
  const ground: DepthMap = {
    w: n, h: n, tiles, rooms, start: { x: startRooms[0]!.cx, y: startRooms[0]!.cy }, exit: { x: heart.cx, y: heart.cy },
    startRoom: startRooms[0]!, exitRoom: heart, wardenRoom: heart, gate, gateOpen: false,
  };

  // Alt skal kunne nås fra hjertet: en lysning, en hytte eller en lejr, der er lukket inde, får en sti ud. Rummet prøves
  // på et frit felt ved midten (midt i en lejr står bålet).
  for (let pass = 0; pass < 3; pass++) {
    const reach = bfs(ground, c, c + heartR + 2);
    const shut = rooms.filter((r) => {
      if (r === heart) return false;
      const spot = openSpot(ground, r);
      return !spot || reach[spot.y * n + spot.x]! < 0;
    });
    if (!shut.length) break;
    for (const r of shut) path({ x: r.cx, y: r.cy }, outside(nearestOpening({ x: r.cx, y: r.cy })));
  }
  return { ground, districts, buildings, groundStairs: [], floors: [], startRooms, camps };
}

/** Et frit felt i midten af et rum eller lige ved siden af – midt i en lejr står bålet, og i en hytte kan der stå et møbel. */
export function openSpot(map: DepthMap, r: Room): Point | null {
  for (const [dx, dy] of [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1]] as const) {
    const x = r.cx + dx;
    const y = r.cy + dy;
    if (!isSolid(map, x, y)) return { x, y };
  }
  return null;
}
