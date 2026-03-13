import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type EventRow = {
  id: string;
  round_name: string;
  status: string;
  scheduled_start: string;
  contributions_close_at: string;
  team_a_id: string;
  team_b_id: string;
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
  if (!team) return "Unknown";
  return Array.isArray(team) ? (team[0]?.name ?? "Unknown") : team.name;
}

export default async function HomePage() {
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select(
      `
      id,
      round_name,
      status,
      scheduled_start,
      contributions_close_at,
      team_a_id,
      team_b_id,
      team_a:team_a_id ( name ),
      team_b:team_b_id ( name )
    `
    )
    .order("scheduled_start");

  const { data: billyStates, error: billyError } = await supabase
    .from("event_billy_state")
    .select(
      "event_id, team_a_id, team_b_id, team_a_total, team_b_total, billy_leaning_team_id"
    );

  const stateMap = new Map<string, BillyStateRow>();
  (billyStates ?? []).forEach((row: BillyStateRow) => {
    stateMap.set(row.event_id, row);
  });

  return (
    <main style={{ padding: 40 }}>
      <h1 style={{ fontSize: 32, marginBottom: 20 }}>Billy the Jinx Admin</h1>
      <h2 style={{ fontSize: 24, marginBottom: 16 }}>Upcoming Events</h2>

      {eventsError ? <p>Error loading events: {eventsError.message}</p> : null}
      {billyError ? <p>Error loading Billy state: {billyError.message}</p> : null}

      {!eventsError && (!events || events.length === 0) ? <p>No events found.</p> : null}

      {events?.map((event: EventRow) => {
        const state = stateMap.get(event.id);
        const teamAName = getTeamName(event.team_a);
        const teamBName = getTeamName(event.team_b);
        const isLocked = new Date() >= new Date(event.contributions_close_at);

        let billyLeaningText = "Billy is undecided";
        if (state?.billy_leaning_team_id === event.team_a_id) {
          billyLeaningText = `Billy leaning: ${teamAName}`;
        } else if (state?.billy_leaning_team_id === event.team_b_id) {
          billyLeaningText = `Billy leaning: ${teamBName}`;
        }

        return (
          <div
            key={event.id}
            style={{
              padding: 14,
              border: "1px solid #ddd",
              borderRadius: 10,
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 18 }}>
              {teamAName} vs {teamBName}
            </div>
            <div style={{ marginTop: 6 }}>Round: {event.round_name}</div>
            <div>Status: {isLocked ? "locked" : event.status}</div>
            <div>Start: {new Date(event.scheduled_start).toLocaleString()}</div>
            <div>
              Close: {new Date(event.contributions_close_at).toLocaleString()}
            </div>
            <div style={{ marginTop: 8, fontWeight: 600 }}>{billyLeaningText}</div>
            <div style={{ marginTop: 4, color: "#555" }}>
              {teamAName}: {state?.team_a_total ?? 0} snacks
            </div>
            <div style={{ color: "#555" }}>
              {teamBName}: {state?.team_b_total ?? 0} snacks
            </div>
          </div>
        );
      })}
    </main>
  );
}