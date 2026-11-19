// api: commands og forespørgsler for Accounts, Characters, Gear, Market, Patronage, Lobby og Other players.

import { bindingsFor, queueFor } from '@maw/contracts';
import { connectBus } from '@maw/platform';
import { buildApp } from './app.ts';
import { createPool, migrate, waitForDatabase } from './db.ts';
import { startConsumers } from './events.ts';
import { startRelay } from './outbox.ts';

const env = {
  databaseUrl: process.env.DATABASE_URL ?? '',
  rabbitUrl: process.env.RABBITMQ_URL ?? '',
  port: Number(process.env.PORT ?? 3000),
};
if (!env.databaseUrl || !env.rabbitUrl) throw new Error('DATABASE_URL and RABBITMQ_URL must be set');

const log = (message: string) => console.log(JSON.stringify({ time: new Date().toISOString(), service: 'api', message }));

const pool = createPool(env.databaseUrl);
await waitForDatabase(pool, log);
await migrate(pool, undefined, log);

const bus = await connectBus(env.rabbitUrl, { log });
bus.onClose(() => {
  log('RabbitMQ connection closed; exiting so Docker restarts the service');
  process.exit(1);
});
// Køerne oprettes med det samme, så events venter på deres lyttere: også Tithes kø, så "Tithe launched" ikke går tabt,
// hvis tithe-server starter efter api'et.
for (const context of ['Characters', 'Gear', 'Market', 'Patronage', 'Tithe']) {
  const bindings = bindingsFor(context);
  if (bindings.length) await bus.declare(queueFor(context), bindings);
}
await startConsumers(pool, bus);
const stopRelay = startRelay(pool, bus, log);

const app = buildApp(pool, bus, true);

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
