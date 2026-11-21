```yaml
id: Feature-049
use_case: Use a talent
bounded_context: Tithe
product: The Maw
source: models/Feature-049-use-a-talent.drawio
semantics: event-modeling-semantik.md
version: 3
status: draft
created: 2026-11-21
```

# Use case: Use a talent

## 1. Purpose

For the player: use the talent of the character's background – Hide, Berserk, Haste or Healing Circle – at the right moment in a fight, so each background plays differently and the player grows the talent by using it.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Depth | 1 | 1 | Player |
| CMD-01 | Command | Use talent | 2 | 1 | – |
| AGG-01 | Aggregate | Tithe | 3 | 1 | – |
| EVT-01 | Event | Talent used | 4 | 1 | – |

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
| VIEW-01 Depth | CMD-01 Use talent |
| CMD-01 Use talent | AGG-01 Tithe |
| AGG-01 Tithe | EVT-01 Talent used |

## 5. Data

### CMD-01 Use talent (VIEW-01 → AGG-01)

| Field |
|---|
| Talent |

### AGG-01 Tithe (CMD-01 → EVT-01)

| Field |
|---|
| Candidates (many) |
| Candidates › Stamina |
| Candidates › Focus |
| Candidates › Talent cooldown |
| Candidates › Effects |
| Healing circles (many) |
| Healing circles › Place |
| Healing circles › Radius |
| Healing circles › Time left |

## 6. User stories

### US-01: Use talent (CMD-01 → EVT-01)

As a player I want to use my character's talent with one key, so that I can hide, rage, run or heal when the fight calls for it.

```gherkin
Scenario: Hiding in plain sight
  Given Rook is a Street Runner with an effective Hide of 30 and 20 focus, and a Gnawer is 4 tiles away
  When the player performs CMD-01 "Use talent" with Hide
  Then EVT-01 "Talent used" is recorded
  And Rook is 80 % transparent for 11 seconds and has 8 focus left
  And the Gnawer does not see Rook until it is within 2 tiles

Scenario: Not enough stamina
  Given Vessa is a Poacher with 10 stamina
  When the player performs CMD-01 "Use talent" with Haste
  Then nothing is recorded
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- Every background has one talent (Characters, Create character): Street Runner Hide, Miner Berserk, Poacher Haste and Temple Acolyte Healing Circle. Pressing the talent's key uses it at once (Gear, Use the hotbar); the weapon chosen for Attack stays chosen. It costs stamina or focus and then waits for its cooldown; without enough, or before the cooldown is over, nothing happens. The numbers grow with the effective talent skill (level + attribute bonus), written s below. (CMD-01)
- Hide (Street Runner; 12 focus, 12 s): works anywhere, also in plain sight. For 5 + 0.2 × s seconds (at most 15) the candidate is 50 + s % transparent (at most 90 %). Others – monsters, rivals and players outside the party – only see and strike it within (100 − transparency) / 10 tiles: 5 tiles at 50 %, 1 tile at 90 %; beyond that it is invisible. Striking or casting ends Hide. Attributes: Dexterity 60 %, Intelligence 40 %. (AGG-01)
- Berserk (Miner; 25 stamina, 20 s): for 6 + 0.1 × s seconds (at most 12) melee blows reach 20 + s % farther (at most 60 %) and swing 60 + 6 × s degrees wider than the weapon, up to 360 degrees all around the candidate. Attributes: Strength 60 %, Constitution 40 %. (AGG-01)
- Haste (Poacher; 20 stamina, 18 s): for 6 + 0.1 × s seconds (at most 12) the candidate moves, shoots and its arrows fly 15 + 0.5 × s % faster (at most 50 %). Attributes: Dexterity 60 %, Stamina 40 %. (AGG-01)
- Healing Circle (Temple Acolyte; 18 focus, 15 s): a circle with a radius of 3 + 0.04 × s tiles (at most 5) glows around the candidate for 5 seconds and moves with it, and heals the candidate and its party members standing in it – in the arena its side – by 15 + 0.5 × s % of their max life (at most 40 %) over the 5 seconds. Attributes: Intelligence 70 %, Constitution 30 %. (AGG-01)
- Using the talent trains it (Characters, Learn by use), except in the arena, where nothing is trained. (EVT-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Depth | (starting point) | CMD-01 |

**VIEW-01:** The talent's key on the hotbar shows the cooldown left. While Hide lasts the candidate is drawn see-through, and others see it as transparent as the talent makes it; while Berserk lasts the swing is drawn as wide as it reaches; a Healing Circle glows around the candidate and follows it while it heals. The HUD shows Hidden, Berserk and Hasted while they last.

```gherkin
Scenario: Berserk all around
  Given Kael is a Miner with a Pickaxe and an effective Berserk of 40, and Gnawers stand on all sides of him
  When the player performs CMD-01 "Use talent" with Berserk
  Then EVT-01 "Talent used" is recorded
  And Kael's next swing hits the Gnawers on all sides

Scenario: The Healing Circle heals the party
  Given Mira is a Temple Acolyte and Jory, in her party, stands 2 tiles from her with 20 of 60 life
  When the player performs CMD-01 "Use talent" with Healing Circle
  Then EVT-01 "Talent used" is recorded
  And Jory heals over 5 seconds while he stands in the circle
```

## 10. Validation and open questions

### Resolved in version 3

| # | Question | Resolution |
|---|---|---|
| 1 | **Talents:** What should each background be able to do that the others cannot? | Decided 2026-11-21: one trainable talent per background on a hotbar key – Hide (Street Runner, focus), Berserk (Miner, stamina), Haste (Poacher, stamina) and Healing Circle (Temple Acolyte, focus). The key uses the talent at once, and only the background's own talent can be trained (my recommendations; the user did not choose). |

### Still open

None.
