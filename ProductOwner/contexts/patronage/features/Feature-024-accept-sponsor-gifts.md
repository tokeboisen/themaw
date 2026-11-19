```yaml
id: Feature-024
use_case: Accept sponsor gifts
bounded_context: Patronage
product: The Maw
source: models/Feature-024-accept-sponsor-gifts.drawio
semantics: event-modeling-semantik.md
version: 1
status: draft
created: 2026-11-19
```

# Use case: Accept sponsor gifts

## 1. Purpose

For the player: accept the gifts the Noble Houses sent, so the items and gold become the character's.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Patrons' Hall | 1 | 1 | Player |
| CMD-01 | Command | Accept gift | 2 | 1 | – |
| AGG-01 | Aggregate | Sponsor gift | 3 | 1 | – |
| EVT-01 | Event | Item gift accepted | 4 | 1 | – |
| EVT-02 | Event | Gold gift accepted | 4 | 2 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | The Noble Houses' agents in the Rim, with the sponsor gifts that wait. |
| AGG-01 | A gift from one of the Noble Houses for the Renown of a Tithe: an item or gold, waiting until it is accepted. |

## 4. Flows

| From | To |
|---|---|
| VIEW-01 Patrons' Hall | CMD-01 Accept gift |
| CMD-01 Accept gift | AGG-01 Sponsor gift |
| AGG-01 Sponsor gift | EVT-01 Item gift accepted |
| AGG-01 Sponsor gift | EVT-02 Gold gift accepted |

## 5. Data

### CMD-01 Accept gift (VIEW-01 → AGG-01)

| Field |
|---|
| Gift |

### AGG-01 Sponsor gift (CMD-01 → EVT-01, EVT-02)

| Field |
|---|
| Accepted |

## 6. User stories

### US-01: Accept gift (CMD-01 → EVT-01, EVT-02)

As a player I want to accept a sponsor gift, so that the item or gold becomes mine.

```gherkin
Scenario: A gold gift is accepted
  Given House Vane has sent 64 gold
  When the player performs CMD-01 "Accept gift" with it
  Then EVT-02 "Gold gift accepted" is recorded with 64 gold

Scenario: A full pack refuses an item gift
  Given Kael's pack is full and House Morrow has sent an item
  When the player performs CMD-01 "Accept gift" with the item
  Then nothing is recorded
  And "Your inventory is full." is shown
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- An item gift needs room in the pack; otherwise it is refused with "Your inventory is full." and keeps waiting. (CMD-01)
- An accepted item goes into the pack (Gear, Stock the inventory), and accepted gold into the wallet (Market, Keep the wallet). (EVT-01, EVT-02)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Patrons' Hall | (starting point) | CMD-01 |

**VIEW-01:** Explains that the Houses give one gift for every 100 Renown (at most 4) and what the crowd loves, shows the Renown of the last Tithe and lists the waiting gifts – each item with its house, an item gift with its description – with Accept.

## 10. Validation and open questions

### Resolved in version 1

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
