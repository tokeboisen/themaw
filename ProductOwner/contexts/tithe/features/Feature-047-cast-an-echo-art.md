```yaml
id: Feature-047
use_case: Cast an Echo Art
bounded_context: Tithe
product: The Maw
source: models/Feature-047-cast-an-echo-art.drawio
semantics: event-modeling-semantik.md
version: 1
status: draft
created: 2026-11-21
```

# Use case: Cast an Echo Art

## 1. Purpose

For the player: fight with the Echo – the Maw's resonance that the Branded learn to shape in their minds – by casting the Echo Art chosen on the hotbar: arts that strike, shield, hold monsters, move the caster or make the party stronger, so a Branded who trains Echo Arts has more to do than throw a bolt.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Depth | 1 | 1 | Player |
| CMD-01 | Command | Cast an Echo Art | 2 | 1 | – |
| AGG-01 | Aggregate | Tithe | 3 | 1 | – |
| EVT-01 | Event | Echo Art cast | 4 | 1 | – |

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
| VIEW-01 Depth | CMD-01 Cast an Echo Art |
| CMD-01 Cast an Echo Art | AGG-01 Tithe |
| AGG-01 Tithe | EVT-01 Echo Art cast |

## 5. Data

### CMD-01 Cast an Echo Art (VIEW-01 → AGG-01)

| Field |
|---|
| Echo Art |
| Aim |

### AGG-01 Tithe (CMD-01 → EVT-01)

| Field |
|---|
| Candidates (many) |
| Candidates › Focus |
| Candidates › Cooldowns |
| Candidates › Effects |
| Monsters (many) |
| Monsters › Held, rooted, stunned or slowed |
| Monsters › Marked |
| Areas on the floor (many) |
| Areas on the floor › Flames, echoes or mirror images |

## 6. User stories

### US-01: Cast an Echo Art (CMD-01 → EVT-01)

As a player I want to cast the Echo Art chosen on my hotbar, so that I fight with the Echo – alone or for my party.

```gherkin
Scenario: Kael casts Shatterpulse
  Given Kael knows Shatterpulse, has 20 focus and three Gnawers stand together 5 tiles away
  When the player performs CMD-01 "Cast an Echo Art" with Shatterpulse
  Then EVT-01 "Echo Art cast" is recorded
  And the three Gnawers take damage
  And Kael has 6 focus left

Scenario: Not enough focus
  Given Kael has 5 focus and Shatterpulse is chosen
  When the player performs CMD-01 "Cast an Echo Art" with Shatterpulse
  Then nothing is recorded
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- An Echo Art is cast with Attack (Space) when its key is chosen on the hotbar (Gear, Use the hotbar) and the character knows it (Characters, Read the spellbook). It costs focus and then waits for its cooldown; without enough focus, or before the cooldown is over, nothing happens. An art aimed at a spot aims at the nearest enemy in range, otherwise at a spot 4 tiles straight ahead. Echo Chain, Last Words and The Maw Remembers need a target and are not cast without one. Echo Bolt is cast as Fight in the depths describes. (CMD-01)
- Damage from an Echo Art grows with the Echo Arts skill as Echo Bolt's does, and it trains Echo Arts. Party arts reach the caster and the party members within 6 tiles – in the arena the caster's side; alone, the caster gets them. Control arts work on monsters only. A slowed monster is 40 % slower; a rooted one cannot move but can still strike; a stunned one can do neither. (AGG-01)
- Level 1. Echo Bolt (8 focus, 0.55 s): as Fight in the depths describes. Ringing Ward (10 focus, 8 s): for 4 seconds the next blow on the caster loses 75 % of its damage. Hollow Call (8 focus, 10 s): the monsters within 6 tiles of a spot up to 7 tiles away walk to it for 3 seconds. Shared Breath (8 focus, 12 s, party): 15 stamina back. (AGG-01)
- Level 2. Crystal Cage (12 focus, 10 s): the monsters within 2 tiles of a spot up to 7 tiles away are rooted for 3 seconds. Step Through the Echo (10 focus, 6 s): the caster steps up to 4 tiles ahead, stopped by walls. Rally Toll (12 focus, 20 s, party): 15 % more damage for 10 seconds. (AGG-01)
- Level 3. Shatterpulse (14 focus, 3 s): 10–16 damage within 2 tiles of a spot up to 7 tiles away. Mirror Double (14 focus, 14 s): a mirror image 2 tiles ahead draws the monsters within 8 tiles for 5 seconds. Hearth Echo (14 focus, 18 s, party): heals 20 % of max life over 5 seconds. (AGG-01)
- Level 4. Hunger of the Maw (16 focus, 4 s): 8–12 damage in a cone 3 tiles long and 90° wide; the caster heals 30 % of the damage. Resonant Line (16 focus, 3.5 s): a tone that flies 8 tiles and deals 12–18 damage to every enemy it passes. Chorus of the Branded (16 focus, 20 s, party): attacks 20 % faster for 8 seconds. (AGG-01)
- Level 5. Toll of Stillness (18 focus, 12 s): the monsters within 3 tiles are stunned for 1.5 seconds, a Warden for 0.5. Cinder Echo (18 focus, 12 s): for 6 seconds the caster leaves flames behind that burn for 2 seconds and deal 8 damage a second. Crystal Mantle (18 focus, 24 s, party): 8 more armour for 15 seconds. (AGG-01)
- Level 6. Echo Chain (22 focus, 5 s): 14–22 damage to the nearest enemy within 7 tiles, jumping on to up to 3 more, each within 4 tiles of the last. Last Words (20 focus, 8 s): marks a monster within 7 tiles for 10 seconds; when it dies it bursts for 20–30 damage within 2.5 tiles. Brand's Refusal (22 focus, 60 s, party): for 60 seconds the next killing blow on each of them leaves 1 life instead. (AGG-01)
- Level 7. Mirror Storm (26 focus, 30 s): three mirror images strike with the caster for 6 seconds – 150 % more damage. The Maw Remembers (26 focus, 30 s): the monsters the caster slew in the last 5 seconds rise as echoes for 8 seconds; each draws the monsters within 4 tiles and deals 10 damage a second within 1.6 tiles. Echo of Courage (24 focus, 30 s, party): no slowing or stunning, and 10 % more damage, for 8 seconds. (AGG-01)
- Level 8. Shatter the Depth (30 focus, 10 s): 22–34 damage within 4 tiles of the caster, and those hit are slowed for 3 seconds. Unmaking Note (30 focus, 8 s): a note that flies 8 tiles and deals 45–65 damage to the first enemy it hits, double to an armoured one. Kindled Brands (30 focus, 40 s, party): heals 35 % of max life and gives back half of max focus. (AGG-01)
- Level 9. The Maw Holds Its Breath (36 focus, 60 s): every monster in the area stops for 3 seconds, a Warden for 1. Requiem of the Tithed (36 focus, 25 s): 40–60 damage within 6 tiles of the caster. Crown of Echoes (36 focus, 60 s, party within 8 tiles): 25 % more damage, 25 % faster on the feet and 2 % of max life back every second for 12 seconds; the crowd gives the caster 50 Renown. (AGG-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Depth | (starting point) | CMD-01 |

**VIEW-01:** The chosen Echo Art is cast with Attack (Space). Areas burst in the Echo's pale light, flames, echoes and mirror images stand on the floor while they last, and a party art lights up everyone it reaches. The hotbar shows the cooldown left on each art's key, and the HUD shows the effects on the player (Warded, Rallied, Quickened, Mantled, Refused, Mirrored, Courageous, Crowned).

```gherkin
Scenario: Hearth Echo heals the party
  Given Kael and Jory are a party 3 tiles apart, and both are wounded
  When the player performs CMD-01 "Cast an Echo Art" with Hearth Echo
  Then EVT-01 "Echo Art cast" is recorded
  And Kael and Jory heal 20 % of max life over 5 seconds

Scenario: Brand's Refusal
  Given Kael cast Brand's Refusal with Jory 2 tiles away
  When a blow would kill Jory
  Then Jory is left with 1 life
```

## 10. Validation and open questions

### Resolved in version 1

| # | Question | Resolution |
|---|---|---|
| 1 | **Echo Arts:** Which Echo Arts should there be besides Echo Bolt? | Decided 2026-11-21: 28 arts on 9 levels in the spirit of the game – the Echo, the Brand, the Tithed and the Mirrormaster's mirrors – inspired by, but not taken from, tabletop games, with party arts that make the players nearby stronger. |

### Still open

None.
