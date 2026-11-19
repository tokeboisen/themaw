// Feature-005 SVC-01 Quartermaster: inventaret følger med, når andre contexts melder noget.

import type { CharacterCreated, CharacterDeleted, ConsumableBought, ItemBought, ItemGiftAccepted, ItemSold } from '@maw/contracts';
import { BALANCE as B, backgroundById, createRng, randomSeed, removeWeaponFromHotbar, startingKit, type Item } from '@maw/rules';
import type { Client } from '../db.ts';

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
