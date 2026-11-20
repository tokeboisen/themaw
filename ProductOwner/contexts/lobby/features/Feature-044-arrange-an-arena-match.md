```yaml
id: Feature-044
use_case: Arrange an arena match
bounded_context: Lobby
product: The Maw
source: models/Feature-044-arrange-an-arena-match.drawio
semantics: event-modeling-semantik.md
version: 1
status: draft
created: 2026-11-20
```

# Use case: Arrange an arena match

## 1. Purpose

For the players: set up a fight between players in the arena – one against one, two against one or two against two – for a stake of gold, so the Branded can test their builds against each other between Tithes.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01, VIEW-02 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Arena board | 1 | 1 | Player |
| CMD-01 | Command | Open an arena match | 2 | 1 | – |
| CMD-02 | Command | Join a side | 2 | 2 | – |
| AGG-01 | Aggregate | Arena match | 3 | 1 | – |
| EVT-01 | Event | Arena match opened | 4 | 1 | – |
| EVT-02 | Event | Side joined | 4 | 2 | – |
| VIEW-02 | UI View | Arena match | 5 | 1 | Player |
| CMD-03 | Command | Start the arena match | 6 | 1 | – |
| CMD-04 | Command | Leave the arena match | 6 | 2 | – |
| AGG-02 | Aggregate | Arena match | 7 | 1 | – |
| EVT-03 | Event | Arena match started | 8 | 1 | – |
| EVT-04 | Event | Arena match left | 8 | 2 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | The open arena matches and the form to open a new one. |
| AGG-01 | A fight between players in the arena that has been opened but not started yet: its format, stake, opener and the players on each side. |
| VIEW-02 | The arena match the player waits in, with both sides. |
| AGG-02 | A fight between players in the arena that has been opened but not started yet: its format, stake, opener and the players on each side. |

## 4. Flows

| From | To |
|---|---|
| VIEW-01 Arena board | CMD-01 Open an arena match |
| VIEW-01 Arena board | CMD-02 Join a side |
| CMD-01 Open an arena match | AGG-01 Arena match |
| CMD-02 Join a side | AGG-01 Arena match |
| AGG-01 Arena match | EVT-01 Arena match opened |
| AGG-01 Arena match | EVT-02 Side joined |
| EVT-01 Arena match opened | VIEW-02 Arena match |
| EVT-02 Side joined | VIEW-02 Arena match |
| VIEW-02 Arena match | CMD-03 Start the arena match |
| VIEW-02 Arena match | CMD-04 Leave the arena match |
| CMD-03 Start the arena match | AGG-02 Arena match |
| CMD-04 Leave the arena match | AGG-02 Arena match |
| AGG-02 Arena match | EVT-03 Arena match started |
| AGG-02 Arena match | EVT-04 Arena match left |

## 5. Data

### CMD-01 Open an arena match (VIEW-01 → AGG-01)

| Field |
|---|
| Name |
| Format |
| Stake |
| Side |

### CMD-02 Join a side (VIEW-01 → AGG-01)

| Field |
|---|
| Arena match |
| Side |

### AGG-01 Arena match (CMD-01, CMD-02 → EVT-01, EVT-02)

| Field |
|---|
| Name |
| Format |
| Stake |
| Opener |
| Sides (many) |
| Sides › Number |
| Sides › Places |
| Sides › Players |

### CMD-03 Start the arena match (VIEW-02 → AGG-02)

| Field |
|---|
| Arena match |

### CMD-04 Leave the arena match (VIEW-02 → AGG-02)

| Field |
|---|
| Arena match |

### AGG-02 Arena match (CMD-03, CMD-04 → EVT-03, EVT-04)

| Field |
|---|
| Sides (many) |
| Sides › Players |

## 6. User stories

### US-01: Open an arena match (CMD-01 → EVT-01, EVT-02)

As a player I want to open an arena match, so that others can come and fight me for a stake.

```gherkin
Scenario: Kael opens a match for 50 gold
  Given Kael stands at the Arena with 120 gold
  When the player performs CMD-01 "Open an arena match" with "Sand and Steel", 1:1, a stake of 50 and Side 1
  Then EVT-01 "Arena match opened" is recorded
  And VIEW-02 "Arena match" shows Kael on Side 1 and an open place on Side 2
```

### US-02: Join a side (CMD-02 → EVT-01, EVT-02)

As a player I want to join a side in an open arena match, so that I fight in it.

```gherkin
Scenario: Not enough gold
  Given Brann has 30 gold and "Sand and Steel" has a stake of 50
  When the player performs CMD-02 "Join a side" with Side 2
  Then nothing is recorded
  And "Not enough gold." is shown
```

### US-03: Start the arena match (CMD-03 → EVT-03, EVT-04)

As the player who opened an arena match I want to start it when both sides are full, so that we fight.

```gherkin
Scenario: Starting needs full sides
  Given Kael opened a 2:2 match and three places are filled
  When the player performs CMD-03 "Start the arena match"
  Then nothing is recorded
  And "Every place must be filled." is shown

Scenario: The match starts
  Given Brann has joined Side 2 of Kael's 1:1 match
  When the player performs CMD-03 "Start the arena match"
  Then EVT-03 "Arena match started" is recorded
  And Kael and Brann enter the arena
```

### US-04: Leave the arena match (CMD-04 → EVT-03, EVT-04)

As a player I want to leave an arena match before it starts, so that I can do something else.

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- The formats are 1:1, 2:1 and 2:2. Side 1 has two places in 2:1 and 2:2, Side 2 has two places in 2:2; every other side has one. The opener chooses the side to stand on. (AGG-01)
- The name is 3–30 characters and unique among the open Tithes and arena matches ("This name is taken."). The stake is 0–1000 gold. (CMD-01)
- Every fighter needs at least the stake in the wallet to open or join ("Not enough gold."). A player is in one lobby or arena match at a time, and a side with no free place cannot be joined ("That side is full."). (CMD-01, CMD-02)
- Only the player who opened the match can start it, and only when every place is filled ("Every place must be filled."). The fighters' characters and gear go into the arena as they are (Fight in the arena). (CMD-03)
- When the player who opened the match leaves it, the match closes and the others are back at the Arena board. (CMD-04)
- While a player is in an arena match – waiting or fighting – the character cannot be changed, as in a lobby (Characters, Gear, Market). (AGG-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Arena board | (starting point) | CMD-01, CMD-02 |
| VIEW-02 | Arena match | EVT-01, EVT-02 | CMD-03, CMD-04 |

**VIEW-01:** Opened with F at the Arena on the Mustering Square ("Arena – press F") as a see-through overlay like the Tithe Board. It lists the open arena matches with their format, stake and the players on each side, with a Join button for every side that has a free place. Above the list the player opens a match with a name, a format (1:1, 2:1 or 2:2), a stake and a side.

**VIEW-02:** Shows the match's name, format and stake and the players on Side 1 and Side 2 with their characters and Marks; empty places are shown as open. The player who opened the match sees Start, which can be used when every place is filled; everyone sees Leave. The overlay can be closed while waiting; the player stays in the match and walks the square.

## 10. Validation and open questions

### Resolved in version 1

| # | Question | Resolution |
|---|---|---|
| 1 | **Arena:** What is at stake in the arena, who fights, how is a match won, and how do players find a match? | Decided 2026-11-20: every fighter stakes the same gold and the winners share the pot; the players' own characters with their gear fight; one round, until one side is down; matches are opened and joined at an Arena board on the Mustering Square. |

### Still open

None.
