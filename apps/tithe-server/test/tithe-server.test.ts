// tithe-server med bot-klienter over WebSocket (planen, afsnit 10): Feature-010 (start), -016 (Tithe ended og resultat),
// -029 (Leave og mistet forbindelse) og at kun det, spilleren kan se, sendes.

import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import WebSocket from 'ws';
import { EVENT, type EventEnvelope, type ServerMessage, type Snapshot, type TitheEnded, type TitheLaunched } from '@maw/contracts';
import { BALANCE, createCharacter, createRng } from '@maw/rules';
import { Host } from '../src/host.ts';
import { createTitheServer, type TitheServer } from '../src/server.ts';

const published: EventEnvelope[] = [];
// Kort genforbindelsestid, så testen af en mistet forbindelse ikke venter i 60 sekunder.
const balance = { ...BALANCE, tithe: { ...BALANCE.tithe, reconnectSeconds: 0.3 } };
let app: TitheServer;
let port = 0;

before(async () => {
  const host = new Host({ publish: async (e) => void published.push(e) }, () => {}, balance);
  app = createTitheServer(host, () => true);
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  port = (app.server.address() as AddressInfo).port;
});
after(() => app.close());

function launch(name: string, tickets: string[]): TitheLaunched {
  const data: TitheLaunched = {
    titheId: crypto.randomUUID(),
    name,
    players: tickets.map((ticket, i) => {
      const character = createCharacter(`Kael${i}`, 'miner', createRng(i + 1), BALANCE);
      return { userId: crypto.randomUUID(), userName: `player${i}`, characterId: crypto.randomUUID(), ticket, character, hotbar: { '1': { weapon: character.equipment.melee!.id } } };
    }),
  };
  app.host.launch(data);
  return data;
}

/** En bot: forbinder med billetten og samler beskederne op. */
async function bot(ticket: string) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?ticket=${ticket}`);
  const inbox: ServerMessage[] = [];
  let closed: number | null = null;
  socket.on('message', (raw) => inbox.push(JSON.parse(raw.toString()) as ServerMessage));
  socket.on('close', (code) => (closed = code));
  await new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', reject);
  });
  const waitFor = async <T extends ServerMessage['t']>(t: T, ms = 3000): Promise<Extract<ServerMessage, { t: T }>> => {
    const end = Date.now() + ms;
    for (;;) {
      const found = inbox.find((m) => m.t === t);
      if (found) return found as Extract<ServerMessage, { t: T }>;
      if (Date.now() > end) throw new Error(`no ${t} message`);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };
  return { socket, inbox, waitFor, send: (m: object) => socket.send(JSON.stringify(m)), closed: () => closed };
}

const running = async () => ((await (await fetch(`http://127.0.0.1:${port}/internal/tithes`)).json()) as { tithes: { id: string; players: string[] }[] }).tithes;

test('F010: a launched Tithe sends the player a sheet and snapshots with 8 candidates and only what is in sight', async () => {
  const data = launch('Ashfall', ['ticket-a']);
  const b = await bot('ticket-a');
  assert.equal((await b.waitFor('welcome')).name, 'Ashfall');
  const sheet = await b.waitFor('sheet');
  assert.equal(sheet.character.name, 'Kael0');
  const snap: Snapshot = await b.waitFor('snap');
  assert.equal(snap.reset, true);
  assert.ok(snap.tiles.length > 0);
  assert.equal(snap.candidates.length, 8);
  assert.equal(snap.candidates.filter((c) => !c.player).length, 7);
  const R = BALANCE.view.visionRadius + 0.5;
  assert.ok(snap.ents.every((e) => (e.x - snap.you.x) ** 2 + (e.y - snap.you.y) ** 2 <= R * R));
  assert.ok(snap.msgs.some((m) => m.who === 'Mirrormaster'));
  const tithe = (await running()).find((t) => t.id === data.titheId)!;
  assert.deepEqual(tithe.players, [data.players[0]!.userId]);
  b.socket.close();
});

test('F029 scenario "Kael leaves" and F016 scenario "Leaving ends the player\'s Tithe"', async () => {
  const data = launch('Cinderfall', ['ticket-b', 'ticket-c']);
  const kael = await bot('ticket-b');
  await kael.waitFor('snap');
  kael.send({ t: 'leave' });
  const ended = await kael.waitFor('ended');
  assert.equal(ended.kind, 'left');
  assert.equal(ended.summary.outcome.kind, 'left');
  await app.host.drained();
  const event = published.find((e) => e.type === EVENT.titheEnded && (e.data as TitheEnded).userId === data.players[0]!.userId);
  assert.equal((event?.data as TitheEnded).outcome.kind, 'left');
  // The Tithe goes on for the other candidates
  const tithe = (await running()).find((t) => t.id === data.titheId)!;
  assert.deepEqual(tithe.players, [data.players[1]!.userId]);
  kael.socket.close();
});

test('F029: a lost connection counts as leaving after the reconnect time, and a new connection in time keeps the player in', async () => {
  const data = launch('Emberfall', ['ticket-d', 'ticket-e']);
  const first = await bot('ticket-d');
  await first.waitFor('snap');
  first.socket.close();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const again = await bot('ticket-d'); // within the time: still in
  await again.waitFor('snap');
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.ok((await running()).find((t) => t.id === data.titheId)!.players.includes(data.players[0]!.userId));
  again.socket.close();
  await new Promise((resolve) => setTimeout(resolve, 600));
  assert.ok(!(await running()).find((t) => t.id === data.titheId)!.players.includes(data.players[0]!.userId));
  await app.host.drained();
  assert.ok(published.some((e) => e.type === EVENT.titheEnded && (e.data as TitheEnded).userId === data.players[0]!.userId && (e.data as TitheEnded).outcome.kind === 'left'));
});

test('an unknown ticket is turned away', async () => {
  const b = await bot('no-such-ticket');
  assert.equal((await b.waitFor('gone')).t, 'gone');
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(b.closed(), 4004);
});

test('F007 and F027 over WebSocket: a refused sheet action answers with the reason', async () => {
  launch('Ashgate', ['ticket-f']);
  const b = await bot('ticket-f');
  await b.waitFor('sheet');
  b.send({ t: 'sheet', action: { action: 'drop', itemId: 'nothing' } });
  assert.equal((await b.waitFor('refused')).message, 'Invalid request.');
  b.send({ t: 'sheet', action: { action: 'hotbar', key: '9', echoArt: 'Echo Bolt' } });
  b.socket.close();
});

test('F029: a player who never connects has left the Tithe after the reconnect time', async () => {
  const data = launch('Ghostfall', ['ticket-g', 'ticket-h']);
  await new Promise((resolve) => setTimeout(resolve, 600));
  const tithe = (await running()).find((t) => t.id === data.titheId)!;
  assert.deepEqual(tithe.players, []);
});

test('F034 and F035 over WebSocket: Kael invites Brann, Brann accepts, and both see the party', async () => {
  const data = launch('Partyfall', ['ticket-k', 'ticket-b2']);
  const [kaelId, brannId] = data.players.map((p) => p.userId) as [string, string];
  const kael = await bot('ticket-k');
  const brann = await bot('ticket-b2');
  await kael.waitFor('snap');
  await brann.waitFor('snap');
  kael.send({ t: 'party', action: 'invite', userId: brannId });
  const deadline = Date.now() + 3000;
  let invitation: { from: string } | undefined;
  while (!invitation && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    invitation = (brann.inbox.filter((m) => m.t === 'snap').at(-1) as Snapshot | undefined)?.party.invitations[0];
  }
  assert.equal(invitation?.from, kaelId);
  brann.send({ t: 'party', action: 'accept', from: kaelId });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const last = kael.inbox.filter((m) => m.t === 'snap').at(-1) as Snapshot;
  assert.deepEqual(last.party.members.map((m) => m.name).sort(), ['player0', 'player1']);
  assert.ok(kael.inbox.some((m) => m.t === 'snap' && m.msgs.some((x) => x.text === 'player1 joined the party.')));
  kael.socket.close();
  brann.socket.close();
});

test('F011 EVT-06: a player defeated by another player is published with the spilled gold', async () => {
  const data = launch('Bloodfall', ['ticket-x', 'ticket-y']);
  const t = app.host.titheOf(data.titheId)!;
  const [x, y] = t.players as [import('@maw/rules').Player, import('@maw/rules').Player];
  y.ch.gold = 100;
  t.defeats.push({ userId: y.userId, characterId: y.characterId, byUserId: x.userId, byCharacterId: x.characterId, gold: 15 });
  await new Promise((resolve) => setTimeout(resolve, 200));
  await app.host.drained();
  const event = published.find((e) => e.type === EVENT.playerDefeated && (e.data as { titheId: string }).titheId === data.titheId);
  assert.deepEqual(event?.data, { titheId: data.titheId, userId: y.userId, characterId: y.characterId, byUserId: x.userId, byCharacterId: x.characterId, gold: 15 });
});
