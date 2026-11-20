```yaml
id: Feature-041
use_case: Climb the stairs
bounded_context: Tithe
product: The Maw
source: models/Feature-041-climb-the-stairs.drawio
semantics: event-modeling-semantik.md
version: 1
status: draft
created: 2026-11-20
```

# Use case: Climb the stairs

## 1. Purpose

For the player: climb the stairs of a large house or a factory in The Broken City to its upper floors and back down, so the candidate can search them for loot – and leave the street fights below for a while.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Depth | 1 | 1 | Player |
| CMD-01 | Command | Climb the stairs | 2 | 1 | – |
| AGG-01 | Aggregate | Tithe | 3 | 1 | – |
| EVT-01 | Event | Floor reached | 4 | 1 | – |

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
| VIEW-01 Depth | CMD-01 Climb the stairs |
| CMD-01 Climb the stairs | AGG-01 Tithe |
| AGG-01 Tithe | EVT-01 Floor reached |

## 5. Data

### AGG-01 Tithe (CMD-01 → EVT-01)

| Field |
|---|
| Candidates (many) |
| Candidates › Name |
| Candidates › Floor |

## 6. User stories

### US-01: Climb the stairs (CMD-01 → EVT-01)

As a player I want to climb the stairs of a house, so that I can search its upper floors before my rivals do.

```gherkin
Scenario: Kael climbs to the upper floor
  Given Kael stands on the stairs in a large house in The Broken City
  When the player performs CMD-01 "Climb the stairs"
  Then EVT-01 "Floor reached" is recorded with floor 2
  And Kael sees only the upper floor

Scenario: Kael goes back down
  Given Kael stands on the stairs on the upper floor of a large house
  When the player performs CMD-01 "Climb the stairs"
  Then EVT-01 "Floor reached" is recorded with floor 1
  And Kael stands at the stairs in the street level of the house
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- Small houses have one floor. Large houses have an upper floor and factories two, reached by stairs inside; stairs go both up and down, and going down returns the candidate to the stairs below. (CMD-01)
- An upper floor is its own map: the candidate sees only that floor, with its rooms, monsters and a cache. Other candidates come up the same stairs. (EVT-01)
- An upper floor belongs to its house's district: it is sealed with the district, and a candidate on it is wounded like everyone in the district (Spectacle, Run the show; Survive the depths). (EVT-01)
- Floors give no Renown; only districts closer to the middle count as deeper depths (Descend). (CMD-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Depth | (starting point) | CMD-01 |

**VIEW-01:** Standing on stairs shows "Climb – press F" or "Go down – press F". On an upper floor the screen shows only that floor, and the HUD shows the house and the floor.

## 10. Validation and open questions

### Resolved in version 1

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
