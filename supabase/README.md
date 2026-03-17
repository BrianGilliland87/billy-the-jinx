# Supabase Migrations

This directory contains SQL migrations for Billy the Jinx.

Run each file in order via the **Supabase SQL Editor** or the Supabase CLI.

---

## Migration order

| File | Description |
|------|-------------|
| `migrations/001_tournament_bracket.sql` | Schema changes, new tables, updated trigger, all RPCs |
| `migrations/002_bracket_skeleton.sql` | `create_tournament_bracket()` function + seeds 2026 bracket |

---

## How to run (SQL Editor)

1. Open [Supabase Dashboard](https://app.supabase.com) → your project → **SQL Editor**
2. Paste the content of `001_tournament_bracket.sql` and click **Run**
3. Paste the content of `002_bracket_skeleton.sql` and click **Run**

---

## What migration 001 does

- Creates `tournaments` table
- Adds `tournament_year`, `display_seed`, `region` to `teams`
- Adds `tournament_year`, `round_order`, `bracket_slot`,
  `team_a_source_event_id`, `team_b_source_event_id`,
  `next_event_id`, `next_event_slot` to `events`
- Adds `'pending'` status to events (bracket shells before teams are assigned)
- Makes `scheduled_start` and `contributions_close_at` nullable
- Creates `user_event_selections` table with RLS
- Updates `handle_new_user` trigger to give new users **50 free snacks**
- Creates RPCs:
  - `resolve_event_and_advance_winner` – resolves a game and auto-advances winner
  - `set_event_matchup` – admin assigns teams + schedule to an opening-round event
  - `select_all_active_games` – mobile: select all currently active games
  - `clear_all_game_selections` – mobile: clear all user game selections

## What migration 002 does

- Creates `create_tournament_bracket(year integer)` function
- Seeds the **2026** tournament bracket (67 event shells, fully wired)
  - 4 First Four games (FF-01 … FF-04)
  - 32 Round of 64 games (R64-01 … R64-32)
  - 16 Round of 32 games (R32-01 … R32-16)
  - 8 Sweet Sixteen games (S16-01 … S16-08)
  - 4 Elite Eight games (E8-01 … E8-04)
  - 2 Final Four games (F4-01, F4-02)
  - 1 Championship game (CH-01)

---

## Admin workflow after migrations

1. Create a `tournaments` record for 2026 (via admin UI or SQL)
2. Add 68 teams with `tournament_year = 2026`, seeds, and regions
3. Use **Set Matchup** in admin to assign teams to First Four and Round of 64 games
4. As games are played, use **Resolve & Advance** – the winner automatically advances

---

## Round order reference

| round_order | Round name |
|-------------|------------|
| 1 | First Four |
| 2 | Round of 64 |
| 3 | Round of 32 |
| 4 | Sweet Sixteen |
| 5 | Elite Eight |
| 6 | Final Four |
| 7 | Championship |
