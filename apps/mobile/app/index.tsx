import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert, FlatList } from "react-native";
import { Session } from "@supabase/supabase-js";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import LoginScreen from "./login";

type Profile = {
  id: string;
  email: string | null;
  username: string | null;
  free_snack_balance: number;
  paid_snack_balance: number;
  ad_snack_balance: number;
  last_daily_claim_at: string | null;
};

type EventItem = {
  id: string;
  round_name: string;
  status: string;
  scheduled_start: string;
  contributions_close_at: string;
  billy_support_team_id: string | null;
  winning_team_id: string | null;
  curse_success: boolean | null;
  team_a_id: string;
  team_b_id: string;
  team_a: { name: string } | { name: string }[] | null;
  team_b: { name: string } | { name: string }[] | null;
};

type SectionRow =
  | { type: "section"; title: string }
  | { type: "event"; event: EventItem };

function isSameUtcDay(a: string | null, b: Date) {
  if (!a) return false;
  const d = new Date(a);
  return (
    d.getUTCFullYear() === b.getUTCFullYear() &&
    d.getUTCMonth() === b.getUTCMonth() &&
    d.getUTCDate() === b.getUTCDate()
  );
}

function getTeamName(team: EventItem["team_a"]) {
  if (!team) return "Unknown";
  return Array.isArray(team) ? (team[0]?.name ?? "Unknown") : team.name;
}

function getDisplayStatus(event: EventItem) {
  if (event.status === "final") return "final";
  if (event.contributions_close_at && new Date() >= new Date(event.contributions_close_at)) {
    return "locked";
  }
  return "open";
}

export default function HomeScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId?: string) => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, email, username, free_snack_balance, paid_snack_balance, ad_snack_balance, last_daily_claim_at"
      )
      .eq("id", userId)
      .single();

    if (error) {
      Alert.alert("Profile error", error.message);
      setLoading(false);
      return;
    }

    setProfile(data);
    setLoading(false);
  };

  const loadEvents = async () => {
    setEventsLoading(true);

    const { data, error } = await supabase
      .from("events")
      .select(
        `
        id,
        round_name,
        status,
        scheduled_start,
        contributions_close_at,
        billy_support_team_id,
        winning_team_id,
        curse_success,
        team_a_id,
        team_b_id,
        team_a:team_a_id ( name ),
        team_b:team_b_id ( name )
      `
      )
      .order("scheduled_start");

    if (error) {
      Alert.alert("Events error", error.message);
      setEventsLoading(false);
      return;
    }

    setEvents((data as EventItem[]) ?? []);
    setEventsLoading(false);
  };

  useEffect(() => {
    loadProfile(session?.user?.id);
  }, [session?.user?.id]);

  useEffect(() => {
    if (session) {
      loadEvents();
    } else {
      setEvents([]);
      setEventsLoading(false);
    }
  }, [session]);

  const claimDailySnack = async () => {
    if (!session?.user?.id || !profile) return;

    const now = new Date();

    if (isSameUtcDay(profile.last_daily_claim_at, now)) {
      Alert.alert("Already claimed", "You already claimed your daily snack today.");
      return;
    }

    if (profile.free_snack_balance >= 30) {
      Alert.alert("Snack storage full", "Your free snack storage is already at the max of 30.");
      return;
    }

    setClaiming(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        free_snack_balance: profile.free_snack_balance + 1,
        last_daily_claim_at: now.toISOString(),
      })
      .eq("id", session.user.id);

    setClaiming(false);

    if (error) {
      Alert.alert("Claim failed", error.message);
      return;
    }

    await loadProfile(session.user.id);
    Alert.alert("Daily snack claimed", "Billy gave you 1 snack.");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setEvents([]);
  };

  if (!session) {
    return <LoginScreen />;
  }

  const alreadyClaimedToday = isSameUtcDay(profile?.last_daily_claim_at ?? null, new Date());

  const rows = useMemo(() => {
    const open = events.filter((e) => getDisplayStatus(e) === "open");
    const locked = events.filter((e) => getDisplayStatus(e) === "locked");
    const final = events.filter((e) => getDisplayStatus(e) === "final");

    const result: SectionRow[] = [];

    if (open.length) {
      result.push({ type: "section", title: "Open Events" });
      open.forEach((event) => result.push({ type: "event", event }));
    }

    if (locked.length) {
      result.push({ type: "section", title: "Locked Events" });
      locked.forEach((event) => result.push({ type: "event", event }));
    }

    if (final.length) {
      result.push({ type: "section", title: "Final Events" });
      final.forEach((event) => result.push({ type: "event", event }));
    }

    return result;
  }, [events]);

  return (
    <FlatList
      data={rows}
      keyExtractor={(item, index) =>
        item.type === "section" ? `section-${item.title}-${index}` : item.event.id
      }
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>Billy the Jinx</Text>
          <Text style={styles.subtitle}>Sweet Sixteen HQ</Text>

          {loading ? <Text>Loading profile...</Text> : null}

          {profile ? (
            <View style={styles.card}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{profile.email ?? "-"}</Text>

              <Text style={styles.label}>Username</Text>
              <Text style={styles.value}>{profile.username ?? "-"}</Text>

              <Text style={styles.label}>Free snacks</Text>
              <Text style={styles.value}>{profile.free_snack_balance}</Text>

              <Text style={styles.label}>Paid snacks</Text>
              <Text style={styles.value}>{profile.paid_snack_balance}</Text>

              <Text style={styles.label}>Ad snacks</Text>
              <Text style={styles.value}>{profile.ad_snack_balance}</Text>

              <Text style={styles.label}>Daily claim status</Text>
              <Text style={styles.value}>
                {alreadyClaimedToday ? "Claimed today" : "Available"}
              </Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.button, (claiming || alreadyClaimedToday) && styles.buttonDisabled]}
            onPress={claimDailySnack}
            disabled={claiming || alreadyClaimedToday}
          >
            <Text style={styles.buttonText}>
              {claiming ? "Claiming..." : alreadyClaimedToday ? "Daily Snack Claimed" : "Claim Daily Snack"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.push("/settings" as any)}
          >
            <Text style={styles.secondaryButtonText}>Settings / About</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={signOut}>
            <Text style={styles.secondaryButtonText}>Logout</Text>
          </Pressable>

          {eventsLoading ? <Text style={styles.info}>Loading events...</Text> : null}
          {!eventsLoading && rows.length === 0 ? (
            <Text style={styles.info}>No events found.</Text>
          ) : null}
        </View>
      }
      renderItem={({ item }) => {
        if (item.type === "section") {
          return <Text style={styles.sectionTitle}>{item.title}</Text>;
        }

        const event = item.event;
        const teamA = getTeamName(event.team_a);
        const teamB = getTeamName(event.team_b);
        const displayStatus = getDisplayStatus(event);

        let resultText = "";
        if (displayStatus === "final") {
          resultText = event.curse_success ? "Billy delivered the curse." : "Billy failed to deliver.";
        }

        return (
          <Pressable
            onPress={() =>
  router.push(
    getDisplayStatus(event) === "final"
      ? (`/result/${event.id}` as any)
      : (`/event/${event.id}` as any)
  )
}
            style={styles.eventCard}
          >
            <Text style={styles.eventMatchup}>
              {teamA} vs {teamB}
            </Text>
            <Text style={styles.eventMeta}>Round: {event.round_name}</Text>
            <Text style={styles.eventMeta}>Status: {displayStatus}</Text>
            <Text style={styles.eventMeta}>
              Start: {new Date(event.scheduled_start).toLocaleString()}
            </Text>
            {resultText ? <Text style={styles.resultText}>{resultText}</Text> : null}
            <Text style={styles.eventLink}>
              {displayStatus === "final" ? "View Billy Result" : "Open Event"}
            </Text>
          </Pressable>
        );
      }}
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
  button: {
    backgroundColor: "#111",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
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
    marginBottom: 10,
  },
  secondaryButtonText: {
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 12,
  },
  info: {
    color: "#555",
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
    marginTop: 2,
  },
  resultText: {
    marginTop: 8,
    fontWeight: "600",
  },
  eventLink: {
    marginTop: 10,
    fontWeight: "700",
    color: "#111",
  },
});