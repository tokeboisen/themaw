// Indholdet af de events, der går over bussen. Navnene er modellens; routing keys kommer fra event-kataloget.

import type { ArenaFormat, ArenaSide, Character, Equipment, Hotbar, Item, OutcomeKind, ReachId, SkillId, TitheRecord } from '@maw/rules';
import { routingKey } from './events.ts';

export const EVENT = {
  characterCreated: routingKey('Characters', 'Character created'),
  characterDeleted: routingKey('Characters', 'Character deleted'),
  itemBought: routingKey('Market', 'Item bought'),
  itemSold: routingKey('Market', 'Item sold'),
  potionBought: routingKey('Market', 'Potion bought'),
  rationBought: routingKey('Market', 'Ration bought'),
  focusPotionBought: routingKey('Market', 'Focus potion bought'),
  identificationBought: routingKey('Market', 'Identification bought'),
  itemGiftAccepted: routingKey('Patronage', 'Item gift accepted'),
  goldGiftAccepted: routingKey('Patronage', 'Gold gift accepted'),
  pursePaid: routingKey('Patronage', 'Purse paid'),
  foundGearKept: routingKey('Gear', 'Found gear kept'),
  titheLaunched: routingKey('Lobby', 'Tithe launched'),
  titheEnded: routingKey('Tithe', 'Tithe ended'),
  playerDefeated: routingKey('Tithe', 'Player defeated'),
  arenaMatchStarted: routingKey('Lobby', 'Arena match started'),
  arenaMatchEnded: routingKey('Tithe', 'Arena match ended'),
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

/** Feature-019 EVT-04 Identification bought: Gear identificerer alle karakterens ting (Feature-005 CMD-05). */
export interface IdentificationBought {
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

/** Feature-022 EVT-03 */
export interface PursePaid {
  characterId: string;
  gold: number;
}

/** Feature-009 EVT-02: det fundne guld, der beholdes, går til tegnebogen (Feature-018). */
export interface FoundGearKept {
  characterId: string;
  titheId: string;
  gold: number;
  items: string[];
}

/** En spiller i en Tithe, der startes: arbejdskopien af karakteren og billetten til WebSocket (planen, afsnit 5 og 8). */
export interface TithePlayer {
  userId: string;
  userName: string;
  characterId: string;
  ticket: string;
  character: Character;
  hotbar: Hotbar;
}

/** Feature-037 EVT-01: NPC-rivaler fylder pladserne op til 8, når Tithen startes (Feature-010). */
export interface TitheLaunched {
  titheId: string;
  name: string;
  /** Feature-037: Tithen lægges ud i sin Reach. Mangler den, er det The Old Mines. */
  reach?: ReachId;
  /** Feature-037: Mark hos den spiller, der startede Tithen; den sætter Tithens niveau. */
  level?: number;
  players: TithePlayer[];
}

/** Feature-044 EVT-03 Arena match started: til tithe-server (Feature-045) og Market (Feature-046). */
export interface ArenaMatchStarted {
  matchId: string;
  name: string;
  format: ArenaFormat;
  stake: number;
  fighters: (TithePlayer & { side: ArenaSide })[];
}

/** Feature-045 EVT-04 Arena match ended: vinderens side, eller null ved uafgjort, og hver kæmpers udfald (Feature-046). */
export interface ArenaMatchEnded {
  matchId: string;
  name: string;
  stake: number;
  winner: ArenaSide | null;
  fighters: { userId: string; userName: string; characterId: string; side: ArenaSide; result: 'won' | 'lost' | 'draw' }[];
}

/**
 * Feature-016 EVT-04, for én spiller: udfaldet, regnskabet og arbejdskopien. Characters gemmer skills, Echo, Marks og
 * point og tæller statistikken (F039), Gear afregner det fundne (F009), Market fylder smedjen (F021), og Patronage betaler
 * pengepungen og giver gaver for summen af Renown (F022, F023).
 */
export interface TitheEnded {
  titheId: string;
  titheName: string;
  characterId: string;
  userId: string;
  outcome: { kind: OutcomeKind; name: string };
  seconds: number;
  record: TitheRecord;
  start: { mark: number; skills: Record<SkillId, number> };
  character: Pick<Character, 'level' | 'echo' | 'attributes' | 'skills' | 'attributePoints' | 'skillPoints'>;
  /** focusPotions mangler i en Tithe, der startede før focus potions (Feature-008 v4). */
  gear: { equipment: Equipment; pack: Item[]; potions: number; focusPotions?: number; rations: number; hotbar: Hotbar };
}

/** Feature-011 EVT-06: en spiller er slået ned af en anden spiller (fase 4). */
export interface PlayerDefeated {
  titheId: string;
  characterId: string;
  userId: string;
  byCharacterId: string;
  byUserId: string;
  gold: number;
}
