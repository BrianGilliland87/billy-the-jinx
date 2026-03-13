import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView } from "react-native";
import { supabase } from "../lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const signUp = async () => {
    if (!agreed) {
      Alert.alert(
        "Agreement required",
        "You must agree that Billy the Jinx is for entertainment purposes only."
      );
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      Alert.alert("Sign up failed", error.message);
      return;
    }

    Alert.alert("Account created", "Your account was created. You can now sign in.");
  };

  const signIn = async () => {
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      Alert.alert("Login failed", error.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Billy the Jinx</Text>
      <Text style={styles.subtitle}>Sign in to feed Billy</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <View style={styles.disclaimerCard}>
        <Text style={styles.disclaimerTitle}>Entertainment Notice</Text>
        <Text style={styles.disclaimerText}>
          Billy the Jinx is a fictional entertainment experience for sports fans.
          Snack contributions and Billy’s “curse” are game mechanics only and do
          not affect real sporting events or outcomes.
        </Text>
        <Text style={styles.disclaimerText}>
          This app does not involve gambling or real-money wagering.
        </Text>

        <Pressable
          style={[styles.checkboxRow, agreed && styles.checkboxRowActive]}
          onPress={() => setAgreed(!agreed)}
        >
          <Text style={styles.checkbox}>{agreed ? "☑" : "☐"}</Text>
          <Text style={styles.checkboxLabel}>
            I understand this app is for entertainment purposes only.
          </Text>
        </Pressable>
      </View>

      <Pressable style={styles.button} onPress={signIn} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Please wait..." : "Login"}</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={signUp} disabled={loading}>
        <Text style={styles.secondaryButtonText}>Create Account</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  disclaimerCard: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  disclaimerTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  disclaimerText: {
    color: "#555",
    marginBottom: 8,
    lineHeight: 20,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 10,
  },
  checkboxRowActive: {
    borderColor: "#111",
  },
  checkbox: {
    fontSize: 20,
    marginRight: 10,
  },
  checkboxLabel: {
    flex: 1,
    lineHeight: 20,
    fontWeight: "600",
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