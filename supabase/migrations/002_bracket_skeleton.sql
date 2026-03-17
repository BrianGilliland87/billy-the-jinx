-- ============================================================
-- Migration 002: Bracket Skeleton Creation Function
-- Billy the Jinx – create_tournament_bracket(year)
--
-- Creates all 67 game shells for a single tournament year and
-- wires every next_event_id / next_event_slot link so that
-- resolve_event_and_advance_winner can auto-advance winners
-- without any name-based logic.
--
-- Bracket layout (68 teams, 67 games):
--   First Four   : FF-01 … FF-04         (round_order 1)
--   Round of 64  : R64-01 … R64-32       (round_order 2)
--   Round of 32  : R32-01 … R32-16       (round_order 3)
--   Sweet Sixteen: S16-01 … S16-08       (round_order 4)
--   Elite Eight  : E8-01  … E8-04        (round_order 5)
--   Final Four   : F4-01, F4-02          (round_order 6)
--   Championship : CH-01                  (round_order 7)
--
-- Run this AFTER migration 001.
-- ============================================================

-- Allow pending bracket shells without assigned teams yet.
ALTER TABLE public.events
  ALTER COLUMN team_a_id DROP NOT NULL,
  ALTER COLUMN team_b_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.create_tournament_bracket(p_year integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Championship
  v_ch_01  uuid;

  -- Final Four
  v_f4_01  uuid;
  v_f4_02  uuid;

  -- Elite Eight
  v_e8_01  uuid;
  v_e8_02  uuid;
  v_e8_03  uuid;
  v_e8_04  uuid;

  -- Sweet Sixteen
  v_s16    uuid[] := '{}';

  -- Round of 32
  v_r32    uuid[] := '{}';

  -- Round of 64
  v_r64    uuid[] := '{}';

  -- First Four
  v_ff_01  uuid;
  v_ff_02  uuid;
  v_ff_03  uuid;
  v_ff_04  uuid;

  -- E8 mapping arrays for S16 loop
  v_e8_next uuid[];
  v_e8_slot text[];

  v_temp    uuid;
  i         integer;
BEGIN
  -- Guard: reject duplicate bracket creation
  IF EXISTS (SELECT 1 FROM public.events WHERE tournament_year = p_year LIMIT 1) THEN
    RAISE EXCEPTION 'A bracket already exists for year %', p_year;
  END IF;

  -- Championship (no next event)
  INSERT INTO public.events (round_name, round_order, bracket_slot, tournament_year, status)
  VALUES ('Championship', 7, 'CH-01', p_year, 'pending')
  RETURNING id INTO v_ch_01;

  -- Final Four (→ Championship)
  INSERT INTO public.events (round_name, round_order, bracket_slot, tournament_year, status,
                             next_event_id, next_event_slot)
  VALUES ('Final Four', 6, 'F4-01', p_year, 'pending', v_ch_01, 'team_a')
  RETURNING id INTO v_f4_01;

  INSERT INTO public.events (round_name, round_order, bracket_slot, tournament_year, status,
                             next_event_id, next_event_slot)
  VALUES ('Final Four', 6, 'F4-02', p_year, 'pending', v_ch_01, 'team_b')
  RETURNING id INTO v_f4_02;

  UPDATE public.events
  SET team_a_source_event_id = v_f4_01,
      team_b_source_event_id = v_f4_02
  WHERE id = v_ch_01;

  -- Elite Eight (→ Final Four)
  INSERT INTO public.events (round_name, round_order, bracket_slot, tournament_year, status,
                             next_event_id, next_event_slot)
  VALUES ('Elite Eight', 5, 'E8-01', p_year, 'pending', v_f4_01, 'team_a')
  RETURNING id INTO v_e8_01;

  INSERT INTO public.events (round_name, round_order, bracket_slot, tournament_year, status,
                             next_event_id, next_event_slot)
  VALUES ('Elite Eight', 5, 'E8-02', p_year, 'pending', v_f4_01, 'team_b')
  RETURNING id INTO v_e8_02;

  INSERT INTO public.events (round_name, round_order, bracket_slot, tournament_year, status,
                             next_event_id, next_event_slot)
  VALUES ('Elite Eight', 5, 'E8-03', p_year, 'pending', v_f4_02, 'team_a')
  RETURNING id INTO v_e8_03;

  INSERT INTO public.events (round_name, round_order, bracket_slot, tournament_year, status,
                             next_event_id, next_event_slot)
  VALUES ('Elite Eight', 5, 'E8-04', p_year, 'pending', v_f4_02, 'team_b')
  RETURNING id INTO v_e8_04;

  UPDATE public.events
  SET team_a_source_event_id = v_e8_01, team_b_source_event_id = v_e8_02
  WHERE id = v_f4_01;

  UPDATE public.events
  SET team_a_source_event_id = v_e8_03, team_b_source_event_id = v_e8_04
  WHERE id = v_f4_02;

  -- Sweet Sixteen (→ Elite Eight)
  v_e8_next := ARRAY[v_e8_01, v_e8_01, v_e8_02, v_e8_02, v_e8_03, v_e8_03, v_e8_04, v_e8_04];
  v_e8_slot := ARRAY['team_a','team_b','team_a','team_b','team_a','team_b','team_a','team_b'];

  FOR i IN 1..8 LOOP
    INSERT INTO public.events (round_name, round_order, bracket_slot, tournament_year, status,
                               next_event_id, next_event_slot)
    VALUES ('Sweet Sixteen', 4, 'S16-0' || i, p_year, 'pending', v_e8_next[i], v_e8_slot[i])
    RETURNING id INTO v_temp;
    v_s16 := array_append(v_s16, v_temp);
  END LOOP;

  UPDATE public.events SET team_a_source_event_id = v_s16[1], team_b_source_event_id = v_s16[2] WHERE id = v_e8_01;
  UPDATE public.events SET team_a_source_event_id = v_s16[3], team_b_source_event_id = v_s16[4] WHERE id = v_e8_02;
  UPDATE public.events SET team_a_source_event_id = v_s16[5], team_b_source_event_id = v_s16[6] WHERE id = v_e8_03;
  UPDATE public.events SET team_a_source_event_id = v_s16[7], team_b_source_event_id = v_s16[8] WHERE id = v_e8_04;

  -- Round of 32 (→ Sweet Sixteen)
  FOR i IN 1..16 LOOP
    INSERT INTO public.events (round_name, round_order, bracket_slot, tournament_year, status,
                               next_event_id, next_event_slot)
    VALUES ('Round of 32', 3, 'R32-' || LPAD(i::text, 2, '0'), p_year, 'pending',
            v_s16[(i + 1) / 2],
            CASE WHEN i % 2 = 1 THEN 'team_a' ELSE 'team_b' END)
    RETURNING id INTO v_temp;
    v_r32 := array_append(v_r32, v_temp);
  END LOOP;

  FOR i IN 1..8 LOOP
    UPDATE public.events
    SET team_a_source_event_id = v_r32[i * 2 - 1],
        team_b_source_event_id = v_r32[i * 2]
    WHERE id = v_s16[i];
  END LOOP;

  -- Round of 64 (→ Round of 32)
  FOR i IN 1..32 LOOP
    INSERT INTO public.events (round_name, round_order, bracket_slot, tournament_year, status,
                               next_event_id, next_event_slot)
    VALUES ('Round of 64', 2, 'R64-' || LPAD(i::text, 2, '0'), p_year, 'pending',
            v_r32[(i + 1) / 2],
            CASE WHEN i % 2 = 1 THEN 'team_a' ELSE 'team_b' END)
    RETURNING id INTO v_temp;
    v_r64 := array_append(v_r64, v_temp);
  END LOOP;

  FOR i IN 1..16 LOOP
    UPDATE public.events
    SET team_a_source_event_id = v_r64[i * 2 - 1],
        team_b_source_event_id = v_r64[i * 2]
    WHERE id = v_r32[i];
  END LOOP;

  -- First Four
  INSERT INTO public.events (round_name, round_order, bracket_slot, tournament_year, status,
                             next_event_id, next_event_slot)
  VALUES ('First Four', 1, 'FF-01', p_year, 'pending', v_r64[1], 'team_b')
  RETURNING id INTO v_ff_01;

  INSERT INTO public.events (round_name, round_order, bracket_slot, tournament_year, status,
                             next_event_id, next_event_slot)
  VALUES ('First Four', 1, 'FF-02', p_year, 'pending', v_r64[17], 'team_b')
  RETURNING id INTO v_ff_02;

  INSERT INTO public.events (round_name, round_order, bracket_slot, tournament_year, status,
                             next_event_id, next_event_slot)
  VALUES ('First Four', 1, 'FF-03', p_year, 'pending', v_r64[6], 'team_b')
  RETURNING id INTO v_ff_03;

  INSERT INTO public.events (round_name, round_order, bracket_slot, tournament_year, status,
                             next_event_id, next_event_slot)
  VALUES ('First Four', 1, 'FF-04', p_year, 'pending', v_r64[22], 'team_b')
  RETURNING id INTO v_ff_04;

  UPDATE public.events SET team_b_source_event_id = v_ff_01 WHERE id = v_r64[1];
  UPDATE public.events SET team_b_source_event_id = v_ff_02 WHERE id = v_r64[17];
  UPDATE public.events SET team_b_source_event_id = v_ff_03 WHERE id = v_r64[6];
  UPDATE public.events SET team_b_source_event_id = v_ff_04 WHERE id = v_r64[22];
END;
$$;

-- ============================================================
-- Seed the 2026 tournament bracket
-- Commented out to avoid auto-seeding during migration runs.
-- ============================================================
-- SELECT public.create_tournament_bracket(2026);
