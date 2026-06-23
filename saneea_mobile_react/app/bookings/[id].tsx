import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { getBooking, BookingSummary, EventPackageItem, PaymentRequest, submitPaymentReceipt, uploadMobileFile } from "../../src/api/mobile";
import { Button, ErrorState, LoadingState, PageHeader, Price, Screen, Section, Surface } from "../../src/components/ui";
import { goBackOrHome } from "../../src/navigation/safe-router";
import { colors } from "../../src/theme/colors";

type Detail = BookingSummary & {
  packageItems: Array<EventPackageItem & { effectiveOption?: { optionName?: string | null; vendorName?: string | null; price?: number | null } }>;
  selectedItemOptions?: unknown[];
  payments: PaymentRequest[];
  clientAttachments?: Array<{ url: string; fileName?: string | null; contentType?: string | null }>;
  specialRequests?: string | null;
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  vendor_review: "Under review",
  vendor_approved: "Approved",
  vendor_rejected: "Rejected",
  quotation_sent: "Quotation sent",
  quotation_accepted: "Quotation accepted",
  quotation_rejected: "Quotation rejected",
  confirmed: "Confirmed",
  in_progress: "In progress",
  cancelled: "Cancelled",
  completed: "Completed",
};

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [booking, setBooking] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPaymentId, setUploadingPaymentId] = useState<number | null>(null);
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

  async function uploadReceipt(payment: PaymentRequest) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("cameraPermissionRequired"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.86,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset) return;

    setUploadingPaymentId(payment.id);
    try {
      const contentType = asset.mimeType || "image/jpeg";
      const uploaded = await uploadMobileFile({
        uri: asset.uri,
        filename: asset.fileName || `receipt-${payment.id}-${Date.now()}.jpg`,
        contentType,
        folder: `saneea/receipts/payment-${payment.id}`,
      });
      await submitPaymentReceipt({
        paymentId: payment.id,
        receiptUrl: uploaded.url,
        receiptFileName: uploaded.fileName,
        receiptContentType: uploaded.contentType,
      });
      Alert.alert(t("receiptSubmitted"));
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "uploadReceiptFailed";
      Alert.alert(t(message) || t("uploadReceiptFailed"));
    } finally {
      setUploadingPaymentId(null);
    }
  }

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <PageHeader title={t("bookingDetails")} onBack={goBackOrHome} />
      {loading ? <LoadingState label={t("loading")} /> : null}
      {error ? <ErrorState message={error} retryLabel={t("retry")} onRetry={load} /> : null}
      {booking ? (
        <>
          <Surface>
            <Text style={styles.title}>{booking.eventTypeName || booking.bundleName}</Text>
            <Text style={styles.muted}>{t("status")}: {statusLabels[booking.status] || booking.status}</Text>
            <Text style={styles.muted}>{booking.eventDate} {booking.eventTime || ""}</Text>
            <Price value={booking.totalPrice} currency={t("sar")} />
          </Surface>
          {booking.packageItems?.length ? (
            <Section title={t("customize")}>
              {booking.packageItems.map((item) => (
                <Surface key={`${item.bundleItemId || item.eventItemId}`}>
                  <Text style={styles.title}>{item.itemName}</Text>
                  <Text style={styles.muted}>{item.effectiveOption?.optionName || item.optionName || "-"}</Text>
                  {item.effectiveOption?.vendorName || item.vendorName ? (
                    <Text style={styles.muted}>{item.effectiveOption?.vendorName || item.vendorName}</Text>
                  ) : null}
                </Surface>
              ))}
            </Section>
          ) : null}
          {booking.clientAttachments?.length ? (
            <Section title={t("attachments")}>
              {booking.clientAttachments.map((attachment, index) => (
                <Surface key={`${attachment.url}-${index}`}>
                  <Pressable onPress={() => Linking.openURL(attachment.url)}>
                    <Text style={styles.link}>{attachment.fileName || attachment.url}</Text>
                  </Pressable>
                </Surface>
              ))}
            </Section>
          ) : null}
          <Section title={t("payments")}>
            {!booking.payments?.length ? <Text style={styles.muted}>{t("noPayments", { defaultValue: "No payment requests yet" })}</Text> : null}
            {booking.payments?.map((payment) => (
              <Surface key={payment.id}>
                <View style={styles.row}>
                  <Text style={styles.title}>{payment.type === "deposit" ? t("paymentDeposit") : t("paymentFinal")}</Text>
                  <Price value={payment.amount} currency={t("sar")} />
                </View>
                <Text style={styles.muted}>{payment.status}</Text>
                {payment.receiptUrl ? <Text style={styles.muted}>{t("receiptSubmitted")}</Text> : null}
                {!payment.receiptUrl && payment.status !== "paid" ? (
                  <Button
                    title={uploadingPaymentId === payment.id ? t("loading") : t("uploadReceipt")}
                    variant="ghost"
                    disabled={uploadingPaymentId === payment.id}
                    onPress={() => uploadReceipt(payment)}
                  />
                ) : null}
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
  link: { color: colors.green, fontFamily: "Almarai-Bold", fontSize: 13, lineHeight: 22 },
  row: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
});
