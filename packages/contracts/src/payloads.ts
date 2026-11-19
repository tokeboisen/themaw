// Indholdet af de events, der går over bussen. Navnene er modellens; routing keys kommer fra event-kataloget.

import type { Item } from '@maw/rules';
import { routingKey } from './events.ts';

export const EVENT = {
  characterCreated: routingKey('Characters', 'Character created'),
  characterDeleted: routingKey('Characters', 'Character deleted'),
  itemBought: routingKey('Market', 'Item bought'),
  itemSold: routingKey('Market', 'Item sold'),
  potionBought: routingKey('Market', 'Potion bought'),
  rationBought: routingKey('Market', 'Ration bought'),
  itemGiftAccepted: routingKey('Patronage', 'Item gift accepted'),
  goldGiftAccepted: routingKey('Patronage', 'Gold gift accepted'),
  pursePaid: routingKey('Patronage', 'Purse paid'),
  foundGearKept: routingKey('Gear', 'Found gear kept'),
  titheLaunched: routingKey('Lobby', 'Tithe launched'),
  titheEnded: routingKey('Tithe', 'Tithe ended'),
  playerDefeated: routingKey('Tithe', 'Player defeated'),
} as const;

/** Feature-001 EVT-01 */
export interface CharacterCreated {
  characterId: string;
  userId: string;
  name: string;
  background: string;
  mark: number;
}

/** Feature-038 EVT-01 */
export interface CharacterDeleted {
  characterId: string;
  userId: string;
}

/** Feature-019 EVT-01 */
export interface ItemBought {
  characterId: string;
  item: Item;
}

/** Feature-019 EVT-03 */
export interface ItemSold {
  characterId: string;
  itemId: string;
  gold: number;
}

/** Feature-020 EVT-01 og EVT-02 */
export interface ConsumableBought {
  characterId: string;
}

/** Feature-024 EVT-01 */
export interface ItemGiftAccepted {
  characterId: string;
  giftId: string;
  item: Item;
}

/** Feature-024 EVT-02 */
export interface GoldGiftAccepted {
  characterId: string;
  giftId: string;
  gold: number;
}
