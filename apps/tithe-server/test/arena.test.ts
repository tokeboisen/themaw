// Feature-045 Fight in the arena i tithe-server: rummet åbnes af "Arena match started", kæmperne er låst, indtil kampen
// er afgjort, og "Arena match ended" sendes én gang – aldrig "Tithe ended" eller "Player defeated".

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EVENT, type ArenaMatchEnded, type ArenaMatchStarted, type EventEnvelope } from '@maw/contracts';
import { BALANCE, BUSH, createCharacter, createRng, leaveTithe } from '@maw/rules';
import { Host } from '../src/host.ts';
import { newViewState, snapshot } from '../src/views.ts';

function match(id: string): ArenaMatchStarted {
  return {
    matchId: id, name: 'Sand and Steel', format: '1v1', stake: 50,
    fighters: [1, 2].map((side) => {
      const character = createCharacter(side === 1 ? 'Kael' : 'Brann', 'miner', createRng(side), BALANCE);
      return {
        userId: `u${side}`, userName: side === 1 ? 'kael' : 'brann', characterId: `c${side}`, ticket: `t-${id}-${side}`, side: side as 1 | 2,
        character, hotbar: { '1': { weapon: character.equipment.melee!.id } },
      };
    }),
  };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('F045: the arena opens from "Arena match started" and ends with "Arena match ended" once, with Side 1 the winner', async () => {
  const published: EventEnvelope[] = [];
  const host = new Host({ publish: async (e) => void published.push(e) });
  try {
    host.launchArena(match('A1'));
    const t = host.titheOf('A1')!;
    assert.equal(t.reach, 'arena');
    assert.deepEqual(host.running().find((r) => r.id === 'A1')?.players, ['u1', 'u2']);
    t.time = BALANCE.arena.countdown + 1;
    leaveTithe(t, 'u2'); // Brann leaves: counts as down
    await wait(150);
    // A fighter who is down stays locked until the match is decided – here it is decided at once.
    const ended = published.filter((e) => e.type === EVENT.arenaMatchEnded);
    assert.equal(ended.length, 1);
    const data = ended[0]!.data as ArenaMatchEnded;
    assert.equal(data.winner, 1);
    assert.deepEqual(data.fighters.map((f) => [f.userId, f.result]), [['u1', 'won'], ['u2', 'lost']]);
    assert.ok(!published.some((e) => e.type === EVENT.titheEnded || e.type === EVENT.playerDefeated));
    assert.deepEqual(host.running().find((r) => r.id === 'A1')?.players, []);
  } finally {
    host.stop();
  }
});

test('F045 scenario "Hiding in a bush" in the snapshot: Kael does not see Brann, but sees the whole arena', () => {
  const host = new Host({ publish: async () => {} });
  try {
    host.launchArena(match('A2'));
    const t = host.titheOf('A2')!;
    const [kael, brann] = t.players;
    const map = t.depths[1]!.map;
    const i = map.tiles.indexOf(BUSH);
    Object.assign(brann!, { x: (i % map.w) + 0.5, y: Math.floor(i / map.w) + 0.5, revealT: 0 });
    Object.assign(kael!, { x: brann!.x + 5, y: brann!.y });
    const snap = snapshot(t, kael!, newViewState(t));
    assert.ok(!snap.ents.some((e) => e.id === 'u2'));
    assert.equal(snap.arena?.you, 1);
    assert.equal(snap.tiles.length / 2, map.w * map.h); // the whole arena is on the map
    brann!.revealT = 1;
    assert.ok(snapshot(t, kael!, newViewState(t)).ents.some((e) => e.id === 'u2' && e.side === 2));
  } finally {
    host.stop();
  }
});
