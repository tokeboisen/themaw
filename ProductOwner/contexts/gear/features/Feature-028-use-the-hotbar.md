```yaml
id: Feature-028
use_case: Use the hotbar
bounded_context: Gear
product: The Maw
source: models/Feature-028-use-the-hotbar.drawio
semantics: event-modeling-semantik.md
version: 2
status: draft
created: 2026-11-19
```

# Use case: Use the hotbar

## 1. Purpose

For the player: press a number key to draw another weapon in the middle of a fight, so the character can switch between a bow at range and a blade up close.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Depth | 1 | 1 | Player |
| CMD-01 | Command | Draw weapon | 2 | 1 | – |
| AGG-01 | Aggregate | Inventory | 3 | 1 | – |
| EVT-01 | Event | Weapon drawn | 4 | 1 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | The depth of the Maw the candidate is in, with the loot on the floor and the potion and ration buttons. |
| AGG-01 | Everything a character owns and carries: the equipped weapon, armour and ring, the items in the pack, potions and rations, the hotbar, and what was found in the current Tithe. |

## 4. Flows

| From | To |
|---|---|
| VIEW-01 Depth | CMD-01 Draw weapon |
| CMD-01 Draw weapon | AGG-01 Inventory |
| AGG-01 Inventory | EVT-01 Weapon drawn |

## 5. Data

### CMD-01 Draw weapon (VIEW-01 → AGG-01)

| Field |
|---|
| Key |

### AGG-01 Inventory (CMD-01 → EVT-01)

| Field |
|---|
| Equipment |
| Equipment › Weapon |
| Hotbar (many) |
| Hotbar › Key |
| Hotbar › Weapon |

## 6. User stories

### US-01: Draw weapon (CMD-01 → EVT-01)

As a player I want to draw the weapon on a number key, so that I fight with the right weapon for the moment.

```gherkin
Scenario: Drawing the bow
  Given Kael holds the Pickaxe and the Short Bow is on key 3
  When the player performs CMD-01 "Draw weapon" with key 3
  Then EVT-01 "Weapon drawn" is recorded
  And the Pickaxe is in the pack
  And Kael's blows now train Bows
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- Pressing a key with a weapon draws it: it becomes the equipped weapon, and the weapon in hand goes into the pack. The candidate cannot strike while drawing (0.3 seconds). (CMD-01)
- Pressing a key with an Echo Art casts it at the automatic target (Tithe, Fight in the depths). A key with nothing on it does nothing. (CMD-01)
- Attack (Space) always strikes with the weapon in hand, and its blows train that weapon's skill. (EVT-01)
- Clicking a slot of the hotbar with the mouse does the same as pressing its key. (CMD-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Depth | (starting point) | CMD-01 |

**VIEW-01:** The hotbar is shown at the bottom of the screen with the keys 1–8; the key in hand is highlighted.

## 10. Validation and open questions

### Resolved in version 2

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
