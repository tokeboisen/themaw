```yaml
id: Feature-007
use_case: Manage equipment
bounded_context: Gear
product: The Maw
source: models/Feature-007-manage-equipment.drawio
semantics: event-modeling-semantik.md
version: 6
status: draft
created: 2026-11-19
```

# Use case: Manage equipment

## 1. Purpose

For the player: choose which melee weapon, ranged weapon, armour and two rings the character wears, so the character's build follows the loot the player finds and the skills the player grows.

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
| VIEW-01 | The equipped melee weapon, ranged weapon, armour and two rings, the items in the pack and the hotbar with the keys 1–8, each item with damage or armour and affixes. Part of the character sheet. |
| AGG-01 | Everything a character owns and carries: the equipped melee weapon, ranged weapon, armour and two rings, the items in the pack, potions and rations, the hotbar, and what was found in the current Tithe. |

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
| Ring slot |

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
| Equipment › Melee weapon |
| Equipment › Ranged weapon |
| Equipment › Armour |
| Equipment › Ring 1 |
| Equipment › Ring 2 |
| Items (many) |
| Items › Item |

## 6. User stories

### US-01: Equip item (CMD-01 → EVT-01, EVT-02, EVT-03)

As a player I want to equip an item from my pack, so that I fight with the best gear I have.

```gherkin
Scenario: Equipping swaps the weapon
  Given Kael has a Pickaxe equipped and a Short Sword in the pack, and meets the Short Sword's requirements
  When the player performs CMD-01 "Equip item" with the Short Sword
  Then EVT-01 "Item equipped" is recorded
  And the Pickaxe is in the pack
  And Kael's blows now train Blades

Scenario: A bow goes into the ranged slot
  Given Kael has a Pickaxe equipped and a Short Bow in the pack
  When the player performs CMD-01 "Equip item" with the Short Bow
  Then EVT-01 "Item equipped" is recorded
  And Kael wears the Pickaxe as the melee weapon and the Short Bow as the ranged weapon

Scenario: A second ring
  Given Kael wears a Bone Ring and has a Cruel Bone Ring in the pack
  When the player performs CMD-01 "Equip item" with the Cruel Bone Ring
  Then EVT-01 "Item equipped" is recorded
  And Kael wears both rings

Scenario: A weapon Kael is not ready for
  Given Kael has Heavy Weapons 8 and a War Axe of item level 1 in the pack
  When the player performs CMD-01 "Equip item" with the War Axe
  Then nothing is recorded
  And "You do not meet the requirements." is shown
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

```gherkin
Scenario: A dropped item lands on the floor
  Given Kael is in a Tithe with a Short Sword in the pack
  When the player performs CMD-03 "Drop item" with the Short Sword
  Then EVT-03 "Item dropped" is recorded
  And the Short Sword lies on the floor at Kael's feet
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- Equipping puts the item in its slot – a melee weapon, a ranged weapon (a bow), armour or a ring – and moves the item that was there into the pack. An item is only equipped when the character meets its requirements; otherwise "You do not meet the requirements." is shown and nothing changes. A character wears a melee weapon, a ranged weapon, armour and two rings at the same time. A ring goes into a free ring slot; when both are taken, the player chooses which ring it replaces. (CMD-01)
- Unequipping needs room in the pack. A character without a melee weapon fights unarmed in melee: 1–3 damage, trained as Blades. (CMD-02)
- Dropping is only possible during a Tithe. The item lands on the floor at the candidate's feet, where anyone can pick it up again (Pick up loot); left there, it is gone when the Tithe ends. In the Rim items are sold instead (Market, Trade at the Forge). (CMD-03)
- Weapons have damage, reach or range and attack time, and train their skill: Blades (Dagger, Rusty Sword, Short Sword, Fine Dagger, Longsword), Heavy Weapons (Pickaxe, War Axe, Maul, Greataxe) and Bows (Short Bow, Hunting Bow, Longbow). Armour gives armour, which reduces damage by armour / (armour + 50). A ring only has affixes. (AGG-01)
- Rarity decides the affixes: Common none, Magic 1–2, Rare 3. Affixes are + an attribute, + % damage, + life, + armour, + the weapon's skill and + % Echo gained. A higher item level gives more damage, armour and bigger affixes. Rings are never common. (AGG-01)
- Weapons and armour have requirements before they can be equipped: a weapon needs a level of its skill and of an attribute – Blades and Bows need Dexterity, Heavy Weapons Strength – and armour needs Strength. Rings have none. At item level 1: Dagger, Rusty Sword, Pickaxe, Short Bow and Padded Coat need nothing; Short Sword Blades 8 and Dexterity 11; War Axe Heavy Weapons 10 and Strength 13; Hunting Bow Bows 10 and Dexterity 13; Maul Heavy Weapons 18 and Strength 16; Fine Dagger Blades 20 and Dexterity 16; Longsword Blades 26 and Dexterity 15; Longbow Bows 26 and Dexterity 17; Greataxe Heavy Weapons 32 and Strength 20; Leather Jerkin Strength 9; Mail Shirt Strength 13; Scale Coat Strength 17. Every item level above 1 adds 1 to the skill and 1 to the attribute for every 2 levels. (AGG-01)
- The skill counts with its level and the attribute with the bonuses from what the character wears. Requirements are checked when an item is equipped. They are shown on the item – in the inventory, the chest and the Forge – in red when the character does not meet them. Skill and damage are not capped by the weapon. (AGG-01)
- Every equipped item gives its affixes – both weapons, also the one that is not chosen on the hotbar (Use the hotbar), and both rings. (AGG-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Inventory | (starting point) | CMD-01, CMD-02, CMD-03 |

**VIEW-01:** Lists the equipped melee weapon, ranged weapon, armour and two rings with Unequip, and the items in the pack with Equip – a ring with Ring 1 and Ring 2 when both ring slots are taken – and with Drop during a Tithe. Each item shows its slot, rarity, damage or armour and its affixes, and "Found this Tithe – lost if you fall" when that applies.

## 10. Validation and open questions

### Resolved in version 6

| # | Question | Resolution |
|---|---|---|
| 1 | **Equipment slots:** How many weapons and rings can a character wear at the same time? | Decided 2026-11-19: a melee weapon, a ranged weapon, armour and two rings at the same time. |
| 2 | **Weapon caps:** Should weapons limit how much of a skill counts? | Decided 2026-11-20: yes: every weapon has a skill cap that limits both its damage bonus and how far its blows train the skill. Replaced the same day by requirements (see Requirements). |
| 3 | **Requirements:** Should items need a minimum skill or attribute, so new characters cannot use strong items? | Decided 2026-11-20: yes, instead of the weapon's skill cap: a weapon needs its skill and one attribute (Blades and Bows Dexterity, Heavy Weapons Strength), armour needs Strength, rings need nothing, and the requirement grows with the type and the item level. |
| 4 | **Dropped items:** What happens to an item that is dropped during a Tithe? | Decided 2026-11-20: it lands on the floor at the candidate's feet instead of disappearing, and anyone can pick it up. |

### Still open

None.
