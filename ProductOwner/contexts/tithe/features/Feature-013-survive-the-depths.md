```yaml
id: Feature-013
use_case: Survive the depths
bounded_context: Tithe
product: The Maw
source: models/Feature-013-survive-the-depths.drawio
semantics: event-modeling-semantik.md
version: 4
status: draft
created: 2026-11-19
```

# Use case: Survive the depths

## 1. Purpose

For the player: the Maw fights back – monsters hunt the candidates, a sealed depth collapses, hunger grows – and potions and rations help, so every Tithe is a fight to stay alive.

## 2. Actors

| Actor | UI Views |
|---|---|
| – | – |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| EVT-01 | Event | Tithe started | 1 | 1 | – |
| EVT-02 | Event | Depth reached | 1 | 2 | – |
| EVT-03 | Event | Beasts released | 1 | 3 | – |
| EVT-04 | Event | Depth sealed | 1 | 4 | – |
| EVT-05 | Event | Potion drunk | 1 | 5 | – |
| EVT-06 | Event | Ration eaten | 1 | 6 | – |
| SVC-01 | Application Service | Monsters | 2 | 2 | – |
| SVC-02 | Application Service | Condition keeper | 2 | 5 | – |
| CMD-01 | Command | Wound candidate | 3 | 2 | – |
| CMD-02 | Command | Heal candidate | 3 | 4 | – |
| CMD-03 | Command | Feed candidate | 3 | 5 | – |
| AGG-01 | Aggregate | Tithe | 4 | 3 | – |
| EVT-07 | Event | Candidate wounded | 5 | 1 | – |
| EVT-08 | Event | Candidate healed | 5 | 2 | – |
| EVT-09 | Event | Candidate fed | 5 | 3 | – |
| EVT-10 | Event | Player fell | 5 | 4 | – |
| EVT-11 | Event | Rival fell | 5 | 5 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| EVT-01 | Feature-010 Enter the Tithe | EVT-02 Tithe started |
| EVT-02 | Feature-012 Descend | EVT-01 Depth reached |
| EVT-03 | Feature-017 Run the show | EVT-09 Beasts released |
| EVT-04 | Feature-017 Run the show | EVT-11 Depth sealed |
| EVT-05 | Feature-008 Use consumables | EVT-01 Potion drunk |
| EVT-06 | Feature-008 Use consumables | EVT-02 Ration eaten |

### Descriptions

| ID | Description |
|---|---|
| SVC-01 | The monsters of a depth: they wake when a candidate comes into sight and hunt the nearest one. |
| SVC-02 | Keeps the candidates' life and hunger: potions, rations, starving and the collapse of a sealed depth. |
| AGG-01 | One run into the Maw: its seed and depths, its candidates (the player and the rivals), the monsters, the Warden and the outcome. |
| EVT-11 | A rival fell to monsters, the collapse of a sealed depth or the Warden, not by the player's hand. |

## 4. Flows

| From | To |
|---|---|
| EVT-01 Tithe started | SVC-01 Monsters |
| EVT-02 Depth reached | SVC-01 Monsters |
| EVT-03 Beasts released | SVC-01 Monsters |
| EVT-04 Depth sealed | SVC-02 Condition keeper |
| EVT-05 Potion drunk | SVC-02 Condition keeper |
| EVT-06 Ration eaten | SVC-02 Condition keeper |
| SVC-01 Monsters | CMD-01 Wound candidate |
| SVC-02 Condition keeper | CMD-01 Wound candidate |
| SVC-02 Condition keeper | CMD-02 Heal candidate |
| SVC-02 Condition keeper | CMD-03 Feed candidate |
| CMD-01 Wound candidate | AGG-01 Tithe |
| CMD-02 Heal candidate | AGG-01 Tithe |
| CMD-03 Feed candidate | AGG-01 Tithe |
| AGG-01 Tithe | EVT-07 Candidate wounded |
| AGG-01 Tithe | EVT-08 Candidate healed |
| AGG-01 Tithe | EVT-09 Candidate fed |
| AGG-01 Tithe | EVT-10 Player fell |
| AGG-01 Tithe | EVT-11 Rival fell |

## 5. Data

### CMD-01 Wound candidate (SVC-01, SVC-02 → AGG-01)

| Field |
|---|
| Candidate |
| Damage |

### CMD-02 Heal candidate (SVC-02 → AGG-01)

| Field |
|---|
| Candidate |
| Life |

### CMD-03 Feed candidate (SVC-02 → AGG-01)

| Field |
|---|
| Candidate |
| Hunger |

### AGG-01 Tithe (CMD-01, CMD-02, CMD-03 → EVT-07, EVT-08, EVT-09, EVT-10, EVT-11)

| Field |
|---|
| Candidates (many) |
| Candidates › Name |
| Candidates › Life |
| Candidates › Hunger |
| Candidates › Status |

## 6. User stories

No user stories.

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| SVC-01 Monsters | EVT-01, EVT-02, EVT-03 | CMD-01 | EVT-07, EVT-08, EVT-09, EVT-10, EVT-11 |
| SVC-02 Condition keeper | EVT-04, EVT-05, EVT-06 | CMD-01, CMD-02, CMD-03 | EVT-07, EVT-08, EVT-09, EVT-10, EVT-11 |

### Rules

- Monsters are many – 2–5 in every room of the mines, groups in the corridors, and bands in the streets and houses of The Broken City. They sleep until a candidate comes into sight, then hunt the nearest candidate, also around walls. Before each attack they wind up, so a dodge avoids it: a dash of 3 tiles in 0.18 seconds that cannot be hit, for 20 stamina. (SVC-01)
- Damage to a candidate is reduced by armour / (armour + 50). (CMD-01)
- Hunger falls by 0.25 per second, 2 % slower per Stamina above 10. At 0 the candidate starves: stamina recovers at 40 % and life does not recover. Otherwise life recovers 0.3 per second. (SVC-02, CMD-03)
- A sealed depth – or a sealed district of The Broken City, with the floors of its houses – wounds every candidate in it by 3 % of max life per second until they leave it. (SVC-02)
- A potion heals 40 % of max life, and a ration restores 45 hunger (Gear, Use consumables). (CMD-02, CMD-03)
- When a player's life reaches 0, the player falls and the Brand drags them back: the player's part of the Tithe ends (End the Tithe), and the other candidates go on. An NPC rival whose life reaches 0 falls and leaves the Tithe. (EVT-10, EVT-11)

```gherkin
Scenario: A potion heals
  Given Kael has 20 of 60 life
  When EVT-05 "Potion drunk" has been recorded
  Then SVC-02 "Condition keeper" performs CMD-02 "Heal candidate" with 24 life
  And EVT-08 "Candidate healed" is recorded
  And Kael has 44 of 60 life

Scenario: The player falls
  Given Kael has 3 life
  When SVC-01 "Monsters" performs CMD-01 "Wound candidate" with 5 damage on Kael
  Then EVT-07 "Candidate wounded" is recorded
  And EVT-10 "Player fell" is recorded

Scenario: A sealed depth collapses
  Given Kael has 60 max life and is still in depth 1
  When EVT-04 "Depth sealed" has been recorded for depth 1
  Then SVC-02 "Condition keeper" performs CMD-01 "Wound candidate" with 1.8 damage per second until Kael leaves depth 1
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

### Resolved in version 4

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
