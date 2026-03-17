"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Team = {
  id: string;
  name: string;
  tournament_year: number | null;
  display_seed: string | null;
  region: string | null;
};

const REGIONS = ["East", "Midwest", "South", "West", ""];

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [yearFilter, setYearFilter] = useState("");

  // New team form
  const [newName, setNewName] = useState("");
  const [newYear, setNewYear] = useState(new Date().getFullYear().toString());
  const [newSeed, setNewSeed] = useState("");
  const [newRegion, setNewRegion] = useState("");

  const loadData = async (year: string) => {
    let query = supabase
      .from("teams")
      .select("id, name, tournament_year, display_seed, region")
      .order("tournament_year", { ascending: false, nullsFirst: false })
      .order("region")
      .order("display_seed");

    if (year) query = query.eq("tournament_year", parseInt(year));

    const { data, error } = await query;
    if (error) { alert(error.message); setLoading(false); return; }
    setTeams((data as Team[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadData(yearFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleYearChange = (value: string) => {
    setYearFilter(value);
    setLoading(true);
    loadData(value);
  };

  const addTeam = async () => {
    if (!newName.trim()) { alert("Enter a team name."); return; }

    setSaving(true);
    const { error } = await supabase.from("teams").insert({
      name: newName.trim(),
      tournament_year: newYear ? parseInt(newYear) : null,
      display_seed: newSeed.trim() || null,
      region: newRegion.trim() || null,
    });
    setSaving(false);

    if (error) { alert(error.message); return; }
    setNewName("");
    setNewSeed("");
    await loadData(yearFilter);
  };

  const deleteTeam = async (id: string, name: string) => {
    if (!window.confirm(`Delete team "${name}"?`)) return;
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    await loadData(yearFilter);
  };

  const uniqueYears = [...new Set(
    teams.map(t => t.tournament_year).filter(Boolean)
  )].sort() as number[];

  const groupedByRegion = teams.reduce<Record<string, Team[]>>((acc, t) => {
    const key = t.region ?? "No Region";
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <main style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4, color: "#4b1d6b" }}>
        Teams
      </h1>
      <p style={{ color: "#666", marginBottom: 32 }}>
        Manage tournament teams by year. Add seeds and regions for bracket assignment.
      </p>

      {/* Add team form */}
      <section style={{ border: "1px solid #e0d8ea", borderRadius: 12, padding: 20, marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#4b1d6b" }}>
          Add Team
        </h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 2, minWidth: 160 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Team Name *
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Duke"
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", width: "100%" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Year</label>
            <input
              type="number"
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
              placeholder="2026"
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", width: 90 }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Seed</label>
            <input
              type="text"
              value={newSeed}
              onChange={(e) => setNewSeed(e.target.value)}
              placeholder="1"
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", width: 70 }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Region</label>
            <select
              value={newRegion}
              onChange={(e) => setNewRegion(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd" }}
            >
              <option value="">—</option>
              {REGIONS.filter(Boolean).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button
            onClick={addTeam}
            disabled={saving}
            style={{
              padding: "8px 20px", background: "#4b1d6b", color: "#fff",
              border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Adding…" : "Add Team"}
          </button>
        </div>
      </section>

      {/* Year filter */}
      <div style={{ marginBottom: 20, display: "flex", gap: 10, alignItems: "center" }}>
        <label style={{ fontWeight: 600 }}>Filter by year:</label>
        <select
          value={yearFilter}
          onChange={(e) => handleYearChange(e.target.value)}
          style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #ddd" }}
        >
          <option value="">All Years</option>
          {uniqueYears.map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>
        <span style={{ color: "#888", fontSize: 13 }}>{teams.length} teams</span>
      </div>

      {loading ? <p>Loading…</p> : null}

      {!loading && teams.length === 0 ? (
        <p style={{ color: "#888" }}>No teams found. Add one above.</p>
      ) : null}

      {/* Teams grouped by region */}
      {Object.entries(groupedByRegion).map(([region, regionTeams]) => (
        <section key={region} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#4b1d6b", marginBottom: 8,
                       borderBottom: "1px solid #e0d8ea", paddingBottom: 4 }}>
            {region}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
            {regionTeams.map((team) => (
              <div
                key={team.id}
                style={{
                  padding: "10px 14px", border: "1px solid #e0d8ea", borderRadius: 10,
                  background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {team.display_seed ? <span style={{ color: "#4b1d6b", marginRight: 6 }}>#{team.display_seed}</span> : null}
                    {team.name}
                  </div>
                  {team.tournament_year ? (
                    <div style={{ fontSize: 12, color: "#888" }}>{team.tournament_year}</div>
                  ) : null}
                </div>
                <button
                  onClick={() => deleteTeam(team.id, team.name)}
                  style={{
                    padding: "3px 8px", background: "#fff0f0", border: "1px solid #f88",
                    borderRadius: 6, cursor: "pointer", color: "#a00", fontSize: 12,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
