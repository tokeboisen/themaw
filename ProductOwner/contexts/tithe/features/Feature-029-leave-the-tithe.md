```yaml
id: Feature-029
use_case: Leave the Tithe
bounded_context: Tithe
product: The Maw
source: models/Feature-029-leave-the-tithe.drawio
semantics: event-modeling-semantik.md
version: 2
status: draft
created: 2026-11-19
```

# Use case: Leave the Tithe

## 1. Purpose

For the player: leave a Tithe before it ends, accepting that it is lost, so the player can always stop playing.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Depth | 1 | 1 | Player |
| CMD-01 | Command | Leave the Tithe | 2 | 1 | – |
| AGG-01 | Aggregate | Tithe | 3 | 1 | – |
| EVT-01 | Event | Player left | 4 | 1 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | The depth of the Maw the candidate is in: the map around the candidate, candidates and monsters in sight, loot on the floor, life, stamina, focus, hunger, Renown, the seal timer and the rivals' depths. |
| AGG-01 | One run into the Maw: its seed and depths, its candidates (the player and the rivals), the monsters, the Warden and the outcome. |

## 4. Flows

| From | To |
|---|---|
| VIEW-01 Depth | CMD-01 Leave the Tithe |
| CMD-01 Leave the Tithe | AGG-01 Tithe |
| AGG-01 Tithe | EVT-01 Player left |

## 5. Data

### AGG-01 Tithe (CMD-01 → EVT-01)

| Field |
|---|
| Candidates (many) |
| Candidates › Name |
| Candidates › Status |

## 6. User stories

### US-01: Leave the Tithe (CMD-01 → EVT-01)

As a player I want to leave a Tithe, so that I can stop playing when I have to, accepting that I lose.

```gherkin
Scenario: Kael leaves
  Given Kael is in depth 2 and has found a "Cruel War Axe"
  When the player performs CMD-01 "Leave the Tithe"
  Then EVT-01 "Player left" is recorded
  And the Tithe goes on for the other candidates
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- Leaving is losing: the player is out of the Tithe, and it counts as a fall (Gear, Settle found gear; Patronage, Pay the Crown's Purse). The other candidates go on. (CMD-01, EVT-01)
- Closing the app counts as leaving, and so does a lost connection after 60 seconds. A Tithe that is still unfinished when the player signs in again is settled as left. (EVT-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Depth | (starting point) | CMD-01 |

**VIEW-01:** The Leave button asks "Leave the Tithe? You lose what you found, and it counts as a fall." with Leave and Stay.

```gherkin
Scenario: Closing the app is leaving
  Given Kael closed the app during a Tithe
  When the user signs in again
  Then EVT-01 "Player left" is recorded for that Tithe
```

## 10. Validation and open questions

### Resolved in version 2

| # | Question | Resolution |
|---|---|---|
| 1 | **A lost connection:** How long may a player's connection be lost before it counts as leaving? | Decided 2026-11-19: 60 seconds. |

### Still open

None.
