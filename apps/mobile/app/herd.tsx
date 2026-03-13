import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert, FlatList, TextInput } from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";

type Profile = {
  id: string;
  primary_team_id: string | null;
  herd_id: string | null;
};

type Team = {
  id: string;
  name: string;
};

type Herd = {
  id: string;
  name: string;
  team_id: string;
  invite_code: string;
  team: { name: string } | { name: string }[] | null;
};

function getTeamName(team: Herd["team"]) {
  if (!team) return "Unknown";
  return Array.isArray(team) ? (team[0]?.name ?? "Unknown") : team.name;
}

function makeInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function HerdScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [herds, setHerds] = useState<Herd[]>([]);
  const [newHerdName, setNewHerdName] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (!userId) {
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, primary_team_id, herd_id")
      .eq("id", userId)
      .single();

    if (profileError) {
      Alert.alert("Profile error", profileError.message);
      setLoading(false);
      return;
    }

    const { data: teamsData, error: teamsError } = await supabase
      .from("teams")
      .select("id, name")
      .order("name");

    if (teamsError) {
      Alert.alert("Teams error", teamsError.message);
      setLoading(false);
      return;
    }

    const { data: herdsData, error: herdsError } = await supabase
      .from("herds")
      .select(`
        id,
        name,
        team_id,
        invite_code,
        team:team_id ( name )
      `)
      .order("name");

    if (herdsError) {
      Alert.alert("Herds error", herdsError.message);
      setLoading(false);
      return;
    }

    setProfile(profileData);
    setTeams((teamsData as Team[]) ?? []);
    setHerds((herdsData as Herd[]) ?? []);
    setSelectedTeamId(profileData.primary_team_id ?? null);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const createHerd = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (!userId) {
      Alert.alert("Not signed in", "Please sign in again.");
      return;
    }

    if (!newHerdName.trim()) {
      Alert.alert("Name required", "Enter a Herd name.");
      return;
    }

    if (!selectedTeamId) {
      Alert.alert("Team required", "Select a team for your Herd.");
      return;
    }

    const inviteCode = makeInviteCode();

    const { data, error } = await supabase
      .from("herds")
      .insert({
        name: newHerdName.trim(),
        team_id: selectedTeamId,
        invite_code: inviteCode,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) {
      Alert.alert("Create Herd failed", error.message);
      return;
    }

    const { error: joinError } = await supabase.rpc("join_herd", {
      p_herd_id: data.id,
    });

    if (joinError) {
      Alert.alert("Join Herd failed", joinError.message);
      return;
    }

    setNewHerdName("");
    await loadData();
    Alert.alert("Herd created", "Your Herd is ready.");
  };

  const joinHerd = async (herdId: string) => {
    const { error } = await supabase.rpc("join_herd", {
      p_herd_id: herdId,
    });

    if (error) {
      Alert.alert("Join Herd failed", error.message);
      return;
    }

    await loadData();
    Alert.alert("Joined Herd", "You joined the Herd.");
  };

  const activeHerd = herds.find((h) => h.id === profile?.herd_id) ?? null;

  return (
    <FlatList
      data={herds}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>Your Herd</Text>
          <Text style={styles.subtitle}>Join forces with fans of the same team</Text>

          {loading ? <Text style={styles.info}>Loading Herds...</Text> : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Current Herd</Text>
            {activeHerd ? (
              <>
                <Text style={styles.value}>{activeHerd.name}</Text>
                <Text style={styles.meta}>Team: {getTeamName(activeHerd.team)}</Text>
                <Text style={styles.meta}>Invite code: {activeHerd.invite_code}</Text>
              </>
            ) : (
              <Text style={styles.info}>You have not joined a Herd yet.</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Create a Herd</Text>

            <TextInput
              style={styles.input}
              placeholder="Herd name"
              value={newHerdName}
              onChangeText={setNewHerdName}
            />

            <Text style={styles.label}>Select team</Text>
            <View style={styles.teamList}>
              {teams.map((team) => (
                <Pressable
                  key={team.id}
                  style={[
                    styles.teamChip,
                    selectedTeamId === team.id && styles.teamChipActive,
                  ]}
                  onPress={() => setSelectedTeamId(team.id)}
                >
                  <Text
                    style={[
                      styles.teamChipText,
                      selectedTeamId === team.id && styles.teamChipTextActive,
                    ]}
                  >
                    {team.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.button} onPress={createHerd}>
              <Text style={styles.buttonText}>Create Herd</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Available Herds</Text>
        </View>
      }
      renderItem={({ item }) => {
        const joined = profile?.herd_id === item.id;

        return (
          <View style={styles.herdCard}>
            <Text style={styles.herdName}>{item.name}</Text>
            <Text style={styles.meta}>Team: {getTeamName(item.team)}</Text>
            <Text style={styles.meta}>Invite code: {item.invite_code}</Text>

            <Pressable
              style={[styles.button, joined && styles.buttonDisabled]}
              disabled={joined}
              onPress={() => joinHerd(item.id)}
            >
              <Text style={styles.buttonText}>
                {joined ? "Current Herd" : "Join Herd"}
              </Text>
            </Pressable>
          </View>
        );
      }}
      ListFooterComponent={
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 40,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    color: "#555",
  },
  info: {
    color: "#555",
    marginBottom: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    marginBottom: 18,
    backgroundColor: "#fff",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
  },
  value: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 6,
  },
  meta: {
    color: "#666",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  teamList: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  teamChip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  teamChipActive: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  teamChipText: {
    color: "#111",
  },
  teamChipTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  herdCard: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  herdName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  button: {
    backgroundColor: "#111",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: "#999",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  secondaryButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    marginTop: 10,
  },
  secondaryButtonText: {
    fontWeight: "600",
  },
});