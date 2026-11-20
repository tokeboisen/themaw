```yaml
id: Feature-017
use_case: Run the show
bounded_context: Spectacle
product: The Maw
source: models/Feature-017-run-the-show.drawio
semantics: event-modeling-semantik.md
version: 4
status: draft
created: 2026-11-19
```

# Use case: Run the show

## 1. Purpose

For the player: the Mirrormaster and the crowd react to everything the candidates do – Renown, sponsor gifts, beasts and sealed depths – so the Tithe is a show that pushes the candidates deeper.

## 2. Actors

| Actor | UI Views |
|---|---|
| – | – |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| EVT-01 | Event | Tithe started | 1 | 1 | – |
| EVT-02 | Event | Depth reached | 1 | 2 | – |
| EVT-03 | Event | Blow landed | 1 | 3 | – |
| EVT-04 | Event | Monster slain | 1 | 4 | – |
| EVT-05 | Event | Rival defeated | 1 | 5 | – |
| EVT-06 | Event | Warden slain | 1 | 6 | – |
| EVT-12 | Event | Player defeated | 1 | 7 | – |
| SVC-01 | Application Service | Mirrormaster | 2 | 3 | – |
| CMD-01 | Command | Award Renown | 3 | 1 | – |
| CMD-02 | Command | Drop sponsor gift | 3 | 2 | – |
| CMD-03 | Command | Release beasts | 3 | 3 | – |
| CMD-04 | Command | Seal depth | 3 | 4 | – |
| AGG-01 | Aggregate | Show | 4 | 3 | – |
| EVT-07 | Event | Renown earned | 5 | 1 | – |
| EVT-08 | Event | Sponsor gift dropped | 5 | 2 | – |
| EVT-09 | Event | Beasts released | 5 | 3 | – |
| EVT-10 | Event | Depth sealing announced | 5 | 4 | – |
| EVT-11 | Event | Depth sealed | 5 | 5 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| EVT-01 | Feature-010 Enter the Tithe | EVT-02 Tithe started |
| EVT-02 | Feature-012 Descend | EVT-01 Depth reached |
| EVT-03 | Feature-011 Fight in the depths | EVT-01 Blow landed |
| EVT-04 | Feature-011 Fight in the depths | EVT-02 Monster slain |
| EVT-05 | Feature-011 Fight in the depths | EVT-03 Rival defeated |
| EVT-06 | Feature-011 Fight in the depths | EVT-04 Warden slain |
| EVT-12 | Feature-011 Fight in the depths | EVT-06 Player defeated |

### Descriptions

| ID | Description |
|---|---|
| SVC-01 | Mirrormaster Lucan Ilveth, who runs the show: he speaks to the candidates, rewards the crowd's favourites and punishes the dull. |
| AGG-01 | The Tithe as the crowd sees it: Renown, kill streaks, sponsor gifts, boredom and the seals of the depths. |

## 4. Flows

| From | To |
|---|---|
| EVT-01 Tithe started | SVC-01 Mirrormaster |
| EVT-02 Depth reached | SVC-01 Mirrormaster |
| EVT-03 Blow landed | SVC-01 Mirrormaster |
| EVT-04 Monster slain | SVC-01 Mirrormaster |
| EVT-05 Rival defeated | SVC-01 Mirrormaster |
| EVT-06 Warden slain | SVC-01 Mirrormaster |
| SVC-01 Mirrormaster | CMD-01 Award Renown |
| SVC-01 Mirrormaster | CMD-02 Drop sponsor gift |
| SVC-01 Mirrormaster | CMD-03 Release beasts |
| SVC-01 Mirrormaster | CMD-04 Seal depth |
| CMD-01 Award Renown | AGG-01 Show |
| CMD-02 Drop sponsor gift | AGG-01 Show |
| CMD-03 Release beasts | AGG-01 Show |
| CMD-04 Seal depth | AGG-01 Show |
| AGG-01 Show | EVT-07 Renown earned |
| AGG-01 Show | EVT-08 Sponsor gift dropped |
| AGG-01 Show | EVT-09 Beasts released |
| AGG-01 Show | EVT-10 Depth sealing announced |
| AGG-01 Show | EVT-11 Depth sealed |
| EVT-12 Player defeated | SVC-01 Mirrormaster |

## 5. Data

### CMD-01 Award Renown (SVC-01 → AGG-01)

| Field |
|---|
| Renown |

### CMD-02 Drop sponsor gift (SVC-01 → AGG-01)

| Field |
|---|
| House |
| Gift |

### CMD-03 Release beasts (SVC-01 → AGG-01)

| Field |
|---|
| Beasts |

### CMD-04 Seal depth (SVC-01 → AGG-01)

| Field |
|---|
| Depth |

### AGG-01 Show (CMD-01, CMD-02, CMD-03, CMD-04 → EVT-07, EVT-08, EVT-09, EVT-10, EVT-11)

| Field |
|---|
| Tithe |
| Renown |
| Kill streak |
| Kill streak › Kills |
| Kill streak › Window |
| Last sponsor gift |
| Last blow |
| Depth seals (many) |
| Depth seals › Depth |
| Depth seals › Seals at |
| Depth seals › Warned |
| Depth seals › Sealed |

## 6. User stories

No user stories.

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| SVC-01 Mirrormaster | EVT-01, EVT-02, EVT-03, EVT-04, EVT-05, EVT-06, EVT-12 | CMD-01, CMD-02, CMD-03, CMD-04 | EVT-07, EVT-08, EVT-09, EVT-10, EVT-11 |

### Rules

- Renown: 2 × level for each monster the player slays, 60 for each NPC rival or player the player defeats, 150 for The Foreman, 20 for each new depth and 15 for each sponsor gift. (CMD-01)
- Three kills by the player within 8 seconds, at most every 30 seconds, make a Noble House – House Morrow, House Vane, House Ashgrave or House Lisle – drop a gift by the player: a magic item (30 %), a potion (25 %), a ration (20 %) or gold (25 %). Kills of monsters called by the Mirrormaster or The Foreman do not count. (CMD-02)
- After 40 seconds without the player dealing damage, the crowd is bored and the Mirrormaster releases 4 Gnawers 6–11 tiles from the player. They drop nothing. (CMD-03)
- Depth 1 is sealed 240 seconds after the Tithe starts and depth 2 after 480 seconds; the last depth is never sealed. A candidate who enters a depth with less than 90 seconds left gets 90 seconds. In The Broken City the districts are sealed from the outside in: the outer ring after 8 minutes, the second after 14 and the third after 20; the foundry is never sealed. The Mirrormaster announces the seal 30 seconds before, and the HUD shows the time left. (CMD-04, EVT-10)
- The Mirrormaster speaks to the whole Tithe in the message log: at the start, about the grace, before and at a seal, when he is bored, about sponsor gifts, when rivals reach a depth or fall, when The Foreman wakes and dies, and when the Tithe has a Champion. (SVC-01)

```gherkin
Scenario: A kill streak brings a sponsor gift
  Given Kael has slain two Gnawers within the last 5 seconds and no gift has fallen for 30 seconds
  When EVT-04 "Monster slain" has been recorded for Kael's third Gnawer
  Then SVC-01 "Mirrormaster" performs CMD-02 "Drop sponsor gift"
  And EVT-08 "Sponsor gift dropped" is recorded next to Kael
  And EVT-07 "Renown earned" is recorded with 15 Renown

Scenario: A bored crowd gets beasts
  Given the last EVT-03 "Blow landed" by Kael was 40 seconds ago
  When SVC-01 "Mirrormaster" reacts
  Then CMD-03 "Release beasts" is performed with 4 Gnawers
  And EVT-09 "Beasts released" is recorded

Scenario: Depth 1 is sealed
  Given EVT-01 "Tithe started" was recorded 210 seconds ago
  When SVC-01 "Mirrormaster" reacts
  Then EVT-10 "Depth sealing announced" is recorded for depth 1 in 30 seconds
  And EVT-11 "Depth sealed" is recorded for depth 1 after 240 seconds
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

### Resolved in version 4

| # | Question | Resolution |
|---|---|---|
| 1 | **The length of The Broken City:** How long should The Broken City take? | Decided 2026-11-20: twice as long as at first: the districts are sealed after 8, 14 and 20 minutes. |

### Still open

None.
