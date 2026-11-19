```yaml
id: Feature-037
use_case: Launch the Tithe
bounded_context: Lobby
product: The Maw
source: models/Feature-037-launch-the-tithe.drawio
semantics: event-modeling-semantik.md
version: 2
status: draft
created: 2026-11-19
```

# Use case: Launch the Tithe

## 1. Purpose

For the player who opened a Tithe: decide when it starts, so the players who wanted to come are in it.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Lobby | 1 | 1 | Player |
| CMD-01 | Command | Launch the Tithe | 2 | 1 | – |
| CMD-02 | Command | Leave the lobby | 2 | 2 | – |
| AGG-01 | Aggregate | Lobby | 3 | 1 | – |
| EVT-01 | Event | Tithe launched | 4 | 1 | – |
| EVT-02 | Event | Lobby left | 4 | 2 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | The waiting room of an open Tithe: its name and the players in it. |
| AGG-01 | An open Tithe on the server before it is launched: its unique name, the player who opened it and the players who have joined. |

## 4. Flows

| From | To |
|---|---|
| VIEW-01 Lobby | CMD-01 Launch the Tithe |
| VIEW-01 Lobby | CMD-02 Leave the lobby |
| CMD-01 Launch the Tithe | AGG-01 Lobby |
| CMD-02 Leave the lobby | AGG-01 Lobby |
| AGG-01 Lobby | EVT-01 Tithe launched |
| AGG-01 Lobby | EVT-02 Lobby left |

## 5. Data

### AGG-01 Lobby (CMD-01, CMD-02 → EVT-01, EVT-02)

| Field |
|---|
| Players (many) |
| Players › User name |
| Players › Character |
| NPC places |
| Launched |

## 6. User stories

### US-01: Launch the Tithe (CMD-01 → EVT-01, EVT-02)

As the player who opened a Tithe I want to launch it, so that we go down when everyone is ready.

```gherkin
Scenario: Kael launches Ashfall
  Given Kael opened "Ashfall" and Brann joined it
  When the player performs CMD-01 "Launch the Tithe"
  Then EVT-01 "Tithe launched" is recorded with two players and six NPC places

Scenario: Only the opener launches
  Given Brann joined Kael's "Ashfall"
  When Brann looks at VIEW-01 "Lobby"
  Then Brann has Leave but no Launch
```

### US-02: Leave the lobby (CMD-02 → EVT-01, EVT-02)

As a player I want to leave a lobby before the Tithe starts, so that I can join another.

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- Only the player who opened the Tithe can launch it, also alone. At launch NPC rivals fill the places up to 8, and EVT-01 "Tithe launched" starts the Tithe (Tithe, Enter the Tithe). (CMD-01, EVT-01)
- Every player can leave the lobby before the launch. When the player who opened the Tithe leaves, the Tithe is closed and the others return to the list of Tithes. (CMD-02, EVT-02)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Lobby | (starting point) | CMD-01, CMD-02 |

**VIEW-01:** Shows the Tithe's name and its players with user name, character and Mark, "n of 8", and Leave. The player who opened the Tithe also has Launch.

## 10. Validation and open questions

### Resolved in version 2

| # | Question | Resolution |
|---|---|---|
| 1 | **The opener leaves:** What happens when the player who opened a Tithe leaves its lobby? | Decided 2026-11-19: the Tithe is closed, and the others return to the list of Tithes. |

### Still open

None.
