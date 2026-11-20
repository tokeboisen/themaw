```yaml
id: Feature-036
use_case: Open a Tithe
bounded_context: Lobby
product: The Maw
source: models/Feature-036-open-a-tithe.drawio
semantics: event-modeling-semantik.md
version: 3
status: draft
created: 2026-11-19
```

# Use case: Open a Tithe

## 1. Purpose

For the player: open a Tithe with a name of the player's own on the server, so friends can find it and join.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01, VIEW-02 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Tithes | 1 | 1 | Player |
| CMD-01 | Command | Open a Tithe | 2 | 1 | – |
| AGG-01 | Aggregate | Lobby | 3 | 1 | – |
| EVT-01 | Event | Tithe opened | 4 | 1 | – |
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
| VIEW-01 Tithes | CMD-01 Open a Tithe |
| CMD-01 Open a Tithe | AGG-01 Lobby |
| AGG-01 Lobby | EVT-01 Tithe opened |
| EVT-01 Tithe opened | VIEW-02 Lobby |

## 5. Data

### CMD-01 Open a Tithe (VIEW-01 → AGG-01)

| Field |
|---|
| Name |
| Reach |

### AGG-01 Lobby (CMD-01 → EVT-01)

| Field |
|---|
| Name |
| Reach |
| Opened by |
| Players (many) |
| Players › User name |
| Players › Character |

## 6. User stories

### US-01: Open a Tithe (CMD-01 → EVT-01)

As a player I want to open a Tithe with a name, so that my friends can find it and join me.

```gherkin
Scenario: Kael opens a Tithe in The Broken City
  Given no Tithe is called "Rustgate"
  When the player performs CMD-01 "Open a Tithe" with "Rustgate" in The Broken City
  Then EVT-01 "Tithe opened" is recorded
  And VIEW-01 "Tithes" shows Rustgate in The Broken City

Scenario: Kael opens Ashfall
  Given no Tithe is called "Ashfall"
  When the player performs CMD-01 "Open a Tithe" with "Ashfall"
  Then EVT-01 "Tithe opened" is recorded
  And VIEW-02 "Lobby" shows Ashfall with Kael's user name and Launch

Scenario: The name is taken
  Given a Tithe called "Ashfall" is open
  When the player performs CMD-01 "Open a Tithe" with "Ashfall"
  Then nothing is recorded
  And "A Tithe with this name already exists." is shown
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- A Tithe is opened in one of the Reaches: The Old Mines or The Broken City (Tithe, Enter the Tithe). The Tithe Board shows them with a short description. (CMD-01)
- The name is 3–30 characters and must be unique among the Tithes that are open or running on the server ("A Tithe with this name already exists."). (CMD-01)
- The player who opens a Tithe is in it with the chosen character, and the Tithe shows in the list for everyone. (EVT-01)

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

### Resolved in version 3

| # | Question | Resolution |
|---|---|---|
| 1 | **Tithe names:** How long can the name of a Tithe be? | Decided 2026-11-19: 3–30 characters. |
| 2 | **Reaches:** Can a Tithe be opened in more than one place? | Decided 2026-11-20: yes, in one of the Reaches – The Old Mines or The Broken City – chosen when the Tithe is opened (Tithe, Enter the Tithe). |

### Still open

None.
