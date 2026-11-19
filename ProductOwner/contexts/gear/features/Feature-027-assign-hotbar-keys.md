```yaml
id: Feature-027
use_case: Assign hotbar keys
bounded_context: Gear
product: The Maw
source: models/Feature-027-assign-hotbar-keys.drawio
semantics: event-modeling-semantik.md
version: 2
status: draft
created: 2026-11-19
```

# Use case: Assign hotbar keys

## 1. Purpose

For the player: put weapons and Echo Arts on the keys 1–8, so the player can switch weapon or cast in the middle of a fight with one key.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Inventory | 1 | 1 | Player |
| CMD-01 | Command | Assign hotbar key | 2 | 1 | – |
| CMD-02 | Command | Clear hotbar key | 2 | 2 | – |
| AGG-01 | Aggregate | Inventory | 3 | 1 | – |
| EVT-01 | Event | Hotbar key assigned | 4 | 1 | – |
| EVT-02 | Event | Hotbar key cleared | 4 | 2 | – |

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
| VIEW-01 Inventory | CMD-01 Assign hotbar key |
| VIEW-01 Inventory | CMD-02 Clear hotbar key |
| CMD-01 Assign hotbar key | AGG-01 Inventory |
| CMD-02 Clear hotbar key | AGG-01 Inventory |
| AGG-01 Inventory | EVT-01 Hotbar key assigned |
| AGG-01 Inventory | EVT-02 Hotbar key cleared |

## 5. Data

### CMD-01 Assign hotbar key (VIEW-01 → AGG-01)

| Field |
|---|
| Key |
| Weapon |
| Echo Art |

### CMD-02 Clear hotbar key (VIEW-01 → AGG-01)

| Field |
|---|
| Key |

### AGG-01 Inventory (CMD-01, CMD-02 → EVT-01, EVT-02)

| Field |
|---|
| Hotbar (many) |
| Hotbar › Key |
| Hotbar › Weapon |
| Hotbar › Echo Art |

## 6. User stories

### US-01: Assign hotbar key (CMD-01 → EVT-01, EVT-02)

As a player I want to put a weapon or an Echo Art on a number key, so that I can use it with one key in a fight.

```gherkin
Scenario: A bow is put on key 3
  Given Kael has a Short Bow in the pack and key 3 is empty
  When the player performs CMD-01 "Assign hotbar key" with key 3 and the Short Bow
  Then EVT-01 "Hotbar key assigned" is recorded

Scenario: Moving Echo Bolt to another key
  Given Echo Bolt is on key 2
  When the player performs CMD-01 "Assign hotbar key" with key 5 and Echo Bolt
  Then EVT-01 "Hotbar key assigned" is recorded
  And key 2 is empty
```

### US-02: Clear hotbar key (CMD-02 → EVT-01, EVT-02)

As a player I want to clear a number key, so that my hotbar only holds what I use.

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- The hotbar has 8 keys, 1–8. A key holds either a weapon the character owns (equipped or in the pack) or an Echo Art the character knows; today the only Echo Art is Echo Bolt. (CMD-01, AGG-01)
- A weapon or an Echo Art is on at most one key; putting it on another key moves it. (CMD-01)
- Keys can be assigned in the Rim and during a Tithe (the character sheet is an overlay). (VIEW-01)
- When a weapon on the hotbar leaves the inventory – sold, dropped or lost in a fall – its key is cleared. (AGG-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Inventory | (starting point) | CMD-01, CMD-02 |

**VIEW-01:** At the bottom of the character view a hotbar shows the keys 1–8 with what is on them. The player chooses a key and then a weapon from the equipment or the pack, or an Echo Art, to put on it; Clear empties the key.

## 10. Validation and open questions

### Resolved in version 2

| # | Question | Resolution |
|---|---|---|
| 1 | **Hotbar on a touch screen:** Phones have no number keys. How does the hotbar work on a phone? | Decided 2026-11-19: the phone waits. For now The Maw is a web app, where the hotbar is used with the keys 1–8 or by clicking its slots (Use the hotbar). |

### Still open

None.
