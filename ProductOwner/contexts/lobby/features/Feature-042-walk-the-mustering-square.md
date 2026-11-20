```yaml
id: Feature-042
use_case: Walk the Mustering Square
bounded_context: Lobby
product: The Maw
source: models/Feature-042-walk-the-mustering-square.drawio
semantics: event-modeling-semantik.md
version: 3
status: draft
created: 2026-11-20
```

# Use case: Walk the Mustering Square

## 1. Purpose

For the player: walk the Mustering Square in the Rim between Tithes, meet the other players there and go to the shops, the Patrons' Hall and the Tithe Board, so the Rim is a place the players share before they go down.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Mustering Square | 1 | 1 | Player |
| CMD-01 | Command | Walk the square | 2 | 1 | – |
| AGG-01 | Aggregate | Square | 3 | 1 | – |
| EVT-01 | Event | Player moved | 4 | 1 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | The square in the Rim where the Branded gather: the Forge, the Apothecary, the Patrons' Hall, the Tithe Board in the middle, the character's chest, the Arena and the players on the square. |
| AGG-01 | The Mustering Square and the players on it. |

## 4. Flows

| From | To |
|---|---|
| VIEW-01 Mustering Square | CMD-01 Walk the square |
| CMD-01 Walk the square | AGG-01 Square |
| AGG-01 Square | EVT-01 Player moved |

## 5. Data

### CMD-01 Walk the square (VIEW-01 → AGG-01)

| Field |
|---|
| Direction |

### AGG-01 Square (CMD-01 → EVT-01)

| Field |
|---|
| Players (many) |
| Players › User name |
| Players › Character |
| Players › Position |

## 6. User stories

### US-01: Walk the square (CMD-01 → EVT-01)

As a player I want to walk the Mustering Square, so that I can go to the shops and the Tithe Board and meet the other players.

```gherkin
Scenario: Kael walks to the Forge
  Given Kael is on the Mustering Square
  When the player performs CMD-01 "Walk the square" toward the Forge
  Then EVT-01 "Player moved" is recorded
  And "Forge – press F" is shown when Kael stands at the Forge
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- The player is on the square after choosing a character (Characters, Choose character) and after a Tithe, and stays on it while waiting in a lobby; the square shows every player on it. (AGG-01)
- The Maw Server keeps the players' positions, so everyone sees the same square. Walls, stalls and the board block the way. (CMD-01)
- The square replaces the Rim's menu: the shops, the Patrons' Hall, the Tithe Board, the chest and the Arena are places on it, and the Patrons' Hall glows when gifts wait. (VIEW-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Mustering Square | (starting point) | CMD-01 |

**VIEW-01:** The player's character walks the square with WASD or the arrows. Hesta Varn's forge stands to the west, Mother Quill's apothecary to the east, the Patrons' Hall to the north, the Tithe Board in the middle, the chest by the south-west houses and the Arena by the south-east houses. Standing at one of them shows "<name> – press F", and F opens it as an overlay (Market, Patronage, Gear's Use the chest; Open a Tithe, Arrange an arena match). Other players on the square are shown with their user names. The gold and the buttons Character, Characters, Other players, Statistics, Help and Account are at the top.

```gherkin
Scenario: Brann sees Kael
  Given Kael and Brann are on the Mustering Square
  When EVT-01 "Player moved" has been recorded for Kael
  Then VIEW-01 "Mustering Square" shows Kael's user name where Kael stands
```

## 10. Validation and open questions

### Resolved in version 3

| # | Question | Resolution |
|---|---|---|
| 1 | **The square:** Is the place where players start between Tithes a screen or a square they walk? | Decided 2026-11-20: a square the players walk, with the shops, the Patrons' Hall and the Tithe Board in the middle, where the players see each other. |

### Still open

None.
