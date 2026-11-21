```yaml
id: Feature-028
use_case: Use the hotbar
bounded_context: Gear
product: The Maw
source: models/Feature-028-use-the-hotbar.drawio
semantics: event-modeling-semantik.md
version: 9
status: draft
created: 2026-11-19
```

# Use case: Use the hotbar

## 1. Purpose

For the player: press a number key to draw the weapon on it for Attack (Space), or to cast the Echo Art or use the talent on it at once, so the character can switch between a bow at range and a blade up close, and cast in the middle of a fight without putting the weapon away.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Depth | 1 | 1 | Player |
| CMD-01 | Command | Choose hotbar key | 2 | 1 | – |
| AGG-01 | Aggregate | Inventory | 3 | 1 | – |
| EVT-01 | Event | Hotbar key chosen | 4 | 1 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | The depth of the Maw the candidate is in, with the loot on the floor and the potion and ration buttons. |
| AGG-01 | Everything a character owns and carries: the equipped melee weapon, ranged weapon, armour, two rings and an amulet, the items in the pack, potions and rations, the hotbar, and what was found in the current Tithe. |

## 4. Flows

| From | To |
|---|---|
| VIEW-01 Depth | CMD-01 Choose hotbar key |
| CMD-01 Choose hotbar key | AGG-01 Inventory |
| AGG-01 Inventory | EVT-01 Hotbar key chosen |

## 5. Data

### CMD-01 Choose hotbar key (VIEW-01 → AGG-01)

| Field |
|---|
| Key |

### AGG-01 Inventory (CMD-01 → EVT-01)

| Field |
|---|
| Equipment |
| Equipment › Melee weapon |
| Equipment › Ranged weapon |
| Hotbar (many) |
| Hotbar › Key |
| Hotbar › Weapon |
| Chosen key |

## 6. User stories

### US-01: Choose hotbar key (CMD-01 → EVT-01)

As a player I want to press a number key, so that I draw the right weapon for Attack or cast an Echo Art at once.

```gherkin
Scenario: Drawing the bow
  Given Kael holds the Pickaxe and the Short Bow in the pack is on key 3
  When the player performs CMD-01 "Choose hotbar key" with key 3
  Then EVT-01 "Hotbar key chosen" is recorded
  And the Short Bow is the ranged weapon and the Pickaxe is still the melee weapon
  And Attack shoots the Short Bow, and its arrows train Bows

Scenario: Switching back to the melee weapon
  Given Kael wears the Pickaxe and the Short Bow and has chosen the Short Bow
  When the player performs CMD-01 "Choose hotbar key" with key 1
  Then EVT-01 "Hotbar key chosen" is recorded
  And Attack strikes with the Pickaxe

Scenario: Casting Echo Bolt with its key
  Given Kael holds the Pickaxe, Echo Bolt is on key 2 and a Gnawer stands 5 tiles away
  When the player performs CMD-01 "Choose hotbar key" with key 2
  Then EVT-01 "Hotbar key chosen" is recorded
  And Echo Bolt is cast at the Gnawer
  And Attack still strikes with the Pickaxe
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- A key with a weapon chooses the weapon Attack (Space) uses. A key with an equipped weapon chooses it. A key with a weapon in the pack draws it: it goes into its slot – melee or ranged – and the weapon that was there goes into the pack. Changing weapon takes 0.3 seconds, in which the candidate cannot strike. A weapon whose requirements the character does not meet stays in the pack, and "You do not meet the requirements." is shown over the candidate (Manage equipment). (CMD-01)
- A key with an Echo Art casts it at once (Tithe, Cast an Echo Art), and a key with the talent uses the talent at once (Tithe, Use a talent); neither changes the weapon Attack uses. A key with nothing on it does nothing. (CMD-01)
- Attack (Space) always strikes with the chosen weapon, and its blows train that weapon's skill (Tithe, Fight in the depths). (EVT-01)
- A Tithe starts with the melee weapon chosen, or the ranged weapon when there is no melee weapon; with neither, the candidate fights unarmed. Equipping a weapon on the character sheet chooses it. (AGG-01)
- Clicking a slot of the hotbar with the mouse does the same as pressing its key. (CMD-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Depth | (starting point) | CMD-01 |

**VIEW-01:** The hotbar is shown at the bottom of the screen with the keys 1–8; the key with the weapon Attack uses is highlighted, and a key with an Echo Art or the talent shows the cooldown left.

## 10. Validation and open questions

### Resolved in version 9

| # | Question | Resolution |
|---|---|---|
| 1 | **What a hotbar key does:** Should a key with an Echo Art cast it at once, or choose what Attack (Space) uses? | Decided 2026-11-19: every key chooses what Attack (Space) uses; a weapon is drawn, an Echo Art is chosen without being cast. Changed 2026-11-21 by the user: a key with an Echo Art or the talent uses it at once, and a key with a weapon chooses the weapon Attack (Space) uses. |
| 2 | **Equipment slots:** How many weapons and rings can a character wear at the same time? | Decided 2026-11-19: a melee weapon, a ranged weapon, armour and two rings at the same time. |

### Still open

None.
