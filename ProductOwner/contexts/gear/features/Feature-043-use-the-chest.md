```yaml
id: Feature-043
use_case: Use the chest
bounded_context: Gear
product: The Maw
source: models/Feature-043-use-the-chest.drawio
semantics: event-modeling-semantik.md
version: 1
status: draft
created: 2026-11-20
```

# Use case: Use the chest

## 1. Purpose

For the player: keep items safe in a chest on the Mustering Square between Tithes, so the character can save gear for later – a weapon it is not ready for yet, or a spare – without carrying it into the Maw.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Chest | 1 | 1 | Player |
| CMD-01 | Command | Put item in the chest | 2 | 1 | – |
| CMD-02 | Command | Take item from the chest | 2 | 2 | – |
| AGG-01 | Aggregate | Chest | 3 | 1 | – |
| EVT-01 | Event | Item put in the chest | 4 | 1 | – |
| EVT-02 | Event | Item taken from the chest | 4 | 2 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | The character's chest on the Mustering Square with room for 12 items, next to the items in the pack. |
| AGG-01 | The items a character keeps in its own chest on the Mustering Square. |

## 4. Flows

| From | To |
|---|---|
| VIEW-01 Chest | CMD-01 Put item in the chest |
| VIEW-01 Chest | CMD-02 Take item from the chest |
| CMD-01 Put item in the chest | AGG-01 Chest |
| CMD-02 Take item from the chest | AGG-01 Chest |
| AGG-01 Chest | EVT-01 Item put in the chest |
| AGG-01 Chest | EVT-02 Item taken from the chest |

## 5. Data

### CMD-01 Put item in the chest (VIEW-01 → AGG-01)

| Field |
|---|
| Item |

### CMD-02 Take item from the chest (VIEW-01 → AGG-01)

| Field |
|---|
| Item |

### AGG-01 Chest (CMD-01, CMD-02 → EVT-01, EVT-02)

| Field |
|---|
| Items (many) |
| Items › Item |

## 6. User stories

### US-01: Put item in the chest (CMD-01 → EVT-01, EVT-02)

As a player I want to put an item from my pack in my chest, so that I keep it safe for later.

```gherkin
Scenario: Kael stores the War Axe
  Given Kael stands at the chest with a War Axe in the pack and 3 items in the chest
  When the player performs CMD-01 "Put item in the chest" with the War Axe
  Then EVT-01 "Item put in the chest" is recorded
  And the chest holds 4 of 12 items

Scenario: A full chest
  Given Kael's chest holds 12 items
  When the player performs CMD-01 "Put item in the chest" with a ring
  Then nothing is recorded
  And "Your chest is full." is shown
```

### US-02: Take item from the chest (CMD-02 → EVT-01, EVT-02)

As a player I want to take an item from my chest, so that I can wear it, sell it or carry it.

```gherkin
Scenario: Taking needs room in the pack
  Given Kael's pack is full and the War Axe is in the chest
  When the player performs CMD-02 "Take item from the chest" with the War Axe
  Then nothing is recorded
  And "Your inventory is full." is shown
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- A chest holds 12 items. Every character has its own chest; items cannot be moved between characters, and the chest is deleted with the character (Characters, Delete character). (AGG-01)
- Only items in the pack go into the chest; an equipped item is unequipped first. A full chest refuses with "Your chest is full." A weapon put in the chest leaves its hotbar key (Assign hotbar keys). (CMD-01)
- Taking an item needs room in the pack; otherwise "Your inventory is full." is shown. (CMD-02)
- The chest stands on the Mustering Square only: it cannot be used in a lobby or a Tithe, and what is in it never goes into the Maw, so it is never lost in a fall. (VIEW-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Chest | (starting point) | CMD-01, CMD-02 |

**VIEW-01:** Opened with F at the chest on the square ("Chest – press F") as a see-through overlay like the shops. It lists the items in the chest with Take and the items in the pack with Put in chest, each with its slot, rarity, damage or armour, affixes and requirements, and shows how many of the 12 places are used.

```gherkin
Scenario: The chest stays out of the Maw
  Given Kael has a Maul in the chest
  When Kael falls in a Tithe
  Then the Maul is still in the chest
```

## 10. Validation and open questions

### Resolved in version 1

| # | Question | Resolution |
|---|---|---|
| 1 | **Chest:** Is the chest shared by all of a user's characters or one per character? | Decided 2026-11-20: one chest per character with room for 12 items. |

### Still open

None.
