```yaml
id: Feature-003
use_case: Earn Marks
bounded_context: Characters
product: The Maw
source: models/Feature-003-earn-marks.drawio
semantics: event-modeling-semantik.md
version: 2
status: draft
created: 2026-11-19
```

# Use case: Earn Marks

## 1. Purpose

For the player: the Echo of slain monsters and defeated rivals and players gathers in the Brand, and when enough has gathered a new Mark burns in and gives points to spend, so fighting makes the character stronger.

## 2. Actors

| Actor | UI Views |
|---|---|
| – | – |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| EVT-01 | Event | Monster slain | 1 | 1 | – |
| EVT-02 | Event | Rival defeated | 1 | 2 | – |
| EVT-05 | Event | Player defeated | 1 | 3 | – |
| SVC-01 | Application Service | Echo keeper | 2 | 1 | – |
| CMD-01 | Command | Gain Echo | 3 | 1 | – |
| AGG-01 | Aggregate | Character | 4 | 1 | – |
| EVT-03 | Event | Echo gained | 5 | 1 | – |
| EVT-04 | Event | Mark earned | 5 | 2 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| EVT-01 | Feature-011 Fight in the depths | EVT-02 Monster slain |
| EVT-02 | Feature-011 Fight in the depths | EVT-03 Rival defeated |
| EVT-05 | Feature-011 Fight in the depths | EVT-06 Player defeated |

### Descriptions

| ID | Description |
|---|---|
| SVC-01 | Gathers the Echo of slain monsters and defeated rivals and burns a new Mark into the Brand when enough has gathered. |
| AGG-01 | A Branded candidate who belongs to a user: who they are and what they have become – attributes, skills, Echo and Marks. |

## 4. Flows

| From | To |
|---|---|
| EVT-01 Monster slain | SVC-01 Echo keeper |
| EVT-02 Rival defeated | SVC-01 Echo keeper |
| EVT-05 Player defeated | SVC-01 Echo keeper |
| SVC-01 Echo keeper | CMD-01 Gain Echo |
| CMD-01 Gain Echo | AGG-01 Character |
| AGG-01 Character | EVT-03 Echo gained |
| AGG-01 Character | EVT-04 Mark earned |

## 5. Data

### CMD-01 Gain Echo (SVC-01 → AGG-01)

| Field |
|---|
| Echo |

### AGG-01 Character (CMD-01 → EVT-03, EVT-04)

| Field |
|---|
| Mark |
| Echo |
| Attribute points |
| Skill points |

## 6. User stories

No user stories.

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| SVC-01 Echo keeper | EVT-01, EVT-02, EVT-05 | CMD-01 | EVT-03, EVT-04 |

### Rules

- Only the candidate who dealt the killing blow gains the Echo. A monster gives its Echo × its level (Gnawer 3, Crystal Spitter 6, Tunnel Brute 9, The Foreman 120), a defeated NPC rival 12 × the rival's level and a defeated player 12 × the player's Mark. Items with "% Echo gained" add to it. (SVC-01)
- The next Mark needs 20 × Mark^1.5 Echo (Mark 1 to 2: 20, Mark 2 to 3: 57). Echo above the threshold carries on. (AGG-01)
- Each Mark gives 3 attribute points, 2 skill points and 4 more life. The points are spent on the character sheet (Spend points), also during a Tithe. (EVT-04)

```gherkin
Scenario: A Mark burns in
  Given Kael is Mark 1 with 15 Echo
  When EVT-01 "Monster slain" has been recorded for a level 2 Gnawer slain by Kael
  Then SVC-01 "Echo keeper" performs CMD-01 "Gain Echo" with 6 Echo
  And EVT-04 "Mark earned" is recorded with Mark 2
  And Kael has 1 Echo, 3 attribute points and 2 skill points
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
