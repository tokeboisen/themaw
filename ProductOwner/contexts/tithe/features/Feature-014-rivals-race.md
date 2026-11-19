```yaml
id: Feature-014
use_case: Rivals race
bounded_context: Tithe
product: The Maw
source: models/Feature-014-rivals-race.drawio
semantics: event-modeling-semantik.md
version: 2
status: draft
created: 2026-11-19
```

# Use case: Rivals race

## 1. Purpose

For the players: the NPC rivals race through the same Tithe and can win it, so the players always have to weigh loot and safety against speed.

## 2. Actors

| Actor | UI Views |
|---|---|
| – | – |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| EVT-01 | Event | Tithe started | 1 | 1 | – |
| EVT-02 | Event | Depth reached | 1 | 2 | – |
| EVT-03 | Event | Depth sealed | 1 | 3 | – |
| SVC-01 | Application Service | Rival director | 2 | 2 | – |
| CMD-01 | Command | Advance rival | 3 | 2 | – |
| AGG-01 | Aggregate | Tithe | 4 | 2 | – |
| EVT-04 | Event | Rival reached depth | 5 | 1 | – |
| EVT-05 | Event | Rival fell | 5 | 2 | – |
| EVT-06 | Event | Rival claimed the Tithe | 5 | 3 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| EVT-01 | Feature-010 Enter the Tithe | EVT-02 Tithe started |
| EVT-02 | Feature-012 Descend | EVT-01 Depth reached |
| EVT-03 | Feature-017 Run the show | EVT-11 Depth sealed |

### Descriptions

| ID | Description |
|---|---|
| SVC-01 | Moves the AI rivals through the Tithe, on screen and off it. |
| AGG-01 | One run into the Maw: its seed and depths, its candidates (the player and the rivals), the monsters, the Warden and the outcome. |
| EVT-05 | A rival fell to monsters, the collapse of a sealed depth or the Warden, not by the player's hand. |

## 4. Flows

| From | To |
|---|---|
| EVT-01 Tithe started | SVC-01 Rival director |
| EVT-02 Depth reached | SVC-01 Rival director |
| EVT-03 Depth sealed | SVC-01 Rival director |
| SVC-01 Rival director | CMD-01 Advance rival |
| CMD-01 Advance rival | AGG-01 Tithe |
| AGG-01 Tithe | EVT-04 Rival reached depth |
| AGG-01 Tithe | EVT-05 Rival fell |
| AGG-01 Tithe | EVT-06 Rival claimed the Tithe |

## 5. Data

### CMD-01 Advance rival (SVC-01 → AGG-01)

| Field |
|---|
| Rival |

### AGG-01 Tithe (CMD-01 → EVT-04, EVT-05, EVT-06)

| Field |
|---|
| Candidates (many) |
| Candidates › Name |
| Candidates › Depth |
| Candidates › Progress |
| Candidates › Life |
| Candidates › Hostile |
| Candidates › Status |
| Warden alive |
| Warden wounds |

## 6. User stories

No user stories.

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| SVC-01 Rival director | EVT-01, EVT-02, EVT-03 | CMD-01 | EVT-04, EVT-05, EVT-06 |

### Rules

- Rivals walk toward the stairs in bursts and search on the way, so a depth takes them about 110 seconds (±15 %, a little faster at a higher level). In a sealed depth they move three times as fast. Rivals the player cannot see move on at the same pace without being shown. (SVC-01)
- An NPC rival fights monsters within 5 tiles (the Warden within 9). A hostile NPC rival also fights players within 6 tiles once the grace is over. NPC rivals never fight each other. Each drinks one potion below 30 % life. (SVC-01)
- The NPC rivals are Cassian Morrow (heavy weapons, one Mark above the players, hostile 90 %), Vessa Thorne (bows, 35 %), Ash and Rook Kell (blades, 60 %), Mira Silvertongue (Echo Arts, 20 %), Silent Odo (blades, 15 %) and Garrick Vane, champion of House Vane (heavy weapons, one Mark above the players, 80 %); the percentage is the chance that the rival is hostile, decided when the Tithe starts. Every NPC rival a player strikes becomes hostile to that player. (AGG-01)
- An NPC rival who reaches The Foreman while no player is in The Foreman's Hall fights him for 20 seconds and wins with 15 % + 4 % per level (at most 70 %), more when The Foreman is wounded. The winner claims the Tithe, and it ends for every player. A rival who loses falls, and The Foreman keeps the wounds: 75 % of his life for the next. (EVT-05, EVT-06)
- When a player is in The Foreman's Hall, the fight is shown, and the candidate who deals the killing blow decides it. (EVT-06)

```gherkin
Scenario: A rival claims the Tithe
  Given Cassian Morrow reaches The Foreman while Kael is in depth 2
  When SVC-01 "Rival director" performs CMD-01 "Advance rival" and Cassian wins the fight
  Then EVT-06 "Rival claimed the Tithe" is recorded

Scenario: A sealed depth makes the rivals hurry
  Given Vessa Thorne is in depth 1
  When EVT-03 "Depth sealed" has been recorded for depth 1
  Then SVC-01 "Rival director" performs CMD-01 "Advance rival" three times as fast for Vessa Thorne
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

### Resolved in version 2

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
