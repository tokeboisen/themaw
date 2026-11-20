```yaml
id: Feature-046
use_case: Settle arena stakes
bounded_context: Market
product: The Maw
source: models/Feature-046-settle-arena-stakes.drawio
semantics: event-modeling-semantik.md
version: 1
status: draft
created: 2026-11-20
```

# Use case: Settle arena stakes

## 1. Purpose

For the players: take every fighter's stake when an arena match starts and share the pot among the winners when it ends, so a fight in the arena is worth winning.

## 2. Actors

| Actor | UI Views |
|---|---|
| – | – |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| EVT-01 | Event | Arena match started | 1 | 1 | – |
| EVT-02 | Event | Arena match ended | 1 | 2 | – |
| SVC-01 | Application Service | Arena bookkeeper | 2 | 1 | – |
| CMD-01 | Command | Take the stakes | 3 | 1 | – |
| CMD-02 | Command | Pay the winners | 3 | 2 | – |
| AGG-01 | Aggregate | Wallet | 4 | 1 | – |
| EVT-03 | Event | Stakes taken | 5 | 1 | – |
| EVT-04 | Event | Winnings paid | 5 | 2 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| EVT-01 | Feature-044 Arrange an arena match | EVT-03 Arena match started |
| EVT-02 | Feature-045 Fight in the arena | EVT-04 Arena match ended |

### Descriptions

| ID | Description |
|---|---|
| SVC-01 | Takes the stakes when an arena match starts and pays the winners when it ends. |
| AGG-01 | The character's gold. |

## 4. Flows

| From | To |
|---|---|
| EVT-01 Arena match started | SVC-01 Arena bookkeeper |
| EVT-02 Arena match ended | SVC-01 Arena bookkeeper |
| SVC-01 Arena bookkeeper | CMD-01 Take the stakes |
| SVC-01 Arena bookkeeper | CMD-02 Pay the winners |
| CMD-01 Take the stakes | AGG-01 Wallet |
| CMD-02 Pay the winners | AGG-01 Wallet |
| AGG-01 Wallet | EVT-03 Stakes taken |
| AGG-01 Wallet | EVT-04 Winnings paid |

## 5. Data

### CMD-01 Take the stakes (SVC-01 → AGG-01)

| Field |
|---|
| Fighters |
| Stake |

### CMD-02 Pay the winners (SVC-01 → AGG-01)

| Field |
|---|
| Winners |
| Pot |

### AGG-01 Wallet (CMD-01, CMD-02 → EVT-03, EVT-04)

| Field |
|---|
| Gold |

## 6. User stories

No user stories.

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| SVC-01 Arena bookkeeper | EVT-01, EVT-02 | CMD-01, CMD-02 | EVT-03, EVT-04 |

### Rules

- When an arena match starts, the stake is taken from every fighter's wallet. The pot is the stake times the number of fighters. (CMD-01)
- When the match ends, the winners share the pot equally, rounded down. In a draw every fighter gets the stake back. A fighter who left or lost the connection is down and gets nothing back. (CMD-02)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| – | – | – | – |

```gherkin
Scenario: The winner takes the pot
  Given Kael and Brann each staked 50 gold in a 1:1 match
  When EVT-02 "Arena match ended" is recorded with Kael's side as the winner
  Then EVT-04 "Winnings paid" is recorded
  And Kael's wallet gets 100 gold

Scenario: Two against one
  Given Kael stood alone against Brann and Mira with a stake of 40
  When EVT-02 "Arena match ended" is recorded with Brann and Mira's side as the winner
  Then Brann and Mira get 60 gold each

Scenario: A draw
  Given Kael and Brann each staked 50 gold
  When EVT-02 "Arena match ended" is recorded as a draw
  Then Kael and Brann get 50 gold each
```

## 10. Validation and open questions

### Resolved in version 1

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
