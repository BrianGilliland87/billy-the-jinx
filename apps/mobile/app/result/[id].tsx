import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../lib/supabase";

type EventDetail = {
  id: string;
  round_name: string;
  status: string;
  scheduled_start: string;
  winning_team_id: string | null;
  billy_support_team_id: string | null;
  curse_success: boolean | null;
  team_a_id: string;
  team_b_id: string;
  team_a: { name: string } | { name: string }[] | null;
  team_b: { name: string } | { name: string }[] | null;
};

function getTeamName(team: EventDetail["team_a"]) {
  if (!team) return "Unknown";
  return Array.isArray(team) ? (team[0]?.name ?? "Unknown") : team.name;
}

export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEvent = async () => {
      if (!id) return;

      const { data, error } = await supabase
        .from("events")
        .select(`
          id,
          round_name,
          status,
          scheduled_start,
          winning_team_id,
          billy_support_team_id,
          curse_success,
          team_a_id,
          team_b_id,
          team_a:team_a_id ( name ),
          team_b:team_b_id ( name )
        `)
        .eq("id", id)
        .single();

      if (!error) {
        setEvent(data as EventDetail);
      }

      setLoading(false);
    };

    loadEvent();
  }, [id]);

  if (loading || !event) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Loading Billy result...</Text>
      </View>
    );
  }

  const teamAName = getTeamName(event.team_a);
  const teamBName = getTeamName(event.team_b);

  const winningName =
    event.winning_team_id === event.team_a_id
      ? teamAName
      : event.winning_team_id === event.team_b_id
      ? teamBName
      : "Unknown";

  const billySupportedName =
    event.billy_support_team_id === event.team_a_id
      ? teamAName
      : event.billy_support_team_id === event.team_b_id
      ? teamBName
      : "No one";

  const success = !!event.curse_success;

  return (
    <ScrollView contentContainerStyle={[styles.container, success ? styles.successBg : styles.failureBg]}>
      <Text style={styles.title}>Billy the Jinx</Text>
      <Text style={styles.subtitle}>{teamAName} vs {teamBName}</Text>

      <View style={styles.heroCard}>
        <Text style={styles.heroEmoji}>{success ? "🎉" : "😞"}</Text>
        <Text style={styles.heroTitle}>
          {success ? "Billy Delivered the Curse!" : "Billy Failed to Deliver"}
        </Text>
        <Text style={styles.heroText}>
          {success
            ? `Billy supported ${billySupportedName}, and ${winningName} won. The curse worked.`
            : `Billy supported ${billySupportedName}, but ${winningName} won anyway.`}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Round</Text>
        <Text style={styles.value}>{event.round_name}</Text>

        <Text style={styles.label}>Winning team</Text>
        <Text style={styles.value}>{winningName}</Text>

        <Text style={styles.label}>Billy supported</Text>
        <Text style={styles.value}>{billySupportedName}</Text>

        <Text style={styles.label}>Result</Text>
        <Text style={styles.value}>{success ? "Curse worked" : "Curse failed"}</Text>
      </View>

      <View style={styles.messageCard}>
        <Text style={styles.messageTitle}>
          {success ? "Billy says:" : "Billy apologizes:"}
        </Text>
        <Text style={styles.messageText}>
          {success
            ? "I told you not to test the power of the snack curse."
            : "That one slipped through my fingers. Feed me again next time."}
        </Text>
      </View>

      <Pressable style={styles.button} onPress={() => router.replace("/" as any)}>
        <Text style={styles.buttonText}>Back to Home</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryButtonText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  successBg: {
    backgroundColor: "#f6fff4",
  },
  failureBg: {
    backgroundColor: "#fff8f6",
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
  heroCard: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 16,
    padding: 20,
    marginBottom: 18,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  heroEmoji: {
    fontSize: 48,
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  heroText: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    color: "#444",
  },
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  label: {
    fontSize: 12,
    color: "#666",
    marginTop: 10,
  },
  value: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 2,
  },
  messageCard: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    backgroundColor: "#fff",
  },
  messageTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    color: "#444",
  },
  button: {
    backgroundColor: "#111",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
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
  },
  secondaryButtonText: {
    fontWeight: "600",
  },
});