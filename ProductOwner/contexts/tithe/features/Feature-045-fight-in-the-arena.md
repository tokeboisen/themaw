```yaml
id: Feature-045
use_case: Fight in the arena
bounded_context: Tithe
product: The Maw
source: models/Feature-045-fight-in-the-arena.drawio
semantics: event-modeling-semantik.md
version: 1
status: draft
created: 2026-11-20
```

# Use case: Fight in the arena

## 1. Purpose

For the players: fight other players in an oval arena with rocks, trees and bushes to hide in, side against side, until one side is down – a short, fair test of skill and build where only the stake is won or lost.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01, VIEW-02 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| EVT-01 | Event | Arena match started | 1 | 1 | – |
| SVC-01 | Application Service | Arena master | 2 | 1 | – |
| CMD-01 | Command | Open the arena | 3 | 1 | – |
| AGG-01 | Aggregate | Arena | 4 | 1 | – |
| EVT-02 | Event | Arena opened | 5 | 1 | – |
| VIEW-01 | UI View | Arena | 6 | 1 | Player |
| CMD-02 | Command | Strike an opponent | 7 | 1 | – |
| AGG-02 | Aggregate | Arena | 8 | 1 | – |
| EVT-03 | Event | Fighter down | 9 | 1 | – |
| EVT-04 | Event | Arena match ended | 9 | 2 | – |
| VIEW-02 | UI View | Arena result | 10 | 1 | Player |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| EVT-01 | Feature-044 Arrange an arena match | EVT-03 Arena match started |

### Descriptions

| ID | Description |
|---|---|
| SVC-01 | Opens the arena when an arena match starts and ends the match when one side is down. |
| AGG-01 | One arena match as it is fought: the oval with its obstacles, the fighters on each side, the closing ring and the clock. |
| VIEW-01 | The arena seen from above with the fighters, the ring and the clock. |
| AGG-02 | One arena match as it is fought: the oval with its obstacles, the fighters on each side, the closing ring and the clock. |
| VIEW-02 | The end of an arena match for the player. |

## 4. Flows

| From | To |
|---|---|
| EVT-01 Arena match started | SVC-01 Arena master |
| SVC-01 Arena master | CMD-01 Open the arena |
| CMD-01 Open the arena | AGG-01 Arena |
| AGG-01 Arena | EVT-02 Arena opened |
| EVT-02 Arena opened | VIEW-01 Arena |
| VIEW-01 Arena | CMD-02 Strike an opponent |
| CMD-02 Strike an opponent | AGG-02 Arena |
| AGG-02 Arena | EVT-03 Fighter down |
| AGG-02 Arena | EVT-04 Arena match ended |
| EVT-04 Arena match ended | VIEW-02 Arena result |

## 5. Data

### CMD-01 Open the arena (SVC-01 → AGG-01)

| Field |
|---|
| Fighters (many) |
| Fighters › Player |
| Fighters › Character |
| Fighters › Side |
| Stake |

### AGG-01 Arena (CMD-01 → EVT-02)

| Field |
|---|
| Layout |
| Fighters (many) |
| Fighters › Name |
| Fighters › Side |
| Fighters › Life |
| Fighters › Down |
| Ring |
| Clock |

### CMD-02 Strike an opponent (VIEW-01 → AGG-02)

| Field |
|---|
| Weapon or Echo Art |

### AGG-02 Arena (CMD-02 → EVT-03, EVT-04)

| Field |
|---|
| Fighters (many) |
| Fighters › Life |
| Fighters › Down |

## 6. User stories

### US-01: Strike an opponent (CMD-02 → EVT-03, EVT-04)

As a player I want to strike the other side with my weapons and Echo Arts, so that my side wins the match.

```gherkin
Scenario: Teammates do not hurt each other
  Given Kael and Mira are on Side 1
  When the player performs CMD-02 "Strike an opponent" and the blow reaches Mira
  Then Mira takes no damage

Scenario: Nothing but the stake
  Given Kael drinks a potion and slays Brann in the arena
  When EVT-04 "Arena match ended" is recorded
  Then Kael has the same potions, skills and Echo as before the match
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| SVC-01 Arena master | EVT-01 | CMD-01 | EVT-02 |

### Rules

- The arena is an oval of sand, 36 × 24 tiles, ringed by the stands. Rocks, trees and bushes are laid out the same on both halves. Rocks and trees block both fighters and missiles; bushes block neither. (AGG-01)
- A fighter standing in a bush is hidden from the other side unless one of them is within 2 tiles, or the fighter has struck in the last 1.5 seconds. A fighter's own side always sees it. (AGG-01)
- Each side starts at its end of the oval. The fighters of a side are a party: they never hurt each other. For the first 5 seconds no one can be hurt. (CMD-01)
- The fighters fight as in a Tithe (Fight in the depths) with their own characters, gear, hotbar, potions and rations. Nothing from the match is kept: no Echo, no skill training, no loot, used potions and rations come back, nothing can be dropped, and hunger does not drain. (CMD-02)
- After 2 minutes the ring closes in from the stands; at 3½ minutes only the middle quarter is left. Outside the ring a fighter loses 8 % of max life every second. (AGG-02)
- The match ends when one side has no fighter standing; the other side wins. If both sides fall at the same time, or the match reaches 4 minutes, it is a draw. Leaving the arena, or losing the connection for 60 seconds, counts as down (Leave the Tithe). (EVT-04)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Arena | EVT-02 | CMD-02 |
| VIEW-02 | Arena result | EVT-04 | – |

**VIEW-01:** The arena is drawn like a depth – sand, rocks, trees and bushes, ringed by the stands – with the fighters' names and life over them, Side 1 in blue and Side 2 in red. The HUD is the Tithe's, with the time left and, when it closes, the ring drawn as a glowing line. A countdown "3 – 2 – 1 – Fight!" opens the match. A fighter who is down watches the rest of the match.

**VIEW-02:** Shown 2.5 seconds after the end: Victory, Defeat or Draw, the fighters of both sides, the stake and the gold the player won or lost, with "Return to the Rim".

```gherkin
Scenario: Brann goes down
  Given Kael and Brann fight a 1:1 match with a stake of 50
  When Kael's blow takes Brann's last life
  Then EVT-03 "Fighter down" is recorded
  And EVT-04 "Arena match ended" is recorded with Side 1 as the winner

Scenario: Hiding in a bush
  Given Brann stands in a bush 5 tiles from Kael and has not struck for 2 seconds
  When the player opens VIEW-01 "Arena"
  Then Kael does not see Brann

Scenario: The ring closes
  Given the match has lasted 3 minutes and Kael stands by the stands
  When a second passes
  Then Kael loses 8 % of max life
```

## 10. Validation and open questions

### Resolved in version 1

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
