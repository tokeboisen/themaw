// Bussen: events mellem bounded contexts over RabbitMQ (Plan-server-og-webapp.md, afsnit 6).
// Udgivelse med bekræftelse, holdbare køer pr. context, og beskeder, der fejler, går til dead-letter-køen.

import { randomUUID } from 'node:crypto';
import amqp from 'amqplib';
import { DEAD_LETTER_EXCHANGE, DEAD_LETTER_QUEUE, EXCHANGE, type EventEnvelope } from '@maw/contracts';

type Connection = Awaited<ReturnType<typeof amqp.connect>>;

export type Handler = (event: EventEnvelope) => Promise<void>;
export type Log = (message: string) => void;

export interface Bus {
  publish(event: EventEnvelope): Promise<void>;
  /** Lytter på køen med de givne routing keys. En handler, der fejler, sender beskeden til dead-letter-køen. */
  consume(queue: string, bindings: string[], handler: Handler): Promise<void>;
  deleteQueue(queue: string): Promise<void>;
  isOpen(): boolean;
  /** Kaldes, hvis forbindelsen lukker uventet. Services afslutter så, og Docker starter dem igen. */
  onClose(callback: () => void): void;
  close(): Promise<void>;
}

export function envelope<T>(type: string, data: T): EventEnvelope<T> {
  return { id: randomUUID(), type, occurredAt: new Date().toISOString(), data };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function connectBus(url: string, opts: { retries?: number; log?: Log } = {}): Promise<Bus> {
  const log = opts.log ?? (() => {});
  let conn: Connection | undefined;
  for (let attempt = 1; !conn; attempt++) {
    try {
      conn = await amqp.connect(url);
    } catch (err) {
      if (attempt >= (opts.retries ?? 30)) throw err;
      log(`RabbitMQ is not ready (attempt ${attempt}): ${(err as Error).message}`);
      await sleep(1000 * Math.min(attempt, 5));
    }
  }
  const connection = conn;
  let open = true;
  let closing = false;
  const closeCallbacks: (() => void)[] = [];
  connection.on('error', (err: Error) => log(`RabbitMQ error: ${err.message}`));
  connection.on('close', () => {
    open = false;
    if (!closing) for (const cb of closeCallbacks) cb();
  });

  const pub = await connection.createConfirmChannel();
  await pub.assertExchange(EXCHANGE, 'topic', { durable: true });
  await pub.assertExchange(DEAD_LETTER_EXCHANGE, 'fanout', { durable: true });
  await pub.assertQueue(DEAD_LETTER_QUEUE, { durable: true });
  await pub.bindQueue(DEAD_LETTER_QUEUE, DEAD_LETTER_EXCHANGE, '');
  const sub = await connection.createChannel();
  await sub.prefetch(10);

  return {
    async publish(event) {
      pub.publish(EXCHANGE, event.type, Buffer.from(JSON.stringify(event)), {
        persistent: true,
        contentType: 'application/json',
        messageId: event.id,
        type: event.type,
        timestamp: Date.now(),
      });
      await pub.waitForConfirms();
    },
    async consume(queue, bindings, handler) {
      await sub.assertQueue(queue, { durable: true, deadLetterExchange: DEAD_LETTER_EXCHANGE });
      for (const binding of bindings) await sub.bindQueue(queue, EXCHANGE, binding);
      await sub.consume(queue, (msg) => {
        if (!msg) return;
        let event: EventEnvelope;
        try {
          event = JSON.parse(msg.content.toString('utf8')) as EventEnvelope;
        } catch {
          log(`Unreadable message on ${queue}; sent to ${DEAD_LETTER_QUEUE}`);
          sub.nack(msg, false, false);
          return;
        }
        handler(event).then(
          () => sub.ack(msg),
          (err: unknown) => {
            log(`${queue} failed on ${event.type} ${event.id}: ${(err as Error).message}; sent to ${DEAD_LETTER_QUEUE}`);
            sub.nack(msg, false, false);
          },
        );
      });
    },
    async deleteQueue(queue) {
      await sub.deleteQueue(queue);
    },
    isOpen: () => open,
    onClose(callback) {
      closeCallbacks.push(callback);
    },
    async close() {
      if (!open) return;
      closing = true;
      await connection.close();
    },
  };
}
