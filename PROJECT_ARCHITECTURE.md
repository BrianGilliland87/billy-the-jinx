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
- notifications
- herd system
- snack store

---

## Admin Dashboard
Location: `apps/admin`

Framework:
- Next.js
- TypeScript

Responsibilities:
- manage teams
- create events
- resolve game winners
- operate tournament progression

---

## Backend

Provider:
- Supabase

Components:
- PostgreSQL database
- authentication
- row-level security
- RPC functions

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

- starter snacks (signup bonus)
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

Events progress through three states:

- scheduled
- locked
- final


### Scheduled
Users can contribute snacks.

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


---

# Tournament Architecture

The system will support a full NCAA tournament structure.

Rounds:

- First Four
- Round of 64
- Round of 32
- Sweet Sixteen
- Elite Eight
- Final Four
- Championship


Each event may define:

- next_event_id
- next_event_slot
- team_a_source_event_id
- team_b_source_event_id


This allows **automatic bracket advancement** when winners are resolved.

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

1. create tournament teams
2. create events
3. resolve game winners
4. advance tournament bracket
5. manage tournament progression

Admin actions trigger backend RPC functions.

---

# Data Integrity Rules

Important rules enforced in database logic:

- snack balances cannot go negative
- locked events cannot accept contributions
- final events cannot be modified
- only event participants receive result notifications

---

# Security Model

Supabase Row-Level Security policies enforce:

- users can only view their own profile
- users can only update their own balances
- users cannot modify events
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

---

# Repository Structure

billy-the-jinx
│
├ apps
│ ├ mobile
│ └ admin
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
- snack economy
- event contributions
- Billy leaning logic
- curse resolution
- notifications
- herd system
- visual UI
- store placeholders

Next development milestone:

**Full 68-team tournament architecture**