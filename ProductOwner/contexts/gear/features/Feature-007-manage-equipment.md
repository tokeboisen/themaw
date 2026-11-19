```yaml
id: Feature-007
use_case: Manage equipment
bounded_context: Gear
product: The Maw
source: models/Feature-007-manage-equipment.drawio
semantics: event-modeling-semantik.md
version: 2
status: draft
created: 2026-11-19
```

# Use case: Manage equipment

## 1. Purpose

For the player: choose which weapon, armour and ring the character wears, so the character's build follows the loot the player finds and the skills the player grows.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Inventory | 1 | 1 | Player |
| CMD-01 | Command | Equip item | 2 | 1 | – |
| CMD-02 | Command | Unequip item | 2 | 2 | – |
| CMD-03 | Command | Drop item | 2 | 3 | – |
| AGG-01 | Aggregate | Inventory | 3 | 2 | – |
| EVT-01 | Event | Item equipped | 4 | 1 | – |
| EVT-02 | Event | Item unequipped | 4 | 2 | – |
| EVT-03 | Event | Item dropped | 4 | 3 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | The equipped weapon, armour and ring, the items in the pack and the hotbar with the keys 1–8, each item with damage or armour and affixes. Part of the character sheet. |
| AGG-01 | Everything a character owns and carries: the equipped weapon, armour and ring, the items in the pack, potions and rations, the hotbar, and what was found in the current Tithe. |

## 4. Flows

| From | To |
|---|---|
| VIEW-01 Inventory | CMD-01 Equip item |
| VIEW-01 Inventory | CMD-02 Unequip item |
| VIEW-01 Inventory | CMD-03 Drop item |
| CMD-01 Equip item | AGG-01 Inventory |
| CMD-02 Unequip item | AGG-01 Inventory |
| CMD-03 Drop item | AGG-01 Inventory |
| AGG-01 Inventory | EVT-01 Item equipped |
| AGG-01 Inventory | EVT-02 Item unequipped |
| AGG-01 Inventory | EVT-03 Item dropped |

## 5. Data

### CMD-01 Equip item (VIEW-01 → AGG-01)

| Field |
|---|
| Item |

### CMD-02 Unequip item (VIEW-01 → AGG-01)

| Field |
|---|
| Slot |

### CMD-03 Drop item (VIEW-01 → AGG-01)

| Field |
|---|
| Item |

### AGG-01 Inventory (CMD-01, CMD-02, CMD-03 → EVT-01, EVT-02, EVT-03)

| Field |
|---|
| Equipment |
| Equipment › Weapon |
| Equipment › Armour |
| Equipment › Ring |
| Items (many) |
| Items › Item |

## 6. User stories

### US-01: Equip item (CMD-01 → EVT-01, EVT-02, EVT-03)

As a player I want to equip an item from my pack, so that I fight with the best gear I have.

```gherkin
Scenario: Equipping swaps the weapon
  Given Kael has a Pickaxe equipped and a Short Sword in the pack
  When the player performs CMD-01 "Equip item" with the Short Sword
  Then EVT-01 "Item equipped" is recorded
  And the Pickaxe is in the pack
  And Kael's blows now train Blades
```

### US-02: Unequip item (CMD-02 → EVT-01, EVT-02, EVT-03)

As a player I want to unequip an item, so that I can sell it or carry it for later.

```gherkin
Scenario: Unequipping needs room
  Given Kael's pack is full
  When the player performs CMD-02 "Unequip item" with the ring
  Then nothing is recorded
  And "Your inventory is full." is shown
```

### US-03: Drop item (CMD-03 → EVT-01, EVT-02, EVT-03)

As a player I want to drop an item during a Tithe, so that I make room for better loot.

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- Equipping puts the item in its slot – weapon, armour or ring – and moves the item that was there into the pack. (CMD-01)
- Unequipping needs room in the pack. A character without a weapon fights unarmed: 1–3 damage, trained as Blades. (CMD-02)
- Dropping is only possible during a Tithe, and the item is gone. In the Rim items are sold instead (Market, Trade at the Forge). (CMD-03)
- Weapons have damage, reach or range and attack time, and train their skill: Blades (Dagger, Rusty Sword, Short Sword), Heavy Weapons (Pickaxe, War Axe, Maul) and Bows (Short Bow, Hunting Bow). Armour gives armour, which reduces damage by armour / (armour + 50). A ring only has affixes. (AGG-01)
- Rarity decides the affixes: Common none, Magic 1–2, Rare 3. Affixes are + an attribute, + % damage, + life, + armour, + the weapon's skill and + % Echo gained. A higher item level gives more damage, armour and bigger affixes. Rings are never common. (AGG-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Inventory | (starting point) | CMD-01, CMD-02, CMD-03 |

**VIEW-01:** Lists the equipped weapon, armour and ring with Unequip, and the items in the pack with Equip – and with Drop during a Tithe. Each item shows its slot, rarity, damage or armour and its affixes, and "Found this Tithe – lost if you fall" when that applies.

## 10. Validation and open questions

### Resolved in version 2

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
