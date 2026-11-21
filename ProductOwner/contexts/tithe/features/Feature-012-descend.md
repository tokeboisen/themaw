```yaml
id: Feature-012
use_case: Descend
bounded_context: Tithe
product: The Maw
source: models/Feature-012-descend.drawio
semantics: event-modeling-semantik.md
version: 3
status: draft
created: 2026-11-19
```

# Use case: Descend

## 1. Purpose

For the player: take the stairs down to the next depth, so the candidate gets closer to the Warden and away from a depth that is about to be sealed.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Depth | 1 | 1 | Player |
| CMD-01 | Command | Descend | 2 | 1 | – |
| AGG-01 | Aggregate | Tithe | 3 | 1 | – |
| EVT-01 | Event | Depth reached | 4 | 1 | – |

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
| VIEW-01 Depth | CMD-01 Descend |
| CMD-01 Descend | AGG-01 Tithe |
| AGG-01 Tithe | EVT-01 Depth reached |

## 5. Data

### AGG-01 Tithe (CMD-01 → EVT-01)

| Field |
|---|
| Candidates (many) |
| Candidates › Name |
| Candidates › Depth |
| Record |
| Record › Deepest depth |

## 6. User stories

### US-01: Descend (CMD-01 → EVT-01)

As a player I want to take the stairs down, so that I get closer to the Warden before my rivals do.

```gherkin
Scenario: Kael descends
  Given Kael stands on the stairs of depth 1
  When the player performs CMD-01 "Descend"
  Then EVT-01 "Depth reached" is recorded with depth 2
  And Kael is in the start room of depth 2
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- The player descends by standing on the stairs and pressing Descend. The last depth has no stairs, only the gate. In The Broken City and The Woods there are no stairs down: crossing into a district closer to the middle is reaching a deeper depth. (CMD-01)
- A new depth starts in its start room. Rivals who are already in that depth appear where they have come to. (EVT-01)
- Reaching a depth for the first time gives Renown (Spectacle, Run the show). (EVT-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Depth | (starting point) | CMD-01 |

**VIEW-01:** Standing on the stairs shows "Descend – press F" and a Descend button on a touch screen.

## 10. Validation and open questions

### Resolved in version 3

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
