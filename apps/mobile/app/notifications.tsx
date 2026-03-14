import { useCallback, useState } from "react";
import { useFocusEffect, router } from "expo-router";
import { View, Text, StyleSheet, Pressable, FlatList, Alert } from "react-native";
import { supabase } from "../lib/supabase";

type NotificationItem = {
  id: string;
  event_id: string | null;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsScreen() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("notifications")
      .select("id, event_id, type, title, body, is_read, created_at")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      Alert.alert("Notifications error", error.message);
      return;
    }

    setItems((data as NotificationItem[]) ?? []);
  };

  useFocusEffect(
  useCallback(() => {
    loadNotifications();
  }, [])
);

  const markRead = async (id: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    if (error) {
      Alert.alert("Update error", error.message);
      return;
    }

    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, is_read: true } : item))
    );
  };

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>Your Billy updates</Text>
          {loading ? <Text style={styles.info}>Loading notifications...</Text> : null}
          {!loading && items.length === 0 ? (
            <Text style={styles.info}>No notifications yet.</Text>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          style={[styles.card, item.is_read && styles.cardRead]}
          onPress={async () => {
            if (!item.is_read) {
              await markRead(item.id);
            }

            if (item.event_id) {
              router.push(`/event/${item.event_id}` as any);
            }
          }}
        >
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardBody}>{item.body}</Text>
          <Text style={styles.cardMeta}>
            {new Date(item.created_at).toLocaleString()} · {item.is_read ? "Read" : "Unread"}
          </Text>
        </Pressable>
      )}
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
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  cardRead: {
    opacity: 0.65,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
  },
  cardBody: {
    color: "#444",
    lineHeight: 20,
    marginBottom: 8,
  },
  cardMeta: {
    color: "#666",
    fontSize: 12,
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