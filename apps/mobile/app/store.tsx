import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert, ScrollView } from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { BillyColors } from "../lib/theme";

type Profile = {
  id: string;
  free_snack_balance: number;
  paid_snack_balance: number;
  ad_snack_balance: number;
  purchased_snacks_today: number;
  purchased_snacks_date: string | null;
};

export default function StoreScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const loadProfile = async () => {
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (!userId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, free_snack_balance, paid_snack_balance, ad_snack_balance, purchased_snacks_today, purchased_snacks_date"
      )
      .eq("id", userId)
      .single();

    setLoading(false);

    if (error) {
      Alert.alert("Store error", error.message);
      return;
    }

    setProfile(data);
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const createStoreNotification = async (title: string, body: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return;

    await supabase.rpc("create_notification_for_user", {
      p_user_id: userId,
      p_event_id: null,
      p_type: "store",
      p_title: title,
      p_body: body,
    });
  };

  const buyPack = async () => {
    setWorking(true);

    const { error } = await supabase.rpc("purchase_snack_pack");

    setWorking(false);

    if (error) {
      Alert.alert("Purchase blocked", error.message);
      return;
    }

    await createStoreNotification(
      "Snack pack added",
      "Billy added 10 paid snacks to your balance."
    );

    await loadProfile();
    Alert.alert("Snack pack added", "Placeholder purchase successful: +10 paid snacks.");
  };

  const claimAdReward = async () => {
    setWorking(true);

    const { error } = await supabase.rpc("claim_ad_snack");

    setWorking(false);

    if (error) {
      Alert.alert("Ad reward failed", error.message);
      return;
    }

    await createStoreNotification(
      "Ad snack earned",
      "Billy rewarded you with 1 ad snack."
    );

    await loadProfile();
    Alert.alert("Ad snack earned", "Placeholder ad reward successful: +1 ad snack.");
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Snack Store</Text>
      <Text style={styles.subtitle}>Feed Billy, fuel the curse</Text>

      {loading ? <Text style={styles.info}>Loading store...</Text> : null}

      {profile ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your Balances</Text>

          <Text style={styles.label}>Free snacks</Text>
          <Text style={styles.value}>{profile.free_snack_balance}</Text>

          <Text style={styles.label}>Paid snacks</Text>
          <Text style={styles.value}>{profile.paid_snack_balance}</Text>

          <Text style={styles.label}>Ad snacks</Text>
          <Text style={styles.value}>{profile.ad_snack_balance}</Text>

          <Text style={styles.label}>Purchased today</Text>
          <Text style={styles.value}>{profile.purchased_snacks_today} / 20</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Snack Pack</Text>
        <Text style={styles.body}>
          Placeholder purchase flow for beta testing.
        </Text>
        <Text style={styles.price}>10 snacks for $0.99</Text>
        <Text style={styles.body}>Daily purchased snack max: 20</Text>

        <Pressable
          style={[styles.button, working && styles.buttonDisabled]}
          disabled={working}
          onPress={buyPack}
        >
          <Text style={styles.buttonText}>
            {working ? "Processing..." : "Buy 10 Snack Pack"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Rewarded Ad</Text>
        <Text style={styles.body}>
          Placeholder ad reward flow for beta testing.
        </Text>
        <Text style={styles.price}>Watch ad → 1 snack</Text>

        <Pressable
          style={[styles.button, working && styles.buttonDisabled]}
          disabled={working}
          onPress={claimAdReward}
        >
          <Text style={styles.buttonText}>
            {working ? "Processing..." : "Claim 1 Ad Snack"}
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
    backgroundColor: BillyColors.background,
    flexGrow: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 6,
    color: BillyColors.primary,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    color: BillyColors.mutedText,
  },
  info: {
    color: BillyColors.mutedText,
    marginBottom: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: BillyColors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    backgroundColor: BillyColors.card,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 10,
    color: BillyColors.primary,
  },
  label: {
    fontSize: 12,
    color: BillyColors.mutedText,
    marginTop: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 2,
    color: BillyColors.text,
  },
  body: {
    color: BillyColors.mutedText,
    lineHeight: 20,
    marginBottom: 8,
  },
  price: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
    color: BillyColors.text,
  },
  button: {
    backgroundColor: BillyColors.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: "#9f96aa",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
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