"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type BracketEvent = {
  id: string;
  round_name: string | null;
  round_order: number | null;
  bracket_slot: string | null;
  status: string;
  scheduled_start: string | null;
  tournament_year: number | null;
  team_a_id: string | null;
  team_b_id: string | null;
  winning_team_id: string | null;
  next_event_id: string | null;
  next_event_slot: string | null;
  team_a_source_event_id: string | null;
  team_b_source_event_id: string | null;
  team_a: { name: string } | { name: string }[] | null;
  team_b: { name: string } | { name: string }[] | null;
};

type Team = {
  id: string;
  name: string;
  tournament_year: number | null;
  display_seed: string | null;
  region: string | null;
};

const ROUNDS = [
  { label: "First Four", order: 1 },
  { label: "Round of 64", order: 2 },
  { label: "Round of 32", order: 3 },
  { label: "Sweet Sixteen", order: 4 },
  { label: "Elite Eight", order: 5 },
  { label: "Final Four", order: 6 },
  { label: "Championship", order: 7 },
];

function getTeamName(team: BracketEvent["team_a"]) {
  if (!team) return null;
  return Array.isArray(team) ? (team[0]?.name ?? null) : team.name;
}

export default function BracketPage() {
  const [events, setEvents] = useState<BracketEvent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState("");
  const [assigning, setAssigning] = useState<string | null>(null);
  const [matchupForm, setMatchupForm] = useState<{
    eventId: string;
    teamAId: string;
    teamBId: string;
    scheduledStart: string;
    closeAt: string;
  } | null>(null);

  // loadData accepts an explicit year parameter so it can be called from
  // the mount effect, filter-change handlers, and the refresh button
  // without relying on potentially-stale state closures.
  const loadData = async (year: string) => {
    let query = supabase
      .from("events")
      .select(`
        id, round_name, round_order, bracket_slot, status,
        scheduled_start, tournament_year,
        team_a_id, team_b_id, winning_team_id,
        next_event_id, next_event_slot,
        team_a_source_event_id, team_b_source_event_id,
        team_a:team_a_id ( name ),
        team_b:team_b_id ( name )
      `)
      .not("round_order", "is", null)
      .order("round_order", { ascending: true })
      .order("bracket_slot", { ascending: true });

    if (year) query = query.eq("tournament_year", parseInt(year));

    const [eventsRes, teamsRes] = await Promise.all([
      query,
      supabase.from("teams").select("id, name, tournament_year, display_seed, region").order("name"),
    ]);

    if (eventsRes.error) { alert(eventsRes.error.message); setLoading(false); return; }

    setEvents((eventsRes.data as BracketEvent[]) ?? []);
    setTeams((teamsRes.data as Team[]) ?? []);
    setLoading(false);
  };

  // Mount-only effect
  useEffect(() => {
    loadData(yearFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleYearChange = (value: string) => {
    setYearFilter(value);
    setLoading(true);
    loadData(value);
  };

  const handleRefresh = () => {
    setLoading(true);
    loadData(yearFilter);
  };

  const openMatchupForm = (event: BracketEvent) => {
    const now = new Date();
    const start = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const close = new Date(start.getTime() - 10 * 60 * 1000);
    setMatchupForm({
      eventId: event.id,
      teamAId: "",
      teamBId: "",
      scheduledStart: start.toISOString().slice(0, 16),
      closeAt: close.toISOString().slice(0, 16),
    });
  };

  const submitMatchup = async () => {
    if (!matchupForm) return;
    if (!matchupForm.teamAId || !matchupForm.teamBId) {
      alert("Select both teams."); return;
    }
    if (matchupForm.teamAId === matchupForm.teamBId) {
      alert("Team A and Team B must be different."); return;
    }

    setAssigning(matchupForm.eventId);
    const { error } = await supabase.rpc("set_event_matchup", {
      p_event_id: matchupForm.eventId,
      p_team_a_id: matchupForm.teamAId,
      p_team_b_id: matchupForm.teamBId,
      p_scheduled_start: new Date(matchupForm.scheduledStart).toISOString(),
      p_contributions_close_at: new Date(matchupForm.closeAt).toISOString(),
    });

    setAssigning(null);
    if (error) { alert(error.message); return; }

    setMatchupForm(null);
    setLoading(true);
    await loadData(yearFilter);
    alert("Matchup set.");
  };

  const uniqueYears = [...new Set(
    events.map(e => e.tournament_year).filter(Boolean)
  )].sort() as number[];

  const teamsForYear = yearFilter
    ? teams.filter(t => t.tournament_year === parseInt(yearFilter))
    : teams;

  const statusColor = (status: string) => {
    if (status === "final")     return "#fff8f0";
    if (status === "scheduled") return "#f7fff4";
    if (status === "locked")    return "#f1eef5";
    return "#fafafa"; // pending
  };

  return (
    <main style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4, color: "#4b1d6b" }}>
        Bracket View
      </h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        View the full tournament bracket by round. Use Set Matchup to assign teams to opening-round games.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <select
          value={yearFilter}
          onChange={(e) => handleYearChange(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}
        >
          <option value="">All Years</option>
          {uniqueYears.map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>
        <button
          onClick={handleRefresh}
          style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ddd",
                   cursor: "pointer", fontSize: 14, background: "#fff" }}
        >
          ↺ Refresh
        </button>
      </div>

      {loading ? <p>Loading bracket…</p> : null}

      {/* Matchup assignment modal */}
      {matchupForm ? (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
        }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 420, maxWidth: "90vw" }}>
            <h3 style={{ margin: "0 0 16px", color: "#4b1d6b" }}>Set Opening Matchup</h3>

            <label style={{ fontSize: 13, fontWeight: 600 }}>Team A</label>
            <select
              value={matchupForm.teamAId}
              onChange={(e) => setMatchupForm({ ...matchupForm, teamAId: e.target.value })}
              style={{ display: "block", width: "100%", padding: "8px", borderRadius: 8,
                       border: "1px solid #ddd", marginBottom: 12, marginTop: 4 }}
            >
              <option value="">Select team…</option>
              {teamsForYear.map(t => (
                <option key={t.id} value={t.id}>
                  {t.display_seed ? `#${t.display_seed} ` : ""}{t.name}{t.region ? ` (${t.region})` : ""}
                </option>
              ))}
            </select>

            <label style={{ fontSize: 13, fontWeight: 600 }}>Team B</label>
            <select
              value={matchupForm.teamBId}
              onChange={(e) => setMatchupForm({ ...matchupForm, teamBId: e.target.value })}
              style={{ display: "block", width: "100%", padding: "8px", borderRadius: 8,
                       border: "1px solid #ddd", marginBottom: 12, marginTop: 4 }}
            >
              <option value="">Select team…</option>
              {teamsForYear.map(t => (
                <option key={t.id} value={t.id}>
                  {t.display_seed ? `#${t.display_seed} ` : ""}{t.name}{t.region ? ` (${t.region})` : ""}
                </option>
              ))}
            </select>

            <label style={{ fontSize: 13, fontWeight: 600 }}>Scheduled Start</label>
            <input
              type="datetime-local"
              value={matchupForm.scheduledStart}
              onChange={(e) => setMatchupForm({ ...matchupForm, scheduledStart: e.target.value })}
              style={{ display: "block", width: "100%", padding: "8px", borderRadius: 8,
                       border: "1px solid #ddd", marginBottom: 12, marginTop: 4 }}
            />

            <label style={{ fontSize: 13, fontWeight: 600 }}>Contributions Close At</label>
            <input
              type="datetime-local"
              value={matchupForm.closeAt}
              onChange={(e) => setMatchupForm({ ...matchupForm, closeAt: e.target.value })}
              style={{ display: "block", width: "100%", padding: "8px", borderRadius: 8,
                       border: "1px solid #ddd", marginBottom: 20, marginTop: 4 }}
            />

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={submitMatchup}
                disabled={!!assigning}
                style={{
                  flex: 1, padding: "10px", background: "#4b1d6b", color: "#fff",
                  border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700,
                  opacity: assigning ? 0.6 : 1,
                }}
              >
                {assigning ? "Saving…" : "Set Matchup"}
              </button>
              <button
                onClick={() => setMatchupForm(null)}
                style={{
                  flex: 1, padding: "10px", background: "#fff", color: "#333",
                  border: "1px solid #ddd", borderRadius: 8, cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Bracket by round */}
      {ROUNDS.map((round) => {
        const roundEvents = events.filter(e => e.round_order === round.order);
        if (roundEvents.length === 0) return null;

        return (
          <section key={round.order} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#4b1d6b", marginBottom: 12,
                         borderBottom: "2px solid #e0d8ea", paddingBottom: 6 }}>
              {round.label} <span style={{ fontSize: 14, color: "#888", fontWeight: 400 }}>
                ({roundEvents.length} games)
              </span>
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
              {roundEvents.map((event) => {
                const teamAName = getTeamName(event.team_a);
                const teamBName = getTeamName(event.team_b);
                const winnerName = event.winning_team_id === event.team_a_id ? teamAName
                  : event.winning_team_id === event.team_b_id ? teamBName : null;
                const isPending = event.status === "pending";

                return (
                  <div
                    key={event.id}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid #e0d8ea",
                      backgroundColor: statusColor(event.status),
                      fontSize: 13,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                      {event.bracket_slot ?? "–"}
                    </div>
                    <div>
                      {teamAName
                        ? <span style={{ fontWeight: event.winning_team_id === event.team_a_id ? 700 : 400 }}>
                            {event.winning_team_id === event.team_a_id ? "🏆 " : ""}{teamAName}
                          </span>
                        : <span style={{ color: "#bbb" }}>TBD</span>}
                    </div>
                    <div style={{ color: "#aaa", fontSize: 11, margin: "2px 0" }}>vs</div>
                    <div>
                      {teamBName
                        ? <span style={{ fontWeight: event.winning_team_id === event.team_b_id ? 700 : 400 }}>
                            {event.winning_team_id === event.team_b_id ? "🏆 " : ""}{teamBName}
                          </span>
                        : <span style={{ color: "#bbb" }}>TBD</span>}
                    </div>
                    {event.scheduled_start ? (
                      <div style={{ marginTop: 4, color: "#888" }}>
                        {new Date(event.scheduled_start).toLocaleString()}
                      </div>
                    ) : null}
                    <div style={{ marginTop: 4, color: "#999" }}>
                      {event.status}
                      {winnerName ? ` · Winner: ${winnerName}` : ""}
                    </div>

                    {isPending && round.order <= 2 ? (
                      <button
                        onClick={() => openMatchupForm(event)}
                        style={{
                          marginTop: 8, padding: "5px 10px", fontSize: 12,
                          background: "#f4e7a1", border: "1px solid #d4af37",
                          borderRadius: 6, cursor: "pointer", fontWeight: 600,
                        }}
                      >
                        Set Matchup
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}
