import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { CityOption, createBooking, getEventTypeDetail, getQuestionnaireItems, QuestionnaireItem } from "../../src/api/mobile";
import { AttachmentPicker } from "../../src/components/attachment-picker";
import { CityField, DateField, GuestCountField, TimeField } from "../../src/components/form-controls";
import { QuestionnaireFields } from "../../src/components/questionnaire-fields";
import { Button, ErrorState, Field, LoadingState, PageHeader, Price, Screen, Section, Surface } from "../../src/components/ui";
import { goBackOrHome } from "../../src/navigation/safe-router";
import { useAuthStore } from "../../src/state/auth-store";
import { useBookingStore } from "../../src/state/booking-store";
import { colors } from "../../src/theme/colors";

export default function EventRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const token = useAuthStore((state) => state.token);
  const draft = useBookingStore();
  const eventTypeId = Number(id);
  const [questions, setQuestions] = useState<QuestionnaireItem[]>([]);
  const [availableCities, setAvailableCities] = useState<CityOption[] | undefined>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [eventType, questionnaireItems] = await Promise.all([
        getEventTypeDetail(eventTypeId),
        getQuestionnaireItems(eventTypeId),
      ]);
      setAvailableCities(eventType.availableCities);
      setQuestions(questionnaireItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToLoad"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (eventTypeId) load();
  }, [eventTypeId]);

  async function submit() {
    if (!token) {
      router.push({ pathname: "/auth/login", params: { returnTo: `/event-request/${eventTypeId}` } });
      return;
    }
    const missing = [
      !eventTypeId && t("chooseEvent"),
      !draft.eventDate && t("eventDate"),
      !draft.eventTime && t("eventTime"),
      !draft.location && t("location"),
      !draft.guestCount && t("guests"),
    ].filter(Boolean);
    if (missing.length > 0) {
      Alert.alert(t("requiredField"), String(missing.join(", ")));
      return;
    }
    setSubmitting(true);
    try {
      const booking = await createBooking({
        eventTypeId,
        bundleId: null,
        eventDate: draft.eventDate,
        eventTime: draft.eventTime,
        location: draft.location,
        guestCount: Number(draft.guestCount),
        budget: draft.budget ? Number(draft.budget) : null,
        specialRequests: draft.specialRequests,
        questionnaireResponses: draft.questionnaireResponses,
        clientAttachments: draft.clientAttachments,
        selectedItemOptions: [],
      });
      draft.reset();
      router.replace(`/bookings/${booking.id}`);
    } catch (err) {
      Alert.alert(err instanceof Error ? err.message : t("failedToLoad"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen
      bottom={<Button title={submitting ? t("loading") : t("submitEventRequest", { defaultValue: "Send request" })} onPress={submit} disabled={submitting} />}
      refreshing={loading}
      onRefresh={load}
    >
      <PageHeader title={t("directRequestTitle")} subtitle={t("directRequestSubtitle")} onBack={goBackOrHome} />
      {loading ? <LoadingState label={t("loading")} /> : null}
      {error ? <ErrorState message={error} retryLabel={t("retry")} onRetry={load} /> : null}
      {!loading && !error ? (
        <>
          <View style={styles.guidanceCard}>
            <Text style={styles.guidanceTitle}>{t("customRequestHelpTitle", { defaultValue: "Tell us the basics" })}</Text>
            <Text style={styles.guidanceText}>
              {t("customRequestHelpBody", {
                defaultValue: "You do not need to know every detail now. Send the request and Saneea will prepare a proposal.",
              })}
            </Text>
          </View>
          <Section title={t("bookingDetails")}>
            <DateField label={t("eventDate")} value={draft.eventDate} onChange={(eventDate) => draft.setDetails({ eventDate })} />
            <TimeField label={t("eventTime")} value={draft.eventTime} onChange={(eventTime) => draft.setDetails({ eventTime })} />
            <CityField
              label={t("location")}
              value={draft.location}
              availableCities={availableCities}
              onChange={(location) => draft.setDetails({ location })}
            />
            <GuestCountField label={t("guests")} value={draft.guestCount} onChange={(guestCount) => draft.setDetails({ guestCount })} />
            <Field label={t("budgetRange")} value={draft.budget} onChangeText={(budget) => draft.setDetails({ budget })} keyboardType="number-pad" />
            <Field label={t("notes")} value={draft.specialRequests} onChangeText={(specialRequests) => draft.setDetails({ specialRequests })} multiline />
            <AttachmentPicker value={draft.clientAttachments} onChange={(clientAttachments) => draft.setDetails({ clientAttachments })} />
          </Section>
          <Section title={t("questionnaire")}>
            <QuestionnaireFields
              questions={questions}
              responses={draft.questionnaireResponses}
              onChange={(questionId, value) => draft.setQuestionResponse(questionId, value)}
            />
          </Section>
          <Section title={t("review")}>
            <Surface>
              <Text style={styles.reviewLine}>{t("eventDate")}: {draft.eventDate || "-"}</Text>
              <Text style={styles.reviewLine}>{t("eventTime")}: {draft.eventTime || "-"}</Text>
              <Text style={styles.reviewLine}>{t("location")}: {draft.location || "-"}</Text>
              <Text style={styles.reviewLine}>{t("guests")}: {draft.guestCount || "-"}</Text>
              {draft.budget ? <Price value={Number(draft.budget)} currency={t("sar")} /> : null}
            </Surface>
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  guidanceCard: {
    backgroundColor: colors.greenSoft,
    borderColor: "#CFE7D7",
    borderRadius: 8,
    borderWidth: 1,
    gap: 7,
    padding: 14,
  },
  guidanceTitle: {
    color: colors.greenDark,
    fontFamily: "Almarai-Bold",
    fontSize: 17,
    lineHeight: 25,
  },
  guidanceText: {
    color: colors.ink,
    fontFamily: "Almarai-Regular",
    fontSize: 14,
    lineHeight: 23,
  },
  muted: {
    color: colors.muted,
    fontFamily: "Almarai-Regular",
    fontSize: 13,
  },
  reviewLine: {
    color: colors.ink,
    fontFamily: "Almarai-Regular",
    fontSize: 13,
    lineHeight: 22,
  },
});
