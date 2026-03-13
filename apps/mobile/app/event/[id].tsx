import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert, ScrollView } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../lib/supabase";

type EventDetail = {
  id: string;
  round_name: string;
  status: string;
  scheduled_start: string;
  contributions_close_at?: string;
  team_a_id: string;
  team_b_id: string;
  winning_team_id: string | null;
  billy_support_team_id: string | null;
  curse_success: boolean | null;
  team_a: { name: string } | { name: string }[] | null;
  team_b: { name: string } | { name: string }[] | null;
};

type TotalRow = {
  event_id: string;
  supported_team_id: string;
  total_snacks: number;
};

type BillyState = {
  event_id: string;
  team_a_id: string;
  team_b_id: string;
  team_a_total: number;
  team_b_total: number;
  billy_leaning_team_id: string | null;
};

function getTeamName(team: EventDetail["team_a"]) {
  if (!team) return "Unknown";
  return Array.isArray(team) ? (team[0]?.name ?? "Unknown") : team.name;
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [totals, setTotals] = useState<TotalRow[]>([]);
  const [billyState, setBillyState] = useState<BillyState | null>(null);
  const [profileBalance, setProfileBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadEvent = async () => {
    if (!id) return;

    const { data, error } = await supabase
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
        winning_team_id,
        billy_support_team_id,
        curse_success,
        team_a:team_a_id ( name ),
        team_b:team_b_id ( name )
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      Alert.alert("Event error", error.message);
      return;
    }

    setEvent(data as EventDetail);
  };

  const loadTotals = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("event_snack_totals")
      .select("event_id, supported_team_id, total_snacks")
      .eq("event_id", id);

    if (error) {
      Alert.alert("Totals error", error.message);
      return;
    }

    setTotals((data as TotalRow[]) ?? []);
  };

  const loadBillyState = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("event_billy_state")
      .select("event_id, team_a_id, team_b_id, team_a_total, team_b_total, billy_leaning_team_id")
      .eq("event_id", id)
      .single();

    if (error) {
      return;
    }

    setBillyState(data as BillyState);
  };

  const loadProfile = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("free_snack_balance")
      .eq("id", userId)
      .single();

    if (!error && data) {
      setProfileBalance(data.free_snack_balance);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([loadEvent(), loadTotals(), loadBillyState(), loadProfile()]);
    setLoading(false);
  };

  useEffect(() => {
    refreshAll();
  }, [id]);

  const getTotalForTeam = (teamId?: string) => {
    if (!teamId) return 0;
    return totals.find((t) => t.supported_team_id === teamId)?.total_snacks ?? 0;
  };

  const contributeSnack = async (supportedTeamId: string) => {
    if (!id || isLocked || isFinal) return;

    setSubmitting(true);

    const { error } = await supabase.rpc("contribute_snack", {
      p_event_id: id,
      p_supported_team_id: supportedTeamId,
    });

    setSubmitting(false);

    if (error) {
      Alert.alert("Contribution failed", error.message);
      return;
    }

    await refreshAll();
    Alert.alert("Snack contributed", "Billy accepted 1 snack.");
  };

  if (loading || !event) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Loading event...</Text>
      </View>
    );
  }

  const teamAName = getTeamName(event.team_a);
  const teamBName = getTeamName(event.team_b);
  const teamATotal = getTotalForTeam(event.team_a_id);
  const teamBTotal = getTotalForTeam(event.team_b_id);
  const isLocked = event.contributions_close_at
    ? new Date() >= new Date(event.contributions_close_at)
    : false;
  const isFinal = event.status === "final";

  let billyLeaningText = "Billy is undecided";
  if (event.billy_support_team_id === event.team_a_id) {
    billyLeaningText = `Billy supported ${teamAName}`;
  } else if (event.billy_support_team_id === event.team_b_id) {
    billyLeaningText = `Billy supported ${teamBName}`;
  } else if (!isFinal && billyState?.billy_leaning_team_id === event.team_a_id) {
    billyLeaningText = `Billy is leaning toward ${teamAName}`;
  } else if (!isFinal && billyState?.billy_leaning_team_id === event.team_b_id) {
    billyLeaningText = `Billy is leaning toward ${teamBName}`;
  }

  let finalResultText = "";
  if (isFinal) {
    const winningName =
      event.winning_team_id === event.team_a_id ? teamAName :
      event.winning_team_id === event.team_b_id ? teamBName :
      "Unknown";

    finalResultText = event.curse_success
      ? `Curse worked. ${winningName} won while Billy supported the other side.`
      : `Curse failed. ${winningName} won.`;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{teamAName} vs {teamBName}</Text>
      <Text style={styles.subtitle}>{event.round_name}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Status</Text>
        <Text style={styles.value}>
          {isFinal ? "final" : isLocked ? "locked" : event.status}
        </Text>

        <Text style={styles.label}>Start</Text>
        <Text style={styles.value}>{new Date(event.scheduled_start).toLocaleString()}</Text>

        <Text style={styles.label}>Contributions close</Text>
        <Text style={styles.value}>
          {event.contributions_close_at
            ? new Date(event.contributions_close_at).toLocaleString()
            : "-"}
        </Text>

        <Text style={styles.label}>Your free snacks</Text>
        <Text style={styles.value}>{profileBalance}</Text>

        <Text style={styles.label}>Billy status</Text>
        <Text style={styles.billyValue}>{billyLeaningText}</Text>

        {isFinal ? (
          <>
            <Text style={styles.label}>Final result</Text>
            <Text style={styles.finalValue}>{finalResultText}</Text>
          </>
        ) : null}
      </View>

      <Text style={styles.sectionTitle}>Current Support Totals</Text>

      <View style={styles.eventCard}>
        <Text style={styles.eventMatchup}>{teamAName}</Text>
        <Text style={styles.eventMeta}>Snacks: {teamATotal}</Text>
        <Pressable
          style={[styles.button, (submitting || isLocked || isFinal) && styles.buttonDisabled]}
          disabled={submitting || isLocked || isFinal}
          onPress={() => contributeSnack(event.team_a_id)}
        >
          <Text style={styles.buttonText}>
            {isFinal ? "Event Final" : isLocked ? "Event Locked" : `Support ${teamAName}`}
          </Text>
        </Pressable>
      </View>

      <View style={styles.eventCard}>
        <Text style={styles.eventMatchup}>{teamBName}</Text>
        <Text style={styles.eventMeta}>Snacks: {teamBTotal}</Text>
        <Pressable
          style={[styles.button, (submitting || isLocked || isFinal) && styles.buttonDisabled]}
          disabled={submitting || isLocked || isFinal}
          onPress={() => contributeSnack(event.team_b_id)}
        >
          <Text style={styles.buttonText}>
            {isFinal ? "Event Final" : isLocked ? "Event Locked" : `Support ${teamBName}`}
          </Text>
        </Pressable>
      </View>

      <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryButtonText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 40,
    backgroundColor: "#fff",
    flexGrow: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    color: "#555",
  },
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
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
  billyValue: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 2,
  },
  finalValue: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
  },
  eventCard: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  eventMatchup: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  eventMeta: {
    color: "#666",
    marginBottom: 10,
  },
  button: {
    backgroundColor: "#111",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
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