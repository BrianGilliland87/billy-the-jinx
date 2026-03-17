import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  FlatList,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { BillyColors } from "../lib/theme";

type GameEvent = {
  id: string;
  round_name: string | null;
  round_order: number | null;
  bracket_slot: string | null;
  status: string;
  scheduled_start: string | null;
  team_a_id: string;
  team_b_id: string;
  team_a: { name: string } | { name: string }[] | null;
  team_b: { name: string } | { name: string }[] | null;
};

type Selection = {
  event_id: string;
  is_selected: boolean;
};

function getTeamName(team: GameEvent["team_a"]) {
  if (!team) return "TBD";
  return Array.isArray(team) ? (team[0]?.name ?? "TBD") : team.name;
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Open",
  locked: "Locked",
  final: "Final",
  pending: "Upcoming",
};

export default function GamesScreen() {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [selections, setSelections] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    const { data: eventsData, error: eventsError } = await supabase
      .from("events")
      .select(`
        id,
        round_name,
        round_order,
        bracket_slot,
        status,
        scheduled_start,
        team_a_id,
        team_b_id,
        team_a:team_a_id ( name ),
        team_b:team_b_id ( name )
      `)
      .in("status", ["scheduled", "locked", "final"])
      .not("team_a_id", "is", null)
      .not("team_b_id", "is", null)
      .order("round_order", { ascending: true, nullsFirst: false })
      .order("bracket_slot", { ascending: true, nullsFirst: false })
      .order("scheduled_start", { ascending: true, nullsFirst: false });

    if (eventsError) {
      Alert.alert("Load error", eventsError.message);
      setLoading(false);
      return;
    }

    if (userId) {
      const { data: selData } = await supabase
        .from("user_event_selections")
        .select("event_id, is_selected")
        .eq("user_id", userId);

      const selMap = new Map<string, boolean>();
      (selData as Selection[] ?? []).forEach((s) => {
        selMap.set(s.event_id, s.is_selected);
      });
      setSelections(selMap);
    }

    setEvents((eventsData as GameEvent[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleSelection = async (eventId: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return;

    const current = selections.get(eventId) ?? false;
    const next = !current;

    // Optimistic update
    setSelections((prev) => new Map(prev).set(eventId, next));

    if (next) {
      const { error } = await supabase
        .from("user_event_selections")
        .upsert(
          { user_id: userId, event_id: eventId, is_selected: true },
          { onConflict: "user_id,event_id" }
        );
      if (error) {
        setSelections((prev) => new Map(prev).set(eventId, current));
        Alert.alert("Error", error.message);
      }
    } else {
      const { error } = await supabase
        .from("user_event_selections")
        .delete()
        .eq("user_id", userId)
        .eq("event_id", eventId);
      if (error) {
        setSelections((prev) => new Map(prev).set(eventId, current));
        Alert.alert("Error", error.message);
      }
    }
  };

  const selectAll = async () => {
    setSubmitting(true);
    const { data, error } = await supabase.rpc("select_all_active_games");
    setSubmitting(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    await loadData();
    Alert.alert("Games selected", `${data ?? 0} active games are now selected.`);
  };

  const clearAll = async () => {
    Alert.alert(
      "Clear all selections?",
      "This will remove all your game selections.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setSubmitting(true);
            const { error } = await supabase.rpc("clear_all_game_selections");
            setSubmitting(false);

            if (error) {
              Alert.alert("Error", error.message);
              return;
            }

            await loadData();
            Alert.alert("Cleared", "All game selections removed.");
          },
        },
      ]
    );
  };

  const selectedCount = [...selections.values()].filter(Boolean).length;

  const activeEvents = events.filter((e) => e.status !== "final");

  return (
    <FlatList
      data={events}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>My Games</Text>
          <Text style={styles.subtitle}>
            Select games to follow. Billy will curse your chosen teams.
          </Text>

          {loading ? <Text style={styles.info}>Loading games…</Text> : null}

          <View style={styles.actionRow}>
            <Pressable
              style={[styles.actionButton, submitting && styles.buttonDisabled]}
              disabled={submitting}
              onPress={selectAll}
            >
              <Text style={styles.actionButtonText}>
                {submitting ? "Updating…" : "Select All Active"}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.actionButtonSecondary, submitting && styles.buttonDisabled]}
              disabled={submitting}
              onPress={clearAll}
            >
              <Text style={styles.actionButtonSecondaryText}>Clear All</Text>
            </Pressable>
          </View>

          {!loading ? (
            <Text style={styles.countText}>
              {selectedCount} game{selectedCount !== 1 ? "s" : ""} selected ·{" "}
              {activeEvents.length} active
            </Text>
          ) : null}
        </View>
      }
      renderItem={({ item }) => {
        const isSelected = selections.get(item.id) ?? false;
        const teamAName = getTeamName(item.team_a);
        const teamBName = getTeamName(item.team_b);
        const isFinal = item.status === "final";
        const statusLabel = STATUS_LABEL[item.status] ?? item.status;

        return (
          <Pressable
            style={[styles.gameCard, isSelected && styles.gameCardSelected]}
            onPress={() => !isFinal && toggleSelection(item.id)}
          >
            <View style={styles.gameCardTop}>
              <View style={styles.gameInfo}>
                <Text style={styles.gameMatchup}>
                  {teamAName} vs {teamBName}
                </Text>
                <Text style={styles.gameMeta}>
                  {item.round_name ?? ""}
                  {item.bracket_slot ? ` · ${item.bracket_slot}` : ""}
                </Text>
                {item.scheduled_start ? (
                  <Text style={styles.gameDate}>
                    {new Date(item.scheduled_start).toLocaleDateString()}
                  </Text>
                ) : null}
              </View>

              <View style={styles.gameRight}>
                <View
                  style={[
                    styles.statusBadge,
                    item.status === "scheduled" && styles.statusOpen,
                    item.status === "locked" && styles.statusLocked,
                    item.status === "final" && styles.statusFinal,
                  ]}
                >
                  <Text style={styles.statusText}>{statusLabel}</Text>
                </View>

                {!isFinal ? (
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    <Text style={styles.checkboxText}>{isSelected ? "✓" : ""}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {isFinal ? (
              <Pressable
                onPress={() => router.push(`/event/${item.id}` as any)}
                style={styles.viewResultLink}
              >
                <Text style={styles.viewResultText}>View Result →</Text>
              </Pressable>
            ) : null}
          </Pressable>
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
    backgroundColor: BillyColors.background,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 6,
    color: BillyColors.primary,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 20,
    color: BillyColors.mutedText,
    lineHeight: 22,
  },
  info: {
    color: BillyColors.mutedText,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: BillyColors.primary,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  actionButtonSecondary: {
    flex: 1,
    backgroundColor: BillyColors.card,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: BillyColors.border,
  },
  actionButtonSecondaryText: {
    color: BillyColors.text,
    fontWeight: "600",
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  countText: {
    color: BillyColors.mutedText,
    fontSize: 13,
    marginBottom: 16,
  },
  gameCard: {
    borderWidth: 1,
    borderColor: BillyColors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    backgroundColor: BillyColors.card,
  },
  gameCardSelected: {
    borderColor: BillyColors.primary,
    backgroundColor: "#f5f0ff",
  },
  gameCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  gameInfo: {
    flex: 1,
    marginRight: 10,
  },
  gameMatchup: {
    fontSize: 16,
    fontWeight: "700",
    color: BillyColors.text,
    marginBottom: 4,
  },
  gameMeta: {
    fontSize: 13,
    color: BillyColors.mutedText,
  },
  gameDate: {
    fontSize: 12,
    color: BillyColors.mutedText,
    marginTop: 2,
  },
  gameRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#eee",
  },
  statusOpen: {
    backgroundColor: BillyColors.openBg,
  },
  statusLocked: {
    backgroundColor: BillyColors.lockedBg,
  },
  statusFinal: {
    backgroundColor: BillyColors.finalBg,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    color: BillyColors.mutedText,
    textTransform: "uppercase",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: BillyColors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkboxSelected: {
    backgroundColor: BillyColors.primary,
    borderColor: BillyColors.primary,
  },
  checkboxText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  viewResultLink: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BillyColors.border,
  },
  viewResultText: {
    color: BillyColors.primary,
    fontWeight: "600",
    fontSize: 13,
  },
  secondaryButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: BillyColors.border,
    marginTop: 10,
    backgroundColor: BillyColors.card,
  },
  secondaryButtonText: {
    fontWeight: "700",
    color: BillyColors.text,
  },
});
