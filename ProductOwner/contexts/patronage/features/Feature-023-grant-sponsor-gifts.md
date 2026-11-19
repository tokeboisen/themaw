```yaml
id: Feature-023
use_case: Grant sponsor gifts
bounded_context: Patronage
product: The Maw
source: models/Feature-023-grant-sponsor-gifts.drawio
semantics: event-modeling-semantik.md
version: 2
status: draft
created: 2026-11-19
```

# Use case: Grant sponsor gifts

## 1. Purpose

For the player: the Noble Houses send gifts for the Renown of a Tithe, so playing to the crowd pays even in a Tithe the player does not win.

## 2. Actors

| Actor | UI Views |
|---|---|
| – | – |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| EVT-01 | Event | Renown earned | 1 | 1 | – |
| EVT-02 | Event | Tithe ended | 1 | 2 | – |
| EVT-04 | Event | Character deleted | 1 | 3 | – |
| SVC-01 | Application Service | Noble Houses | 2 | 1 | – |
| CMD-01 | Command | Grant gift | 3 | 1 | – |
| CMD-02 | Command | Withdraw gifts | 3 | 2 | – |
| AGG-01 | Aggregate | Sponsor gift | 4 | 1 | – |
| EVT-03 | Event | Sponsor gift granted | 5 | 1 | – |
| EVT-05 | Event | Sponsor gifts withdrawn | 5 | 2 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| EVT-01 | Feature-017 Run the show | EVT-07 Renown earned |
| EVT-02 | Feature-016 End the Tithe | EVT-04 Tithe ended |
| EVT-04 | Feature-038 Delete character | EVT-01 Character deleted |

### Descriptions

| ID | Description |
|---|---|
| AGG-01 | A gift from one of the Noble Houses for the Renown of a Tithe: an item or gold, waiting until it is accepted. |

## 4. Flows

| From | To |
|---|---|
| EVT-01 Renown earned | SVC-01 Noble Houses |
| EVT-02 Tithe ended | SVC-01 Noble Houses |
| SVC-01 Noble Houses | CMD-01 Grant gift |
| CMD-01 Grant gift | AGG-01 Sponsor gift |
| AGG-01 Sponsor gift | EVT-03 Sponsor gift granted |
| EVT-04 Character deleted | SVC-01 Noble Houses |
| SVC-01 Noble Houses | CMD-02 Withdraw gifts |
| CMD-02 Withdraw gifts | AGG-01 Sponsor gift |
| AGG-01 Sponsor gift | EVT-05 Sponsor gifts withdrawn |

## 5. Data

### CMD-01 Grant gift (SVC-01 → AGG-01)

| Field |
|---|
| House |
| Gift |

### AGG-01 Sponsor gift (CMD-01, CMD-02 → EVT-03, EVT-05)

| Field |
|---|
| House |
| Kind |
| Item |
| Gold |
| Accepted |

### CMD-02 Withdraw gifts (SVC-01 → AGG-01)

| Field |
|---|
| Character |

## 6. User stories

No user stories.

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| SVC-01 Noble Houses | EVT-01, EVT-02, EVT-04 | CMD-01, CMD-02 | EVT-03, EVT-05 |

### Rules

- One gift for every 100 Renown in the Tithe, at most 4. They come from House Morrow, House Vane, House Ashgrave and House Lisle. (SVC-01)
- Every other gift is an item – the first a rare one when the Tithe earned 300 Renown or more, otherwise magic – and the others are gold: 40 × (1 + 0.2 × Mark). (CMD-01)
- Gifts wait in the Patrons' Hall until they are accepted (Accept sponsor gifts). (AGG-01)
- When a character is deleted, the gifts waiting for it are withdrawn. (CMD-02)

```gherkin
Scenario: Renown brings gifts
  Given Kael is Mark 3 and earned 324 Renown in the Tithe
  When EVT-02 "Tithe ended" has been recorded
  Then SVC-01 "Noble Houses" performs CMD-01 "Grant gift" three times
  And EVT-03 "Sponsor gift granted" is recorded for a rare item, 64 gold and a magic item
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

### Resolved in version 2

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
