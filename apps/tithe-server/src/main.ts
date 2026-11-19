// tithe-server: kører Tithes i hukommelsen og taler med browserne over WebSocket (Tithe, Spectacle og partierne i en
// Tithe). Fase 0: sundhedstjek, WebSocket med ping/pong og lytning på bussen. Selve Tithen kommer i fase 3.

import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { bindingsFor, queueFor } from '@maw/contracts';
import { connectBus } from '@maw/platform';

const env = {
  rabbitUrl: process.env.RABBITMQ_URL ?? '',
  port: Number(process.env.PORT ?? 3001),
};
if (!env.rabbitUrl) throw new Error('RABBITMQ_URL must be set');

const log = (message: string) => console.log(JSON.stringify({ time: new Date().toISOString(), service: 'tithe-server', message }));

const bus = await connectBus(env.rabbitUrl, { log });
bus.onClose(() => {
  log('RabbitMQ connection closed; exiting so Docker restarts the service');
  process.exit(1);
});
// Tithe launched (Feature-037 → Feature-010) starter Tithen i fase 3.
await bus.consume(queueFor('Tithe'), bindingsFor('Tithe'), async (event) => {
  log(`Received ${event.type} ${event.id} (Tithes are started from phase 3)`);
});

const server = createServer((request, response) => {
  if (request.url === '/health') {
    const ok = bus.isOpen();
    response.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: ok ? 'ok' : 'degraded', service: 'tithe-server', bus: ok, connections: sockets.clients.size }));
    return;
  }
  response.writeHead(404).end();
});

const sockets = new WebSocketServer({ server, path: '/ws' });
sockets.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'hello', service: 'tithe-server' }));
  socket.on('message', (raw) => {
    let message: { type?: string; at?: number };
    try {
      message = JSON.parse(raw.toString()) as { type?: string; at?: number };
    } catch {
      return;
    }
    if (message.type === 'ping') socket.send(JSON.stringify({ type: 'pong', at: message.at, players: sockets.clients.size }));
  });
});

const shutdown = async () => {
  for (const client of sockets.clients) client.close(1001, 'Server is shutting down');
  sockets.close();
  server.close();
  await bus.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(env.port, '0.0.0.0', () => log(`Listening on ${env.port}`));
