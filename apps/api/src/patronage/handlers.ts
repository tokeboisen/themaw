// Feature-022 SVC-01 Crown treasurer og Feature-023 SVC-01 Noble Houses: pengepungen og gaverne efter en Tithe, og
// gaverne trækkes tilbage, når en karakter slettes (CMD-02 Withdraw gifts).

import { randomUUID } from 'node:crypto';
import { EVENT, type CharacterDeleted, type PursePaid, type TitheEnded } from '@maw/contracts';
import { envelope } from '@maw/platform';
import { BALANCE as B, createRng, crownsPurse, grantGifts, randomSeed } from '@maw/rules';
import type { Client } from '../db.ts';
import { enqueue } from '../outbox.ts';

/**
 * Feature-022 CMD-01 Pay the purse: 40 × dybeste dybde + 150 for The Foreman + 0,3 × Renown + 300 for Champion, halveret
 * ved et fald. Feature-023 CMD-01 Grant gift: én gave for hver 100 Renown, højst 4. Renown følger med "Tithe ended".
 */
export async function onTitheEnded(client: Client, data: TitheEnded): Promise<void> {
  const exists = await client.query('select 1 from market.wallets where character_id = $1', [data.characterId]);
  if (!exists.rowCount) return; // karakteren er slettet imens
  const gold = crownsPurse(data, B);
  if (gold > 0) {
    const paid: PursePaid = { characterId: data.characterId, gold };
    await enqueue(client, envelope(EVENT.pursePaid, paid));
  }
  for (const gift of grantGifts(createRng(randomSeed()), data.record.renown, data.character.level, B)) {
    await client.query(
      'insert into patronage.gifts (id, character_id, user_id, house, kind, item, gold) values ($1, $2, $3, $4, $5, $6, $7)',
      [randomUUID(), data.characterId, data.userId, gift.house, gift.kind, gift.item ? JSON.stringify(gift.item) : null, gift.gold ?? null],
    );
  }
}

export async function onCharacterDeleted(client: Client, data: CharacterDeleted): Promise<void> {
  await client.query('delete from patronage.gifts where character_id = $1 and accepted_at is null', [data.characterId]);
}
