```yaml
id: Feature-004
use_case: Spend points
bounded_context: Characters
product: The Maw
source: models/Feature-004-spend-points.drawio
semantics: event-modeling-semantik.md
version: 6
status: draft
created: 2026-11-19
```

# Use case: Spend points

## 1. Purpose

For the player: spend the points from new Marks on attributes and skills, so the player decides what the character becomes.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Character sheet | 1 | 1 | Player |
| CMD-01 | Command | Spend attribute point | 2 | 1 | – |
| CMD-02 | Command | Spend skill point | 2 | 2 | – |
| AGG-01 | Aggregate | Character | 3 | 1 | – |
| EVT-01 | Event | Attribute raised | 4 | 1 | – |
| EVT-02 | Event | Skill raised | 4 | 2 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | Attributes, skills, Echo and Marks, with the points left to spend. Opened with the Character button or C, as a see-through overlay. |
| AGG-01 | A Branded candidate who belongs to a user: who they are and what they have become – attributes, skills, Echo and Marks. |

## 4. Flows

| From | To |
|---|---|
| VIEW-01 Character sheet | CMD-01 Spend attribute point |
| VIEW-01 Character sheet | CMD-02 Spend skill point |
| CMD-01 Spend attribute point | AGG-01 Character |
| CMD-02 Spend skill point | AGG-01 Character |
| AGG-01 Character | EVT-01 Attribute raised |
| AGG-01 Character | EVT-02 Skill raised |

## 5. Data

### CMD-01 Spend attribute point (VIEW-01 → AGG-01)

| Field |
|---|
| Attribute |

### CMD-02 Spend skill point (VIEW-01 → AGG-01)

| Field |
|---|
| Skill |

### AGG-01 Character (CMD-01, CMD-02 → EVT-01, EVT-02)

| Field |
|---|
| Attributes |
| Attributes › Strength |
| Attributes › Dexterity |
| Attributes › Stamina |
| Attributes › Constitution |
| Attributes › Intelligence |
| Skills (many) |
| Skills › Skill |
| Skills › Level |
| Attribute points |
| Skill points |

## 6. User stories

### US-01: Spend attribute point (CMD-01 → EVT-01, EVT-02)

As a player I want to spend an attribute point, so that my character gets stronger where I choose.

```gherkin
Scenario: A point in Dexterity makes Bows better
  Given Kael has Dexterity 10, Bows 1 and 3 attribute points
  When the player performs CMD-01 "Spend attribute point" with Dexterity
  Then EVT-01 "Attribute raised" is recorded with Dexterity 11
  And Kael's effective Bows is 1.05 higher
  And Kael has 2 attribute points

Scenario: No points left
  Given Kael has no attribute points
  When the player opens VIEW-01 "Character sheet"
  Then no + button is shown by the attributes
```

### US-02: Spend skill point (CMD-02 → EVT-01, EVT-02)

As a player I want to spend a skill point, so that a skill I rely on gets better faster than use alone would make it.

```gherkin
Scenario: A skill point gives two levels
  Given Kael is Mark 2 with Heavy Weapons 15 and 2 skill points
  When the player performs CMD-02 "Spend skill point" with Heavy Weapons
  Then EVT-02 "Skill raised" is recorded with Heavy Weapons 17
  And Kael has 1 skill point
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- One attribute point raises an attribute by 1. One skill point raises a skill by 2 levels, at most to the Mark's cap of 10 + 5 × Mark (Learn by use). Points can only be spent while there are some left, and they never expire. (CMD-01, CMD-02)
- Skills get a bonus from attributes: the effective skill is the level + the bonus from items + 1.5 × weight × (attribute − 10) for each of the skill's attributes. Weights: Blades Dexterity 70 % and Strength 30 %; Heavy Weapons Strength 80 % and Constitution 20 %; Bows Dexterity 70 % and Strength 30 %; Echo Arts Intelligence 80 % and Stamina 20 %. (AGG-01)
- Attributes also give: Strength one more place in the pack for every 2 points above 10; Dexterity +0.5 % critical chance per point; Stamina +5 stamina, faster stamina recovery and 2 % slower hunger per point; Constitution +6 life per point; Intelligence +4 focus for Echo Bolts and faster learning (Learn by use). (AGG-01)
- The sheet never pauses a Tithe: it is a see-through overlay, and the Tithe goes on behind it. (VIEW-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Character sheet | (starting point) | CMD-01, CMD-02 |

**VIEW-01:** Opened with the Character button (mouse or touch) or C, in the Rim and during a Tithe. It lies as a see-through overlay over the game, so the player can see what happens behind it. It has three tabs – Character, Equipment and Spells – and opens on the tab last used. Character shows the Mark and the Echo to the next one; the five attributes with the bonus from items; the skills – the four weapon and Echo skills, the background's talent and Reveal – with level, progress to the next level, effective level and which attributes give them a bonus; and the combat values that follow. A + button stands by each attribute and skill while there are points left. Equipment shows what the character wears and carries, with its stats (Gear, Manage equipment), and Spells the spellbook (Read the spellbook); both have the hotbar at the top (Gear, Assign hotbar keys).

## 10. Validation and open questions

### Resolved in version 6

| # | Question | Resolution |
|---|---|---|
| 1 | **Pausing in multiplayer:** Nobody can pause a shared Tithe. What does the character sheet do during a Tithe? | Decided 2026-11-19: the sheet opens with a Character button as a see-through overlay, and the Tithe goes on behind it. |

### Still open

None.
