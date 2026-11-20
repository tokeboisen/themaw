// Reach 2, The Broken City: Feature-010 (kortet og startrummene), -041 Climb the stairs, -012 (distrikter som dybder),
// -017 og -013 (forsegling udefra og ind) og -014 (rivalerne krydser byen).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BALANCE as B, GROUND_AREA, STAIRS, bfs, createCharacter, createRng, createTithe, districtAt, generateCity, isSolid, queueAct,
  sealInfoAt, shownDepth, stepTithe, testing, type Hotbar, type Player, type Tithe,
} from '../src/index.ts';

const DT = 1 / 30;

function city(players = 1, seed = 5): Tithe {
  const t = createTithe({
    id: 'T-city',
    name: 'Rustgate',
    reach: 'city',
    seed,
    players: Array.from({ length: players }, (_, i) => {
      const character = createCharacter(`Kael${i}`, 'miner', createRng(i + 1), B);
      const hotbar: Hotbar = { '1': { weapon: character.equipment.melee!.id } };
      return { userId: `u${i + 1}`, userName: `p${i + 1}`, characterId: `c${i + 1}`, character, hotbar };
    }),
  }, B);
  return t;
}

/** Fjerner monstrene, så en test kan bevæge sig frit. */
function quiet(t: Tithe): void {
  for (const dep of Object.values(t.depths)) dep.monsters = dep.monsters.filter((m) => m.def.warden);
  for (const r of t.rivals) r.status = 'fallen';
}

const player = (t: Tithe) => t.players[0]!;

test('F010 AGG-01: The Broken City is one large map; every house can be reached from the foundry', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const plan = generateCity(createRng(seed), B);
    const n = B.city.blocks * B.city.block;
    assert.equal(plan.ground.w, n);
    const f = plan.ground.wardenRoom!;
    const reach = bfs(plan.ground, f.cx, f.cy);
    for (const b of plan.buildings) assert.ok(reach[b.room.cy * n + b.room.cx]! >= 0, `seed ${seed}: building ${b.id} (${b.kind}) is shut`);
    assert.ok(plan.buildings.some((b) => b.kind === 'small'));
    assert.ok(plan.buildings.some((b) => b.kind === 'large'));
    assert.equal(plan.buildings.filter((b) => b.kind === 'foundry').length, 1);
    assert.ok(plan.startRooms.length >= B.tithe.candidates, `seed ${seed}: only ${plan.startRooms.length} start houses`);
  }
});

test('F010 AGG-01: four districts from the outer ring to the foundry in the middle', () => {
  const plan = generateCity(createRng(7), B);
  const n = plan.ground.w;
  const at = (x: number, y: number) => plan.districts[y * n + x];
  assert.equal(at(5, 5), 1);
  assert.equal(at(n - 6, n - 6), 1);
  assert.equal(at(plan.ground.wardenRoom!.cx, plan.ground.wardenRoom!.cy), 4);
  assert.equal(at(Math.floor(n / 2), B.city.block + 5), 2); // ring 2
  assert.equal(at(Math.floor(n / 2), 2 * B.city.block + 5), 3); // ring 1
});

test('F041: large houses have an upper floor and factories two, joined by stairs both ways', () => {
  const plan = generateCity(createRng(8), B);
  for (const b of plan.buildings.filter((x) => x.upper > 0)) {
    assert.equal(plan.floors.filter((f) => f.building === b.id).length, b.upper);
  }
  for (const link of plan.groundStairs) {
    assert.equal(plan.ground.tiles[link.y * plan.ground.w + link.x], STAIRS);
    const floor = plan.floors.find((f) => f.area === link.area)!;
    assert.ok(!isSolid(floor.map, link.tx, link.ty)); // man lander på et frit felt
    assert.ok(floor.stairs.some((s) => s.area === GROUND_AREA && !s.up)); // og kan gå ned igen
  }
});

test('F010: in The Broken City every candidate starts in a house of its own in the outer ring, and The Smelter holds the foundry', () => {
  const t = city(2);
  const ground = t.depths[GROUND_AREA]!;
  for (const c of [...t.players, ...t.rivals]) assert.equal(districtAt(t, GROUND_AREA, c.x, c.y), 1);
  const houses = [...t.players, ...t.rivals].map((c) => ground.startRooms.findIndex((r) => c.x >= r.x && c.x <= r.x + r.w && c.y >= r.y && c.y <= r.y + r.h));
  assert.equal(new Set(houses).size, 8);
  assert.equal(ground.monsters.find((m) => m.def.warden)?.name, 'The Smelter');
  assert.ok(t.messages.some((m) => m.text.includes('grace')));
});

test('F041 scenarios "Kael climbs to the upper floor" and "Kael goes back down"', () => {
  const t = city();
  quiet(t);
  const p = player(t);
  const link = t.depths[GROUND_AREA]!.stairs[0]!;
  p.x = link.x + 0.5;
  p.y = link.y + 0.5;
  stepTithe(t, DT);
  assert.equal(p.interact, 'climb'); // "Climb – press F"
  queueAct(t, p.id, { act: 'interact' });
  stepTithe(t, DT);
  assert.equal(p.depth, link.area);
  assert.equal(t.depths[p.depth]!.floor, 2);
  // Ned igen: stil spilleren på trappen ned.
  const down = t.depths[p.depth]!.stairs.find((s) => !s.up)!;
  p.x = down.x + 0.5;
  p.y = down.y + 0.5;
  stepTithe(t, DT);
  assert.equal(p.interact, 'down');
  queueAct(t, p.id, { act: 'interact' });
  stepTithe(t, DT);
  assert.equal(p.depth, GROUND_AREA);
  assert.ok(Math.hypot(p.x - link.x, p.y - link.y) < 2);
});

test('F012 in The Broken City: crossing into a district closer to the middle is a deeper depth with Renown', () => {
  const t = city();
  quiet(t);
  const p = player(t);
  const ground = t.depths[GROUND_AREA]!;
  const n = ground.map.w;
  // Et frit felt i distrikt 2.
  let spot: { x: number; y: number } | null = null;
  for (let i = 0; i < n * n && !spot; i++) {
    const x = i % n;
    const y = Math.floor(i / n);
    if (ground.districts![i] === 2 && !isSolid(ground.map, x, y)) spot = { x, y };
  }
  p.x = spot!.x + 0.5;
  p.y = spot!.y + 0.5;
  stepTithe(t, DT);
  assert.equal(p.record.maxDepth, 2);
  assert.equal(p.record.renown, B.renown.depth);
  assert.equal(shownDepth(t, p), 2);
});

test('F017 and F013 in The Broken City: the outer ring is sealed after 8 minutes, the second ring is not', () => {
  const t = city();
  quiet(t);
  const p = player(t);
  p.mm.lastDamageAt = 1e9;
  t.time = 449.9;
  stepTithe(t, 0.2);
  assert.ok(t.messages.some((m) => m.text === 'The outer ward grows dull. I will seal it in 30 seconds.'));
  t.time = 480;
  stepTithe(t, DT);
  assert.ok(t.messages.some((m) => m.text.startsWith('The outer ward is sealed!')));
  assert.equal(sealInfoAt(t, GROUND_AREA, p.x, p.y)?.sealed, true);
  const before = p.hp;
  for (let i = 0; i < 30; i++) stepTithe(t, DT);
  assert.ok(p.hp < before - 1);
  // En etage hører til sit hus' distrikt.
  const floor = Object.values(t.depths).find((d) => d.floorDistrict === 2);
  if (floor) assert.equal(sealInfoAt(t, floor.level, 3, 3)?.sealed, false);
});

test('F014 in The Broken City: a rival who reaches the foundry while no player is on the street can claim the Tithe', () => {
  const t = city();
  quiet(t);
  const p: Player = player(t);
  // Spilleren går op på en etage, så rivalerne ikke ses og skrider frem i tid.
  const link = t.depths[GROUND_AREA]!.stairs[0]!;
  p.x = link.x + 0.5;
  p.y = link.y + 0.5;
  testing.climbStairs(t, p);
  // Flere rivaler når støberiet; hver vinder med 95 %, så en af dem gør det.
  for (const r of t.rivals) Object.assign(r, { status: 'in', real: false, depth: GROUND_AREA, progress: 1 });
  t.wardenHpFactor = 0.01;
  for (let i = 0; i < Math.round((B.tithe.abstractWardenFight + 1) / DT) && !t.champion; i++) stepTithe(t, DT);
  assert.ok(t.rivals.some((r) => r.name === t.champion));
  assert.equal(p.end?.kind, 'rival-champion');
});

test('F011: The Broken City has its own monsters, by district', () => {
  const t = city();
  const types = new Set(Object.values(t.depths).flatMap((d) => d.monsters.map((m) => m.type)));
  assert.ok([...types].every((x) => B.monsters.types[x]!.home === 'city'), [...types].join(','));
  assert.ok(types.has('smelter'));
  assert.ok(types.size >= 6, [...types].join(','));
});
