```yaml
id: Feature-018
use_case: Keep the wallet
bounded_context: Market
product: The Maw
source: models/Feature-018-keep-the-wallet.drawio
semantics: event-modeling-semantik.md
version: 4
status: draft
created: 2026-11-19
```

# Use case: Keep the wallet

## 1. Purpose

For the player: the starting gold, the Crown's Purse, sponsor gold and the gold found in a Tithe land in one wallet, and a defeat by another player spills some of it, so the player can see and spend what the character owns.

## 2. Actors

| Actor | UI Views |
|---|---|
| – | – |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| EVT-01 | Event | Character created | 1 | 1 | – |
| EVT-02 | Event | Found gear kept | 1 | 2 | – |
| EVT-03 | Event | Purse paid | 1 | 3 | – |
| EVT-04 | Event | Gold gift accepted | 1 | 4 | – |
| EVT-06 | Event | Player defeated | 1 | 5 | – |
| EVT-07 | Event | Character deleted | 1 | 6 | – |
| SVC-01 | Application Service | Banker | 2 | 2 | – |
| CMD-01 | Command | Add gold | 3 | 2 | – |
| CMD-02 | Command | Spill gold | 3 | 3 | – |
| CMD-03 | Command | Close wallet | 3 | 4 | – |
| AGG-01 | Aggregate | Wallet | 4 | 2 | – |
| EVT-05 | Event | Gold added | 5 | 2 | – |
| EVT-08 | Event | Gold spilled | 5 | 3 | – |
| EVT-09 | Event | Wallet closed | 5 | 4 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| EVT-01 | Feature-001 Create character | EVT-01 Character created |
| EVT-02 | Feature-009 Settle found gear | EVT-02 Found gear kept |
| EVT-03 | Feature-022 Pay the Crown's Purse | EVT-03 Purse paid |
| EVT-04 | Feature-024 Accept sponsor gifts | EVT-02 Gold gift accepted |
| EVT-06 | Feature-011 Fight in the depths | EVT-06 Player defeated |
| EVT-07 | Feature-038 Delete character | EVT-01 Character deleted |

### Descriptions

| ID | Description |
|---|---|
| AGG-01 | The character's gold. |

## 4. Flows

| From | To |
|---|---|
| EVT-01 Character created | SVC-01 Banker |
| EVT-02 Found gear kept | SVC-01 Banker |
| EVT-03 Purse paid | SVC-01 Banker |
| EVT-04 Gold gift accepted | SVC-01 Banker |
| SVC-01 Banker | CMD-01 Add gold |
| CMD-01 Add gold | AGG-01 Wallet |
| AGG-01 Wallet | EVT-05 Gold added |
| EVT-06 Player defeated | SVC-01 Banker |
| EVT-07 Character deleted | SVC-01 Banker |
| SVC-01 Banker | CMD-02 Spill gold |
| SVC-01 Banker | CMD-03 Close wallet |
| CMD-02 Spill gold | AGG-01 Wallet |
| CMD-03 Close wallet | AGG-01 Wallet |
| AGG-01 Wallet | EVT-08 Gold spilled |
| AGG-01 Wallet | EVT-09 Wallet closed |

## 5. Data

### CMD-01 Add gold (SVC-01 → AGG-01)

| Field |
|---|
| Gold |

### AGG-01 Wallet (CMD-01, CMD-02, CMD-03 → EVT-05, EVT-08, EVT-09)

| Field |
|---|
| Gold |

### CMD-02 Spill gold (SVC-01 → AGG-01)

| Field |
|---|
| Gold |

### CMD-03 Close wallet (SVC-01 → AGG-01)

| Field |
|---|
| Character |

## 6. User stories

No user stories.

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| SVC-01 Banker | EVT-01, EVT-02, EVT-03, EVT-04, EVT-06, EVT-07 | CMD-01, CMD-02, CMD-03 | EVT-05, EVT-08, EVT-09 |

### Rules

- A new character starts with 60 gold. (SVC-01)
- The gold found in a Tithe is only added when it is kept (EVT-02); a fall adds nothing of it. (SVC-01)
- The Mustering Square and its shops show the gold at the top. (AGG-01)
- A player defeated by another player spills 10–20 % of the gold in the wallet, rounded down. It lies on the floor where the player fell, and whoever picks it up finds it (Gear, Pick up loot). (CMD-02, EVT-08)
- When a character is deleted, its wallet is closed and the gold is gone. (CMD-03)

```gherkin
Scenario: The Crown pays
  Given Kael has 60 gold
  When EVT-03 "Purse paid" has been recorded with 690 gold
  Then SVC-01 "Banker" performs CMD-01 "Add gold" with 690 gold
  And EVT-05 "Gold added" is recorded
  And Kael has 750 gold

Scenario: A defeat spills gold
  Given Brann has 200 gold
  When EVT-06 "Player defeated" has been recorded for Brann
  Then SVC-01 "Banker" performs CMD-02 "Spill gold" with between 20 and 40 gold
  And EVT-08 "Gold spilled" is recorded
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

### Resolved in version 4

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
