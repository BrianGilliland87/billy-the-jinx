"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type EventRow = {
  id: string;
  round_name: string;
  round_order: number | null;
  bracket_slot: string | null;
  status: string;
  scheduled_start: string | null;
  contributions_close_at: string | null;
  tournament_year: number | null;
  team_a_id: string;
  team_b_id: string;
  winning_team_id: string | null;
  billy_support_team_id: string | null;
  curse_success: boolean | null;
  next_event_id: string | null;
  next_event_slot: string | null;
  team_a: { name: string } | { name: string }[] | null;
  team_b: { name: string } | { name: string }[] | null;
};

type BillyStateRow = {
  event_id: string;
  team_a_id: string;
  team_b_id: string;
  team_a_total: number;
  team_b_total: number;
  billy_leaning_team_id: string | null;
};

function getTeamName(team: EventRow["team_a"]) {
  if (!team) return "TBD";
  return Array.isArray(team) ? (team[0]?.name ?? "TBD") : team.name;
}

const ROUND_OPTIONS = [
  { label: "All Rounds", value: "" },
  { label: "First Four", value: "1" },
  { label: "Round of 64", value: "2" },
  { label: "Round of 32", value: "3" },
  { label: "Sweet Sixteen", value: "4" },
  { label: "Elite Eight", value: "5" },
  { label: "Final Four", value: "6" },
  { label: "Championship", value: "7" },
];

export default function HomePage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [stateMap, setStateMap] = useState<Map<string, BillyStateRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [roundFilter, setRoundFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [resolving, setResolving] = useState<string | null>(null);

  // loadData does not call setLoading(true) — callers are responsible for that
  const loadData = async (round: string, year: string) => {
    let query = supabase
      .from("events")
      .select(`
        id,
        round_name,
        round_order,
        bracket_slot,
        status,
        scheduled_start,
        contributions_close_at,
        tournament_year,
        team_a_id,
        team_b_id,
        winning_team_id,
        billy_support_team_id,
        curse_success,
        next_event_id,
        next_event_slot,
        team_a:team_a_id ( name ),
        team_b:team_b_id ( name )
      `);

    if (round) query = query.eq("round_order", parseInt(round));
    if (year)  query = query.eq("tournament_year", parseInt(year));
    query = query
      .order("round_order", { ascending: true, nullsFirst: false })
      .order("bracket_slot", { ascending: true, nullsFirst: false })
      .order("scheduled_start", { ascending: true, nullsFirst: false });

    const [eventsRes, billyRes] = await Promise.all([
      query,
      supabase
        .from("event_billy_state")
        .select("event_id, team_a_id, team_b_id, team_a_total, team_b_total, billy_leaning_team_id"),
    ]);

    if (eventsRes.error) { alert(eventsRes.error.message); setLoading(false); return; }
    if (billyRes.error)  { alert(billyRes.error.message);  setLoading(false); return; }

    const nextMap = new Map<string, BillyStateRow>();
    (billyRes.data ?? []).forEach((row: BillyStateRow) => nextMap.set(row.event_id, row));

    setEvents((eventsRes.data as EventRow[]) ?? []);
    setStateMap(nextMap);
    setLoading(false);
  };

  // Mount-only effect — loading starts as true
  useEffect(() => {
    loadData(roundFilter, yearFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter change handlers set loading state before updating filter
  const handleRoundFilterChange = (value: string) => {
    setRoundFilter(value);
    setLoading(true);
    loadData(value, yearFilter);
  };

  const handleYearFilterChange = (value: string) => {
    setYearFilter(value);
    setLoading(true);
    loadData(roundFilter, value);
  };

  const handleRefresh = () => {
    setLoading(true);
    loadData(roundFilter, yearFilter);
  };

  const resolveEvent = async (eventId: string, winningTeamId: string) => {
    setResolving(eventId);
    const { error } = await supabase.rpc("resolve_event_and_advance_winner", {
      p_event_id: eventId,
      p_winning_team_id: winningTeamId,
    });

    setResolving(null);

    if (error) {
      alert(error.message);
      return;
    }

    setLoading(true);
    await loadData(roundFilter, yearFilter);
    alert("Event resolved and winner advanced.");
  };

  const statusBadgeStyle = (status: string) => {
    const base = {
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 700,
      textTransform: "uppercase" as const,
    };
    if (status === "final")     return { ...base, background: "#fff8f0", color: "#c05500" };
    if (status === "locked")    return { ...base, background: "#f1eef5", color: "#4b1d6b" };
    if (status === "scheduled") return { ...base, background: "#f7fff4", color: "#1a7a2a" };
    return { ...base, background: "#f0f0f0", color: "#666" }; // pending
  };

  const uniqueYears = [...new Set(
    events.map(e => e.tournament_year).filter(Boolean)
  )].sort() as number[];

  return (
    <main style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4, color: "#4b1d6b" }}>
        Events
      </h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Resolve games and auto-advance winners through the bracket.
      </p>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <select
          value={roundFilter}
          onChange={(e) => handleRoundFilterChange(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}
        >
          {ROUND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={yearFilter}
          onChange={(e) => handleYearFilterChange(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}
        >
          <option value="">All Years</option>
          {uniqueYears.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>

        <button
          onClick={handleRefresh}
          style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ddd",
                   cursor: "pointer", fontSize: 14, background: "#fff" }}
        >
          ↺ Refresh
        </button>
      </div>

      {loading ? <p>Loading...</p> : null}

      {!loading && events.length === 0 ? (
        <p style={{ color: "#888" }}>No events found for the selected filters.</p>
      ) : null}

      {events.map((event) => {
        const state = stateMap.get(event.id);
        const teamAName = getTeamName(event.team_a);
        const teamBName = getTeamName(event.team_b);
        const isLocked = event.contributions_close_at
          ? new Date() >= new Date(event.contributions_close_at)
          : false;
        const isPending = event.status === "pending";
        const isFinal = event.status === "final";
        const isResolving = resolving === event.id;
        const hasBothTeams = event.team_a_id && event.team_b_id;

        let billyLeaningText = "Billy is undecided";
        if (state?.billy_leaning_team_id === event.team_a_id) {
          billyLeaningText = `Billy leaning: ${teamAName}`;
        } else if (state?.billy_leaning_team_id === event.team_b_id) {
          billyLeaningText = `Billy leaning: ${teamBName}`;
        }

        let finalResultText = "";
        if (isFinal) {
          finalResultText = event.curse_success ? "✅ Curse worked" : "❌ Curse failed";
        }

        const displayStatus = isFinal ? "final" : isLocked ? "locked" : event.status;

        return (
          <div
            key={event.id}
            style={{
              padding: 16,
              border: "1px solid #e0d8ea",
              borderRadius: 12,
              marginBottom: 12,
              backgroundColor: isFinal ? "#fffaf5" : "#fff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontWeight: 700, fontSize: 17 }}>
                {teamAName} vs {teamBName}
              </div>
              <span style={statusBadgeStyle(displayStatus)}>{displayStatus}</span>
            </div>

            <div style={{ marginTop: 6, color: "#666", fontSize: 13, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span>Round: <strong>{event.round_name || "—"}</strong></span>
              {event.bracket_slot ? <span>Slot: <strong>{event.bracket_slot}</strong></span> : null}
              {event.tournament_year ? <span>Year: <strong>{event.tournament_year}</strong></span> : null}
              {event.scheduled_start
                ? <span>Start: {new Date(event.scheduled_start).toLocaleString()}</span>
                : null}
            </div>

            {!isFinal && hasBothTeams ? (
              <div style={{ marginTop: 8, fontSize: 13, color: "#555" }}>
                <span style={{ fontWeight: 600 }}>{billyLeaningText}</span>
                <span style={{ marginLeft: 16 }}>{teamAName}: {state?.team_a_total ?? 0} snacks</span>
                <span style={{ marginLeft: 12 }}>{teamBName}: {state?.team_b_total ?? 0} snacks</span>
              </div>
            ) : null}

            {isFinal ? (
              <div style={{ marginTop: 8, fontWeight: 700, fontSize: 14 }}>{finalResultText}</div>
            ) : null}

            {event.next_event_id ? (
              <div style={{ marginTop: 4, fontSize: 12, color: "#888" }}>
                Winner advances to slot <strong>{event.next_event_slot}</strong> of next event
              </div>
            ) : null}

            {!isFinal && hasBothTeams ? (
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => resolveEvent(event.id, event.team_a_id)}
                  disabled={isResolving}
                  style={{
                    padding: "8px 14px", cursor: "pointer", borderRadius: 8,
                    background: "#4b1d6b", color: "#fff", border: "none",
                    fontWeight: 600, opacity: isResolving ? 0.6 : 1,
                  }}
                >
                  {teamAName} Won
                </button>
                <button
                  onClick={() => resolveEvent(event.id, event.team_b_id)}
                  disabled={isResolving}
                  style={{
                    padding: "8px 14px", cursor: "pointer", borderRadius: 8,
                    background: "#4b1d6b", color: "#fff", border: "none",
                    fontWeight: 600, opacity: isResolving ? 0.6 : 1,
                  }}
                >
                  {teamBName} Won
                </button>
                {isResolving ? <span style={{ alignSelf: "center", color: "#888" }}>Resolving…</span> : null}
              </div>
            ) : null}

            {isPending && !hasBothTeams ? (
              <div style={{ marginTop: 8, fontSize: 13, color: "#aaa" }}>
                Awaiting team assignment
              </div>
            ) : null}
          </div>
        );
      })}
    </main>
  );
}
