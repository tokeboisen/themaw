```yaml
id: Feature-030
use_case: Read help
bounded_context: Tithe
product: The Maw
source: models/Feature-030-read-help.drawio
semantics: event-modeling-semantik.md
version: 13
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
- Esc always closes what is open on top, also while typing in a field: the character sheet, Help, Other players, the places on the square, the Tithe Board, the lobby (the player stays in it), Account and every confirmation, which then counts as Stay or Keep. On Player statistics Esc goes back like the Back button. (VIEW-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Help | (starting point) | – |

**VIEW-01:** Opened with the Help button or H, in the Rim and during a Tithe, as a see-through overlay like the character sheet; the Tithe goes on behind it. Tabs down the left side show one subject at a time: first Keys, after that the tab last read. Keys lists the shortcut keys – move (WASD or arrows), attack with the chosen weapon (Space), use the hotbar (1–8, or click a slot: a weapon is drawn, an Echo Art or the talent used at once), dodge (Shift), potion (Q), focus potion (E), ration (R), descend, climb the stairs, the gate and the places on the square (F), character (C), other players (O), help (H) and close or go back (Esc) – and what is on the hotbar. Then come short texts on: The Tithe, The Reaches, Fighting, Hiding, Skills and Marks, Talents, Echo Arts, The character sheet, Gear and loot, Hunger and supplies, The Mirrormaster, The Rim, Playing with others and The Arena. The last tab, Bestiary, lists the monsters of each Reach with their levels, how they fight, their traits and what they are weak against.

```gherkin
Scenario: Help during a Tithe
  Given Kael is in a Tithe
  When the player opens VIEW-01 "Help"
  Then the Keys tab is shown with the tabs of the other subjects down the left side
  And the Tithe goes on behind the help

Scenario: Reading about hiding
  Given Kael has Help open on Keys
  When the player opens VIEW-01 "Help" on the tab Hiding
  Then the text on hiding in bushes is shown

Scenario: Esc closes what is open
  Given Kael stands on the square with the Forge open
  When the player presses Esc
  Then the Forge closes
  And Kael stands on the square
```

## 10. Validation and open questions

### Resolved in version 13

| # | Question | Resolution |
|---|---|---|
| 1 | **Esc:** What should Esc do? | Decided 2026-11-20: Esc always closes dialogs and overlays. |

### Still open

None.
