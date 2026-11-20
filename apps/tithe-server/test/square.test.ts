// Feature-042 Walk the Mustering Square over WebSocket: spillerne kendes på cookien, går rundt, og alle ser hinanden.

import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import WebSocket from 'ws';
import type { SquareServerMessage } from '@maw/contracts';
import { Host } from '../src/host.ts';
import { createTitheServer, type TitheServer } from '../src/server.ts';
import { Square } from '../src/square.ts';

let app: TitheServer;
let port = 0;
const users: Record<string, { userId: string; userName: string; character: { id: string; name: string; mark: number } | null }> = {
  'maw_session=kael': { userId: 'u-kael', userName: 'kael', character: { id: 'c1', name: 'Kael', mark: 1 } },
  'maw_session=brann': { userId: 'u-brann', userName: 'brann', character: { id: 'c2', name: 'Brann', mark: 2 } },
};

before(async () => {
  app = createTitheServer(new Host({ publish: async () => {} }), () => true, new Square(async (cookie) => users[cookie] ?? null));
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  port = (app.server.address() as AddressInfo).port;
});
after(() => app.close());

async function walker(cookie: string) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?square=1`, { headers: { cookie } });
  const inbox: SquareServerMessage[] = [];
  socket.on('message', (raw) => inbox.push(JSON.parse(raw.toString()) as SquareServerMessage));
  await new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', reject);
  });
  const latest = () => inbox.filter((m) => m.t === 'square').at(-1) as Extract<SquareServerMessage, { t: 'square' }> | undefined;
  return { socket, inbox, latest, send: (m: object) => socket.send(JSON.stringify(m)) };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('F042 scenario "Brann sees Kael": both players are on the square with their user names', async () => {
  const kael = await walker('maw_session=kael');
  const brann = await walker('maw_session=brann');
  await wait(200);
  const seen = brann.latest()!;
  assert.deepEqual(seen.players.map((p) => p.name).sort(), ['brann', 'kael']);
  assert.equal(seen.players.find((p) => p.you)?.name, 'brann');
  assert.equal(seen.players.find((p) => p.name === 'kael')?.character, 'Kael');
  kael.socket.close();
  brann.socket.close();
});

test('F042 scenario "Kael walks to the Forge": the server moves Kael, and walls stop him', async () => {
  const kael = await walker('maw_session=kael');
  await wait(150);
  const start = kael.latest()!.players.find((p) => p.you)!;
  kael.send({ t: 'input', moveX: -1, moveY: 0 });
  await wait(600);
  const moved = kael.latest()!.players.find((p) => p.you)!;
  assert.ok(moved.x < start.x - 1, `${start.x} → ${moved.x}`);
  kael.send({ t: 'input', moveX: 0, moveY: 1 });
  await wait(1500);
  const blocked = kael.latest()!.players.find((p) => p.you)!;
  assert.ok(blocked.y < 25, 'the south wall stops Kael'); // muren i bunden
  kael.socket.close();
});

test('F042: an unknown cookie is turned away', async () => {
  const stranger = await walker('maw_session=nobody');
  await wait(150);
  assert.equal(stranger.inbox[0]?.t, 'gone');
});
