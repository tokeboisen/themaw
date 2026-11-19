```yaml
id: Feature-032
use_case: Log in
bounded_context: Accounts
product: The Maw
source: models/Feature-032-log-in.drawio
semantics: event-modeling-semantik.md
version: 2
status: draft
created: 2026-11-19
```

# Use case: Log in

## 1. Purpose

For the player: log in with user name and password, so the player can play the user's characters.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Sign in | 1 | 1 | Player |
| CMD-01 | Command | Log in | 2 | 1 | – |
| AGG-01 | Aggregate | User | 3 | 1 | – |
| EVT-01 | Event | User logged in | 4 | 1 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | The first screen when no user is signed in on the device: log in or create a user. |
| AGG-01 | A player's user: a unique user name, which other players see, and the password, stored only as a hash. |

## 4. Flows

| From | To |
|---|---|
| VIEW-01 Sign in | CMD-01 Log in |
| CMD-01 Log in | AGG-01 User |
| AGG-01 User | EVT-01 User logged in |

## 5. Data

### CMD-01 Log in (VIEW-01 → AGG-01)

| Field |
|---|
| User name |
| Password |

### AGG-01 User (CMD-01 → EVT-01)

| Field |
|---|
| User name |
| Sessions (many) |
| Sessions › Device |
| Sessions › Signed in at |

## 6. User stories

### US-01: Log in (CMD-01 → EVT-01)

As a player I want to log in with my user name and password, so that I can play my characters.

```gherkin
Scenario: Kael logs in
  Given the user "kael" exists
  When the player performs CMD-01 "Log in" with "kael" and the right password
  Then EVT-01 "User logged in" is recorded

Scenario: A wrong password
  Given the user "kael" exists
  When the player performs CMD-01 "Log in" with a wrong password
  Then nothing is recorded
  And "Wrong user name or password." is shown
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- A wrong user name or password is refused with "Wrong user name or password." without saying which. (CMD-01)
- The game needs a signed-in user. The user stays signed in on the device until Log out. (EVT-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Sign in | (starting point) | CMD-01 |

**VIEW-01:** User name, Password and Log in. A wrong login is shown above the fields.

## 10. Validation and open questions

### Resolved in version 2

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
