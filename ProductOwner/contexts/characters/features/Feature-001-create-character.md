```yaml
id: Feature-001
use_case: Create character
bounded_context: Characters
product: The Maw
source: models/Feature-001-create-character.drawio
semantics: event-modeling-semantik.md
version: 5
status: draft
created: 2026-11-19
```

# Use case: Create character

## 1. Purpose

For the player: create a Branded character – a name, a background that gives the starting weapon and the story, and points placed on attributes and skills within the background's limits – so every character can be built the way the player wants.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Create character | 1 | 1 | Player |
| CMD-01 | Command | Create character | 2 | 1 | – |
| AGG-01 | Aggregate | Character | 3 | 1 | – |
| EVT-01 | Event | Character created | 4 | 1 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| AGG-01 | A Branded candidate who belongs to a user: who they are and what they have become – attributes, skills, Echo and Marks. |

## 4. Flows

| From | To |
|---|---|
| VIEW-01 Create character | CMD-01 Create character |
| CMD-01 Create character | AGG-01 Character |
| AGG-01 Character | EVT-01 Character created |

## 5. Data

### CMD-01 Create character (VIEW-01 → AGG-01)

| Field |
|---|
| Name |
| Background |
| Attributes |
| Attributes › Strength |
| Attributes › Dexterity |
| Attributes › Stamina |
| Attributes › Constitution |
| Attributes › Intelligence |
| Skills (many) |
| Skills › Skill |
| Skills › Level |

### AGG-01 Character (CMD-01 → EVT-01)

| Field |
|---|
| User |
| Name |
| Background |
| Mark |
| Echo |
| Attributes |
| Attributes › Strength |
| Attributes › Dexterity |
| Attributes › Stamina |
| Attributes › Constitution |
| Attributes › Intelligence |
| Skills (many) |
| Skills › Skill |
| Skills › Level |
| Skills › Experience |

## 6. User stories

### US-01: Create character (CMD-01 → EVT-01)

As a player I want to create a character with a background and place its points on attributes and skills myself, so that my character is built the way I want to play.

```gherkin
Scenario: A Miner is created with the suggested points
  Given the user has no characters
  When the player performs CMD-01 "Create character" with the name "Kael", the background Miner and its suggested points
  Then EVT-01 "Character created" is recorded
  And Kael has Strength 13, Constitution 12 and Heavy Weapons 10

Scenario: Points are moved within the limits
  Given the player has chosen Miner
  When the player moves 2 points from Strength to Dexterity
  And the player performs CMD-01 "Create character" with the name "Brann"
  Then EVT-01 "Character created" is recorded with Strength 11 and Dexterity 12

Scenario: A maximum cannot be passed
  Given the player has chosen Temple Acolyte and Strength is 12
  When the player looks at Strength in VIEW-01 "Create character"
  Then the + by Strength is disabled

Scenario: All points must be placed
  Given the player has 1 skill point left
  When the player performs CMD-01 "Create character"
  Then nothing is recorded
  And "Place all your points first." is shown
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- A user can have several characters. Each belongs to one user and is kept on the Maw Server. (AGG-01)
- Every background has a talent, a fifth skill that only it has: Street Runner Hide, Miner Berserk, Poacher Haste and Temple Acolyte Healing Circle (Tithe, Use a talent). It starts at 0 and is not placed at creation; it grows by use and with skill points. Every character also has the skill Reveal, which reads unidentified items (Gear, Reveal an item) and gets its bonus from Intelligence; it too starts at 0. (AGG-01)
- The five attributes add up to 55 points and the four skills (Blades, Heavy Weapons, Bows, Echo Arts) to 16. Every attribute and skill must lie between the background's minimum and maximum, and all points must be placed before the character can be created; otherwise "Place all your points first." is shown. (CMD-01)
- Miner: strengths Strength, Constitution and Heavy Weapons; weaknesses Dexterity, Intelligence and Echo Arts. Suggestion: Strength 13, Dexterity 10, Stamina 10, Constitution 12, Intelligence 10; Blades 3, Heavy Weapons 10, Bows 2, Echo Arts 1. Limits: Strength 11–16, Dexterity 7–12, Stamina 9–13, Constitution 10–15, Intelligence 7–12; Blades 0–8, Heavy Weapons 6–12, Bows 0–6, Echo Arts 0–4. Starting weapon: Pickaxe. (CMD-01)
- Poacher: strengths Dexterity and Bows; weaknesses Constitution and Heavy Weapons. Suggestion: Strength 10, Dexterity 14, Stamina 11, Constitution 10, Intelligence 10; Blades 4, Heavy Weapons 1, Bows 10, Echo Arts 1. Limits: Strength 8–13, Dexterity 12–17, Stamina 9–14, Constitution 7–12, Intelligence 8–13; Blades 0–8, Heavy Weapons 0–4, Bows 6–12, Echo Arts 0–6. Starting weapon: Short Bow. (CMD-01)
- Temple Acolyte: strengths Intelligence and Echo Arts; weaknesses Strength, Constitution and Heavy Weapons. Suggestion: Strength 10, Dexterity 10, Stamina 11, Constitution 10, Intelligence 14; Blades 4, Heavy Weapons 0, Bows 2, Echo Arts 10. Limits: Strength 7–12, Dexterity 8–13, Stamina 9–14, Constitution 7–12, Intelligence 12–17; Blades 0–8, Heavy Weapons 0–4, Bows 0–6, Echo Arts 6–12. Starting weapon: Dagger. (CMD-01)
- Street Runner: strengths Stamina, Dexterity and Blades; weaknesses Intelligence and Echo Arts. Suggestion: Strength 10, Dexterity 12, Stamina 13, Constitution 10, Intelligence 10; Blades 10, Heavy Weapons 2, Bows 3, Echo Arts 1. Limits: Strength 8–13, Dexterity 10–15, Stamina 11–16, Constitution 8–13, Intelligence 7–12; Blades 6–12, Heavy Weapons 0–6, Bows 0–8, Echo Arts 0–4. Starting weapon: Rusty Sword. (CMD-01)
- The background's limits apply when the character is created. Later, Marks and use raise attributes and skills beyond them (Learn by use, Spend points). (AGG-01)
- A new character is Mark 1 with no Echo and no points to spend. The name is required and at most 20 characters. (CMD-01, AGG-01)
- EVT-01 "Character created" gives the starting kit and hotbar (Gear, Stock the inventory), the starting gold (Market, Keep the wallet) and the Forge's first stock (Market, Restock the Forge), and the new character becomes the one being played (Choose character). (EVT-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Create character | (starting point) | CMD-01 |

**VIEW-01:** Opened with New character, and right away for a user without characters. The four backgrounds are shown as cards; each card has the background's story, its strengths and weaknesses, its starting weapon, its talent and the minimum and maximum of every attribute and skill. Choosing a background places its suggested points. A − and a + stand by every attribute and skill, disabled at the background's minimum and maximum, and "Points left" counts the attribute points and the skill points. A name field and "Take the Brand" create the character.

## 10. Validation and open questions

### Resolved in version 5

| # | Question | Resolution |
|---|---|---|
| 1 | **More characters:** Can a player have several characters? | Decided 2026-11-19: yes. A user can have several characters, each created with points to place; the background suggests the points and sets a minimum and maximum for every attribute and skill. |
| 2 | **Limits after creation:** Do the background's maximums also cap the character later, or only at creation? | Decided 2026-11-19: only at creation. Later, Marks and use raise attributes and skills beyond them. |
| 3 | **Deleting a character:** Can a user delete a character? | Decided 2026-11-19: yes (Delete character). |
| 4 | **Where characters are kept:** Should characters be kept on the server? | Decided 2026-11-19: yes, on the Maw Server – and so is what a character owns: gear, gold, gifts and statistics. |

### Still open

None.
