```yaml
id: Feature-010
use_case: Enter the Tithe
bounded_context: Tithe
product: The Maw
source: models/Feature-010-enter-the-tithe.drawio
semantics: event-modeling-semantik.md
version: 6
status: draft
created: 2026-11-19
```

# Use case: Enter the Tithe

## 1. Purpose

For the players: when the player who opened a Tithe launches it, it is laid out anew and up to 8 candidates – players and NPC rivals – descend into it, each in a room of their own, so every run is a new race to the bottom.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| EVT-01 | Event | Tithe launched | 1 | 1 | – |
| SVC-01 | Application Service | Tithe master | 2 | 1 | – |
| CMD-01 | Command | Start the Tithe | 3 | 1 | – |
| AGG-01 | Aggregate | Tithe | 4 | 1 | – |
| EVT-02 | Event | Tithe started | 5 | 1 | – |
| VIEW-01 | UI View | Depth | 6 | 1 | Player |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| EVT-01 | Feature-037 Launch the Tithe | EVT-01 Tithe launched |

### Descriptions

| ID | Description |
|---|---|
| SVC-01 | Starts a Tithe when the matchmaker has filled it. |
| AGG-01 | One run into the Maw: its seed and depths, its candidates (the player and the rivals), the monsters, the Warden and the outcome. |
| VIEW-01 | The depth of the Maw the candidate is in: the map around the candidate, candidates and monsters in sight, loot on the floor, life, stamina, focus, hunger, Renown, the seal timer and the rivals' depths. |

## 4. Flows

| From | To |
|---|---|
| EVT-01 Tithe launched | SVC-01 Tithe master |
| SVC-01 Tithe master | CMD-01 Start the Tithe |
| CMD-01 Start the Tithe | AGG-01 Tithe |
| AGG-01 Tithe | EVT-02 Tithe started |
| EVT-02 Tithe started | VIEW-01 Depth |

## 5. Data

### CMD-01 Start the Tithe (SVC-01 → AGG-01)

| Field |
|---|
| Players (many) |
| Players › Player |
| Players › Character |
| NPC rivals |

### AGG-01 Tithe (CMD-01 → EVT-02)

| Field |
|---|
| Name |
| Seed |
| Depths (many) |
| Depths › Number |
| Depths › Layout |
| Depths › Seals at |
| Candidates (many) |
| Candidates › Name |
| Candidates › Kind |
| Candidates › Party |
| Candidates › Level |
| Candidates › Start room |
| Candidates › Depth |
| Candidates › Status |
| Warden alive |

## 6. User stories

No user stories.

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| SVC-01 Tithe master | EVT-01 | CMD-01 | EVT-02 |

### Rules

- Every Tithe is in a Reach, chosen when it is opened (Lobby, Open a Tithe), and gets a new seed that lays it out anew. Reach 1, The Old Mines, has 3 depths of rooms joined by corridors two tiles wide, the stairs in the room farthest from the start and two caches in each; the last is The Foreman's Hall with the Warden and the gate. (AGG-01)
- Reach 2, The Broken City, is one large map of ruined streets and roads: small houses, large houses with an upper floor and big factories with two (Climb the stairs), and caches in the houses. It is divided into four districts from the outer ring to the foundry in the middle, the largest factory, where The Smelter guards the gate. The districts are its depths (Descend), and everything said about The Foreman and his hall holds for The Smelter and the foundry. (AGG-01)
- A Tithe has 8 candidates: the players who joined it, and NPC rivals for the places that are left, chosen among Cassian Morrow (heavy weapons, one Mark above the players, hostile 90 %), Vessa Thorne (bows, 35 %), Ash and Rook Kell (blades, 60 %), Mira Silvertongue (Echo Arts, 20 %), Silent Odo (blades, 15 %) and Garrick Vane, champion of House Vane (heavy weapons, one Mark above the players, 80 %). A single player meets all seven NPC rivals. (CMD-01, AGG-01)
- The Tithe's level is the Mark of the player who launched it (Lobby, Launch the Tithe); NPC rivals and monsters follow it (Fight in the depths). Every player enters with the chosen character, full life, stamina and focus and a full stomach. (CMD-01)
- Every candidate – player or NPC rival – starts in a room of its own, the rooms chosen about equally far from the stairs – in The Broken City in a house of its own in the outer ring, about equally far from the foundry. Everyone starts without a party. (AGG-01, EVT-02)
- For the first 20 seconds no candidate may strike another (grace). In those seconds the players can form parties (Parties, Form a party). (EVT-02)
- The Maw Server runs the Tithe and the Mirrormaster's show; the players' browsers only show it and send the players' actions, so no player can cheat. (SVC-01)

```gherkin
Scenario: A Tithe with three players starts
  Given Kael opened the Tithe "Ashfall" and Brann and Vessa's player joined it
  When EVT-01 "Tithe launched" has been recorded
  Then SVC-01 "Tithe master" performs CMD-01 "Start the Tithe" with three players and five NPC rivals
  And EVT-02 "Tithe started" is recorded
  And each of the 8 candidates starts in a room of its own
```

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Depth | EVT-02 | – |

**VIEW-01:** The candidate is in the middle of the screen with the depth around it; what is outside the vision radius of 7 tiles is dark, and what has not been seen is black. The HUD shows life, stamina, focus, hunger, the Echo to the next Mark, the depth, the seal timer, Renown and gold found, a minimap, the candidates and their depths, the hotbar and the Mirrormaster's last three messages, and the buttons Character, Other players, Help and Leave. Players in sight show their user names over their heads; party members are also shown on the minimap with their user names. Mouse and keyboard for now; touch controls wait for the phone version.

## 10. Validation and open questions

### Resolved in version 6

| # | Question | Resolution |
|---|---|---|
| 1 | **Where the Tithe runs:** Should the Tithe and the Mirrormaster's show be run by the Maw Server, so no player can cheat, or in the players' browsers? | Decided 2026-11-19: the Maw Server runs the Tithe and the show, so no player can cheat. |
| 2 | **Playing without a connection:** Can a player play a Tithe without a connection? | Decided 2026-11-19: no. Characters are kept on the Maw Server, so the game needs a connection. |
| 3 | **A second Reach:** Is there more than The Old Mines? | Decided 2026-11-20: yes: Reach 2, The Broken City, one large map of ruins with houses on several floors and the Warden in the foundry in the middle; the districts are sealed from the outside in. |

### Still open

None.
