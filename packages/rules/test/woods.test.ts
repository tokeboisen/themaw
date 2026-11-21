// Reach 3, The Woods (Feature-010, -011, -013, -017): kortet med hytter, lysninger og lejre, distrikterne, monstrene,
// buskene, der skjuler for monstre, og de sjældne forsyninger (Feature-011, 2026-11-20).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BALANCE as B, BUSH, CAMPFIRE, FURNITURE, GATE, GROUND_AREA, HEARTH, TREE_BIG, bfs, createCharacter, createRng, createTithe, districtAt,
  generateWoods, openSpot, stepTithe, testing, type Hotbar, type Tithe,
} from '../src/index.ts';

const DT = 1 / 30;

function woods(players = 1, seed = 5): Tithe {
  return createTithe({
    id: 'T-woods', name: 'Greenwake', reach: 'woods', seed,
    players: Array.from({ length: players }, (_, i) => {
      const character = createCharacter(`Kael${i}`, 'miner', createRng(i + 1), B);
      const hotbar: Hotbar = { '1': { weapon: character.equipment.melee!.id } };
      return { userId: `u${i + 1}`, userName: `p${i + 1}`, characterId: `c${i + 1}`, character, hotbar };
    }),
  }, B);
}

test('F010 AGG-01: The Woods is one large forest – huts with furniture and a hearth, camps with a campfire, big trees of 2 × 2, all reachable from the heart', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const plan = generateWoods(createRng(seed), B);
    const map = plan.ground;
    const n = B.woods.size;
    assert.equal(map.w, n);
    assert.ok(plan.startRooms.length >= B.tithe.candidates, `seed ${seed}: ${plan.startRooms.length} start clearings`);
    assert.ok(plan.buildings.length >= 8, `seed ${seed}: ${plan.buildings.length} huts`);
    assert.ok((plan.camps?.length ?? 0) >= 4, `seed ${seed}: ${plan.camps?.length} camps`);
    const tile = (x: number, y: number) => map.tiles[y * n + x];
    for (const hut of plan.buildings) {
      const inside: number[] = [];
      for (let y = hut.room.y; y < hut.room.y + hut.room.h; y++) for (let x = hut.room.x; x < hut.room.x + hut.room.w; x++) inside.push(tile(x, y)!);
      assert.ok(inside.includes(HEARTH), `seed ${seed}: hut ${hut.id} has no hearth`);
      assert.ok(inside.includes(FURNITURE), `seed ${seed}: hut ${hut.id} has no furniture`);
    }
    for (const camp of plan.camps ?? []) assert.equal(tile(camp.cx, camp.cy), CAMPFIRE);
    // Store træer er hele 2 × 2-blokke.
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (tile(x, y) !== TREE_BIG || tile(x - 1, y) === TREE_BIG || tile(x, y - 1) === TREE_BIG) continue;
        assert.ok(tile(x + 1, y) === TREE_BIG && tile(x, y + 1) === TREE_BIG && tile(x + 1, y + 1) === TREE_BIG, `seed ${seed}: broken big tree at ${x},${y}`);
      }
    }
    assert.equal(tile(map.gate!.x, map.gate!.y), GATE);
    const heart = map.wardenRoom!;
    const from = openSpot(map, plan.startRooms[0]!)!;
    const reach = bfs(map, from.x, from.y);
    for (const r of [...plan.startRooms, ...plan.buildings.map((b) => b.room), ...(plan.camps ?? []), heart]) {
      const spot = openSpot(map, r)!;
      assert.ok(reach[spot.y * n + spot.x]! >= 0, `seed ${seed}: ${r.cx},${r.cy} is shut in`);
    }
    assert.equal(plan.districts[5 * n + 5], 1); // the forest edge
    assert.equal(plan.districts[heart.cy * n + heart.cx], 4); // the heart
  }
});

test('F010: in The Woods every candidate starts in a clearing of its own at the forest edge, and The Antlered King holds the heart', () => {
  const t = woods(2);
  const ground = t.depths[GROUND_AREA]!;
  for (const c of [...t.players, ...t.rivals]) assert.equal(districtAt(t, GROUND_AREA, c.x, c.y), 1);
  assert.equal(ground.monsters.find((m) => m.def.warden)?.name, 'The Antlered King');
});

test('F011: The Woods has its own monsters, and brigands camp by the campfires', () => {
  const t = woods();
  const ground = t.depths[GROUND_AREA]!;
  const types = new Set(ground.monsters.map((m) => m.type));
  assert.ok([...types].every((x) => B.monsters.types[x]!.home === 'woods'), [...types].join(','));
  assert.ok(types.size >= 6, [...types].join(','));
  const fires: { x: number; y: number }[] = [];
  const map = ground.map;
  for (let i = 0; i < map.tiles.length; i++) if (map.tiles[i] === CAMPFIRE) fires.push({ x: (i % map.w) + 0.5, y: Math.floor(i / map.w) + 0.5 });
  assert.ok(fires.length >= 4);
  for (const f of fires) {
    const band = ground.monsters.filter((m) => Math.hypot(m.x - f.x, m.y - f.y) < 3);
    assert.ok(band.length >= 3 && band.every((m) => m.type === 'brigand' || m.type === 'brigand_archer'), band.map((m) => m.type).join(','));
  }
});

test('F013: in The Woods a candidate in a bush is hidden from monsters until close or after striking', () => {
  const t = woods();
  const ground = t.depths[GROUND_AREA]!;
  ground.monsters = ground.monsters.filter((m) => m.def.warden);
  for (const r of t.rivals) r.status = 'fallen';
  t.time = B.tithe.graceSeconds + 1;
  const p = t.players[0]!;
  const room = ground.startRooms[0]!;
  Object.assign(p, { x: room.cx + 0.5, y: room.cy + 0.5, revealT: 0 });
  ground.map.tiles[room.cy * ground.map.w + room.cx] = BUSH;
  const wolf = testing.makeMonster(t, 'grey_wolf', p.x + 3, p.y, 1);
  ground.monsters.push(wolf);
  for (let i = 0; i < 30; i++) stepTithe(t, DT);
  assert.equal(wolf.awake, false);
  p.revealT = B.arena.revealSeconds; // Kael strikes
  for (let i = 0; i < 3; i++) stepTithe(t, DT);
  assert.equal(wolf.awake, true);
});

test('F011: potions and rations are rare – about 4 % of slain monsters drop one', () => {
  const t = woods();
  const ground = t.depths[GROUND_AREA]!;
  const p = t.players[0]!;
  ground.loot = [];
  for (let i = 0; i < 3000; i++) {
    const m = testing.makeMonster(t, 'thornling', p.x + 10, p.y, 1);
    m.veteran = false;
    testing.kill(t, ground, p, m);
  }
  const supplies = ground.loot.filter((l) => l.kind === 'potion' || l.kind === 'ration').length;
  assert.ok(supplies > 60 && supplies < 190, String(supplies)); // 4 % of 3000 = 120
});
