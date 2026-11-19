// Characters' lyttere: karakteren gemmes, når en Tithe slutter (Feature-016 EVT-04), og Feature-039 SVC-01 Chronicler
// tæller statistikken.

import type { PlayerDefeated, TitheEnded } from '@maw/contracts';
import type { Client } from '../db.ts';

async function ensureStatistics(client: Client, characterId: string): Promise<void> {
  await client.query('insert into characters.statistics (character_id) values ($1) on conflict (character_id) do nothing', [characterId]);
}

/**
 * Feature-016: skills, Echo, Marks og point fra Tithen gemmes altid (Feature-002, -003, -004 i arbejdskopien).
 * Feature-039 CMD-01 Record statistics: Tithen tælles med sit udfald, den dybeste dybde, monstre og rivaler.
 */
export async function onTitheEnded(client: Client, data: TitheEnded): Promise<void> {
  const c = data.character;
  const updated = await client.query(
    `update characters.characters set mark = $2, echo = $3, attributes = $4, skills = $5, attribute_points = $6, skill_points = $7
     where id = $1`,
    [data.characterId, c.level, c.echo, JSON.stringify(c.attributes), JSON.stringify(c.skills), c.attributePoints, c.skillPoints],
  );
  if (updated.rowCount === 0) return; // karakteren er slettet imens
  await ensureStatistics(client, data.characterId);
  const kind = data.outcome.kind;
  await client.query(
    `update characters.statistics set
       tithes = tithes + 1,
       champions = champions + $2,
       falls = falls + $3,
       left_tithes = left_tithes + $4,
       deepest = greatest(deepest, $5),
       monsters = monsters + $6,
       rivals = rivals + $7
     where character_id = $1`,
    [data.characterId, kind === 'champion' ? 1 : 0, kind === 'fell' ? 1 : 0, kind === 'left' ? 1 : 0, data.record.maxDepth, data.record.kills, data.record.rivalsDefeated],
  );
}

/** Feature-039 EVT-05 Player kill recorded: den, der slog, får et Player kill, og den slåede ét "Killed by players". */
export async function onPlayerDefeated(client: Client, data: PlayerDefeated): Promise<void> {
  for (const id of [data.byCharacterId, data.characterId]) await ensureStatistics(client, id);
  await client.query('update characters.statistics set player_kills = player_kills + 1 where character_id = $1', [data.byCharacterId]);
  await client.query('update characters.statistics set killed_by_players = killed_by_players + 1 where character_id = $1', [data.characterId]);
}
