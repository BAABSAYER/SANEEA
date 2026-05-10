import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { BookingSummary, getBookings } from "../../src/api/mobile";
import { BottomNav } from "../../src/components/bottom-nav";
import { Button, ErrorState, LoadingState, PageHeader, Price, Screen, Surface } from "../../src/components/ui";
import { useAuthStore } from "../../src/state/auth-store";
import { colors } from "../../src/theme/colors";

export default function BookingsScreen() {
  const { t } = useTranslation();
  const token = useAuthStore((state) => state.token);
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setBookings(await getBookings());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToLoad"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  return (
    <Screen bottom={<BottomNav />} refreshing={loading} onRefresh={load}>
      <PageHeader title={t("bookings")} onBack={() => router.back()} />
      {!token ? <Button title={t("loginSignup")} onPress={() => router.push("/auth/login")} /> : null}
      {loading ? <LoadingState label={t("loading")} /> : null}
      {error ? <ErrorState message={error} retryLabel={t("retry")} onRetry={load} /> : null}
      {token && !loading && bookings.length === 0 ? <Text style={styles.muted}>{t("emptyBookings")}</Text> : null}
      <View style={{ gap: 10 }}>
        {bookings.map((booking) => (
          <Pressable key={booking.id} onPress={() => router.push(`/bookings/${booking.id}`)}>
            <Surface>
              <Text style={styles.title}>{booking.eventTypeName || booking.bundleName}</Text>
              <Text style={styles.muted}>{booking.eventDate} - {booking.status}</Text>
              <Price value={booking.totalPrice} currency={t("sar")} />
            </Surface>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.black, fontFamily: "Almarai-Bold", fontSize: 16 },
  muted: { color: colors.muted, fontFamily: "Almarai-Regular", fontSize: 13, lineHeight: 22 },
});
