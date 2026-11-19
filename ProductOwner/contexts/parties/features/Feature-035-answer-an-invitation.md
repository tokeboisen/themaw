```yaml
id: Feature-035
use_case: Answer an invitation
bounded_context: Parties
product: The Maw
source: models/Feature-035-answer-an-invitation.drawio
semantics: event-modeling-semantik.md
version: 2
status: draft
created: 2026-11-19
```

# Use case: Answer an invitation

## 1. Purpose

For the player: accept or decline an invitation in the first seconds of a Tithe, so the player decides who to fight with.

## 2. Actors

| Actor | UI Views |
|---|---|
| Player | VIEW-01 |

## 3. Elements

| ID | Type | Name | Column | Stack | Actors |
|---|---|---|---|---|---|
| EVT-01 | Event | Invitation sent | 1 | 1 | – |
| VIEW-01 | UI View | Invitation | 2 | 1 | Player |
| CMD-01 | Command | Accept invitation | 3 | 1 | – |
| CMD-02 | Command | Decline invitation | 3 | 2 | – |
| AGG-01 | Aggregate | Party | 4 | 1 | – |
| EVT-02 | Event | Party joined | 5 | 1 | – |
| EVT-03 | Event | Invitation declined | 5 | 2 | – |

### Stimuli

| ID | Use case | Event in the use case |
|---|---|---|
| EVT-01 | Feature-034 Form a party | EVT-01 Invitation sent |

### Descriptions

| ID | Description |
|---|---|
| VIEW-01 | An invitation to join another player's party. |
| AGG-01 | Players who fight together in one Tithe: the members and the open invitations. |

## 4. Flows

| From | To |
|---|---|
| EVT-01 Invitation sent | VIEW-01 Invitation |
| VIEW-01 Invitation | CMD-01 Accept invitation |
| VIEW-01 Invitation | CMD-02 Decline invitation |
| CMD-01 Accept invitation | AGG-01 Party |
| CMD-02 Decline invitation | AGG-01 Party |
| AGG-01 Party | EVT-02 Party joined |
| AGG-01 Party | EVT-03 Invitation declined |

## 5. Data

### CMD-01 Accept invitation (VIEW-01 → AGG-01)

| Field |
|---|
| Invitation |

### CMD-02 Decline invitation (VIEW-01 → AGG-01)

| Field |
|---|
| Invitation |

### AGG-01 Party (CMD-01, CMD-02 → EVT-02, EVT-03)

| Field |
|---|
| Members (many) |
| Members › Player |
| Members › Character |
| Invitations (many) |
| Invitations › Player |
| Invitations › Status |

## 6. User stories

### US-01: Accept invitation (CMD-01 → EVT-02, EVT-03)

As a player I want to accept an invitation, so that I fight in my friend's party.

```gherkin
Scenario: Brann accepts
  Given EVT-01 "Invitation sent" has been recorded from Kael to Brann 5 seconds after the start
  When the player performs CMD-01 "Accept invitation"
  Then EVT-02 "Party joined" is recorded
  And Kael and Brann see each other on the map with their user names
```

### US-02: Decline invitation (CMD-02 → EVT-02, EVT-03)

As a player I want to decline an invitation, so that I choose who I fight with.

```gherkin
Scenario: Brann declines
  Given EVT-01 "Invitation sent" has been recorded from Kael to Brann
  When the player performs CMD-02 "Decline invitation"
  Then EVT-03 "Invitation declined" is recorded
  And Kael sees "brann declined."
```

## 7. Automation

| Application Service | Triggered by | Performs | Results in |
|---|---|---|---|
| – | – | – | – |

### Rules

- An invitation can only be answered during the Tithe's first 20 seconds; when the countdown ends, it lapses. (CMD-01, CMD-02)
- Accepting leaves the party the player was in. (CMD-01)
- The one who invited sees "<user name> joined the party." or "<user name> declined.". (EVT-02, EVT-03)

## 8. Integrations

| ID | System | Incoming Command | Outgoing Event |
|---|---|---|---|
| – | – | – | – |

## 9. Views

| ID | Name | Fed by | Triggers |
|---|---|---|---|
| VIEW-01 | Invitation | EVT-01 | CMD-01, CMD-02 |

**VIEW-01:** Pops up in the Other players overlay: "<user name> invites you to their party." with Accept, Decline and the countdown.

## 10. Validation and open questions

### Resolved in version 2

| # | Question | Resolution |
|---|---|---|
| – | – | – |

### Still open

None.
