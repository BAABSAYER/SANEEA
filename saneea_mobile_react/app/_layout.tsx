import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import SplashScreen from "../src/components/splash-screen";
import { setupI18n } from "../src/i18n";
import { useAuthStore } from "../src/state/auth-store";
import { colors } from "../src/theme/colors";

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>تعذر فتح التطبيق</Text>
      <Text style={styles.errorMessage}>{error.message}</Text>
      <Pressable style={styles.errorButton} onPress={retry}>
        <Text style={styles.errorButtonText}>إعادة المحاولة</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const language = useAuthStore((state) => state.language);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const [fontsLoaded] = useFonts({
    "Almarai-Regular": require("../assets/fonts/Almarai-Regular.ttf"),
    "Almarai-Bold": require("../assets/fonts/Almarai-Bold.ttf"),
  });

  useEffect(() => {
    setupI18n(language);
  }, [language]);

  if (!fontsLoaded || !hasHydrated) return <SplashScreen />;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

const styles = StyleSheet.create({
  errorButton: {
    backgroundColor: colors.green,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  errorButtonText: {
    color: colors.surface,
    fontFamily: "Almarai-Bold",
    fontSize: 14,
  },
  errorContainer: {
    alignItems: "center",
    backgroundColor: colors.surface,
    flex: 1,
    gap: 14,
    justifyContent: "center",
    padding: 24,
  },
  errorMessage: {
    color: colors.muted,
    fontFamily: "Almarai-Regular",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  errorTitle: {
    color: colors.ink,
    fontFamily: "Almarai-Bold",
    fontSize: 20,
    textAlign: "center",
  },
});
