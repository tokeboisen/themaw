```yaml
id: Feature-019
use_case: Trade at the Forge
bounded_context: Market
product: The Maw
source: models/Feature-019-trade-at-the-forge.drawio
semantics: event-modeling-semantik.md
version: 2
status: draft
created: 2026-11-19
```

# Use case: Trade at the Forge

## 1. Purpose

For the player: buy weapons, armour and rings from Hesta Varn and sell what is not needed, so the gold of a Tithe becomes the gear for the next.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Forge | 1 | 1 | Player |
| CMD-01 | Command | Buy item | 2 | 1 | – |
| CMD-02 | Command | Sell item | 2 | 2 | – |
| AGG-01 | Aggregate | Forge | 3 | 1 | – |
| AGG-02 | Aggregate | Wallet | 3 | 2 | – |
| EVT-01 | Event | Item bought | 4 | 1 | – |
| EVT-02 | Event | Gold spent | 4 | 2 | – |
| EVT-03 | Event | Item sold | 4 | 3 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | Hesta Varn's forge on the Mustering Square: the items for sale with price, and the player's pack with sell price. |
| AGG-01 | Hesta Varn's forge and the items for sale. |
| AGG-02 | The character's gold. |

## 4. Flows

| From | To |
|---|---|
| VIEW-01 Forge | CMD-01 Buy item |
| VIEW-01 Forge | CMD-02 Sell item |
| CMD-01 Buy item | AGG-01 Forge |
| CMD-01 Buy item | AGG-02 Wallet |
| CMD-02 Sell item | AGG-02 Wallet |
| AGG-01 Forge | EVT-01 Item bought |
| AGG-02 Wallet | EVT-02 Gold spent |
| AGG-02 Wallet | EVT-03 Item sold |

## 5. Data

### CMD-01 Buy item (VIEW-01 → AGG-01, AGG-02)

| Field |
|---|
| Item |

### CMD-02 Sell item (VIEW-01 → AGG-02)

| Field |
|---|
| Item |

### AGG-01 Forge (CMD-01 → EVT-01)

| Field |
|---|
| Stock (many) |
| Stock › Item |
| Stock › Price |

### AGG-02 Wallet (CMD-01, CMD-02 → EVT-02, EVT-03)

| Field |
|---|
| Gold |

## 6. User stories

### US-01: Buy item (CMD-01 → EVT-02, EVT-03, EVT-01)

As a player I want to buy an item at the Forge, so that I go down better armed.

```gherkin
Scenario: An item is bought
  Given Kael has 100 gold and the Forge sells a "Short Sword" for 59 gold
  When the player performs CMD-01 "Buy item" with the Short Sword
  Then EVT-01 "Item bought" is recorded
  And EVT-02 "Gold spent" is recorded with 59 gold
  And Kael has 41 gold

Scenario: Not enough gold
  Given Kael has 20 gold
  When the player performs CMD-01 "Buy item" with an item for 59 gold
  Then nothing is recorded
  And "Not enough gold." is shown
```

### US-02: Sell item (CMD-02 → EVT-02, EVT-03)

As a player I want to sell an item I do not need, so that I get gold for better gear.

```gherkin
Scenario: An item is sold
  Given Kael has a "Reinforced Leather Jerkin" worth 86 gold in the pack
  When the player performs CMD-02 "Sell item" with it
  Then EVT-03 "Item sold" is recorded with 25 gold
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- Price: the base price × (1 + 15 % per item level above 1) × the rarity (Common 1, Magic 2.2, Rare 4) + 8 per affix. Selling gives 30 % of the price. (AGG-01, CMD-02)
- Buying needs the gold and room in the pack; otherwise it is refused with "Not enough gold." or "Your inventory is full.". A bought item leaves the stock. (CMD-01)
- Only items in the pack can be sold; equipped items must be unequipped first. (CMD-02)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Forge | (starting point) | CMD-01, CMD-02 |

**VIEW-01:** "Hesta Varn, the smith: Steel for the Branded. Coin first." Two lists: For sale, each item with its price and Buy (disabled when the gold is not enough), and Your inventory, each item with its sell price and Sell. A refusal is shown above the lists.

## 10. Validation and open questions

### Resolved in version 2

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
