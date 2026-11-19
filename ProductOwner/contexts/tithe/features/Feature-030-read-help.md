```yaml
id: Feature-030
use_case: Read help
bounded_context: Tithe
product: The Maw
source: models/Feature-030-read-help.drawio
semantics: event-modeling-semantik.md
version: 3
status: draft
created: 2026-11-19
```

# Use case: Read help

## 1. Purpose

For the player: look up the shortcut keys and short texts about how the game works, so a new player can learn the game while playing.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Help | 1 | 1 | Player |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | Shortcut keys and short help texts about the game. |

## 4. Flows

| From | To |
|---|---|
| – | – |

## 5. Data

No Aggregates.

## 6. User stories

No user stories.

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- The help texts are short (a few sentences per topic) and in English, like the rest of the game. (VIEW-01)
- The key list shows what is actually on the hotbar keys of the character being played. (VIEW-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Help | (starting point) | – |

**VIEW-01:** Opened with the Help button or H, in the Rim and during a Tithe, as a see-through overlay like the character sheet; the Tithe goes on behind it. It lists the shortcut keys – move (WASD or arrows), attack with what is chosen on the hotbar (Space), choose on the hotbar (1–8, or click a slot), dodge (Shift), potion (Q), ration (R), descend and the gate (F), character (C), other players (O), help (H) and close (Esc) – and short texts on: The Tithe, Fighting, Skills and Marks, Gear and loot, Hunger and supplies, The Mirrormaster, The Rim and Playing with others.

```gherkin
Scenario: Help during a Tithe
  Given Kael is in a Tithe
  When the player opens VIEW-01 "Help"
  Then the shortcut keys and the help topics are shown
  And the Tithe goes on behind the help
```

## 10. Validation and open questions

### Resolved in version 3

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
