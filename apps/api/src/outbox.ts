// Outbox: et event skrives i samme transaktion som den ændring, det fortæller om, og sendes bagefter til RabbitMQ.
// Så går et event aldrig tabt mellem databasen og bussen. Lytterne husker behandlede events, så et event, der
// kommer to gange (f.eks. efter en genstart før kvittering), kun tæller én gang.

import type { EventEnvelope } from '@maw/contracts';
import type { Bus } from '@maw/platform';
import { transaction, type Client, type Pool } from './db.ts';

export async function enqueue(db: Pool | Client, event: EventEnvelope): Promise<void> {
  await db.query('insert into platform.outbox (id, type, payload, occurred_at) values ($1, $2, $3, $4)', [
    event.id,
    event.type,
    JSON.stringify(event.data),
    event.occurredAt,
  ]);
}

interface OutboxRow {
  id: string;
  type: string;
  payload: unknown;
  occurred_at: Date;
}

/** Sender de events, der venter, og returnerer, hvor mange det var. */
export async function relayOnce(pool: Pool, bus: Bus, batch = 50): Promise<number> {
  return transaction(pool, async (client) => {
    const { rows } = await client.query<OutboxRow>(
      `select id, type, payload, occurred_at from platform.outbox
       where published_at is null order by occurred_at limit $1 for update skip locked`,
      [batch],
    );
    for (const row of rows) {
      await bus.publish({ id: row.id, type: row.type, occurredAt: row.occurred_at.toISOString(), data: row.payload });
      await client.query('update platform.outbox set published_at = now() where id = $1', [row.id]);
    }
    return rows.length;
  });
}

/** Sender ventende events hvert kvarte sekund. Returnerer en funktion, der stopper relæet. */
export function startRelay(pool: Pool, bus: Bus, log: (m: string) => void): () => Promise<void> {
  let running = true;
  const loop = (async () => {
    while (running) {
      try {
        const sent = await relayOnce(pool, bus);
        if (sent > 0) continue;
      } catch (err) {
        log(`Outbox relay failed: ${(err as Error).message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  })();
  return async () => {
    running = false;
    await loop;
  };
}

/** Gør en handler idempotent: hvert event behandles højst én gang pr. lytter, i én transaktion. */
export function idempotent(pool: Pool, consumer: string, handler: (event: EventEnvelope, client: Client) => Promise<void>) {
  return (event: EventEnvelope) =>
    transaction(pool, async (client) => {
      const inserted = await client.query(
        'insert into platform.processed_events (consumer, event_id) values ($1, $2) on conflict do nothing',
        [consumer, event.id],
      );
      if (inserted.rowCount === 0) return;
      await handler(event, client);
    });
}
