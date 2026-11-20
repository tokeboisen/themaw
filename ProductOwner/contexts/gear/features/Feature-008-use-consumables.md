```yaml
id: Feature-008
use_case: Use consumables
bounded_context: Gear
product: The Maw
source: models/Feature-008-use-consumables.drawio
semantics: event-modeling-semantik.md
version: 3
status: draft
created: 2026-11-19
```

# Use case: Use consumables

## 1. Purpose

For the player: drink a potion or eat a ration in the middle of a Tithe, so the candidate survives longer in the Maw.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Depth | 1 | 1 | Player |
| CMD-01 | Command | Drink potion | 2 | 1 | – |
| CMD-02 | Command | Eat ration | 2 | 2 | – |
| AGG-01 | Aggregate | Inventory | 3 | 1 | – |
| EVT-01 | Event | Potion drunk | 4 | 1 | – |
| EVT-02 | Event | Ration eaten | 4 | 2 | – |

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
| VIEW-01 Depth | CMD-01 Drink potion |
| VIEW-01 Depth | CMD-02 Eat ration |
| CMD-01 Drink potion | AGG-01 Inventory |
| CMD-02 Eat ration | AGG-01 Inventory |
| AGG-01 Inventory | EVT-01 Potion drunk |
| AGG-01 Inventory | EVT-02 Ration eaten |

## 5. Data

### AGG-01 Inventory (CMD-01, CMD-02 → EVT-01, EVT-02)

| Field |
|---|
| Potions |
| Rations |

## 6. User stories

### US-01: Drink potion (CMD-01 → EVT-01, EVT-02)

As a player I want to drink a healing draught, so that I survive a fight that goes badly.

```gherkin
Scenario: A potion is drunk
  Given Kael has 20 of 60 life and 2 potions
  When the player performs CMD-01 "Drink potion"
  Then EVT-01 "Potion drunk" is recorded
  And Kael has 1 potion

Scenario: Full life keeps the potion
  Given Kael has full life
  When the player performs CMD-01 "Drink potion"
  Then nothing is recorded
```

### US-02: Eat ration (CMD-02 → EVT-01, EVT-02)

As a player I want to eat a ration, so that I do not starve deep in the Maw.

```gherkin
Scenario: A ration is eaten
  Given Kael has 30 hunger and 3 rations
  When the player performs CMD-02 "Eat ration"
  Then EVT-02 "Ration eaten" is recorded
  And Kael has 2 rations
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- A potion restores 40 % of the candidate's max life. It can be drunk once per second, and only when life is not full. (CMD-01)
- A ration restores 45 hunger and is only eaten when hunger is below 95 of 100. (CMD-02)
- The candidate's life and hunger belong to the Tithe, which reacts to EVT-01 and EVT-02 (Tithe, Survive the depths). (EVT-01, EVT-02)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Depth | (starting point) | CMD-01, CMD-02 |

**VIEW-01:** Potion and Ration buttons show how many are left (keys Q and R on a keyboard).

## 10. Validation and open questions

### Resolved in version 3

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
