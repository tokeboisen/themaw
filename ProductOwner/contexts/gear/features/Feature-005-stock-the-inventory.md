```yaml
id: Feature-005
use_case: Stock the inventory
bounded_context: Gear
product: The Maw
source: models/Feature-005-stock-the-inventory.drawio
semantics: event-modeling-semantik.md
version: 7
status: draft
created: 2026-11-19
```

# Use case: Stock the inventory

## 1. Purpose

For the player: the starting kit, bought items and supplies and accepted item gifts land in the inventory, sold items leave it, and a deleted character's inventory is emptied, so what the character owns is kept in one place.

## 2. Actors

| Actor | UI Views |
|---|---|
| – | – |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| EVT-01 | Event | Character created | 1 | 1 | – |
| EVT-02 | Event | Item bought | 1 | 2 | – |
| EVT-03 | Event | Item sold | 1 | 3 | – |
| EVT-04 | Event | Potion bought | 1 | 4 | – |
| EVT-05 | Event | Ration bought | 1 | 5 | – |
| EVT-06 | Event | Item gift accepted | 1 | 6 | – |
| EVT-10 | Event | Character deleted | 1 | 7 | – |
| EVT-12 | Event | Focus potion bought | 1 | 8 | – |
| EVT-13 | Event | Identification bought | 1 | 9 | – |
| SVC-01 | Application Service | Quartermaster | 2 | 3 | – |
| CMD-01 | Command | Add item | 3 | 2 | – |
| CMD-02 | Command | Remove item | 3 | 3 | – |
| CMD-03 | Command | Add consumable | 3 | 4 | – |
| CMD-04 | Command | Empty inventory | 3 | 5 | – |
| CMD-05 | Command | Identify items | 3 | 6 | – |
| AGG-01 | Aggregate | Inventory | 4 | 3 | – |
| EVT-07 | Event | Item added | 5 | 2 | – |
| EVT-08 | Event | Item removed | 5 | 3 | – |
| EVT-09 | Event | Consumable added | 5 | 4 | – |
| EVT-11 | Event | Inventory emptied | 5 | 5 | – |
| EVT-14 | Event | Items identified | 5 | 6 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| EVT-01 | Feature-001 Create character | EVT-01 Character created |
| EVT-02 | Feature-019 Trade at the Forge | EVT-01 Item bought |
| EVT-03 | Feature-019 Trade at the Forge | EVT-03 Item sold |
| EVT-04 | Feature-020 Shop at the Apothecary | EVT-01 Potion bought |
| EVT-05 | Feature-020 Shop at the Apothecary | EVT-02 Ration bought |
| EVT-06 | Feature-024 Accept sponsor gifts | EVT-01 Item gift accepted |
| EVT-10 | Feature-038 Delete character | EVT-01 Character deleted |
| EVT-12 | Feature-020 Shop at the Apothecary | EVT-03 Focus potion bought |
| EVT-13 | Feature-019 Trade at the Forge | EVT-04 Identification bought |

### Descriptions

| ID | Description |
|---|---|
| SVC-01 | Keeps the inventory in step with what happens elsewhere: the starting kit, purchases, sales, gifts and the end of a Tithe. |
| AGG-01 | Everything a character owns and carries: the equipped melee weapon, ranged weapon, armour, two rings and an amulet, the items in the pack, potions and rations, the hotbar, and what was found in the current Tithe. |

## 4. Flows

| From | To |
|---|---|
| EVT-01 Character created | SVC-01 Quartermaster |
| EVT-02 Item bought | SVC-01 Quartermaster |
| EVT-03 Item sold | SVC-01 Quartermaster |
| EVT-04 Potion bought | SVC-01 Quartermaster |
| EVT-05 Ration bought | SVC-01 Quartermaster |
| EVT-06 Item gift accepted | SVC-01 Quartermaster |
| SVC-01 Quartermaster | CMD-01 Add item |
| SVC-01 Quartermaster | CMD-02 Remove item |
| SVC-01 Quartermaster | CMD-03 Add consumable |
| CMD-01 Add item | AGG-01 Inventory |
| CMD-02 Remove item | AGG-01 Inventory |
| CMD-03 Add consumable | AGG-01 Inventory |
| AGG-01 Inventory | EVT-07 Item added |
| AGG-01 Inventory | EVT-08 Item removed |
| AGG-01 Inventory | EVT-09 Consumable added |
| EVT-10 Character deleted | SVC-01 Quartermaster |
| EVT-12 Focus potion bought | SVC-01 Quartermaster |
| EVT-13 Identification bought | SVC-01 Quartermaster |
| SVC-01 Quartermaster | CMD-05 Identify items |
| CMD-05 Identify items | AGG-01 Inventory |
| AGG-01 Inventory | EVT-14 Items identified |
| SVC-01 Quartermaster | CMD-04 Empty inventory |
| CMD-04 Empty inventory | AGG-01 Inventory |
| AGG-01 Inventory | EVT-11 Inventory emptied |

## 5. Data

### CMD-01 Add item (SVC-01 → AGG-01)

| Field |
|---|
| Item |

### CMD-02 Remove item (SVC-01 → AGG-01)

| Field |
|---|
| Item |

### CMD-03 Add consumable (SVC-01 → AGG-01)

| Field |
|---|
| Consumable |

### AGG-01 Inventory (CMD-01, CMD-02, CMD-03, CMD-05, CMD-04 → EVT-07, EVT-08, EVT-09, EVT-14, EVT-11)

| Field |
|---|
| Equipment |
| Equipment › Melee weapon |
| Equipment › Ranged weapon |
| Equipment › Armour |
| Equipment › Ring 1 |
| Equipment › Ring 2 |
| Equipment › Amulet |
| Items (many) |
| Items › Item |
| Items › Slot |
| Items › Rarity |
| Items › Item level |
| Items › Affixes |
| Potions |
| Focus potions |
| Rations |
| Hotbar (many) |
| Hotbar › Key |
| Hotbar › Weapon |
| Hotbar › Echo Art |

### CMD-05 Identify items (SVC-01 → AGG-01)

| Field |
|---|
| Character |

### CMD-04 Empty inventory (SVC-01 → AGG-01)

| Field |
|---|
| Character |

## 6. User stories

No user stories.

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| SVC-01 Quartermaster | EVT-01, EVT-02, EVT-03, EVT-04, EVT-05, EVT-06, EVT-10, EVT-12, EVT-13 | CMD-01, CMD-02, CMD-03, CMD-05, CMD-04 | EVT-07, EVT-08, EVT-09, EVT-14, EVT-11 |

### Rules

- A new character gets the background's weapon (Miner Pickaxe, Poacher Short Bow, Temple Acolyte Dagger, Street Runner Rusty Sword) and a Padded Coat, both common and equipped – the Short Bow as the ranged weapon, the others as the melee weapon – 2 potions, 1 focus potion and 3 rations, and a hotbar with the weapon on key 1, Echo Bolt on key 2 and the background's talent on key 3. (SVC-01, CMD-01, CMD-03)
- A bought item and an accepted item gift go into the pack. The pack holds 12 items plus 1 for every 2 points of Strength above 10; the Forge and the Patrons' Hall check that there is room first. (CMD-01, AGG-01)
- A sold item leaves the pack. Only items in the pack can be sold, never equipped ones. (CMD-02)
- A character carries at most 9 potions, 9 focus potions and 9 rations. (CMD-03)
- When a character is deleted, its inventory is emptied. (CMD-04)
- When identification is bought at the Forge, every item the character owns – worn, in the pack and in the chest – is identified. (CMD-05)

```gherkin
Scenario: A new Miner gets the starting kit
  Given EVT-01 "Character created" has been recorded for Kael, a Miner
  When SVC-01 "Quartermaster" reacts
  Then CMD-01 "Add item" is performed with a Pickaxe and a Padded Coat, both equipped
  And CMD-03 "Add consumable" is performed with 2 potions, 1 focus potion and 3 rations
  And EVT-07 "Item added" and EVT-09 "Consumable added" are recorded

Scenario: A bought item lands in the pack
  Given EVT-02 "Item bought" has been recorded for a "Short Sword"
  When SVC-01 "Quartermaster" reacts
  Then CMD-01 "Add item" is performed with the Short Sword
  And EVT-07 "Item added" is recorded
```

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| – | – | – | – |

## 10. Validation and open questions

### Resolved in version 7

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
