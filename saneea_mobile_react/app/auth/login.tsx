import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { loginWithPhone, requestPasswordResetOtp, requestSignupOtp, verifyPasswordResetOtp, verifySignupOtp } from "../../src/api/mobile";
import { OtpCodeInput, emptyOtpDigits } from "../../src/components/otp-code-input";
import { BrandMark, Button, Field, PageHeader, Screen, Surface } from "../../src/components/ui";
import { useAuthStore } from "../../src/state/auth-store";
import { colors } from "../../src/theme/colors";

type Mode = "login" | "signup" | "signupOtp" | "forgot" | "forgotOtp";

export default function LoginScreen() {
  const { t } = useTranslation();
  const setSession = useAuthStore((state) => state.setSession);
  const [mode, setMode] = useState<Mode>("login");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [digits, setDigits] = useState(emptyOtpDigits());
  const [loading, setLoading] = useState(false);

  async function run(action: () => Promise<void>) {
    setLoading(true);
    try {
      await action();
    } catch (err) {
      Alert.alert(err instanceof Error ? err.message : t("failedToLoad"));
    } finally {
      setLoading(false);
    }
  }

  async function login() {
    await run(async () => {
      const data = await loginWithPhone({ phone, password });
      setSession(data.token, data.user);
      router.replace("/home");
    });
  }

  async function startSignup() {
    await run(async () => {
      await requestSignupOtp({ phone, fullName, password });
      setDigits(emptyOtpDigits());
      setMode("signupOtp");
    });
  }

  async function verifySignup() {
    await run(async () => {
      const data = await verifySignupOtp({ phone, fullName, password, code: digits.join("") });
      setSession(data.token, data.user);
      router.replace("/home");
    });
  }

  async function startForgot() {
    await run(async () => {
      await requestPasswordResetOtp({ phone });
      setDigits(emptyOtpDigits());
      setMode("forgotOtp");
    });
  }

  async function verifyForgot() {
    await run(async () => {
      const data = await verifyPasswordResetOtp({ phone, password, code: digits.join("") });
      setSession(data.token, data.user);
      router.replace("/home");
    });
  }

  const isOtp = mode === "signupOtp" || mode === "forgotOtp";

  return (
    <Screen>
      <PageHeader title={t("authTitle")} subtitle={t("authSubtitle")} onBack={() => router.back()} right={<BrandMark />} />
      <Surface>
        <View style={{ gap: 14 }}>
          {!isOtp ? <Field label={t("phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" /> : null}
          {mode === "signup" ? <Field label={t("name")} value={fullName} onChangeText={setFullName} /> : null}
          {!isOtp || mode === "forgotOtp" ? <Field label={mode === "forgotOtp" ? t("newPassword") : t("password")} value={password} onChangeText={setPassword} secureTextEntry /> : null}
          {isOtp ? (
            <>
              <Text style={styles.otpTitle}>{t("otpTitle")}</Text>
              <Text style={styles.muted}>{t("otpSubtitle", { phone })}</Text>
              <OtpCodeInput digits={digits} setDigits={setDigits} />
            </>
          ) : null}
          {mode === "login" ? <Button title={loading ? t("loading") : t("login")} onPress={login} disabled={loading} /> : null}
          {mode === "signup" ? <Button title={loading ? t("loading") : t("sendOtp")} onPress={startSignup} disabled={loading} /> : null}
          {mode === "signupOtp" ? <Button title={loading ? t("loading") : t("verify")} onPress={verifySignup} disabled={loading} /> : null}
          {mode === "forgot" ? <Button title={loading ? t("loading") : t("sendOtp")} onPress={startForgot} disabled={loading} /> : null}
          {mode === "forgotOtp" ? <Button title={loading ? t("loading") : t("resetPassword")} onPress={verifyForgot} disabled={loading} /> : null}
          <View style={styles.links}>
            <Pressable onPress={() => setMode(mode === "login" ? "signup" : "login")}>
              <Text style={styles.link}>{mode === "login" ? t("signup") : t("login")}</Text>
            </Pressable>
            <Pressable onPress={() => setMode("forgot")}>
              <Text style={styles.link}>{t("forgotPassword")}</Text>
            </Pressable>
          </View>
        </View>
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  links: { flexDirection: "row", gap: 16, justifyContent: "center" },
  link: { color: colors.green, fontFamily: "Almarai-Bold", fontSize: 14 },
  muted: { color: colors.muted, fontFamily: "Almarai-Regular", fontSize: 13, textAlign: "center" },
  otpTitle: { color: colors.black, fontFamily: "Almarai-Bold", fontSize: 18, textAlign: "center" },
});
