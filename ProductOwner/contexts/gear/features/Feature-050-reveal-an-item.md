```yaml
id: Feature-050
use_case: Reveal an item
bounded_context: Gear
product: The Maw
source: models/Feature-050-reveal-an-item.drawio
semantics: event-modeling-semantik.md
version: 1
status: draft
created: 2026-11-21
```

# Use case: Reveal an item

## 1. Purpose

For the player: find out what an unidentified magic item does by reading it with the Reveal skill during a Tithe, so a clever character does not have to pay the Forge, and Reveal grows with every try.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Inventory | 1 | 1 | Player |
| CMD-01 | Command | Reveal item | 2 | 1 | – |
| AGG-01 | Aggregate | Inventory | 3 | 1 | – |
| EVT-01 | Event | Item revealed | 4 | 1 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | The equipped melee weapon, ranged weapon, armour, two rings and an amulet, the items in the pack and the hotbar with the keys 1–8, each item with damage or armour and affixes. Part of the character sheet. |
| AGG-01 | Everything a character owns and carries: the equipped melee weapon, ranged weapon, armour, two rings and an amulet, the items in the pack, potions and rations, the hotbar, and what was found in the current Tithe. |

## 4. Flows

| From | To |
|---|---|
| VIEW-01 Inventory | CMD-01 Reveal item |
| CMD-01 Reveal item | AGG-01 Inventory |
| AGG-01 Inventory | EVT-01 Item revealed |

## 5. Data

### CMD-01 Reveal item (VIEW-01 → AGG-01)

| Field |
|---|
| Item |

### AGG-01 Inventory (CMD-01 → EVT-01)

| Field |
|---|
| Items (many) |
| Items › Item |
| Items › Identified |

## 6. User stories

### US-01: Reveal item (CMD-01 → EVT-01)

As a player I want to read an unidentified item with Reveal, so that I know what it does without paying for it.

```gherkin
Scenario: Revealing a ring
  Given Kael is in a Tithe with 20 focus, an effective Reveal of 30 and an unidentified ring of item level 5
  When the player performs CMD-01 "Reveal item" with the ring
  Then EVT-01 "Item revealed" is recorded
  And the ring shows its name and affixes
  And Kael has 10 focus left

Scenario: Not enough focus
  Given Kael has 5 focus and an unidentified ring
  When the player performs CMD-01 "Reveal item" with the ring
  Then nothing is recorded
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- Reveal can only be used during a Tithe, on an unidentified item the character wears or carries. A try costs 10 focus and succeeds with a chance of 25 % + 4 % for every point of effective Reveal above 2 × the item level, at least 5 % and at most 100 %. Every try trains Reveal (Characters, Learn by use), except in the arena. (CMD-01)
- Magic and rare items found in a Tithe are unidentified (Gear, Manage equipment): their name is the base name, and their affixes are hidden but work when worn. Revealing shows the name and affixes. Items from the Forge and sponsor gifts are identified. (AGG-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Inventory | (starting point) | CMD-01 |

**VIEW-01:** During a Tithe an unidentified item in the Equipment tab has a Reveal button with the chance of success and the focus it costs. A revealed item shows its name and affixes at once; a failed try shows "The item keeps its secrets." over the candidate. In the Rim the button is not there, and the item reads "Unidentified – reveal it in a Tithe or pay Hesta at the Forge".

## 10. Validation and open questions

### Resolved in version 1

| # | Question | Resolution |
|---|---|---|
| 1 | **Identifying items:** How are magic items identified? | Decided 2026-11-21: magic items found in a Tithe are unidentified; every character has the trainable skill Reveal (Intelligence), and in the Rim Hesta Varn identifies all items for gold. Unidentified items work when worn, but their affixes are hidden (my recommendation; the user did not choose). |

### Still open

None.
