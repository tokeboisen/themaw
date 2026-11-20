// Gear: inventaret (Feature-005, -007, -027) og Gears forespørgsler til Market og Patronage.

import { BALANCE as B, derivedStats, emptyEquipment, type Character, type EquipSlot, type Equipment, type Hotbar, type Item } from '@maw/rules';
import { characterCore } from '../characters/queries.ts';
import type { Client, Pool } from '../db.ts';

export interface Inventory {
  characterId: string;
  userId: string;
  potions: number;
  rations: number;
  hotbar: Hotbar;
  equipment: Equipment;
  pack: Item[];
}

type Db = Pool | Client;

export async function loadInventory(db: Db, characterId: string, lock = false): Promise<Inventory | undefined> {
  const inv = await db.query<{ user_id: string; potions: number; rations: number; hotbar: Hotbar }>(
    `select user_id, potions, rations, hotbar from gear.inventories where character_id = $1${lock ? ' for update' : ''}`,
    [characterId],
  );
  const row = inv.rows[0];
  if (!row) return undefined;
  const items = await db.query<{ location: EquipSlot | 'pack'; data: Item }>(
    'select location, data from gear.items where character_id = $1 order by added_at, id',
    [characterId],
  );
  const equipment: Equipment = emptyEquipment();
  const pack: Item[] = [];
  for (const item of items.rows) {
    if (item.location === 'pack') pack.push(item.data);
    else equipment[item.location] = item.data;
  }
  return { characterId, userId: row.user_id, potions: row.potions, rations: row.rations, hotbar: row.hotbar, equipment, pack };
}

/** Pakkens størrelse: 12 + 1 for hver 2 Strength over 10, med bonus fra udstyret (Feature-005 AGG-01). */
export async function capacity(db: Db, inv: Inventory): Promise<number> {
  const core = await characterCore(db, inv.characterId);
  if (!core) return B.character.baseCapacity;
  const character: Character = {
    name: core.name, background: core.background, level: core.mark, echo: core.echo, attributes: core.attributes,
    skills: core.skills, attributePoints: core.attributePoints, skillPoints: core.skillPoints, gold: 0,
    potions: inv.potions, rations: inv.rations, equipment: inv.equipment, inventory: inv.pack, tithes: 0, championships: 0,
  };
  return derivedStats(character, B).capacity;
}

// --- Forespørgsler fra Market og Patronage --------------------------------------------------------

/** Ledige pladser i pakken. */
export async function roomLeft(db: Db, characterId: string): Promise<number> {
  const inv = await loadInventory(db, characterId);
  if (!inv) return 0;
  return (await capacity(db, inv)) - inv.pack.length;
}

export async function consumables(db: Db, characterId: string): Promise<{ potions: number; rations: number } | undefined> {
  const { rows } = await db.query<{ potions: number; rations: number }>('select potions, rations from gear.inventories where character_id = $1', [characterId]);
  return rows[0];
}

/** En ting i pakken (ikke en, der er taget på); kun dem kan sælges (Feature-019 CMD-02). */
export async function packItem(db: Db, characterId: string, itemId: string): Promise<Item | undefined> {
  const { rows } = await db.query<{ data: Item }>(
    `select data from gear.items where character_id = $1 and id = $2 and location = 'pack'`,
    [characterId, itemId],
  );
  return rows[0]?.data;
}
