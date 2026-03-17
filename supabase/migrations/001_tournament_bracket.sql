-- ============================================================
-- Migration 001: Tournament Bracket Architecture
-- Billy the Jinx – Full NCAA tournament bracket support
--
-- Run this in your Supabase SQL Editor (or via CLI).
-- Safe to re-run: all DDL uses IF NOT EXISTS / OR REPLACE.
-- ============================================================


-- ============================================================
-- 1. tournaments table
-- ============================================================
CREATE TABLE IF NOT EXISTS tournaments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  year       integer     UNIQUE NOT NULL,
  name       text        NOT NULL,
  is_active  boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tournaments' AND policyname = 'Anyone can read tournaments'
  ) THEN
    CREATE POLICY "Anyone can read tournaments"
      ON tournaments FOR SELECT USING (true);
  END IF;
END $$;


-- ============================================================
-- 2. teams – add tournament fields
-- ============================================================
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS tournament_year integer,
  ADD COLUMN IF NOT EXISTS display_seed    text,
  ADD COLUMN IF NOT EXISTS region          text;

CREATE INDEX IF NOT EXISTS teams_tournament_year_idx ON teams(tournament_year);


-- ============================================================
-- 3. events – extend for bracket architecture
-- ============================================================

-- Allow bracket shells that don't have dates yet
ALTER TABLE events
  ALTER COLUMN scheduled_start        DROP NOT NULL,
  ALTER COLUMN contributions_close_at DROP NOT NULL;

-- Extend status enum to include 'pending' (bracket shell, awaiting teams)
-- Drop and recreate the CHECK constraint safely
DO $$
BEGIN
  ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE events
  ADD CONSTRAINT events_status_check
  CHECK (status IN ('pending', 'scheduled', 'locked', 'final'));

-- New bracket columns
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS tournament_year        integer,
  ADD COLUMN IF NOT EXISTS round_order            integer,
  ADD COLUMN IF NOT EXISTS bracket_slot           text,
  ADD COLUMN IF NOT EXISTS team_a_source_event_id uuid REFERENCES events(id),
  ADD COLUMN IF NOT EXISTS team_b_source_event_id uuid REFERENCES events(id),
  ADD COLUMN IF NOT EXISTS next_event_id          uuid REFERENCES events(id),
  ADD COLUMN IF NOT EXISTS next_event_slot        text
    CHECK (next_event_slot IN ('team_a', 'team_b'));

CREATE INDEX IF NOT EXISTS events_tournament_year_idx ON events(tournament_year);
CREATE INDEX IF NOT EXISTS events_round_order_idx     ON events(round_order);
CREATE INDEX IF NOT EXISTS events_bracket_slot_idx    ON events(bracket_slot);
CREATE INDEX IF NOT EXISTS events_next_event_id_idx   ON events(next_event_id);


-- ============================================================
-- 4. user_event_selections table
-- ============================================================
CREATE TABLE IF NOT EXISTS user_event_selections (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id    uuid        NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
  is_selected boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);

ALTER TABLE user_event_selections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_event_selections'
      AND policyname = 'Users can view their own selections'
  ) THEN
    CREATE POLICY "Users can view their own selections"
      ON user_event_selections FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_event_selections'
      AND policyname = 'Users can insert their own selections'
  ) THEN
    CREATE POLICY "Users can insert their own selections"
      ON user_event_selections FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_event_selections'
      AND policyname = 'Users can update their own selections'
  ) THEN
    CREATE POLICY "Users can update their own selections"
      ON user_event_selections FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_event_selections'
      AND policyname = 'Users can delete their own selections'
  ) THEN
    CREATE POLICY "Users can delete their own selections"
      ON user_event_selections FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS user_event_selections_user_id_idx  ON user_event_selections(user_id);
CREATE INDEX IF NOT EXISTS user_event_selections_event_id_idx ON user_event_selections(event_id);


-- ============================================================
-- 5. Update user creation trigger – 50 starter snacks
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, free_snack_balance)
  VALUES (new.id, new.email, 50)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- 6. resolve_event_and_advance_winner RPC
--    Resolves a game, calculates Billy curse, refunds if needed,
--    then writes the winner into the next bracket event.
-- ============================================================
CREATE OR REPLACE FUNCTION resolve_event_and_advance_winner(
  p_event_id        uuid,
  p_winning_team_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event         events%ROWTYPE;
  v_next_event    events%ROWTYPE;
  v_curse_success boolean;
BEGIN
  -- Load the event
  SELECT * INTO v_event FROM events WHERE id = p_event_id;

  IF v_event.id IS NULL THEN
    RAISE EXCEPTION 'Event not found: %', p_event_id;
  END IF;

  IF v_event.status = 'final' THEN
    RAISE EXCEPTION 'Event % is already resolved', p_event_id;
  END IF;

  IF p_winning_team_id IS DISTINCT FROM v_event.team_a_id
     AND p_winning_team_id IS DISTINCT FROM v_event.team_b_id THEN
    RAISE EXCEPTION 'Team % is not a participant in event %',
      p_winning_team_id, p_event_id;
  END IF;

  -- Determine curse outcome
  v_curse_success := (
    v_event.billy_support_team_id IS NOT NULL
    AND v_event.billy_support_team_id IS DISTINCT FROM p_winning_team_id
  );

  -- Mark event as final
  UPDATE events
  SET
    status          = 'final',
    winning_team_id = p_winning_team_id,
    curse_success   = v_curse_success
  WHERE id = p_event_id;

  -- Refund paid snacks when curse failed
  IF NOT v_curse_success AND v_event.billy_support_team_id IS NOT NULL THEN
    UPDATE profiles p
    SET paid_snack_balance = p.paid_snack_balance + ec.snacks_paid
    FROM event_contributions ec
    WHERE ec.event_id   = p_event_id
      AND ec.user_id    = p.id
      AND ec.snacks_paid > 0;
  END IF;

  -- Advance winner to next bracket event if one is configured
  IF v_event.next_event_id IS NOT NULL AND v_event.next_event_slot IS NOT NULL THEN
    SELECT * INTO v_next_event FROM events WHERE id = v_event.next_event_id;

    IF v_event.next_event_slot = 'team_a' THEN
      IF v_next_event.team_a_id IS NOT NULL THEN
        RAISE EXCEPTION
          'Slot team_a in event % is already occupied', v_event.next_event_id;
      END IF;
      UPDATE events SET team_a_id = p_winning_team_id
      WHERE id = v_event.next_event_id;

    ELSIF v_event.next_event_slot = 'team_b' THEN
      IF v_next_event.team_b_id IS NOT NULL THEN
        RAISE EXCEPTION
          'Slot team_b in event % is already occupied', v_event.next_event_id;
      END IF;
      UPDATE events SET team_b_id = p_winning_team_id
      WHERE id = v_event.next_event_id;
    END IF;

    -- Promote next event from pending → scheduled once both teams are set
    UPDATE events
    SET status = 'scheduled'
    WHERE id           = v_event.next_event_id
      AND team_a_id IS NOT NULL
      AND team_b_id IS NOT NULL
      AND status        = 'pending';
  END IF;
END;
$$;


-- ============================================================
-- 7. set_event_matchup RPC
--    Admin assigns teams and schedule to an opening-round event
--    (FF or R64).  Safe to call on a pending bracket shell.
-- ============================================================
CREATE OR REPLACE FUNCTION set_event_matchup(
  p_event_id               uuid,
  p_team_a_id              uuid,
  p_team_b_id              uuid,
  p_scheduled_start        timestamptz,
  p_contributions_close_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE events
  SET
    team_a_id              = p_team_a_id,
    team_b_id              = p_team_b_id,
    scheduled_start        = p_scheduled_start,
    contributions_close_at = p_contributions_close_at,
    status                 = 'scheduled'
  WHERE id = p_event_id
    AND status IN ('pending', 'scheduled');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event % not found or is not in a modifiable state', p_event_id;
  END IF;
END;
$$;


-- ============================================================
-- 8. select_all_active_games RPC (mobile)
--    Inserts or re-enables selections for all current active games.
--    Returns the count of games selected.
-- ============================================================
CREATE OR REPLACE FUNCTION select_all_active_games()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_count   integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO user_event_selections (user_id, event_id, is_selected)
  SELECT v_user_id, e.id, true
  FROM events e
  WHERE e.status IN ('scheduled', 'locked')
    AND e.team_a_id IS NOT NULL
    AND e.team_b_id IS NOT NULL
  ON CONFLICT (user_id, event_id)
  DO UPDATE SET is_selected = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ============================================================
-- 9. clear_all_game_selections RPC (mobile)
-- ============================================================
CREATE OR REPLACE FUNCTION clear_all_game_selections()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM user_event_selections WHERE user_id = v_user_id;
END;
$$;
