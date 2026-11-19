```yaml
id: Feature-022
use_case: Pay the Crown's Purse
bounded_context: Patronage
product: The Maw
source: models/Feature-022-pay-the-crown-s-purse.drawio
semantics: event-modeling-semantik.md
version: 2
status: draft
created: 2026-11-19
```

# Use case: Pay the Crown's Purse

## 1. Purpose

For the player: the Crown pays gold after every Tithe for how deep the candidate came, the Warden, Renown and the championship, so even a lost Tithe brings the character forward.

## 2. Actors

| Actor | UI Views |
|---|---|
| – | – |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| EVT-01 | Event | Renown earned | 1 | 1 | – |
| EVT-02 | Event | Tithe ended | 1 | 2 | – |
| SVC-01 | Application Service | Crown treasurer | 2 | 1 | – |
| CMD-01 | Command | Pay the purse | 3 | 1 | – |
| AGG-01 | Aggregate | Crown's Purse | 4 | 1 | – |
| EVT-03 | Event | Purse paid | 5 | 1 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| EVT-01 | Feature-017 Run the show | EVT-07 Renown earned |
| EVT-02 | Feature-016 End the Tithe | EVT-04 Tithe ended |

### Descriptions

| ID | Description |
|---|---|
| AGG-01 | The gold the Crown pays a candidate after a Tithe. |

## 4. Flows

| From | To |
|---|---|
| EVT-01 Renown earned | SVC-01 Crown treasurer |
| EVT-02 Tithe ended | SVC-01 Crown treasurer |
| SVC-01 Crown treasurer | CMD-01 Pay the purse |
| CMD-01 Pay the purse | AGG-01 Crown's Purse |
| AGG-01 Crown's Purse | EVT-03 Purse paid |

## 5. Data

### CMD-01 Pay the purse (SVC-01 → AGG-01)

| Field |
|---|
| Tithe |

### AGG-01 Crown's Purse (CMD-01 → EVT-03)

| Field |
|---|
| Tithe |
| Deepest depth |
| Warden slain |
| Renown |
| Outcome |
| Amount |

## 6. User stories

No user stories.

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| SVC-01 Crown treasurer | EVT-01, EVT-02 | CMD-01 | EVT-03 |

### Rules

- The treasurer adds up the Renown earned during the Tithe and pays when it ends. (SVC-01)
- The purse is 40 × the deepest depth + 150 when the player's party slew The Foreman + 0.3 × Renown + 300 for each Champion. A fall or leaving halves it. (CMD-01, AGG-01)

```gherkin
Scenario: The Champion's purse
  Given Kael reached depth 3, slew The Foreman and earned 400 Renown
  When EVT-02 "Tithe ended" has been recorded with Kael as Champion
  Then SVC-01 "Crown treasurer" performs CMD-01 "Pay the purse"
  And EVT-03 "Purse paid" is recorded with 690 gold

Scenario: A fall halves the purse
  Given Kael reached depth 2 and earned 100 Renown
  When EVT-02 "Tithe ended" has been recorded with Kael fallen
  Then EVT-03 "Purse paid" is recorded with 55 gold
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
