"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Tournament = {
  id: string;
  year: number;
  name: string;
  is_active: boolean;
  created_at: string;
};

export default function TournamentPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [buildingBracket, setBuildingBracket] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear().toString());
  const [newName, setNewName] = useState("");

  const loadData = async () => {
    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .order("year", { ascending: false });

    if (error) { alert(error.message); setLoading(false); return; }
    setTournaments((data as Tournament[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  const createTournament = async () => {
    const year = parseInt(newYear);
    if (!year || year < 2020 || year > 2100) {
      alert("Enter a valid year (2020–2100)."); return;
    }
    if (!newName.trim()) {
      alert("Enter a tournament name."); return;
    }

    setCreating(true);
    const { error } = await supabase.from("tournaments").insert({
      year,
      name: newName.trim(),
      is_active: false,
    });
    setCreating(false);

    if (error) { alert(error.message); return; }
    setNewYear("");
    setNewName("");
    await loadData();
    alert(`Tournament ${year} created.`);
  };

  const buildBracket = async (year: number) => {
    const confirmed = window.confirm(
      `Build all 67 bracket game shells for ${year}?\n\nThis is irreversible.`
    );
    if (!confirmed) return;

    setBuildingBracket(true);
    const { error } = await supabase.rpc("create_tournament_bracket", { p_year: year });
    setBuildingBracket(false);

    if (error) { alert(error.message); return; }
    alert(`Bracket for ${year} created — 67 game shells are ready. Go to the Bracket page to assign teams.`);
  };

  const toggleActive = async (tournament: Tournament) => {
    const { error } = await supabase
      .from("tournaments")
      .update({ is_active: !tournament.is_active })
      .eq("id", tournament.id);

    if (error) { alert(error.message); return; }
    await loadData();
  };

  return (
    <main style={{ padding: 32, maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4, color: "#4b1d6b" }}>
        Tournament Management
      </h1>
      <p style={{ color: "#666", marginBottom: 32 }}>
        Create tournament years and build bracket game shells.
      </p>

      {/* Create new tournament */}
      <section style={{ border: "1px solid #e0d8ea", borderRadius: 12, padding: 20, marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#4b1d6b" }}>
          Create Tournament
        </h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Year</label>
            <input
              type="number"
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
              placeholder="2026"
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", width: 100 }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="NCAA Tournament 2026"
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", width: "100%" }}
            />
          </div>
          <button
            onClick={createTournament}
            disabled={creating}
            style={{
              padding: "8px 20px", background: "#4b1d6b", color: "#fff",
              border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700,
              opacity: creating ? 0.6 : 1,
            }}
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
      </section>

      {/* Tournament list */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#4b1d6b" }}>
          Tournaments
        </h2>

        {loading ? <p>Loading…</p> : null}

        {!loading && tournaments.length === 0 ? (
          <p style={{ color: "#888" }}>No tournaments yet. Create one above.</p>
        ) : null}

        {tournaments.map((t) => (
          <div
            key={t.id}
            style={{
              padding: 16, border: "1px solid #e0d8ea", borderRadius: 12,
              marginBottom: 12, display: "flex", justifyContent: "space-between",
              alignItems: "center", flexWrap: "wrap", gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{t.name}</div>
              <div style={{ color: "#666", fontSize: 13, marginTop: 2 }}>
                Year: {t.year} ·{" "}
                <span style={{
                  fontWeight: 600,
                  color: t.is_active ? "#1a7a2a" : "#888",
                }}>
                  {t.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => toggleActive(t)}
                style={{
                  padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontWeight: 600,
                  background: t.is_active ? "#fff0f0" : "#f0fff0",
                  border: `1px solid ${t.is_active ? "#f88" : "#6c6"}`,
                  color: t.is_active ? "#a00" : "#080",
                }}
              >
                {t.is_active ? "Deactivate" : "Activate"}
              </button>
              <button
                onClick={() => buildBracket(t.year)}
                disabled={buildingBracket}
                style={{
                  padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontWeight: 600,
                  background: "#f4e7a1", border: "1px solid #d4af37", color: "#5a4000",
                  opacity: buildingBracket ? 0.6 : 1,
                }}
              >
                {buildingBracket ? "Building…" : "Build Bracket"}
              </button>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
