// tithe-server: kører Tithes i hukommelsen og taler med browserne over WebSocket (Tithe, Spectacle og partierne i en
// Tithe). "Tithe launched" fra lobbyen starter en Tithe; "Tithe ended" går tilbage på bussen for hver spiller.

import { EVENT, bindingsFor, queueFor, type TitheLaunched } from '@maw/contracts';
import { connectBus } from '@maw/platform';
import { Host } from './host.ts';
import { createTitheServer } from './server.ts';

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

const host = new Host(bus, log);
// Feature-037 EVT-01 Tithe launched → Feature-010 SVC-01 Tithe master
await bus.consume(queueFor('Tithe'), bindingsFor('Tithe'), async (event) => {
  if (event.type === EVENT.titheLaunched) host.launch(event.data as TitheLaunched);
});

const app = createTitheServer(host, () => bus.isOpen());

const shutdown = async () => {
  await app.close();
  await bus.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

app.server.listen(env.port, '0.0.0.0', () => log(`Listening on ${env.port}`));
