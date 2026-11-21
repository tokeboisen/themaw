```yaml
id: Feature-013
use_case: Survive the depths
bounded_context: Tithe
product: The Maw
source: models/Feature-013-survive-the-depths.drawio
semantics: event-modeling-semantik.md
version: 8
status: draft
created: 2026-11-19
```

# Use case: Survive the depths

## 1. Purpose

For the player: the Maw fights back – monsters hunt the candidates, a sealed depth collapses, hunger grows – and potions and rations help, so every Tithe is a fight to stay alive.

## 2. Actors

| Actor | UI Views |
|---|---|
| – | – |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| EVT-01 | Event | Tithe started | 1 | 1 | – |
| EVT-02 | Event | Depth reached | 1 | 2 | – |
| EVT-03 | Event | Beasts released | 1 | 3 | – |
| EVT-04 | Event | Depth sealed | 1 | 4 | – |
| EVT-05 | Event | Potion drunk | 1 | 5 | – |
| EVT-06 | Event | Ration eaten | 1 | 6 | – |
| EVT-12 | Event | Focus potion drunk | 1 | 7 | – |
| SVC-01 | Application Service | Monsters | 2 | 2 | – |
| SVC-02 | Application Service | Condition keeper | 2 | 5 | – |
| CMD-01 | Command | Wound candidate | 3 | 2 | – |
| CMD-02 | Command | Heal candidate | 3 | 4 | – |
| CMD-03 | Command | Feed candidate | 3 | 5 | – |
| CMD-04 | Command | Restore focus | 3 | 6 | – |
| AGG-01 | Aggregate | Tithe | 4 | 3 | – |
| EVT-07 | Event | Candidate wounded | 5 | 1 | – |
| EVT-08 | Event | Candidate healed | 5 | 2 | – |
| EVT-09 | Event | Candidate fed | 5 | 3 | – |
| EVT-10 | Event | Player fell | 5 | 4 | – |
| EVT-11 | Event | Rival fell | 5 | 5 | – |
| EVT-13 | Event | Focus restored | 5 | 6 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| EVT-01 | Feature-010 Enter the Tithe | EVT-02 Tithe started |
| EVT-02 | Feature-012 Descend | EVT-01 Depth reached |
| EVT-03 | Feature-017 Run the show | EVT-09 Beasts released |
| EVT-04 | Feature-017 Run the show | EVT-11 Depth sealed |
| EVT-05 | Feature-008 Use consumables | EVT-01 Potion drunk |
| EVT-06 | Feature-008 Use consumables | EVT-02 Ration eaten |
| EVT-12 | Feature-008 Use consumables | EVT-03 Focus potion drunk |

### Descriptions

| ID | Description |
|---|---|
| SVC-01 | The monsters of a depth: they wake when a candidate comes into sight and hunt the nearest one. |
| SVC-02 | Keeps the candidates' life and hunger: potions, rations, starving and the collapse of a sealed depth. |
| AGG-01 | One run into the Maw: its seed and depths, its candidates (the player and the rivals), the monsters, the Warden and the outcome. |
| EVT-11 | A rival fell to monsters, the collapse of a sealed depth or the Warden, not by the player's hand. |

## 4. Flows

| From | To |
|---|---|
| EVT-01 Tithe started | SVC-01 Monsters |
| EVT-02 Depth reached | SVC-01 Monsters |
| EVT-03 Beasts released | SVC-01 Monsters |
| EVT-04 Depth sealed | SVC-02 Condition keeper |
| EVT-05 Potion drunk | SVC-02 Condition keeper |
| EVT-06 Ration eaten | SVC-02 Condition keeper |
| EVT-12 Focus potion drunk | SVC-02 Condition keeper |
| SVC-02 Condition keeper | CMD-04 Restore focus |
| CMD-04 Restore focus | AGG-01 Tithe |
| AGG-01 Tithe | EVT-13 Focus restored |
| SVC-01 Monsters | CMD-01 Wound candidate |
| SVC-02 Condition keeper | CMD-01 Wound candidate |
| SVC-02 Condition keeper | CMD-02 Heal candidate |
| SVC-02 Condition keeper | CMD-03 Feed candidate |
| CMD-01 Wound candidate | AGG-01 Tithe |
| CMD-02 Heal candidate | AGG-01 Tithe |
| CMD-03 Feed candidate | AGG-01 Tithe |
| AGG-01 Tithe | EVT-07 Candidate wounded |
| AGG-01 Tithe | EVT-08 Candidate healed |
| AGG-01 Tithe | EVT-09 Candidate fed |
| AGG-01 Tithe | EVT-10 Player fell |
| AGG-01 Tithe | EVT-11 Rival fell |

## 5. Data

### CMD-01 Wound candidate (SVC-01, SVC-02 → AGG-01)

| Field |
|---|
| Candidate |
| Damage |

### CMD-02 Heal candidate (SVC-02 → AGG-01)

| Field |
|---|
| Candidate |
| Life |

### CMD-03 Feed candidate (SVC-02 → AGG-01)

| Field |
|---|
| Candidate |
| Hunger |

### CMD-04 Restore focus (SVC-02 → AGG-01)

| Field |
|---|
| Candidate |
| Focus |

### AGG-01 Tithe (CMD-04, CMD-01, CMD-02, CMD-03 → EVT-13, EVT-07, EVT-08, EVT-09, EVT-10, EVT-11)

| Field |
|---|
| Candidates (many) |
| Candidates › Name |
| Candidates › Life |
| Candidates › Focus |
| Candidates › Hunger |
| Candidates › Status |

## 6. User stories

No user stories.

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| SVC-01 Monsters | EVT-01, EVT-02, EVT-03 | CMD-01 | EVT-13, EVT-07, EVT-08, EVT-09, EVT-10, EVT-11 |
| SVC-02 Condition keeper | EVT-04, EVT-05, EVT-06, EVT-12 | CMD-04, CMD-01, CMD-02, CMD-03 | EVT-13, EVT-07, EVT-08, EVT-09, EVT-10, EVT-11 |

### Rules

- Monsters are many – 2–5 in every room of the mines, groups in the corridors, bands in the streets and houses of The Broken City, and packs on the paths, brigands at the campfires and beasts in the huts of The Woods. They sleep until a candidate comes into sight, then hunt the nearest candidate, also around walls. Before each attack they wind up, so a dodge avoids it: a dash of 3 tiles in 0.18 seconds that cannot be hit, for 20 stamina. (SVC-01)
- Damage to a candidate is reduced by armour / (armour + 50). (CMD-01)
- Some monsters harm more than life: the Cave Spider's web and the Harpy's shriek make a player 40 % slower for 2 and 1.5 seconds, the Ghoul's claws stun for 0.6 seconds, the Rust Ooze eats 3 armour for 10 seconds, the Wraith drains 20 stamina and 8 focus, and the Kobold Sapper's fire pots burst over 1.3 tiles. The HUD shows when the player is slowed, stunned or corroded. (CMD-01, SVC-01)
- Some monsters fight in a way of their own: the Tunnel Goblin flees below 25 % life; the Skeleton Miner takes half damage from arrows; the Cave Troll heals 2 % of its life per second unless an Echo Bolt hit it within 5 seconds; Feral Hounds hit 20 % harder for every other hound within 3 tiles, at most 60 %; the Cutthroat sidesteps a blow 30 % of the time, at most every 3 seconds; a Hollow rises once with 40 % of its life; the Cultist of the Maw heals the monsters within 5 tiles by 15 % every 6 seconds; a Gargoyle stands still until a candidate is within 3 tiles; Harpies fly over rubble; and the Scrap Golem takes double damage from Echo Bolt. In The Woods: Grey Wolves hunt in packs like Feral Hounds; the Brigand sidesteps like the Cutthroat; the Wild Boar's charge stuns for 0.6 seconds; the Thornling's thorns slow for 1.5 seconds; the Bog Wisp flies over furniture and drains stamina and focus; the Barrow Wight rises once; the Briar Treant heals unless an Echo Bolt hit it and takes half damage from arrows; and the Fen Witch heals the monsters around her. (SVC-01)
- Hunger falls by 0.25 per second, 2 % slower per Stamina above 10. At 0 the candidate starves: stamina recovers at 40 % and life does not recover. Otherwise life recovers 0.3 per second. (SVC-02, CMD-03)
- A sealed depth – or a sealed district of The Broken City, with the floors of its houses, or of The Woods – wounds every candidate in it by 3 % of max life per second until they leave it. (SVC-02)
- In The Woods a candidate standing in a bush is hidden – from monsters, rivals and other players outside its party – unless they are within 2 tiles, or the candidate has struck or cast in the last 1.5 seconds. Others see it fade in as they come closer: invisible beyond 3 tiles, then less and less transparent, 80 % transparent at 1 tile. A hidden candidate can sneak past sleeping monsters, and a monster that loses sight of its prey stops the hunt. Hide hides in plain sight as well (Use a talent). (SVC-01)
- A potion heals 40 % of max life, and a ration restores 45 hunger (Gear, Use consumables). (CMD-02, CMD-03)
- A focus potion restores 40 % of max focus (Gear, Use consumables). (CMD-04)
- When a player's life reaches 0, the player falls and the Brand drags them back: the player's part of the Tithe ends (End the Tithe), and the other candidates go on. An NPC rival whose life reaches 0 falls and leaves the Tithe. (EVT-10, EVT-11)

```gherkin
Scenario: A potion heals
  Given Kael has 20 of 60 life
  When EVT-05 "Potion drunk" has been recorded
  Then SVC-02 "Condition keeper" performs CMD-02 "Heal candidate" with 24 life
  And EVT-08 "Candidate healed" is recorded
  And Kael has 44 of 60 life

Scenario: The player falls
  Given Kael has 3 life
  When SVC-01 "Monsters" performs CMD-01 "Wound candidate" with 5 damage on Kael
  Then EVT-07 "Candidate wounded" is recorded
  And EVT-10 "Player fell" is recorded

Scenario: A sealed depth collapses
  Given Kael has 60 max life and is still in depth 1
  When EVT-04 "Depth sealed" has been recorded for depth 1
  Then SVC-02 "Condition keeper" performs CMD-01 "Wound candidate" with 1.8 damage per second until Kael leaves depth 1
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

### Resolved in version 8

| # | Question | Resolution |
|---|---|---|
| 1 | **Monster traits:** Should the monsters have traits of their own beyond how they fight? | Decided 2026-11-20: yes – slowing, stunning, corroding, draining, area attacks, fleeing, healing, regeneration, resistances and weaknesses, as the rules list them. |
| 2 | **Hiding in The Woods:** Should the bushes of The Woods hide candidates, as in the arena? | Decided 2026-11-20: yes, from players, rivals and monsters alike, unless they come within 2 tiles or the candidate strikes. |

### Still open

None.
