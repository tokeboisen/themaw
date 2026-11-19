// Lytterne i api'et: hvilket modul der håndterer hvilket event fra bussen. Samme tabel bruges af RabbitMQ (main.ts)
// og af testene, der leverer outboxens events direkte.

import { EVENT, bindingsFor, queueFor, type EventEnvelope } from '@maw/contracts';
import type { Bus } from '@maw/platform';
import type { Client, Pool } from './db.ts';
import * as gear from './gear/handlers.ts';
import * as market from './market/handlers.ts';
import { idempotent } from './outbox.ts';
import * as patronage from './patronage/handlers.ts';

// Hver lytter kender sit events indhold; tabellen kalder den med event.data.
type Handler = (client: Client, data: never) => Promise<void>;

export const HANDLERS: Record<string, Record<string, Handler>> = {
  // Feature-005 Stock the inventory
  Gear: {
    [EVENT.characterCreated]: gear.onCharacterCreated,
    [EVENT.itemBought]: gear.onItemReceived,
    [EVENT.itemGiftAccepted]: gear.onItemReceived,
    [EVENT.itemSold]: gear.onItemSold,
    [EVENT.potionBought]: gear.onConsumableBought('potions'),
    [EVENT.rationBought]: gear.onConsumableBought('rations'),
    [EVENT.characterDeleted]: gear.onCharacterDeleted,
  },
  // Feature-018 Keep the wallet og Feature-021 Restock the Forge
  Market: {
    [EVENT.characterCreated]: market.onCharacterCreated,
    [EVENT.goldGiftAccepted]: market.onGoldReceived,
    [EVENT.pursePaid]: market.onGoldReceived,
    [EVENT.foundGearKept]: market.onGoldReceived,
    [EVENT.characterDeleted]: market.onCharacterDeleted,
  },
  // Feature-023 Grant sponsor gifts (tilbagetrækning; at give gaver kommer i fase 3)
  Patronage: {
    [EVENT.characterDeleted]: patronage.onCharacterDeleted,
  },
};

export function consumer(pool: Pool, context: string): (event: EventEnvelope) => Promise<void> {
  const handlers = HANDLERS[context] ?? {};
  return idempotent(pool, queueFor(context), async (event, client) => {
    const handler = handlers[event.type];
    if (!handler) throw new Error(`${context} has no handler for ${event.type} yet`);
    await handler(client, event.data as never);
  });
}

/** Lytter på køerne for de contexts, der har lyttere. Køerne med kun senere lyttere er oprettet i main.ts. */
export async function startConsumers(pool: Pool, bus: Bus): Promise<void> {
  for (const context of Object.keys(HANDLERS)) {
    await bus.consume(queueFor(context), bindingsFor(context), consumer(pool, context));
  }
}
