```yaml
id: Feature-021
use_case: Restock the Forge
bounded_context: Market
product: The Maw
source: models/Feature-021-restock-the-forge.drawio
semantics: event-modeling-semantik.md
version: 3
status: draft
created: 2026-11-19
```

# Use case: Restock the Forge

## 1. Purpose

For the player: the Forge gets new stock after every Tithe, at the character's level, so there is always something new to save up for.

## 2. Actors

| Actor | UI Views |
|---|---|
| – | – |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| EVT-01 | Event | Character created | 1 | 1 | – |
| EVT-02 | Event | Tithe ended | 1 | 2 | – |
| EVT-04 | Event | Character deleted | 1 | 3 | – |
| SVC-01 | Application Service | Forge keeper | 2 | 1 | – |
| CMD-01 | Command | Restock the Forge | 3 | 1 | – |
| CMD-02 | Command | Clear the Forge | 3 | 2 | – |
| AGG-01 | Aggregate | Forge | 4 | 1 | – |
| EVT-03 | Event | Forge restocked | 5 | 1 | – |
| EVT-05 | Event | Forge cleared | 5 | 2 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| EVT-01 | Feature-001 Create character | EVT-01 Character created |
| EVT-02 | Feature-016 End the Tithe | EVT-04 Tithe ended |
| EVT-04 | Feature-038 Delete character | EVT-01 Character deleted |

### Descriptions

| ID | Description |
|---|---|
| AGG-01 | Hesta Varn's forge and the items for sale. |

## 4. Flows

| From | To |
|---|---|
| EVT-01 Character created | SVC-01 Forge keeper |
| EVT-02 Tithe ended | SVC-01 Forge keeper |
| SVC-01 Forge keeper | CMD-01 Restock the Forge |
| CMD-01 Restock the Forge | AGG-01 Forge |
| AGG-01 Forge | EVT-03 Forge restocked |
| EVT-04 Character deleted | SVC-01 Forge keeper |
| SVC-01 Forge keeper | CMD-02 Clear the Forge |
| CMD-02 Clear the Forge | AGG-01 Forge |
| AGG-01 Forge | EVT-05 Forge cleared |

## 5. Data

### CMD-01 Restock the Forge (SVC-01 → AGG-01)

| Field |
|---|
| Item level |

### AGG-01 Forge (CMD-01, CMD-02 → EVT-03, EVT-05)

| Field |
|---|
| Stock (many) |
| Stock › Item |
| Stock › Price |

### CMD-02 Clear the Forge (SVC-01 → AGG-01)

| Field |
|---|
| Character |

## 6. User stories

No user stories.

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| SVC-01 Forge keeper | EVT-01, EVT-02, EVT-04 | CMD-01, CMD-02 | EVT-03, EVT-05 |

### Rules

- The new stock is 7 items with the character's Mark as item level: 2 % rare, otherwise 12 % magic, otherwise common, so a magic weapon at the Forge is rare and dear. The old stock is replaced. (CMD-01)
- Every character has its own Forge stock; it is cleared when the character is deleted. (CMD-02)

```gherkin
Scenario: New stock after a Tithe
  Given Kael is Mark 3
  When EVT-02 "Tithe ended" has been recorded
  Then SVC-01 "Forge keeper" performs CMD-01 "Restock the Forge" with item level 3
  And EVT-03 "Forge restocked" is recorded with 7 items
```

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| – | – | – | – |

## 10. Validation and open questions

### Resolved in version 3

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
