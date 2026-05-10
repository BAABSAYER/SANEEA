import { router } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { BottomNav } from "../src/components/bottom-nav";
import { BrandMark, Button, Header, Screen, Surface } from "../src/components/ui";
import { deleteMobileAccount } from "../src/api/mobile";
import { useAuthStore } from "../src/state/auth-store";
import { colors } from "../src/theme/colors";

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const setLanguage = useAuthStore((state) => state.setLanguage);

  async function deleteAccount() {
    Alert.alert(t("deleteAccount"), t("deleteAccountConfirm"), [
      { text: t("commonCancel"), style: "cancel" },
      {
        text: t("deleteAccount"),
        style: "destructive",
        onPress: async () => {
          await deleteMobileAccount();
          logout();
          router.replace("/home");
        },
      },
    ]);
  }

  return (
    <Screen bottom={<BottomNav />}>
      <Header title={t("profile")} right={<BrandMark />} />
      <Surface>
        {user ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.name}>{user.fullName}</Text>
            <Text style={styles.muted}>{user.phone || user.username}</Text>
          </View>
        ) : (
          <Button title={t("loginSignup")} onPress={() => router.push("/auth/login")} />
        )}
      </Surface>
      <Button title={t("language")} variant="ghost" onPress={() => setLanguage(i18n.language === "ar" ? "en" : "ar")} />
      {user ? <Button title={t("logout")} variant="dark" onPress={() => logout()} /> : null}
      {user ? <Button title={t("deleteAccount")} variant="ghost" onPress={deleteAccount} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.black, fontFamily: "Almarai-Bold", fontSize: 20 },
  muted: { color: colors.muted, fontFamily: "Almarai-Regular", fontSize: 14 },
});
