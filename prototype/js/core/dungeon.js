// Banerne: tilfældigt genererede dybder med rum og gange, afstandskort og kollision.
// Koordinater er i felter. Felt (x, y) dækker [x, x+1) × [y, y+1), og midten er (x + 0,5, y + 0,5).

export const WALL = 0;
export const FLOOR = 1;
export const EXIT = 2; // trappen ned
export const GATE = 3; // porten bag Warden, lukket indtil Warden er død
export const MAP_SIZE = 64;

function makeRoom(x, y, w, h) {
  return { x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) };
}

export function generateDepth(rng, { warden = false } = {}) {
  const w = MAP_SIZE;
  const h = MAP_SIZE;
  const tiles = new Uint8Array(w * h);
  const rooms = [];
  const overlaps = (x, y, rw, rh) =>
    rooms.some((r) => x - 2 < r.x + r.w && x + rw + 2 > r.x && y - 2 < r.y + r.h && y + rh + 2 > r.y);

  let wardenRoom = null;
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

  const set = (x, y, v) => {
    if (x >= 1 && y >= 1 && x < w - 1 && y < h - 1) tiles[y * w + x] = v;
  };
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) set(x, y, FLOOR);

  // Gange, to felter brede, så det er let at bevæge sig med touch.
  const carve = (a, b) => {
    const horizontalFirst = rng.chance(0.5);
    const hLine = (x1, x2, y) => {
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2) + 1; x++) {
        set(x, y, FLOOR);
        set(x, y + 1, FLOOR);
      }
    };
    const vLine = (y1, y2, x) => {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2) + 1; y++) {
        set(x, y, FLOOR);
        set(x + 1, y, FLOOR);
      }
    };
    if (horizontalFirst) {
      hLine(a.cx, b.cx, a.cy);
      vLine(a.cy, b.cy, b.cx);
    } else {
      vLine(a.cy, b.cy, a.cx);
      hLine(a.cx, b.cx, b.cy);
    }
  };
  // Forbind hvert rum med det nærmeste, der allerede er forbundet (et træ), og tilføj et par løkker.
  const connected = [rooms[0]];
  const rest = rooms.slice(1);
  while (rest.length) {
    let best = null;
    for (const a of rest) {
      for (const b of connected) {
        const d = Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy);
        if (!best || d < best.d) best = { a, b, d };
      }
    }
    carve(best.a, best.b);
    connected.push(best.a);
    rest.splice(rest.indexOf(best.a), 1);
  }
  for (let i = 0; i < 2; i++) {
    const a = rng.pick(rooms);
    const b = rng.pick(rooms);
    if (a !== b) carve(a, b);
  }

  const map = { w, h, tiles, rooms, start: null, exit: null, startRoom: null, exitRoom: null, wardenRoom, gate: null, gateOpen: false };

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

function farthestRoom(map, rooms, dist) {
  let best = rooms[0];
  for (const r of rooms) if (dist[r.cy * map.w + r.cx] > dist[best.cy * map.w + best.cx]) best = r;
  return best;
}

export function tileAt(map, x, y) {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return WALL;
  return map.tiles[y * map.w + x];
}

export function isSolid(map, x, y) {
  const t = tileAt(map, x, y);
  return t === WALL || (t === GATE && !map.gateOpen);
}

// Afstand i skridt fra et felt til alle andre (−1 = kan ikke nås).
export function bfs(map, sx, sy) {
  const { w, h } = map;
  const dist = new Int16Array(w * h).fill(-1);
  if (isSolid(map, sx, sy)) return dist;
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  dist[sy * w + sx] = 0;
  queue[tail++] = sy * w + sx;
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    const y = (i / w) | 0;
    const d = dist[i] + 1;
    if (x > 0 && dist[i - 1] < 0 && !isSolid(map, x - 1, y)) { dist[i - 1] = d; queue[tail++] = i - 1; }
    if (x < w - 1 && dist[i + 1] < 0 && !isSolid(map, x + 1, y)) { dist[i + 1] = d; queue[tail++] = i + 1; }
    if (y > 0 && dist[i - w] < 0 && !isSolid(map, x, y - 1)) { dist[i - w] = d; queue[tail++] = i - w; }
    if (y < h - 1 && dist[i + w] < 0 && !isSolid(map, x, y + 1)) { dist[i + w] = d; queue[tail++] = i + w; }
  }
  return dist;
}

export function lineOfSight(map, ax, ay, bx, by) {
  const dist = Math.hypot(bx - ax, by - ay);
  const steps = Math.ceil(dist / 0.2);
  for (let i = 1; i < steps; i++) {
    const f = i / steps;
    if (isSolid(map, Math.floor(ax + (bx - ax) * f), Math.floor(ay + (by - ay) * f))) return false;
  }
  return true;
}

export function collides(map, x, y, r) {
  const x0 = Math.floor(x - r);
  const x1 = Math.floor(x + r);
  const y0 = Math.floor(y - r);
  const y1 = Math.floor(y + r);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!isSolid(map, tx, ty)) continue;
      const nx = Math.max(tx, Math.min(x, tx + 1));
      const ny = Math.max(ty, Math.min(y, ty + 1));
      if ((x - nx) ** 2 + (y - ny) ** 2 < r * r) return true;
    }
  }
  return false;
}

// Flytter en cirkel og glider langs vægge. Returnerer den strækning, den faktisk flyttede sig.
export function moveWithCollision(map, e, dx, dy) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.2));
  const sx = dx / steps;
  const sy = dy / steps;
  const ox = e.x;
  const oy = e.y;
  for (let i = 0; i < steps; i++) {
    if (!collides(map, e.x + sx, e.y, e.r)) e.x += sx;
    if (!collides(map, e.x, e.y + sy, e.r)) e.y += sy;
  }
  return Math.hypot(e.x - ox, e.y - oy);
}

export function randomFloorInRoom(rng, map, room) {
  for (let i = 0; i < 30; i++) {
    const x = rng.int(room.x + 1, room.x + room.w - 2);
    const y = rng.int(room.y + 1, room.y + room.h - 2);
    if (tileAt(map, x, y) === FLOOR) return { x, y };
  }
  return { x: room.cx, y: room.cy };
}
