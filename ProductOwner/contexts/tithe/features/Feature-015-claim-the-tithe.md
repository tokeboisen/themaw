```yaml
id: Feature-015
use_case: Claim the Tithe
bounded_context: Tithe
product: The Maw
source: models/Feature-015-claim-the-tithe.drawio
semantics: event-modeling-semantik.md
version: 3
status: draft
created: 2026-11-19
```

# Use case: Claim the Tithe

## 1. Purpose

For the player: walk through the gate after The Foreman is slain, so the player – and the player's party – is the Champion of the Tithe.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Depth | 1 | 1 | Player |
| CMD-01 | Command | Pass the gate | 2 | 1 | – |
| AGG-01 | Aggregate | Tithe | 3 | 1 | – |
| EVT-01 | Event | Tithe claimed | 4 | 1 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | The depth of the Maw the candidate is in: the map around the candidate, candidates and monsters in sight, loot on the floor, life, stamina, focus, hunger, Renown, the seal timer and the rivals' depths. |
| AGG-01 | One run into the Maw: its seed and depths, its candidates (the player and the rivals), the monsters, the Warden and the outcome. |

## 4. Flows

| From | To |
|---|---|
| VIEW-01 Depth | CMD-01 Pass the gate |
| CMD-01 Pass the gate | AGG-01 Tithe |
| AGG-01 Tithe | EVT-01 Tithe claimed |

## 5. Data

### AGG-01 Tithe (CMD-01 → EVT-01)

| Field |
|---|
| Gate open |
| Outcome |
| Outcome › Kind |
| Outcome › Champion |

## 6. User stories

### US-01: Pass the gate (CMD-01 → EVT-01)

As a player I want to walk through the gate, so that I claim the Tithe as its Champion.

```gherkin
Scenario: Kael claims the Tithe
  Given Kael slew The Foreman and stands at the open gate
  When the player performs CMD-01 "Pass the gate"
  Then EVT-01 "Tithe claimed" is recorded with Kael as Champion

Scenario: The gate is closed while The Foreman lives
  Given The Foreman is alive
  When the player performs CMD-01 "Pass the gate"
  Then nothing is recorded

Scenario: The whole party is Champion
  Given Kael slew The Foreman and Brann from Kael's party is still in the Tithe
  When the player performs CMD-01 "Pass the gate"
  Then EVT-01 "Tithe claimed" is recorded with Kael and Brann as Champions
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- The gate opens for the party of the player who slew The Foreman (Fight in the depths). When one of them passes the open gate, every member of that party still in the Tithe is Champion. (CMD-01, EVT-01)
- The Champions get the champion purse (Patronage, Pay the Crown's Purse) and keep everything found (Gear, Settle found gear). For every other player the Tithe ends without a fall. (EVT-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Depth | (starting point) | CMD-01 |

**VIEW-01:** The open gate glows gold; standing at it shows "Claim the Tithe – press F" and a button on a touch screen.

## 10. Validation and open questions

### Resolved in version 3

| # | Question | Resolution |
|---|---|---|
| 1 | **Champion in a party:** When one member of a party passes the gate, who is Champion? | Decided 2026-11-19: every member of the party still in the Tithe. |

### Still open

None.
