```yaml
id: Feature-016
use_case: End the Tithe
bounded_context: Tithe
product: The Maw
source: models/Feature-016-end-the-tithe.drawio
semantics: event-modeling-semantik.md
version: 2
status: draft
created: 2026-11-19
```

# Use case: End the Tithe

## 1. Purpose

For the player: the player's part of the Tithe ends when it has a Champion or the player falls or leaves, and the results show what the Tithe brought, so the player can see the progress and go again.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| EVT-01 | Event | Tithe claimed | 1 | 1 | – |
| EVT-02 | Event | Rival claimed the Tithe | 1 | 2 | – |
| EVT-03 | Event | Player fell | 1 | 3 | – |
| EVT-05 | Event | Player defeated | 1 | 4 | – |
| EVT-06 | Event | Player left | 1 | 5 | – |
| SVC-01 | Application Service | Tithe referee | 2 | 3 | – |
| CMD-01 | Command | End the Tithe | 3 | 3 | – |
| AGG-01 | Aggregate | Tithe | 4 | 3 | – |
| EVT-04 | Event | Tithe ended | 5 | 3 | – |
| VIEW-01 | UI View | Tithe results | 6 | 3 | Player |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| EVT-01 | Feature-015 Claim the Tithe | EVT-01 Tithe claimed |
| EVT-02 | Feature-014 Rivals race | EVT-06 Rival claimed the Tithe |
| EVT-03 | Feature-013 Survive the depths | EVT-10 Player fell |
| EVT-05 | Feature-011 Fight in the depths | EVT-06 Player defeated |
| EVT-06 | Feature-029 Leave the Tithe | EVT-01 Player left |

### Descriptions

| ID | Description |
|---|---|
| SVC-01 | Ends the Tithe when it has a Champion or the player has fallen. |
| AGG-01 | One run into the Maw: its seed and depths, its candidates (the player and the rivals), the monsters, the Warden and the outcome. |

## 4. Flows

| From | To |
|---|---|
| EVT-01 Tithe claimed | SVC-01 Tithe referee |
| EVT-02 Rival claimed the Tithe | SVC-01 Tithe referee |
| EVT-03 Player fell | SVC-01 Tithe referee |
| EVT-05 Player defeated | SVC-01 Tithe referee |
| EVT-06 Player left | SVC-01 Tithe referee |
| SVC-01 Tithe referee | CMD-01 End the Tithe |
| CMD-01 End the Tithe | AGG-01 Tithe |
| AGG-01 Tithe | EVT-04 Tithe ended |
| EVT-04 Tithe ended | VIEW-01 Tithe results |

## 5. Data

### CMD-01 End the Tithe (SVC-01 → AGG-01)

| Field |
|---|
| Player |
| Outcome |

### AGG-01 Tithe (CMD-01 → EVT-04)

| Field |
|---|
| Outcome |
| Outcome › Kind |
| Outcome › Champions |
| Record (many) |
| Record › Player |
| Record › Time |
| Record › Deepest depth |
| Record › Kills |
| Record › Rivals defeated |
| Record › Players defeated |
| Record › Warden slain |

## 6. User stories

No user stories.

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| SVC-01 Tithe referee | EVT-01, EVT-02, EVT-03, EVT-05, EVT-06 | CMD-01 | EVT-04 |

### Rules

- EVT-04 "Tithe ended" is recorded for each player when the player's part of the Tithe ends: the player falls (also when defeated by another player), leaves, or the Tithe gets a Champion – the player's party, another party or an NPC rival. Leaving counts as a fall. When someone else is Champion, the Brand drags the player back without a fall. (SVC-01, CMD-01)
- The Tithe closes when it has a Champion or no player is left in it. (AGG-01)
- The character is saved when the Tithe ends: skills, Marks and points from the Tithe are always kept, and what was found is settled (Gear, Settle found gear). (EVT-04)
- EVT-04 "Tithe ended" also pays the Crown's Purse and grants sponsor gifts (Patronage) and restocks the Forge (Market). (EVT-04)

```gherkin
Scenario: A fall ends the player's Tithe
  Given Kael is in depth 2
  When EVT-03 "Player fell" has been recorded for Kael
  Then SVC-01 "Tithe referee" performs CMD-01 "End the Tithe" for Kael with the outcome fell
  And EVT-04 "Tithe ended" is recorded for Kael
  And VIEW-01 "Tithe results" shows "You fell"

Scenario: Leaving ends the player's Tithe
  Given Kael is in depth 2
  When EVT-06 "Player left" has been recorded for Kael
  Then EVT-04 "Tithe ended" is recorded for Kael with the outcome left
  And VIEW-01 "Tithe results" shows "You left the Tithe"

Scenario: An NPC rival's victory ends the Tithe for every player
  Given Kael and Brann are in depth 2
  When EVT-02 "Rival claimed the Tithe" has been recorded for Cassian Morrow
  Then EVT-04 "Tithe ended" is recorded for Kael and for Brann
  And VIEW-01 "Tithe results" shows "Cassian Morrow is the Champion"
```

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Tithe results | EVT-04 | – |

**VIEW-01:** Shown 2.5 seconds after the end. The heading is "You are the Champion!", "<name> is the Champion", "You fell" or "You left the Tithe". It shows the Tithe's number, time, deepest depth, monsters slain, rivals and players defeated, Renown, gold found (or lost), the Crown's Purse, sponsor gifts waiting, the Mark and the skills before and after the Tithe, and what was lost. "Return to the Rim" opens the Rim, on the Patrons' Hall when gifts wait.

## 10. Validation and open questions

### Resolved in version 2

| # | Question | Resolution |
|---|---|---|
| 1 | **Leaving a Tithe:** Should an unfinished Tithe count as a fall, be resumable, or be lost? | Decided 2026-11-19: leaving is losing. The player is out, and it counts as a fall (Leave the Tithe). |

### Still open

None.
