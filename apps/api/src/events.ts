// Lytterne i api'et: hvilket modul der håndterer hvilket event fra bussen. Samme tabel bruges af RabbitMQ (main.ts)
// og af testene, der leverer outboxens events direkte.

import { EVENT, bindingsFor, queueFor, type EventEnvelope } from '@maw/contracts';
import type { Bus } from '@maw/platform';
import * as characters from './characters/handlers.ts';
import type { Client, Pool } from './db.ts';
import * as gear from './gear/handlers.ts';
import * as market from './market/handlers.ts';
import { idempotent } from './outbox.ts';
import * as patronage from './patronage/handlers.ts';

// Hver lytter kender sit events indhold; tabellen kalder den med event.data.
type Handler = (client: Client, data: never) => Promise<void>;

export const HANDLERS: Record<string, Record<string, Handler>> = {
  // Feature-016 (karakteren gemmes) og Feature-039 Keep player statistics
  Characters: {
    [EVENT.titheEnded]: characters.onTitheEnded,
    [EVENT.playerDefeated]: characters.onPlayerDefeated,
  },
  // Feature-005 Stock the inventory og Feature-009 Settle found gear
  Gear: {
    [EVENT.characterCreated]: gear.onCharacterCreated,
    [EVENT.itemBought]: gear.onItemReceived,
    [EVENT.itemGiftAccepted]: gear.onItemReceived,
    [EVENT.itemSold]: gear.onItemSold,
    [EVENT.potionBought]: gear.onConsumableBought('potions'),
    [EVENT.rationBought]: gear.onConsumableBought('rations'),
    [EVENT.focusPotionBought]: gear.onConsumableBought('focus_potions'),
    [EVENT.identificationBought]: gear.onIdentificationBought,
    [EVENT.characterDeleted]: gear.onCharacterDeleted,
    [EVENT.titheEnded]: gear.onTitheEnded,
  },
  // Feature-018 Keep the wallet, Feature-021 Restock the Forge og Feature-046 Settle arena stakes
  Market: {
    [EVENT.characterCreated]: market.onCharacterCreated,
    [EVENT.goldGiftAccepted]: market.onGoldReceived,
    [EVENT.pursePaid]: market.onGoldReceived,
    [EVENT.foundGearKept]: market.onGoldReceived,
    [EVENT.characterDeleted]: market.onCharacterDeleted,
    [EVENT.titheEnded]: market.onTitheEnded,
    [EVENT.playerDefeated]: market.onPlayerDefeated,
    // Feature-046 Settle arena stakes
    [EVENT.arenaMatchStarted]: market.onArenaMatchStarted,
    [EVENT.arenaMatchEnded]: market.onArenaMatchEnded,
  },
  // Feature-022 Pay the Crown's Purse og Feature-023 Grant sponsor gifts
  Patronage: {
    [EVENT.characterDeleted]: patronage.onCharacterDeleted,
    [EVENT.titheEnded]: patronage.onTitheEnded,
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
