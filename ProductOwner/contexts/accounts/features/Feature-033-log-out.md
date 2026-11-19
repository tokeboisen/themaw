```yaml
id: Feature-033
use_case: Log out
bounded_context: Accounts
product: The Maw
source: models/Feature-033-log-out.drawio
semantics: event-modeling-semantik.md
version: 2
status: draft
created: 2026-11-19
```

# Use case: Log out

## 1. Purpose

For the player: log out of the device, so nobody else can play the player's characters on it.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Account | 1 | 1 | Player |
| CMD-01 | Command | Log out | 2 | 1 | – |
| AGG-01 | Aggregate | User | 3 | 1 | – |
| EVT-01 | Event | User logged out | 4 | 1 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | The account menu in the Rim, with the user name and Log out. |
| AGG-01 | A player's user: a unique user name, which other players see, and the password, stored only as a hash. |

## 4. Flows

| From | To |
|---|---|
| VIEW-01 Account | CMD-01 Log out |
| CMD-01 Log out | AGG-01 User |
| AGG-01 User | EVT-01 User logged out |

## 5. Data

### AGG-01 User (CMD-01 → EVT-01)

| Field |
|---|
| Sessions (many) |
| Sessions › Device |
| Sessions › Signed in at |

## 6. User stories

### US-01: Log out (CMD-01 → EVT-01)

As a player I want to log out, so that nobody else can play my characters here.

```gherkin
Scenario: Kael logs out
  Given Kael is in the Rim
  When the player performs CMD-01 "Log out"
  Then EVT-01 "User logged out" is recorded
  And the sign-in screen is shown
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- Logging out is only possible outside a Tithe. It also leaves the lobby the player is in (Lobby). (CMD-01)
- After logging out, the sign-in screen is shown. (EVT-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Account | (starting point) | CMD-01 |

**VIEW-01:** Shows the signed-in user name and Log out. Only reachable outside a Tithe.

## 10. Validation and open questions

### Resolved in version 2

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
