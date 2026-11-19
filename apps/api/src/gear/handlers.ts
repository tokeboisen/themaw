// Feature-005 SVC-01 Quartermaster: inventaret følger med, når andre contexts melder noget.

import { EVENT, type CharacterCreated, type CharacterDeleted, type ConsumableBought, type FoundGearKept, type ItemBought, type ItemGiftAccepted, type ItemSold, type TitheEnded } from '@maw/contracts';
import { envelope } from '@maw/platform';
import {
  BALANCE as B, backgroundById, createRng, losesFound, randomSeed, removeWeaponFromHotbar, settleFoundGear, startingKit, type Character, type Item,
} from '@maw/rules';
import type { Client } from '../db.ts';
import { enqueue } from '../outbox.ts';

async function addItem(client: Client, characterId: string, item: Item, location: 'pack' | 'weapon' | 'armour' | 'ring' = 'pack') {
  await client.query(
    'insert into gear.items (id, character_id, location, data) values ($1, $2, $3, $4) on conflict (id) do nothing',
    [item.id, characterId, location, JSON.stringify(item)],
  );
}

/** EVT-01 Character created → CMD-01 Add item og CMD-03 Add consumable: startudstyret. */
export async function onCharacterCreated(client: Client, data: CharacterCreated): Promise<void> {
  const bg = backgroundById(B, data.background);
  if (!bg) throw new Error(`Unknown background ${data.background}`);
  const kit = startingKit(bg, createRng(randomSeed()), B);
  const inserted = await client.query(
    `insert into gear.inventories (character_id, user_id, potions, rations, hotbar) values ($1, $2, $3, $4, $5)
     on conflict (character_id) do nothing`,
    [data.characterId, data.userId, kit.potions, kit.rations, JSON.stringify(kit.hotbar)],
  );
  if (inserted.rowCount === 0) return;
  await addItem(client, data.characterId, kit.weapon, 'weapon');
  await addItem(client, data.characterId, kit.armour, 'armour');
}

/** EVT-02 Item bought og EVT-06 Item gift accepted → CMD-01 Add item: tingen kommer i pakken. */
export async function onItemReceived(client: Client, data: ItemBought | ItemGiftAccepted): Promise<void> {
  await addItem(client, data.characterId, data.item);
}

/** EVT-03 Item sold → CMD-02 Remove item; et våben på hotbaren mister sin tast (Feature-027 AGG-01). */
export async function onItemSold(client: Client, data: ItemSold): Promise<void> {
  await client.query(`delete from gear.items where character_id = $1 and id = $2 and location = 'pack'`, [data.characterId, data.itemId]);
  const { rows } = await client.query<{ hotbar: Record<string, unknown> }>('select hotbar from gear.inventories where character_id = $1 for update', [data.characterId]);
  if (!rows[0]) return;
  const hotbar = removeWeaponFromHotbar(rows[0].hotbar, data.itemId);
  await client.query('update gear.inventories set hotbar = $2 where character_id = $1', [data.characterId, JSON.stringify(hotbar)]);
}

/** EVT-04 Potion bought og EVT-05 Ration bought → CMD-03 Add consumable, højst 9 af hver. */
export function onConsumableBought(kind: 'potions' | 'rations') {
  return async (client: Client, data: ConsumableBought): Promise<void> => {
    await client.query(`update gear.inventories set ${kind} = least($2, ${kind} + 1) where character_id = $1`, [data.characterId, B.character.maxConsumables]);
  };
}

/** EVT-10 Character deleted → CMD-04 Empty inventory. */
export async function onCharacterDeleted(client: Client, data: CharacterDeleted): Promise<void> {
  await client.query('delete from gear.inventories where character_id = $1', [data.characterId]);
}

/**
 * Feature-009 SVC-01 Quartermaster: når en Tithe slutter, er inventaret arbejdskopien fra Tithen. Ved et fald, eller
 * når spilleren forlod Tithen, mistes det fundne (EVT-03 Found gear lost); ellers beholdes det, og det fundne guld går
 * til tegnebogen (EVT-02 Found gear kept → Market, Feature-018).
 */
export async function onTitheEnded(client: Client, data: TitheEnded): Promise<void> {
  const exists = await client.query('select 1 from gear.inventories where character_id = $1 for update', [data.characterId]);
  if (!exists.rowCount) return; // karakteren er slettet imens
  const g = data.gear;
  const ch = { equipment: { ...g.equipment }, inventory: [...g.pack] } as Character;
  const lose = losesFound(data.outcome.kind);
  const { lost, kept } = settleFoundGear(ch, data.titheId, lose);
  let hotbar = g.hotbar;
  for (const item of lost) hotbar = removeWeaponFromHotbar(hotbar, item.id);
  await client.query('update gear.inventories set potions = $2, rations = $3, hotbar = $4 where character_id = $1', [
    data.characterId, Math.min(B.character.maxConsumables, g.potions), Math.min(B.character.maxConsumables, g.rations), JSON.stringify(hotbar),
  ]);
  await client.query('delete from gear.items where character_id = $1', [data.characterId]);
  const placed: [Item, 'pack' | 'weapon' | 'armour' | 'ring'][] = [];
  for (const slot of ['weapon', 'armour', 'ring'] as const) {
    const item = ch.equipment[slot];
    if (item) placed.push([item, slot]);
  }
  for (const item of ch.inventory) placed.push([item, 'pack']);
  // Rækkefølgen i pakken bevares: hver ting får sit eget tidspunkt.
  for (const [i, [item, location]] of placed.entries()) {
    await client.query(
      `insert into gear.items (id, character_id, location, data, added_at) values ($1, $2, $3, $4, now() + $5 * interval '1 millisecond')`,
      [item.id, data.characterId, location, JSON.stringify(item), i],
    );
  }
  if (!lose) {
    const kept_: FoundGearKept = { characterId: data.characterId, titheId: data.titheId, gold: data.record.goldFound, items: kept.map((i) => i.id) };
    await enqueue(client, envelope(EVENT.foundGearKept, kept_));
  }
}
