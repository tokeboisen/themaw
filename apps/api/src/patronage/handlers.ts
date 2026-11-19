// Feature-023 SVC-01 Noble Houses. At give gaver efter en Tithe kommer i fase 3; her trækkes de tilbage, når en
// karakter slettes (CMD-02 Withdraw gifts).

import type { CharacterDeleted } from '@maw/contracts';
import type { Client } from '../db.ts';

export async function onCharacterDeleted(client: Client, data: CharacterDeleted): Promise<void> {
  await client.query('delete from patronage.gifts where character_id = $1 and accepted_at is null', [data.characterId]);
}
