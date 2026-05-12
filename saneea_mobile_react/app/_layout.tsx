import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { useEffect } from "react";
import SplashScreen from "../src/components/splash-screen";
import { setupI18n } from "../src/i18n";
import { useAuthStore } from "../src/state/auth-store";

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
