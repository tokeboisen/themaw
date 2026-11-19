// Arbejdskopien af en karakter, der følger med "Tithe launched" til tithe-server (planen, afsnit 5): Characters'
// egenskaber og skills, Gears udstyr og hotbar, Markets guld og statistikkens antal Tithes. Aflæsningerne er direkte,
// fordi modulerne kører i samme proces.

import type { Character, Hotbar } from '@maw/rules';
import { characterCore } from '../characters/queries.ts';
import type { Client, Pool } from '../db.ts';
import { loadInventory } from '../gear/store.ts';

export async function workingCopy(db: Pool | Client, characterId: string): Promise<{ character: Character; hotbar: Hotbar } | null> {
  const core = await characterCore(db, characterId);
  const inv = await loadInventory(db, characterId);
  if (!core || !inv) return null;
  const wallet = await db.query<{ gold: number }>('select gold from market.wallets where character_id = $1', [characterId]);
  const stats = await db.query<{ tithes: number; champions: number }>('select tithes, champions from characters.statistics where character_id = $1', [characterId]);
  return {
    character: {
      name: core.name, background: core.background, level: core.mark, echo: core.echo, attributes: core.attributes, skills: core.skills,
      attributePoints: core.attributePoints, skillPoints: core.skillPoints, gold: wallet.rows[0]?.gold ?? 0,
      potions: inv.potions, rations: inv.rations, equipment: inv.equipment, inventory: inv.pack,
      tithes: stats.rows[0]?.tithes ?? 0, championships: stats.rows[0]?.champions ?? 0,
    },
    hotbar: inv.hotbar,
  };
}
