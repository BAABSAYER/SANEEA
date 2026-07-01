import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  acceptBookingProposal,
  getBooking,
  rejectBookingProposal,
  BookingSummary,
  EventPackageItem,
  PaymentRequest,
  BookingProposal,
  submitPaymentReceipt,
  uploadMobileFile,
} from "../../src/api/mobile";
import { Button, ErrorState, LoadingState, PageHeader, Price, Screen, Section, Surface } from "../../src/components/ui";
import { goBackOrHome } from "../../src/navigation/safe-router";
import { colors } from "../../src/theme/colors";

type Detail = BookingSummary & {
  packageItems: Array<EventPackageItem & { effectiveOption?: { optionName?: string | null; vendorName?: string | null; price?: number | null } }>;
  selectedItemOptions?: unknown[];
  payments: PaymentRequest[];
  clientAttachments?: Array<{ url: string; fileName?: string | null; contentType?: string | null }>;
  specialRequests?: string | null;
  quotationNotes?: string | null;
  quotationValidUntil?: string | null;
  basePrice?: number | null;
  optionsPrice?: number | null;
  proposal?: BookingProposal | null;
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
  const [proposalAction, setProposalAction] = useState<"accept" | "reject" | null>(null);
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

  async function acceptProposal() {
    if (!booking) return;
    setProposalAction("accept");
    try {
      await acceptBookingProposal(booking.id);
      Alert.alert(t("proposalAccepted", { defaultValue: "Proposal accepted" }));
      await load();
    } catch (error) {
      Alert.alert(error instanceof Error ? error.message : t("failedToLoad"));
    } finally {
      setProposalAction(null);
    }
  }

  async function rejectProposal() {
    if (!booking) return;
    setProposalAction("reject");
    try {
      await rejectBookingProposal(booking.id);
      Alert.alert(t("proposalChangeRequested", { defaultValue: "Request sent" }));
      await load();
    } catch (error) {
      Alert.alert(error instanceof Error ? error.message : t("failedToLoad"));
    } finally {
      setProposalAction(null);
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
            <Text style={styles.muted}>{t("estimatedPriceLabel", { defaultValue: "Initial estimate" })}</Text>
            <Price value={booking.totalPrice} currency={t("sar")} />
          </Surface>
          <Section title={t("requestProgress", { defaultValue: "Request progress" })}>
            <Surface>
              {[
                { key: "vendor_review", label: t("progressReview", { defaultValue: "Saneea reviewing your request" }) },
                { key: "quotation_sent", label: t("progressProposal", { defaultValue: "Proposal sent to you" }) },
                { key: "quotation_accepted", label: t("progressAccepted", { defaultValue: "Proposal accepted" }) },
                { key: "confirmed", label: t("progressConfirmed", { defaultValue: "Payment confirmed" }) },
                { key: "completed", label: t("progressCompleted", { defaultValue: "Event completed" }) },
              ].map((step, index, steps) => {
                const activeIndex = Math.max(0, steps.findIndex((item) => item.key === booking.status));
                const done = index <= activeIndex || booking.status === "completed";
                return (
                  <View key={step.key} style={styles.timelineRow}>
                    <View style={[styles.timelineDot, done && styles.timelineDotDone]} />
                    <Text style={[styles.timelineText, done && styles.timelineTextDone]}>{step.label}</Text>
                  </View>
                );
              })}
            </Surface>
          </Section>
          {booking.status === "quotation_sent" ? (
            <Section title={t("proposalReady", { defaultValue: "Your proposal is ready" })}>
              <Surface>
                <Text style={styles.title}>{t("finalProposalPrice", { defaultValue: "Final proposal price" })}</Text>
                <Price value={booking.proposal?.totalPrice ?? booking.totalPrice} currency={t("sar")} />
                {booking.proposal?.items?.length ? (
                  <View style={styles.proposalItems}>
                    {booking.proposal.items.map((item) => (
                      <View key={item.id} style={styles.proposalItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.proposalItemTitle}>{item.title}</Text>
                          {item.description ? <Text style={styles.muted}>{item.description}</Text> : null}
                          <Text style={styles.muted}>
                            {item.quantity} × {Number(item.unitPrice || 0).toLocaleString()} {t("sar")}
                          </Text>
                        </View>
                        <Price value={item.totalPrice} currency={t("sar")} />
                      </View>
                    ))}
                  </View>
                ) : null}
                {booking.proposal?.depositAmount ? (
                  <Text style={styles.muted}>
                    {t("paymentDeposit")}: {Number(booking.proposal.depositAmount).toLocaleString()} {t("sar")}
                  </Text>
                ) : null}
                {booking.proposal?.finalAmount ? (
                  <Text style={styles.muted}>
                    {t("paymentFinal")}: {Number(booking.proposal.finalAmount).toLocaleString()} {t("sar")}
                  </Text>
                ) : null}
                {booking.proposal?.notes || booking.quotationNotes ? <Text style={styles.muted}>{booking.proposal?.notes || booking.quotationNotes}</Text> : null}
                {booking.proposal?.validUntil || booking.quotationValidUntil ? (
                  <Text style={styles.muted}>
                    {t("validUntil", { defaultValue: "Valid until" })}: {new Date(booking.proposal?.validUntil || booking.quotationValidUntil || "").toLocaleDateString()}
                  </Text>
                ) : null}
                <View style={styles.proposalButtons}>
                  <Button
                    title={proposalAction === "accept" ? t("loading") : t("acceptProposal", { defaultValue: "Accept proposal" })}
                    onPress={acceptProposal}
                    disabled={!!proposalAction}
                  />
                  <Button
                    title={proposalAction === "reject" ? t("loading") : t("requestChanges", { defaultValue: "Request changes" })}
                    onPress={rejectProposal}
                    disabled={!!proposalAction}
                    variant="ghost"
                  />
                </View>
              </Surface>
            </Section>
          ) : null}
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
  timelineRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 34,
  },
  timelineDot: {
    backgroundColor: colors.line,
    borderRadius: 7,
    height: 14,
    width: 14,
  },
  timelineDotDone: {
    backgroundColor: colors.green,
  },
  timelineText: {
    color: colors.muted,
    flex: 1,
    fontFamily: "Almarai-Regular",
    fontSize: 13,
    lineHeight: 21,
  },
  timelineTextDone: {
    color: colors.ink,
    fontFamily: "Almarai-Bold",
  },
  proposalButtons: {
    gap: 10,
    marginTop: 14,
  },
  proposalItems: {
    borderColor: colors.line,
    borderTopWidth: 1,
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
  },
  proposalItem: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
  },
  proposalItemTitle: {
    color: colors.black,
    fontFamily: "Almarai-Bold",
    fontSize: 14,
    lineHeight: 21,
  },
});
