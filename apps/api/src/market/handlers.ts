// Feature-018 SVC-01 Banker og Feature-021 SVC-01 Forge keeper.

import type { CharacterCreated, CharacterDeleted, GoldGiftAccepted } from '@maw/contracts';
import { BALANCE as B, createRng, forgeStockAt, randomSeed } from '@maw/rules';
import type { Client } from '../db.ts';

/** F018: en ny karakter starter med 60 guld. F021: Forge får sit første lager med karakterens Mark. */
export async function onCharacterCreated(client: Client, data: CharacterCreated): Promise<void> {
  await client.query(
    'insert into market.wallets (character_id, user_id, gold) values ($1, $2, $3) on conflict (character_id) do nothing',
    [data.characterId, data.userId, B.character.startGold],
  );
  const stock = forgeStockAt(createRng(randomSeed()), data.mark, B);
  await client.query(
    'insert into market.forges (character_id, user_id, stock) values ($1, $2, $3) on conflict (character_id) do nothing',
    [data.characterId, data.userId, JSON.stringify(stock)],
  );
}

/** F018 CMD-01 Add gold, f.eks. når en guldgave tages imod (Feature-024 EVT-02). */
export async function onGoldReceived(client: Client, data: GoldGiftAccepted | { characterId: string; gold: number }): Promise<void> {
  await client.query('update market.wallets set gold = gold + $2 where character_id = $1', [data.characterId, data.gold]);
}

/** F018 CMD-03 Close wallet og F021 CMD-02 Clear the Forge. */
export async function onCharacterDeleted(client: Client, data: CharacterDeleted): Promise<void> {
  await client.query('delete from market.wallets where character_id = $1', [data.characterId]);
  await client.query('delete from market.forges where character_id = $1', [data.characterId]);
}
