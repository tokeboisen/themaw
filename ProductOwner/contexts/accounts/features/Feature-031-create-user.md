```yaml
id: Feature-031
use_case: Create user
bounded_context: Accounts
product: The Maw
source: models/Feature-031-create-user.drawio
semantics: event-modeling-semantik.md
version: 3
status: draft
created: 2026-11-19
```

# Use case: Create user

## 1. Purpose

For the player: create a user with a user name and a password, so the player's characters are the player's own and the player can meet other players.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Sign in | 1 | 1 | Player |
| CMD-01 | Command | Create user | 2 | 1 | – |
| AGG-01 | Aggregate | User | 3 | 1 | – |
| EVT-01 | Event | User created | 4 | 1 | – |

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
| VIEW-01 Sign in | CMD-01 Create user |
| CMD-01 Create user | AGG-01 User |
| AGG-01 User | EVT-01 User created |

## 5. Data

### CMD-01 Create user (VIEW-01 → AGG-01)

| Field |
|---|
| User name |
| Password |

### AGG-01 User (CMD-01 → EVT-01)

| Field |
|---|
| User name |
| Password hash |
| Created at |

## 6. User stories

### US-01: Create user (CMD-01 → EVT-01)

As a player I want to create a user with a user name and a password, so that my characters are mine.

```gherkin
Scenario: A user is created
  Given no user is called "kael"
  When the player performs CMD-01 "Create user" with "kael" and a password of 10 characters
  Then EVT-01 "User created" is recorded
  And the player is signed in

Scenario: The user name is taken
  Given a user is called "Kael"
  When the player performs CMD-01 "Create user" with "kael"
  Then nothing is recorded
  And "This user name is taken." is shown

Scenario: A short password
  Given no user is called "brann"
  When the player performs CMD-01 "Create user" with "brann" and a password of 7 characters
  Then nothing is recorded
  And "The password must be at least 8 characters." is shown
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- The user name is 3–20 characters – letters, digits and symbols, without spaces ("Use 3–20 letters, digits or symbols, without spaces.") – and must be unique, regardless of upper and lower case ("This user name is taken."). (CMD-01)
- The password can be anything of at least 8 characters ("The password must be at least 8 characters."). It is stored only as a hash. (CMD-01, AGG-01)
- There are no email addresses for now. A new user is signed in right away and goes to Create character (Characters, Choose character). (EVT-01)
- The user name is shown to other players: in the list of Tithes, in the lobby, over the player in a Tithe, on the map of the player's party and in Other players. (AGG-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Sign in | (starting point) | CMD-01 |

**VIEW-01:** User name and Password with Log in, and Create user. Create user asks for a user name and a password. Errors are shown under the field they concern.

## 10. Validation and open questions

### Resolved in version 3

| # | Question | Resolution |
|---|---|---|
| 1 | **Password rules:** Is a minimum of 8 characters the right password rule? | Decided 2026-11-19: yes, any password of at least 8 characters. |
| 2 | **Email addresses:** Should users have an email address, confirmed, with a reset of forgotten passwords? | Decided 2026-11-19: no email addresses for now – only user name and password. So there is no confirmation, and a forgotten password cannot be reset until user administration comes. |
| 3 | **User administration:** Should an administrator be able to see, block and delete users? | Decided 2026-11-19: not now; it comes later. |
| 4 | **User names:** Are 3–20 letters, digits, - or _ the right rule for user names? | Decided 2026-11-19: letters, digits and symbols, 3–20 characters. |

### Still open

None.
