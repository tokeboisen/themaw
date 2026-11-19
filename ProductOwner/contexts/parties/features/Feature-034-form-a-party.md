```yaml
id: Feature-034
use_case: Form a party
bounded_context: Parties
product: The Maw
source: models/Feature-034-form-a-party.drawio
semantics: event-modeling-semantik.md
version: 2
status: draft
created: 2026-11-19
```

# Use case: Form a party

## 1. Purpose

For the player: in the first seconds of a Tithe, invite other players in it into a party – and leave it again – so friends fight as a team, and see who else is on the server.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| VIEW-01 | UI View | Other players | 1 | 1 | Player |
| CMD-01 | Command | Invite player | 2 | 1 | – |
| CMD-02 | Command | Leave party | 2 | 2 | – |
| AGG-01 | Aggregate | Party | 3 | 1 | – |
| EVT-01 | Event | Invitation sent | 4 | 1 | – |
| EVT-02 | Event | Party left | 4 | 2 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| – | – | – |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | The players signed in on the server, the players in the same Tithe and the player's own party, with the countdown for invitations. |
| AGG-01 | Players who fight together in one Tithe: the members and the open invitations. |

## 4. Flows

| From | To |
|---|---|
| VIEW-01 Other players | CMD-01 Invite player |
| VIEW-01 Other players | CMD-02 Leave party |
| CMD-01 Invite player | AGG-01 Party |
| CMD-02 Leave party | AGG-01 Party |
| AGG-01 Party | EVT-01 Invitation sent |
| AGG-01 Party | EVT-02 Party left |

## 5. Data

### CMD-01 Invite player (VIEW-01 → AGG-01)

| Field |
|---|
| Player |

### AGG-01 Party (CMD-01, CMD-02 → EVT-01, EVT-02)

| Field |
|---|
| Tithe |
| Members (many) |
| Members › Player |
| Members › Character |
| Invitations (many) |
| Invitations › Player |
| Invitations › Sent at |
| Invitations › Status |

## 6. User stories

### US-01: Invite player (CMD-01 → EVT-01, EVT-02)

As a player I want to invite another player in my Tithe into my party, so that we fight as a team.

```gherkin
Scenario: Kael invites Brann
  Given Kael and Brann are in the same Tithe, which started 8 seconds ago
  When the player performs CMD-01 "Invite player" with Brann
  Then EVT-01 "Invitation sent" is recorded

Scenario: Too late to invite
  Given the Tithe started 25 seconds ago
  When the player opens VIEW-01 "Other players"
  Then no player has Invite
```

### US-02: Leave party (CMD-02 → EVT-01, EVT-02)

As a player I want to leave my party, so that I fight on my own.

```gherkin
Scenario: Kael leaves the party
  Given Kael is in a party with Brann
  When the player performs CMD-02 "Leave party"
  Then EVT-02 "Party left" is recorded
  And Brann can strike Kael
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- A party lives inside one Tithe and ends with it. Every player starts the Tithe without a party, and a party can be as large as the Tithe (8 players). (AGG-01)
- Invitations can only be sent to players in the same Tithe, and only during its first 20 seconds – the grace – with a countdown in the overlay. After that, Invite is gone. (CMD-01)
- Every member can invite. A player can leave the party at any time in the Tithe; after that the former members can strike the player, and the player them. (CMD-01, CMD-02)
- Party members see each other on the map with their user names (Tithe, Enter the Tithe), and cannot hurt each other (Tithe, Fight in the depths). (AGG-01)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Other players | (starting point) | CMD-01, CMD-02 |

**VIEW-01:** Opened with the Other players button or O, in the Rim and during a Tithe, as a see-through overlay. Lists the players signed in on the server with their user name, the character they play and the Tithe they are in. During the first 20 seconds of a Tithe a countdown runs at the top, and the other players in the same Tithe have Invite. The player's party is shown with its members and Leave party.

## 10. Validation and open questions

### Resolved in version 2

| # | Question | Resolution |
|---|---|---|
| 1 | **Who starts the descent:** Who starts the descent for a party? | Decided 2026-11-19: the player who opened the Tithe launches it (Lobby, Launch the Tithe), and parties are formed in the Tithe's first 20 seconds. |

### Still open

None.
