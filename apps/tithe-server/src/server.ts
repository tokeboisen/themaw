// HTTP og WebSocket for tithe-server: sundhedstjek, /internal/tithes til lobbyen (kun inde i Docker; gatewayen sender
// kun /ws hertil) og /ws?ticket=… til browserne.

import { createServer, type Server } from 'node:http';
import { WebSocketServer } from 'ws';
import { Host } from './host.ts';
import type { Square } from './square.ts';

export interface TitheServer {
  server: Server;
  host: Host;
  close(): Promise<void>;
}

export function createTitheServer(host: Host, health: () => boolean, square?: Square): TitheServer {
  const server = createServer((request, response) => {
    if (request.url === '/health') {
      const ok = health();
      response.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: ok ? 'ok' : 'degraded', service: 'tithe-server', bus: ok, tithes: host.running().length }));
      return;
    }
    if (request.url === '/internal/tithes') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ tithes: host.running() }));
      return;
    }
    response.writeHead(404).end();
  });
  const sockets = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
  sockets.on('connection', (socket, request) => {
    // /ws?square=1 er Mustering Square (Feature-042); /ws?ticket=… er en Tithe.
    const square_ = new URL(request.url ?? '', 'http://localhost').searchParams.has('square');
    if (square_ && square) void square.connect(socket, request);
    else host.connect(socket, request);
  });
  return {
    server,
    host,
    async close() {
      host.stop();
      square?.stop();
      for (const client of sockets.clients) client.close(1001, 'Server is shutting down');
      sockets.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
