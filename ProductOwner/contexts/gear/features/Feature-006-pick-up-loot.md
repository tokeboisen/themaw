```yaml
id: Feature-006
use_case: Pick up loot
bounded_context: Gear
product: The Maw
source: models/Feature-006-pick-up-loot.drawio
semantics: event-modeling-semantik.md
version: 4
status: draft
created: 2026-11-19
```

# Use case: Pick up loot

## 1. Purpose

For the player: items, gold and supplies on the floor of the Maw are picked up by walking over them, so the candidate can grow stronger and richer during the Tithe – at the risk of losing it all in a fall.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Depth | 1 | 1 | Player |
| CMD-01 | Command | Pick up loot | 2 | 1 | – |
| AGG-01 | Aggregate | Inventory | 3 | 1 | – |
| EVT-01 | Event | Item picked up | 4 | 1 | – |
| EVT-02 | Event | Consumable picked up | 4 | 2 | – |
| EVT-03 | Event | Gold picked up | 4 | 3 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | The depth of the Maw the candidate is in, with the loot on the floor and the potion and ration buttons. |
| AGG-01 | Everything a character owns and carries: the equipped melee weapon, ranged weapon, armour and two rings, the items in the pack, potions and rations, the hotbar, and what was found in the current Tithe. |

## 4. Flows

| From | To |
|---|---|
| VIEW-01 Depth | CMD-01 Pick up loot |
| CMD-01 Pick up loot | AGG-01 Inventory |
| AGG-01 Inventory | EVT-01 Item picked up |
| AGG-01 Inventory | EVT-02 Consumable picked up |
| AGG-01 Inventory | EVT-03 Gold picked up |

## 5. Data

### CMD-01 Pick up loot (VIEW-01 → AGG-01)

| Field |
|---|
| Loot |

### AGG-01 Inventory (CMD-01 → EVT-01, EVT-02, EVT-03)

| Field |
|---|
| Items (many) |
| Items › Item |
| Items › Found in Tithe |
| Potions |
| Rations |
| Gold found |

## 6. User stories

### US-01: Pick up loot (CMD-01 → EVT-01, EVT-02, EVT-03)

As a player I want to pick up what I find by walking over it, so that I never stop fighting to collect loot.

```gherkin
Scenario: An item is picked up
  Given Kael uses 3 of 12 places in the pack
  When the player performs CMD-01 "Pick up loot" with a "Cruel War Axe"
  Then EVT-01 "Item picked up" is recorded
  And the War Axe is marked as found in this Tithe

Scenario: A full pack leaves the item on the floor
  Given Kael's pack is full
  When the player performs CMD-01 "Pick up loot" with an item
  Then nothing is recorded
  And "Inventory full" is shown over the item

Scenario: A dropped item is not picked up again at once
  Given Kael has just dropped a Short Sword at Kael's feet
  When Kael stays on the spot
  Then nothing is recorded
  And the Short Sword stays on the floor

Scenario: An item picked up again keeps its mark
  Given Kael brought a Short Sword into the Tithe and dropped it
  And Kael has stepped away from it
  When the player performs CMD-01 "Pick up loot" with the Short Sword
  Then EVT-01 "Item picked up" is recorded
  And the Short Sword is not marked as found in this Tithe

Scenario: Another candidate's dropped item is found loot
  Given Jory dropped a Short Sword in the Tithe
  When the player performs CMD-01 "Pick up loot" with the Short Sword
  Then EVT-01 "Item picked up" is recorded
  And the Short Sword is marked as found in this Tithe for Kael
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- Loot is picked up by walking over it; there is no button. An item needs room in the pack; with a full pack the item stays on the floor and "Inventory full" is shown over it. Potions and rations stop at 9. (CMD-01)
- Items and gold picked up during a Tithe are marked as found in that Tithe until it ends (Settle found gear): a fall loses them. (AGG-01)
- Gold found is not added to the wallet during the Tithe; it is kept or lost when the Tithe ends. (EVT-03)
- A dropped item (Manage equipment) is loot like any other. The candidate who dropped it does not pick it up again before stepping away from it. Picked up again by that candidate, it keeps whether it was found in this Tithe or brought; picked up by another candidate, it is found in this Tithe. (CMD-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Depth | (starting point) | CMD-01 |

**VIEW-01:** Loot lies on the floor as small shapes: items as diamonds in the colour of their rarity (common white, magic blue, rare gold), gold as coins, potions red and rations brown. Picked-up items are named over the candidate in their rarity's colour.

## 10. Validation and open questions

### Resolved in version 4

| # | Question | Resolution |
|---|---|---|
| 1 | **Dropped items:** Who can pick up an item that a candidate dropped? | Decided 2026-11-20: dropped items land on the floor; anyone can pick them up, the one who dropped it only after stepping away. |

### Still open

None.
