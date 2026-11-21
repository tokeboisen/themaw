```yaml
id: Feature-009
use_case: Settle found gear
bounded_context: Gear
product: The Maw
source: models/Feature-009-settle-found-gear.drawio
semantics: event-modeling-semantik.md
version: 4
status: draft
created: 2026-11-19
```

# Use case: Settle found gear

## 1. Purpose

For the player: when a Tithe ends, what was found in it is kept – unless the candidate fell or left – so a fall has a price, but never takes what the candidate brought down.

## 2. Actors

| Actor | UI Views |
|---|---|
| – | – |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| EVT-01 | Event | Tithe ended | 1 | 1 | – |
| SVC-01 | Application Service | Quartermaster | 2 | 1 | – |
| CMD-01 | Command | Settle found gear | 3 | 1 | – |
| AGG-01 | Aggregate | Inventory | 4 | 1 | – |
| EVT-02 | Event | Found gear kept | 5 | 1 | – |
| EVT-03 | Event | Found gear lost | 5 | 2 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| EVT-01 | Feature-016 End the Tithe | EVT-04 Tithe ended |

### Descriptions

| ID | Description |
|---|---|
| SVC-01 | Keeps the inventory in step with what happens elsewhere: the starting kit, purchases, sales, gifts and the end of a Tithe. |
| AGG-01 | Everything a character owns and carries: the equipped melee weapon, ranged weapon, armour, two rings and an amulet, the items in the pack, potions and rations, the hotbar, and what was found in the current Tithe. |

## 4. Flows

| From | To |
|---|---|
| EVT-01 Tithe ended | SVC-01 Quartermaster |
| SVC-01 Quartermaster | CMD-01 Settle found gear |
| CMD-01 Settle found gear | AGG-01 Inventory |
| AGG-01 Inventory | EVT-02 Found gear kept |
| AGG-01 Inventory | EVT-03 Found gear lost |

## 5. Data

### CMD-01 Settle found gear (SVC-01 → AGG-01)

| Field |
|---|
| Outcome |

### AGG-01 Inventory (CMD-01 → EVT-02, EVT-03)

| Field |
|---|
| Equipment |
| Equipment › Melee weapon |
| Equipment › Ranged weapon |
| Equipment › Armour |
| Equipment › Ring 1 |
| Equipment › Ring 2 |
| Items (many) |
| Items › Item |
| Items › Found in Tithe |
| Gold found |

## 6. User stories

No user stories.

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| SVC-01 Quartermaster | EVT-01 | CMD-01 | EVT-02, EVT-03 |

### Rules

- A candidate who falls or leaves the Tithe loses the items and the gold found in that Tithe, also found items that were equipped; never what the candidate brought down. (CMD-01, EVT-03)
- When the player's party claims the Tithe, or someone else does, everything found is kept and is no longer marked as found. (EVT-02)
- The found gold that is kept goes to the wallet (Market, Keep the wallet). (EVT-02)

```gherkin
Scenario: A fall loses what was found
  Given Kael went down with a Pickaxe and found a "Cruel War Axe" and 33 gold
  When EVT-01 "Tithe ended" has been recorded with Kael fallen
  Then SVC-01 "Quartermaster" performs CMD-01 "Settle found gear"
  And EVT-03 "Found gear lost" is recorded with the War Axe and 33 gold
  And Kael still has the Pickaxe

Scenario: A Champion keeps what was found
  Given Kael found a "Cruel War Axe" and 33 gold
  When EVT-01 "Tithe ended" has been recorded with Kael as Champion
  Then EVT-02 "Found gear kept" is recorded with the War Axe and 33 gold

Scenario: Leaving loses what was found
  Given Kael found 20 gold
  When EVT-01 "Tithe ended" has been recorded with Kael having left the Tithe
  Then EVT-03 "Found gear lost" is recorded with 20 gold
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
| 1 | **What a fall costs:** Does a fall cost anything, and what? | Decided 2026-11-18: the items and gold found in that Tithe, never what the candidate brought down. |

### Still open

None.
