```yaml
id: Feature-020
use_case: Shop at the Apothecary
bounded_context: Market
product: The Maw
source: models/Feature-020-shop-at-the-apothecary.drawio
semantics: event-modeling-semantik.md
version: 2
status: draft
created: 2026-11-19
```

# Use case: Shop at the Apothecary

## 1. Purpose

For the player: buy healing draughts and rations from Mother Quill, so the candidate can survive longer in the next Tithe.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Apothecary | 1 | 1 | Player |
| CMD-01 | Command | Buy potion | 2 | 1 | – |
| CMD-02 | Command | Buy ration | 2 | 2 | – |
| AGG-01 | Aggregate | Wallet | 3 | 1 | – |
| EVT-01 | Event | Potion bought | 4 | 1 | – |
| EVT-02 | Event | Ration bought | 4 | 2 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | Mother Quill's apothecary on the Mustering Square: healing draughts and rations. |
| AGG-01 | The character's gold. |

## 4. Flows

| From | To |
|---|---|
| VIEW-01 Apothecary | CMD-01 Buy potion |
| VIEW-01 Apothecary | CMD-02 Buy ration |
| CMD-01 Buy potion | AGG-01 Wallet |
| CMD-02 Buy ration | AGG-01 Wallet |
| AGG-01 Wallet | EVT-01 Potion bought |
| AGG-01 Wallet | EVT-02 Ration bought |

## 5. Data

### AGG-01 Wallet (CMD-01, CMD-02 → EVT-01, EVT-02)

| Field |
|---|
| Gold |

## 6. User stories

### US-01: Buy potion (CMD-01 → EVT-01, EVT-02)

As a player I want to buy a healing draught, so that I can survive a hard fight.

```gherkin
Scenario: A potion is bought
  Given Kael has 40 gold and 1 potion
  When the player performs CMD-01 "Buy potion"
  Then EVT-01 "Potion bought" is recorded
  And Kael has 15 gold
```

### US-02: Buy ration (CMD-02 → EVT-01, EVT-02)

As a player I want to buy a ration, so that I do not starve in a long Tithe.

```gherkin
Scenario: Nine rations are enough
  Given Kael carries 9 rations
  When the player performs CMD-02 "Buy ration"
  Then nothing is recorded
  And "You cannot carry more." is shown
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- A healing draught costs 25 gold and a ration 10 gold. (CMD-01, CMD-02)
- Buying needs the gold, and the character may carry at most 9 of each; otherwise it is refused with "Not enough gold." or "You cannot carry more.". (CMD-01, CMD-02)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Apothecary | (starting point) | CMD-01, CMD-02 |

**VIEW-01:** "Mother Quill: Drink before you need it, child. Eat before you starve." Healing Draught and Ration with what they do, the price, how many the character carries of the 9, and Buy (disabled without gold or room).

## 10. Validation and open questions

### Resolved in version 2

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
