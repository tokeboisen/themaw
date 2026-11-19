```yaml
id: Feature-038
use_case: Delete character
bounded_context: Characters
product: The Maw
source: models/Feature-038-delete-character.drawio
semantics: event-modeling-semantik.md
version: 1
status: draft
created: 2026-11-19
```

# Use case: Delete character

## 1. Purpose

For the player: delete a character the player no longer wants, so the list holds only the characters the player plays.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Characters | 1 | 1 | Player |
| CMD-01 | Command | Delete character | 2 | 1 | – |
| AGG-01 | Aggregate | Character | 3 | 1 | – |
| EVT-01 | Event | Character deleted | 4 | 1 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | The user's characters, with Play, New character, Delete and Statistics. |
| AGG-01 | A Branded candidate who belongs to a user: who they are and what they have become – attributes, skills, Echo and Marks. |

## 4. Flows

| From | To |
|---|---|
| VIEW-01 Characters | CMD-01 Delete character |
| CMD-01 Delete character | AGG-01 Character |
| AGG-01 Character | EVT-01 Character deleted |

## 5. Data

### CMD-01 Delete character (VIEW-01 → AGG-01)

| Field |
|---|
| Character |

### AGG-01 Character (CMD-01 → EVT-01)

| Field |
|---|
| User |
| Name |
| Background |
| Mark |
| Echo |
| Attributes |
| Attributes › Strength |
| Attributes › Dexterity |
| Attributes › Stamina |
| Attributes › Constitution |
| Attributes › Intelligence |
| Skills (many) |
| Skills › Skill |
| Skills › Level |
| Skills › Experience |

## 6. User stories

### US-01: Delete character (CMD-01 → EVT-01)

As a player I want to delete a character, so that my list only holds the characters I play.

```gherkin
Scenario: Brann is deleted
  Given Kael and Brann are the user's characters
  When the player performs CMD-01 "Delete character" with Brann and confirms
  Then EVT-01 "Character deleted" is recorded
  And the list shows only Kael

Scenario: Keep cancels
  Given the player has pressed Delete by Brann
  When the player presses Keep
  Then nothing is recorded
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- A character can only be deleted from the character list, not while it is in a lobby or a Tithe. It cannot be undone. (CMD-01)
- Everything the character owns goes with it: the inventory (Gear, Stock the inventory), the gold (Market, Keep the wallet), the Forge's stock (Market, Restock the Forge), the waiting sponsor gifts (Patronage, Grant sponsor gifts) and the statistics (Keep player statistics). (EVT-01)
- When the character being played is deleted, the player chooses another character or creates a new one. (EVT-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Characters | (starting point) | CMD-01 |

**VIEW-01:** Delete by a character asks "Delete <name>? Everything <name> owns is lost. This cannot be undone." with Delete and Keep.

## 10. Validation and open questions

### Resolved in version 1

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
