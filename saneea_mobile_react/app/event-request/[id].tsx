import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { createBooking, getQuestionnaireItems, QuestionnaireItem } from "../../src/api/mobile";
import { CityField, DateField, GuestCountField, TimeField } from "../../src/components/form-controls";
import { Button, ErrorState, Field, LoadingState, PageHeader, Screen, Section } from "../../src/components/ui";
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setQuestions(await getQuestionnaireItems(eventTypeId));
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
      router.push("/auth/login");
      return;
    }
    if (!eventTypeId || !draft.eventDate || !draft.eventTime || !draft.location || !draft.guestCount) {
      Alert.alert(t("requiredField"));
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
      bottom={<Button title={submitting ? t("loading") : t("confirmBooking")} onPress={submit} disabled={submitting} />}
      refreshing={loading}
      onRefresh={load}
    >
      <PageHeader title={t("directRequestTitle")} subtitle={t("directRequestSubtitle")} onBack={goBackOrHome} />
      {loading ? <LoadingState label={t("loading")} /> : null}
      {error ? <ErrorState message={error} retryLabel={t("retry")} onRetry={load} /> : null}
      {!loading && !error ? (
        <>
          <Section title={t("bookingDetails")}>
            <DateField label={t("eventDate")} value={draft.eventDate} onChange={(eventDate) => draft.setDetails({ eventDate })} />
            <TimeField label={t("eventTime")} value={draft.eventTime} onChange={(eventTime) => draft.setDetails({ eventTime })} />
            <CityField label={t("location")} value={draft.location} onChange={(location) => draft.setDetails({ location })} />
            <GuestCountField label={t("guests")} value={draft.guestCount} onChange={(guestCount) => draft.setDetails({ guestCount })} />
            <Field label={t("budgetRange")} value={draft.budget} onChangeText={(budget) => draft.setDetails({ budget })} keyboardType="number-pad" />
            <Field label={t("notes")} value={draft.specialRequests} onChangeText={(specialRequests) => draft.setDetails({ specialRequests })} multiline />
          </Section>
          <Section title={t("questionnaire")}>
            {questions.length === 0 ? <Text style={styles.muted}>{t("noQuestions")}</Text> : null}
            {questions.map((question) => (
              <Field
                key={question.id}
                label={question.questionText}
                value={String(draft.questionnaireResponses[String(question.id)] || "")}
                onChangeText={(value) => draft.setQuestionResponse(question.id, value)}
                keyboardType={question.questionType === "number" ? "number-pad" : "default"}
              />
            ))}
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: {
    color: colors.muted,
    fontFamily: "Almarai-Regular",
    fontSize: 13,
  },
});
