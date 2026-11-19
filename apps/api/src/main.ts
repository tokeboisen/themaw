// api: commands og forespørgsler for Accounts, Characters, Gear, Market, Patronage, Lobby og Other players.
// Fase 0: sundhedstjek, migrationer, bussen og outbox-relæet. Endpoints for features kommer i fase 1 og frem.

import Fastify from 'fastify';
import { connectBus } from '@maw/platform';
import { createPool, migrate, waitForDatabase } from './db.ts';
import { startRelay } from './outbox.ts';

const env = {
  databaseUrl: process.env.DATABASE_URL ?? '',
  rabbitUrl: process.env.RABBITMQ_URL ?? '',
  port: Number(process.env.PORT ?? 3000),
};
if (!env.databaseUrl || !env.rabbitUrl) throw new Error('DATABASE_URL and RABBITMQ_URL must be set');

const app = Fastify({ logger: true });
const log = (m: string) => app.log.info(m);

const pool = createPool(env.databaseUrl);
await waitForDatabase(pool, log);
await migrate(pool, undefined, log);

const bus = await connectBus(env.rabbitUrl, { log });
bus.onClose(() => {
  app.log.error('RabbitMQ connection closed; exiting so Docker restarts the service');
  process.exit(1);
});
const stopRelay = startRelay(pool, bus, log);

app.get('/api/health', async (_request, reply) => {
  let database = false;
  try {
    await pool.query('select 1');
    database = true;
  } catch {
    database = false;
  }
  const ok = database && bus.isOpen();
  return reply.code(ok ? 200 : 503).send({ status: ok ? 'ok' : 'degraded', service: 'api', database, bus: bus.isOpen() });
});

const shutdown = async () => {
  await stopRelay();
  await app.close();
  await bus.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ host: '0.0.0.0', port: env.port });
