import { ScrollView, Text, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";

export default function SettingsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Settings / About</Text>

      <Text style={styles.sectionTitle}>Entertainment Disclaimer</Text>
      <Text style={styles.body}>
        Billy the Jinx is a fictional entertainment experience for sports fans.
        Snack contributions, support totals, and Billy’s “curse” are game mechanics only.
      </Text>
      <Text style={styles.body}>
        This app does not influence real sporting events, does not involve gambling,
        and has no cash value.
      </Text>

      <Text style={styles.sectionTitle}>Privacy</Text>
      <Text style={styles.body}>
        Basic account and gameplay data are stored so your profile, snack balances,
        and event participation can be shown inside the app.
      </Text>

      <Text style={styles.sectionTitle}>Version</Text>
      <Text style={styles.body}>Billy the Jinx Beta</Text>

      <Pressable style={styles.button} onPress={() => router.back()}>
        <Text style={styles.buttonText}>Back</Text>
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
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 14,
  },
  body: {
    color: "#555",
    lineHeight: 22,
    marginBottom: 10,
  },
  button: {
    backgroundColor: "#111",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
});