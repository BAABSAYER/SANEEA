import { router } from "expo-router";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { BottomNav } from "../src/components/bottom-nav";
import { BrandMark, Button, Header, Screen, Section, Surface } from "../src/components/ui";
import { deleteMobileAccount } from "../src/api/mobile";
import { PRIVACY_POLICY_URL } from "../src/api/client";
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
          try {
            await deleteMobileAccount();
            logout();
            router.replace("/home");
          } catch (error) {
            Alert.alert(t("deleteAccount"), error instanceof Error ? error.message : t("deleteAccountFailed"));
          }
        },
      },
    ]);
  }

  async function openPrivacyPolicy() {
    const supported = await Linking.canOpenURL(PRIVACY_POLICY_URL);
    if (supported) {
      await Linking.openURL(PRIVACY_POLICY_URL);
    }
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
      <Section title={t("settings")}>
        <Button title={t("privacyPolicy")} variant="ghost" onPress={openPrivacyPolicy} />
        <Button title={t("language")} variant="ghost" onPress={() => setLanguage(i18n.language === "ar" ? "en" : "ar")} />
      </Section>
      {user ? (
        <Section title={t("accountSettings")}>
          <Button title={t("logout")} variant="dark" onPress={() => logout()} />
          <Button title={t("deleteAccount")} variant="ghost" onPress={deleteAccount} />
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.black, fontFamily: "Almarai-Bold", fontSize: 20 },
  muted: { color: colors.muted, fontFamily: "Almarai-Regular", fontSize: 14 },
});
