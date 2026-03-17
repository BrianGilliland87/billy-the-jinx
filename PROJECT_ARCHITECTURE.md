# Billy the Jinx – Project Architecture

## Overview

Billy the Jinx is an entertainment-based sports fan app that allows users to
"feed snacks" to Billy in order to influence which team he supports.

Billy is cursed — whichever team he supports experiences bad luck.

Fans therefore try to convince Billy to support the opposing team.

This application tracks sports events, snack contributions, and the outcome of
Billy's curse.

---

# Technology Stack

## Mobile App
Location: `apps/mobile`

Framework:
- Expo
- React Native
- TypeScript
- Expo Router

Responsibilities:
- user accounts
- event participation
- snack contributions
- game selection (follow/unfollow games)
- notifications
- herd system
- snack store

---

## Admin Dashboard
Location: `apps/admin`

Framework:
- Next.js
- TypeScript

Pages:
- `/` – Events list with round filter and resolve-and-advance
- `/bracket` – Full bracket view with Set Matchup tool
- `/tournament` – Tournament creation and bracket skeleton generation
- `/teams` – Team management with seed and region support

---

## Backend

Provider:
- Supabase

Components:
- PostgreSQL database
- authentication
- row-level security
- RPC functions

Database migrations:
- `supabase/migrations/001_tournament_bracket.sql` – schema + RPCs
- `supabase/migrations/002_bracket_skeleton.sql` – bracket creation function

---

# Core Game Mechanics

Billy the Jinx is cursed.

Fans feed Billy snacks to influence which team he supports.

Billy supports the team that receives the most snack offerings.

If Billy supports a team:

Billy's curse attempts to cause that team to lose.

### Curse Success

If Billy-supported team loses → curse succeeds

### Curse Failure

If Billy-supported team wins → curse fails

If the curse fails, paid snacks used in that event are refunded.

---

# Snack Economy

Snack sources:

- starter snacks (50 free snacks on signup)
- daily snack claim
- purchased snack packs
- rewarded ad snacks

Balances stored on user profile.

Snack balances:

- free_snack_balance
- paid_snack_balance
- ad_snack_balance


All snack transactions recorded in:

- daily_claim
- event_contribution
- purchase_credit
- ad_reward
- refund


---

# Event Lifecycle

Events progress through four states:

- pending
- scheduled
- locked
- final


### Pending
Bracket shell created; awaiting team assignment.

### Scheduled
Both teams assigned; users can contribute snacks.

### Locked
Contributions closed 10 minutes before game start.

### Final
Game result entered by admin.

Billy curse resolution calculated.

---

# Event Data Model

Events include:

- team_a_id
- team_b_id
- scheduled_start
- contributions_close_at
- status
- billy_support_team_id
- winning_team_id
- curse_success
- tournament_year
- round_order
- bracket_slot
- team_a_source_event_id
- team_b_source_event_id
- next_event_id
- next_event_slot


---

# Tournament Architecture

The system supports a full NCAA tournament structure.

Rounds (round_order):

| round_order | Round |
|-------------|-------|
| 1 | First Four |
| 2 | Round of 64 |
| 3 | Round of 32 |
| 4 | Sweet Sixteen |
| 5 | Elite Eight |
| 6 | Final Four |
| 7 | Championship |

Bracket slots:

- FF-01 … FF-04
- R64-01 … R64-32
- R32-01 … R32-16
- S16-01 … S16-08
- E8-01 … E8-04
- F4-01, F4-02
- CH-01

Every event explicitly stores:

- next_event_id – which event the winner advances to
- next_event_slot – team_a or team_b in that next event
- team_a_source_event_id – prior event whose winner becomes team A
- team_b_source_event_id – prior event whose winner becomes team B

This allows **automatic bracket advancement** when winners are resolved
without any name-based inference.

Regional structure:

- East:    R64-01 … R64-08
- Midwest: R64-09 … R64-16
- South:   R64-17 … R64-24
- West:    R64-25 … R64-32

First Four play-in assignments:

- FF-01 → R64-01 team_b (East 1 vs 16)
- FF-02 → R64-17 team_b (South 1 vs 16)
- FF-03 → R64-06 team_b (East 6 vs 11)
- FF-04 → R64-22 team_b (South 6 vs 11)

---

# Herd System

Users can form groups called Herds.

A herd represents fans supporting the same team.

Herds allow:
- recruitment
- coordinated snack contributions
- fan community participation

Tables:

- herds
- herd_members


---

# Game Selection System

Users can select which games to follow.

Tables:

- user_event_selections (user_id, event_id, is_selected)

RPCs:

- select_all_active_games() – select all currently active games
- clear_all_game_selections() – remove all user game selections

Mobile screen: `apps/mobile/app/games.tsx`

---

# Notification System

In-app notifications include:

- daily snack claimed
- herd created
- herd joined
- event final results
- store actions


Notifications stored in:

- notifications


Users can mark notifications as read.

---

# Monetization (Beta)

Current monetization features are placeholders.

Snack store allows:

- 10 snack pack purchase
- rewarded ad snack


Limits:

- 20 purchased snacks per day


Future implementation:

- App Store purchases
- Google Play purchases
- ad network integration

---

# Admin Workflow

Admin tasks include:

1. create tournament year (`/tournament`)
2. add teams with seed and region (`/teams`)
3. build bracket skeleton – calls `create_tournament_bracket(year)`
4. assign teams to opening matchups – calls `set_event_matchup` RPC
5. resolve game winners – calls `resolve_event_and_advance_winner` RPC
6. winners auto-advance to the next bracket event

---

# RPC Functions

| Function | Description |
|----------|-------------|
| `resolve_event_and_advance_winner` | Resolve game, calculate curse, advance winner |
| `resolve_event_result` | Legacy: resolve game only |
| `set_event_matchup` | Assign teams and schedule to an opening-round event |
| `create_tournament_bracket` | Create all 67 bracket shells for a year |
| `select_all_active_games` | Mobile: select all currently active games |
| `clear_all_game_selections` | Mobile: clear all user game selections |
| `contribute_snack` | User contributes snack to an event |
| `purchase_snack_pack` | User buys snack pack |
| `claim_ad_snack` | User claims ad reward |
| `join_herd` | User joins a herd |
| `create_notification_for_user` | Create in-app notification |

---

# Data Integrity Rules

Important rules enforced in database logic:

- snack balances cannot go negative
- locked events cannot accept contributions
- final events cannot be modified
- final events cannot be re-resolved
- winners only advance if next_event_id is set
- advancement does not overwrite an already-filled slot
- only event participants receive result notifications

---

# Security Model

Supabase Row-Level Security policies enforce:

- users can only view their own profile
- users can only update their own balances
- users cannot modify events
- users can only manage their own game selections
- admin actions use secure RPC functions

---

# Future Features

Planned improvements:

- real sports data API integration
- push notifications
- animated Billy celebration scenes
- bracket visualization
- improved herd leaderboards
- season history
- follow-favorite-team game selection path

---

# Repository Structure

billy-the-jinx
│
├ apps
│ ├ mobile
│ └ admin
│
├ supabase
│ ├ migrations
│ └ README.md
│
├ .github
│ ├ prompts
│ └ workflows
│
├ PROJECT_ARCHITECTURE.md


---

# Current Development Stage

Status: **Beta 1**

Completed systems:

- authentication
- snack economy (50 starter snacks)
- event contributions
- Billy leaning logic
- curse resolution
- notifications
- herd system
- visual UI
- store placeholders
- tournament bracket schema
- bracket creation function (67 game shells, fully wired)
- resolve-and-advance RPC
- admin bracket management UI
- mobile game-selection system

Next development milestone:

**Phase 6 – mobile game selection UX polish and bracket visualization**