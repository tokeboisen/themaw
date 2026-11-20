// Feature-018 SVC-01 Banker og Feature-021 SVC-01 Forge keeper.

import type { ArenaMatchEnded, ArenaMatchStarted, CharacterCreated, CharacterDeleted, GoldGiftAccepted, PlayerDefeated, TitheEnded } from '@maw/contracts';
import { BALANCE as B, arenaPayout, createRng, forgeStockAt, randomSeed } from '@maw/rules';
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

/** Feature-021 CMD-01 Restock the Forge: efter hver Tithe får smedjen nyt lager med karakterens Mark. */
export async function onTitheEnded(client: Client, data: TitheEnded): Promise<void> {
  const stock = forgeStockAt(createRng(randomSeed()), data.character.level, B);
  await client.query('update market.forges set stock = $2 where character_id = $1', [data.characterId, JSON.stringify(stock)]);
}

/** Feature-018: en spiller, der slås ned af en anden spiller, taber det guld, der blev spildt på gulvet (fase 4). */
export async function onPlayerDefeated(client: Client, data: PlayerDefeated): Promise<void> {
  await client.query('update market.wallets set gold = greatest(0, gold - $2) where character_id = $1', [data.characterId, data.gold]);
}

/** Feature-046 SVC-01 Arena bookkeeper, CMD-01 Take the stakes: indsatsen tages fra hver kæmpers tegnebog. */
export async function onArenaMatchStarted(client: Client, data: ArenaMatchStarted): Promise<void> {
  if (data.stake <= 0) return;
  for (const f of data.fighters) {
    await client.query('update market.wallets set gold = greatest(0, gold - $2) where character_id = $1', [f.characterId, data.stake]);
  }
}

/** Feature-046 CMD-02 Pay the winners: vinderne deler potten; uafgjort giver indsatsen tilbage. */
export async function onArenaMatchEnded(client: Client, data: ArenaMatchEnded): Promise<void> {
  if (data.stake <= 0) return;
  const winners = data.fighters.filter((f) => f.result === 'won').length;
  for (const f of data.fighters) {
    const gold = arenaPayout(data.stake, data.fighters.length, winners, f.result);
    if (gold > 0) await client.query('update market.wallets set gold = gold + $2 where character_id = $1', [f.characterId, gold]);
  }
}
