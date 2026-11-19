// Integrationstest af bussen: outbox → RabbitMQ → idempotent lytter.
// Kræver Postgres og RabbitMQ (DATABASE_URL og RABBITMQ_URL); køres i tools-containeren, se README.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { TECHNICAL_EVENTS } from '@maw/contracts';
import { connectBus, envelope } from '@maw/platform';
import { createPool, migrate } from '../src/db.ts';
import { enqueue, idempotent, relayOnce } from '../src/outbox.ts';

const databaseUrl = process.env.DATABASE_URL;
const rabbitUrl = process.env.RABBITMQ_URL;

test('an event goes from the outbox over RabbitMQ to a listener, and only counts once', { skip: !databaseUrl || !rabbitUrl }, async () => {
  const pool = createPool(databaseUrl!);
  await migrate(pool);
  const bus = await connectBus(rabbitUrl!, { retries: 5 });
  const queue = `maw.test-${randomUUID()}`;
  try {
    const received: string[] = [];
    let arrived!: () => void;
    const first = new Promise<void>((resolve) => (arrived = resolve));
    await bus.consume(queue, [TECHNICAL_EVENTS.ping], idempotent(pool, queue, async (event) => {
      received.push(event.id);
      arrived();
    }));

    const event = envelope(TECHNICAL_EVENTS.ping, { hello: 'the Maw' });
    await enqueue(pool, event);
    assert.ok((await relayOnce(pool, bus)) >= 1);
    await first;

    // Samme event igen, som efter en genstart før kvittering: det tæller ikke to gange.
    await bus.publish(event);
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.deepEqual(received, [event.id]);
  } finally {
    await bus.deleteQueue(queue);
    await bus.close();
    await pool.end();
  }
});
