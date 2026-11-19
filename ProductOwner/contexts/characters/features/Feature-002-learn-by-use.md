```yaml
id: Feature-002
use_case: Learn by use
bounded_context: Characters
product: The Maw
source: models/Feature-002-learn-by-use.drawio
semantics: event-modeling-semantik.md
version: 2
status: draft
created: 2026-11-19
```

# Use case: Learn by use

## 1. Purpose

For the player: every blow that lands makes the skill that dealt it better, so the character grows into what the player actually does instead of a class picked up front.

## 2. Actors

| Actor | UI Views |
|---|---|
| – | – |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| EVT-01 | Event | Blow landed | 1 | 1 | – |
| EVT-02 | Event | Monster slain | 1 | 2 | – |
| EVT-03 | Event | Rival defeated | 1 | 3 | – |
| EVT-06 | Event | Player defeated | 1 | 4 | – |
| SVC-01 | Application Service | Skill trainer | 2 | 2 | – |
| CMD-01 | Command | Train skill | 3 | 2 | – |
| AGG-01 | Aggregate | Character | 4 | 2 | – |
| EVT-04 | Event | Skill trained | 5 | 1 | – |
| EVT-05 | Event | Skill level gained | 5 | 2 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| EVT-01 | Feature-011 Fight in the depths | EVT-01 Blow landed |
| EVT-02 | Feature-011 Fight in the depths | EVT-02 Monster slain |
| EVT-03 | Feature-011 Fight in the depths | EVT-03 Rival defeated |
| EVT-06 | Feature-011 Fight in the depths | EVT-06 Player defeated |

### Descriptions

| ID | Description |
|---|---|
| SVC-01 | Turns every blow that lands into experience for the skill that dealt it. |
| AGG-01 | A Branded candidate who belongs to a user: who they are and what they have become – attributes, skills, Echo and Marks. |

## 4. Flows

| From | To |
|---|---|
| EVT-01 Blow landed | SVC-01 Skill trainer |
| EVT-02 Monster slain | SVC-01 Skill trainer |
| EVT-03 Rival defeated | SVC-01 Skill trainer |
| EVT-06 Player defeated | SVC-01 Skill trainer |
| SVC-01 Skill trainer | CMD-01 Train skill |
| CMD-01 Train skill | AGG-01 Character |
| AGG-01 Character | EVT-04 Skill trained |
| AGG-01 Character | EVT-05 Skill level gained |

## 5. Data

### CMD-01 Train skill (SVC-01 → AGG-01)

| Field |
|---|
| Skill |
| Experience |

### AGG-01 Character (CMD-01 → EVT-04, EVT-05)

| Field |
|---|
| Skills (many) |
| Skills › Skill |
| Skills › Level |
| Skills › Experience |

## 6. User stories

No user stories.

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| SVC-01 Skill trainer | EVT-01, EVT-02, EVT-03, EVT-06 | CMD-01 | EVT-04, EVT-05 |

### Rules

- A blow that lands trains the skill of the weapon that dealt it – Blades, Heavy Weapons or Bows (unarmed counts as Blades) – and an Echo Bolt trains Echo Arts. A blow that misses or is dodged trains nothing. (SVC-01)
- A blow gives 1 experience, and the killing blow 3 more. A swing that hits several enemies trains at most 3 of the hits. (SVC-01, CMD-01)
- Challenge: the experience is multiplied by the enemy's level divided by the character's Mark, kept between 0.25 and 1.5, so weak enemies teach little and strong ones more. (CMD-01)
- Intelligence speeds up learning: +2 % experience for each point of Intelligence above 10, items included. (AGG-01)
- A skill needs 4 + 0.8 × its level in experience to go up one level, so later levels need more use. Skills stop at 100. Experience above the threshold carries on. (AGG-01)
- The effective skill used in combat is the level plus the bonus from its attributes and items (Spend points). Each effective level gives 1.5 % more damage and 0.4 % shorter attack time, at most 35 % shorter. (EVT-05)
- Blows on other players train like blows on NPC rivals; the challenge uses the other player's Mark. (SVC-01)

```gherkin
Scenario: A blow raises the weapon's skill
  Given Kael is Mark 1 with Heavy Weapons 10 and 11.5 of the 12 experience to level 11
  When EVT-01 "Blow landed" has been recorded for Kael's Pickaxe on a level 1 Gnawer
  Then SVC-01 "Skill trainer" performs CMD-01 "Train skill" with Heavy Weapons and 1 experience
  And EVT-04 "Skill trained" is recorded
  And EVT-05 "Skill level gained" is recorded with Heavy Weapons 11

Scenario: Weak enemies teach little
  Given Kael is Mark 4
  When EVT-01 "Blow landed" has been recorded for Kael's Pickaxe on a level 1 Gnawer
  Then SVC-01 "Skill trainer" performs CMD-01 "Train skill" with Heavy Weapons and 0.25 experience
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

### Resolved in version 2

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
