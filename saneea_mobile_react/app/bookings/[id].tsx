import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { getBooking, BookingSummary, PaymentRequest } from "../../src/api/mobile";
import { ErrorState, LoadingState, PageHeader, Price, Screen, Section, Surface } from "../../src/components/ui";
import { goBackOrHome } from "../../src/navigation/safe-router";
import { colors } from "../../src/theme/colors";

type Detail = BookingSummary & { packageItems: unknown[]; payments: PaymentRequest[] };

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [booking, setBooking] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setBooking(await getBooking(Number(id)) as Detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToLoad"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <PageHeader title={t("bookingDetails")} onBack={goBackOrHome} />
      {loading ? <LoadingState label={t("loading")} /> : null}
      {error ? <ErrorState message={error} retryLabel={t("retry")} onRetry={load} /> : null}
      {booking ? (
        <>
          <Surface>
            <Text style={styles.title}>{booking.eventTypeName || booking.bundleName}</Text>
            <Text style={styles.muted}>{t("status")}: {booking.status}</Text>
            <Text style={styles.muted}>{booking.eventDate} {booking.eventTime || ""}</Text>
            <Price value={booking.totalPrice} currency={t("sar")} />
          </Surface>
          <Section title={t("payments")}>
            {booking.payments?.map((payment) => (
              <Surface key={payment.id}>
                <View style={styles.row}>
                  <Text style={styles.title}>{payment.type === "deposit" ? t("paymentDeposit") : t("paymentFinal")}</Text>
                  <Price value={payment.amount} currency={t("sar")} />
                </View>
                <Text style={styles.muted}>{payment.status}</Text>
              </Surface>
            ))}
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.black, fontFamily: "Almarai-Bold", fontSize: 16 },
  muted: { color: colors.muted, fontFamily: "Almarai-Regular", fontSize: 13, lineHeight: 22 },
  row: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
});
