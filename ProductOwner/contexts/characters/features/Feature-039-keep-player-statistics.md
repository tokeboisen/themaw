```yaml
id: Feature-039
use_case: Keep player statistics
bounded_context: Characters
product: The Maw
source: models/Feature-039-keep-player-statistics.drawio
semantics: event-modeling-semantik.md
version: 2
status: draft
created: 2026-11-19
```

# Use case: Keep player statistics

## 1. Purpose

For the player: what every character does in the Tithes is counted – Tithes, Champions, falls, kills and Player kills – so the player can follow the character's story and brag about it.

## 2. Actors

| Actor | UI Views |
|---|---|
| – | – |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| EVT-01 | Event | Player defeated | 1 | 1 | – |
| EVT-02 | Event | Tithe ended | 1 | 2 | – |
| EVT-03 | Event | Character deleted | 1 | 3 | – |
| SVC-01 | Application Service | Chronicler | 2 | 2 | – |
| CMD-01 | Command | Record statistics | 3 | 1 | – |
| CMD-02 | Command | Remove statistics | 3 | 3 | – |
| AGG-01 | Aggregate | Statistics | 4 | 2 | – |
| EVT-04 | Event | Statistics recorded | 5 | 1 | – |
| EVT-05 | Event | Player kill recorded | 5 | 2 | – |
| EVT-06 | Event | Statistics removed | 5 | 3 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| EVT-01 | Feature-011 Fight in the depths | EVT-06 Player defeated |
| EVT-02 | Feature-016 End the Tithe | EVT-04 Tithe ended |
| EVT-03 | Feature-038 Delete character | EVT-01 Character deleted |

### Descriptions

| ID | Description |
|---|---|
| SVC-01 | Keeps the statistics of every character from what happens in the Tithes. |
| AGG-01 | What a character has done in the Tithes: Tithes, Champions, falls, kills and Player kills. |

## 4. Flows

| From | To |
|---|---|
| EVT-01 Player defeated | SVC-01 Chronicler |
| EVT-02 Tithe ended | SVC-01 Chronicler |
| EVT-03 Character deleted | SVC-01 Chronicler |
| SVC-01 Chronicler | CMD-01 Record statistics |
| SVC-01 Chronicler | CMD-02 Remove statistics |
| CMD-01 Record statistics | AGG-01 Statistics |
| CMD-02 Remove statistics | AGG-01 Statistics |
| AGG-01 Statistics | EVT-04 Statistics recorded |
| AGG-01 Statistics | EVT-05 Player kill recorded |
| AGG-01 Statistics | EVT-06 Statistics removed |

## 5. Data

### CMD-01 Record statistics (SVC-01 → AGG-01)

| Field |
|---|
| Character |
| Record |

### CMD-02 Remove statistics (SVC-01 → AGG-01)

| Field |
|---|
| Character |

### AGG-01 Statistics (CMD-01, CMD-02 → EVT-04, EVT-05, EVT-06)

| Field |
|---|
| Character |
| Tithes |
| Times Champion |
| Falls |
| Times left |
| Deepest depth |
| Monsters slain |
| Rivals defeated |
| Player kills |
| Killed by players |

## 6. User stories

No user stories.

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| SVC-01 Chronicler | EVT-01, EVT-02, EVT-03 | CMD-01, CMD-02 | EVT-04, EVT-05, EVT-06 |

### Rules

- A player who defeats another player gets a Player kill, and the defeated player one more "Killed by players". (SVC-01, EVT-05)
- When a player's part of a Tithe ends, the Tithe is counted with its outcome – Champion, fall or left – the deepest depth reached, the monsters slain and the rivals defeated. (CMD-01)
- Statistics belong to a character and are removed with it. (CMD-02)

```gherkin
Scenario: A Player kill
  Given Kael has 1 Player kill
  When EVT-01 "Player defeated" has been recorded for Brann, struck down by Kael
  Then SVC-01 "Chronicler" performs CMD-01 "Record statistics"
  And EVT-05 "Player kill recorded" is recorded
  And Kael has 2 Player kills and Brann 1 more "Killed by players"
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
| 1 | **Seeing others' statistics:** Can players see each other's statistics, for example from Other players? Proposed: not for now. | Decided 2026-11-19: no, players only see their own characters' statistics. |

### Still open

None.
