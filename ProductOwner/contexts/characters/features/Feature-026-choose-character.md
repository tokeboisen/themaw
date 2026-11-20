```yaml
id: Feature-026
use_case: Choose character
bounded_context: Characters
product: The Maw
source: models/Feature-026-choose-character.drawio
semantics: event-modeling-semantik.md
version: 4
status: draft
created: 2026-11-19
```

# Use case: Choose character

## 1. Purpose

For the player: choose which of the user's characters to play, so the player can switch between builds.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| EVT-01 | Event | User logged in | 1 | 1 | – |
| EVT-02 | Event | User created | 1 | 2 | – |
| VIEW-01 | UI View | Characters | 2 | 1 | Player |
| CMD-01 | Command | Choose character | 3 | 1 | – |
| AGG-01 | Aggregate | Roster | 4 | 1 | – |
| EVT-03 | Event | Character chosen | 5 | 1 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| EVT-01 | Feature-032 Log in | EVT-01 User logged in |
| EVT-02 | Feature-031 Create user | EVT-01 User created |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | The user's characters, with Play, New character, Delete and Statistics. |
| AGG-01 | Which of the user's characters is being played. |

## 4. Flows

| From | To |
|---|---|
| EVT-01 User logged in | VIEW-01 Characters |
| EVT-02 User created | VIEW-01 Characters |
| VIEW-01 Characters | CMD-01 Choose character |
| CMD-01 Choose character | AGG-01 Roster |
| AGG-01 Roster | EVT-03 Character chosen |

## 5. Data

### CMD-01 Choose character (VIEW-01 → AGG-01)

| Field |
|---|
| Character |

### AGG-01 Roster (CMD-01 → EVT-03)

| Field |
|---|
| User |
| Active character |

## 6. User stories

### US-01: Choose character (CMD-01 → EVT-03)

As a player I want to choose which of my characters to play, so that I can play different builds.

```gherkin
Scenario: Another character is chosen
  Given Kael and Brann are the user's characters and Kael is being played
  When the player performs CMD-01 "Choose character" with Brann
  Then EVT-03 "Character chosen" is recorded
  And the Rim shows Brann
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- The player plays one character at a time; the chosen character is the one in the Rim, the parties and the Tithe. After choosing, the player is on the Mustering Square in the Rim (Lobby, Walk the Mustering Square). (CMD-01, EVT-03)
- The character can only be changed in the Rim, not during a Tithe or while the player's party is looking for a Tithe. (CMD-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Characters | EVT-01, EVT-02 | CMD-01 |

**VIEW-01:** Shown after sign-in and with the Characters button in the Rim. Lists the user's characters with name, background, Mark, Tithes played and times as Champion, each with Play and Delete (Delete character), and the buttons New character (Create character) and Statistics (View player statistics). A user without characters goes straight to Create character.

```gherkin
Scenario: A new user goes straight to Create character
  Given EVT-02 "User created" has been recorded
  When VIEW-01 "Characters" opens
  Then Create character is shown, as the user has no characters
```

## 10. Validation and open questions

### Resolved in version 4

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
