```yaml
id: Feature-040
use_case: View player statistics
bounded_context: Characters
product: The Maw
source: models/Feature-040-view-player-statistics.drawio
semantics: event-modeling-semantik.md
version: 2
status: draft
created: 2026-11-19
```

# Use case: View player statistics

## 1. Purpose

For the player: see what the user's characters have done in the Tithes, so the player can follow their progress.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Player statistics | 1 | 1 | Player |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | The statistics of the user's characters. |

## 4. Flows

| From | To |
|---|---|
| – | – |

## 5. Data

No Aggregates.

## 6. User stories

No user stories.

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- The statistics come from Keep player statistics. (VIEW-01)
- Players only see the statistics of their own characters. (VIEW-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Player statistics | (starting point) | – |

**VIEW-01:** Opened with Statistics on the character list and in the Rim. Shows for each of the user's characters: Tithes played, times Champion, falls, times left, deepest depth, monsters slain, rivals defeated, Player kills and times killed by players.

```gherkin
Scenario: Kael's Player kills
  Given Kael has 2 Player kills
  When the player opens VIEW-01 "Player statistics"
  Then Kael's Player kills show 2
```

## 10. Validation and open questions

### Resolved in version 2

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
