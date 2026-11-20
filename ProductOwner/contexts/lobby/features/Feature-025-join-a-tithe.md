```yaml
id: Feature-025
use_case: Join a Tithe
bounded_context: Lobby
product: The Maw
source: models/Feature-025-join-a-tithe.drawio
semantics: event-modeling-semantik.md
version: 6
status: draft
created: 2026-11-19
```

# Use case: Join a Tithe

## 1. Purpose

For the player: join a Tithe another player has opened and see who is in it, so friends go down into the same Tithe.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01, VIEW-02 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Tithes | 1 | 1 | Player |
| CMD-01 | Command | Join a Tithe | 2 | 1 | – |
| AGG-01 | Aggregate | Lobby | 3 | 1 | – |
| EVT-01 | Event | Player joined | 4 | 1 | – |
| VIEW-02 | UI View | Lobby | 5 | 1 | Player |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | The Reaches, the Tithes that are open on the server, and the form to open a new one. |
| AGG-01 | An open Tithe on the server before it is launched: its unique name, its Reach, the player who opened it and the players who have joined. |
| VIEW-02 | The waiting room of an open Tithe: its name and the players in it. |

## 4. Flows

| From | To |
|---|---|
| VIEW-01 Tithes | CMD-01 Join a Tithe |
| CMD-01 Join a Tithe | AGG-01 Lobby |
| AGG-01 Lobby | EVT-01 Player joined |
| EVT-01 Player joined | VIEW-02 Lobby |

## 5. Data

### CMD-01 Join a Tithe (VIEW-01 → AGG-01)

| Field |
|---|
| Tithe |

### AGG-01 Lobby (CMD-01 → EVT-01)

| Field |
|---|
| Players (many) |
| Players › User name |
| Players › Character |

## 6. User stories

### US-01: Join a Tithe (CMD-01 → EVT-01)

As a player I want to join a Tithe another player has opened, so that I go down with them.

```gherkin
Scenario: Brann joins Ashfall
  Given Kael has opened "Ashfall"
  When the player performs CMD-01 "Join a Tithe" with Ashfall
  Then EVT-01 "Player joined" is recorded
  And VIEW-02 "Lobby" shows the user names of Kael and Brann

Scenario: A full Tithe
  Given "Ashfall" has 8 players
  When the player performs CMD-01 "Join a Tithe" with Ashfall
  Then nothing is recorded
  And "The Tithe is full." is shown
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- A Tithe has room for 8 players ("The Tithe is full."). A player joins with the chosen character and is in one lobby at a time. (CMD-01)
- Players can join until the Tithe is launched. Everyone in the lobby sees who is in it by user name. (CMD-01, EVT-01)
- The player goes down from the Tithe Board in the middle of the Mustering Square, which opens VIEW-01 "Tithes" (Walk the Mustering Square). (VIEW-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Tithes | (starting point) | CMD-01 |
| VIEW-02 | Lobby | EVT-01 | – |

**VIEW-01:** Opened at the Tithe Board in the middle of the Mustering Square (Walk the Mustering Square). Shows the Reaches with a short description, and lists the Tithes that are open on the server with their name, Reach, the user name of the player who opened them, the players in them by user name and "n of 8", each with Join (disabled when full). A name field, a choice of Reach and "Open a Tithe" open a new one.

**VIEW-02:** Shows the Tithe's name and its players with user name, character and Mark, "n of 8", and Leave. The player who opened the Tithe also has Launch.

## 10. Validation and open questions

### Resolved in version 6

| # | Question | Resolution |
|---|---|---|
| 1 | **Players per Tithe:** How many players can be in one Tithe, and how do players play together? | Decided 2026-11-19: up to 8 players in a Tithe, NPC rivals for the rest. Players play alone or in a team (party), formed by invitations that can be accepted or declined. |
| 2 | **Matching:** Are parties matched by Mark, and how long is the wait before NPC rivals fill the Tithe? | Decided 2026-11-19: there is no automatic matching. A player opens a Tithe with a unique name, others join it, and the player who opened it launches it; NPC rivals fill the places that are left (Open a Tithe, Launch the Tithe). |
| 3 | **Joining a running Tithe:** Can players join a Tithe after it has been launched, as in Diablo? Proposed: no, only until it is launched. | Decided 2026-11-19: no. Players can only join until the Tithe is launched. |

### Still open

None.
