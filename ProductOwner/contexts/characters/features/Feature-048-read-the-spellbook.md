```yaml
id: Feature-048
use_case: Read the spellbook
bounded_context: Characters
product: The Maw
source: models/Feature-048-read-the-spellbook.drawio
semantics: event-modeling-semantik.md
version: 2
status: draft
created: 2026-11-21
```

# Use case: Read the spellbook

## 1. Purpose

For the player: see the Echo Arts the character knows and the ones still to learn, so the player can choose what to put on the hotbar and has a reason to train Echo Arts.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Spellbook | 1 | 1 | Player |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | The Echo Arts the character knows and those still to learn – arts of the mind, not written in any book. |

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

- Echo Arts are known in the mind, not written in a book. A character knows an Echo Art when its Echo Arts skill is at least 10 × (the art's level − 1): the level-1 arts from the start, the level-9 arts at Echo Arts 80. An art is learned the moment the skill reaches it (Learn by use, Spend points), in the Rim or during a Tithe. (VIEW-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Spellbook | (starting point) | – |

**VIEW-01:** The Spells tab of the character sheet, in the Rim and during a Tithe. It shows the 28 Echo Arts by level, the levels side by side three at a time – Levels 1–3, 4–6 and 7–9 – so nothing needs scrolling. Each art shows its kind (damage, defence, control, movement or party), focus, cooldown, effect (Tithe, Cast an Echo Art) and the key it is on. A known art can be marked by clicking it and put on a key by pressing 1–8, put on the first empty key with Equip and taken off with Unequip (Gear, Assign hotbar keys); an art not yet known is greyed out with the Echo Arts level it needs.

```gherkin
Scenario: The spellbook grows with Echo Arts
  Given Kael's Echo Arts has just reached 20
  When the player opens VIEW-01 "Spellbook"
  Then Shatterpulse, Mirror Double and Hearth Echo are known
  And the level-4 arts show "Echo Arts 30"
```

## 10. Validation and open questions

### Resolved in version 2

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
