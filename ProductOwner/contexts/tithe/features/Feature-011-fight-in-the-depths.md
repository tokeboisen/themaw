```yaml
id: Feature-011
use_case: Fight in the depths
bounded_context: Tithe
product: The Maw
source: models/Feature-011-fight-in-the-depths.drawio
semantics: event-modeling-semantik.md
version: 4
status: draft
created: 2026-11-19
```

# Use case: Fight in the depths

## 1. Purpose

For the player: strike monsters, rivals and other players with the weapon in hand or an Echo Art, so the candidate survives, earns Echo and Renown and finds loot.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Depth | 1 | 1 | Player |
| CMD-01 | Command | Strike | 2 | 1 | – |
| CMD-02 | Command | Cast Echo Bolt | 2 | 2 | – |
| AGG-01 | Aggregate | Tithe | 3 | 3 | – |
| EVT-01 | Event | Blow landed | 4 | 1 | – |
| EVT-02 | Event | Monster slain | 4 | 2 | – |
| EVT-03 | Event | Rival defeated | 4 | 3 | – |
| EVT-04 | Event | Warden slain | 4 | 4 | – |
| EVT-05 | Event | Loot dropped | 4 | 5 | – |
| EVT-06 | Event | Player defeated | 4 | 6 | – |

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
| VIEW-01 Depth | CMD-01 Strike |
| VIEW-01 Depth | CMD-02 Cast Echo Bolt |
| CMD-01 Strike | AGG-01 Tithe |
| CMD-02 Cast Echo Bolt | AGG-01 Tithe |
| AGG-01 Tithe | EVT-01 Blow landed |
| AGG-01 Tithe | EVT-02 Monster slain |
| AGG-01 Tithe | EVT-03 Rival defeated |
| AGG-01 Tithe | EVT-04 Warden slain |
| AGG-01 Tithe | EVT-05 Loot dropped |
| AGG-01 Tithe | EVT-06 Player defeated |

## 5. Data

### CMD-01 Strike (VIEW-01 → AGG-01)

| Field |
|---|
| Weapon |
| Target |

### CMD-02 Cast Echo Bolt (VIEW-01 → AGG-01)

| Field |
|---|
| Target |

### AGG-01 Tithe (CMD-01, CMD-02 → EVT-01, EVT-02, EVT-03, EVT-04, EVT-05, EVT-06)

| Field |
|---|
| Candidates (many) |
| Candidates › Name |
| Candidates › Life |
| Candidates › Stamina |
| Candidates › Focus |
| Candidates › Hostile |
| Monsters (many) |
| Monsters › Kind |
| Monsters › Level |
| Monsters › Life |
| Warden alive |
| Gate open |
| Record |
| Record › Kills |
| Record › Rivals defeated |

## 6. User stories

### US-01: Strike (CMD-01 → EVT-01, EVT-02, EVT-03, EVT-04, EVT-05, EVT-06)

As a player I want to strike with my weapon, so that I kill what stands between me and the bottom.

```gherkin
Scenario: A blow slays a Gnawer
  Given a level 1 Gnawer with 5 life left is next to Kael
  When the player performs CMD-01 "Strike" with the Pickaxe
  Then EVT-01 "Blow landed" is recorded
  And EVT-02 "Monster slain" is recorded

Scenario: Striking a peaceful rival makes her hostile
  Given Vessa Thorne is peaceful and the only candidate near Kael
  When the player performs CMD-01 "Strike"
  Then EVT-01 "Blow landed" is recorded on Vessa Thorne
  And Vessa Thorne is hostile to Kael

Scenario: A party member is never hit
  Given Brann is in Kael's party and stands in Kael's swing
  When the player performs CMD-01 "Strike"
  Then no blow lands on Brann
```

### US-02: Cast Echo Bolt (CMD-02 → EVT-01, EVT-02, EVT-03, EVT-04, EVT-05, EVT-06)

As a player I want to cast an Echo Bolt, so that I can hit from afar with any weapon.

```gherkin
Scenario: No focus, no bolt
  Given Kael has 5 focus
  When the player performs CMD-02 "Cast Echo Bolt"
  Then nothing is recorded
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- Aim is automatic: the nearest monster or hostile NPC rival within reach and in sight; another player or a peaceful NPC rival only when nothing else is near. Party members are never aimed at. A melee weapon hits everything in its arc (blades 80–100°, heavy weapons 140–150°); a bow shoots an arrow. (CMD-01)
- A strike costs stamina and cannot be repeated before the weapon's attack time has passed. Damage is the weapon's damage × (1 + 1.5 % per effective skill level) × (1 + % damage from items). Critical hits – 5 % + 0.5 % per Dexterity above 10 – deal 1.6 times the damage. (CMD-01)
- Every character can cast Echo Bolt, from its hotbar key (Gear, Use the hotbar). It costs 8 focus, flies 8 tiles and trains Echo Arts; its damage grows with the effective Echo Arts. (CMD-02)
- Players may strike players outside their party, never members of their own party; a player without a party can be struck by every other player once the grace is over. A player who is struck down by another player is defeated: the player falls and leaves the Tithe (End the Tithe). (CMD-01, EVT-06)
- A defeated player spills 10–20 % of the gold in the wallet on the floor where the player fell, for anyone to pick up (Market, Keep the wallet), and the one who struck the player down gets a Player kill (Characters, Keep player statistics). (EVT-06)
- A rival that is struck becomes hostile to the player. A defeated rival is dragged back by the Brand and drops gold and perhaps an item. (EVT-03)
- EVT-02 "Monster slain" is recorded for every monster, The Foreman included. Only the player who slays The Foreman opens the gate (Claim the Tithe); if a rival slays him, the rival claims the Tithe (Rivals race). (EVT-02, EVT-04)
- A monster slain by the player drops gold (40 %), an item (12 %, Tunnel Brute 30 %) and a potion or a ration (15 %); The Foreman drops gold, a rare and two magic items. Monsters called by the Mirrormaster or The Foreman drop nothing. A cache drops gold, one or two items and perhaps a supply when the candidate walks into it. (EVT-05)
- The monsters of The Old Mines: the Gnawer (fast, weak, in packs), the Crystal Spitter (spits from afar and keeps its distance), the Tunnel Brute (slow, strong, armoured) and The Foreman (the Warden: a slam around him, calls Gnawers every 14 seconds, never leaves his hall). A monster's level is the depth + half of the player's Marks above 1. (AGG-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Depth | (starting point) | CMD-01, CMD-02 |

**VIEW-01:** A melee swing shows a pale arc; damage numbers rise over the one hit (critical hits in gold, damage to the player in red). Monsters about to attack show their reach in red, and the Foreman's slam a red circle.

## 10. Validation and open questions

### Resolved in version 4

| # | Question | Resolution |
|---|---|---|
| 1 | **Players fighting players:** May players strike players outside their party? | Decided 2026-11-19: yes, players in other parties and players without a party; never members of their own party. |
| 2 | **What a defeated player drops:** Proposal: a player defeated by another player spills 10–20 % of the gold in the wallet on the floor, and the one who struck the player down gets a Player kill, shown in the player statistics. Is it 10–20 % or a fixed 10–20 gold? | Decided 2026-11-19: the defeated player spills 10–20 % of the gold in the wallet on the floor, and the one who struck the player down gets a Player kill, shown in the player statistics. |

### Still open

None.
