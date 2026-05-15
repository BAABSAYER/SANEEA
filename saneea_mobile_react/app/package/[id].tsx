import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { createBooking, getPackageCustomization, getQuestionnaireItems, PackageCustomization, QuestionnaireItem } from "../../src/api/mobile";
import { CityField, DateField, GuestCountField, TimeField } from "../../src/components/form-controls";
import { MediaCarousel } from "../../src/components/media-carousel";
import { Button, ErrorState, Field, LoadingState, PageHeader, Price, Screen, Section, Surface } from "../../src/components/ui";
import { goBackOrHome } from "../../src/navigation/safe-router";
import { useAuthStore } from "../../src/state/auth-store";
import { useBookingStore } from "../../src/state/booking-store";
import { colors, radius } from "../../src/theme/colors";

export default function PackageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const token = useAuthStore((state) => state.token);
  const draft = useBookingStore();
  const [customization, setCustomization] = useState<PackageCustomization | null>(null);
  const [questions, setQuestions] = useState<QuestionnaireItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const packageId = Number(id);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getPackageCustomization(packageId);
      setCustomization(data);
      draft.setCustomization(data);
      setQuestions(await getQuestionnaireItems(data.eventType.id));
      data.items.forEach((item) => {
        if (item.defaultOption) {
          draft.selectItemOption({ eventItemId: item.eventItemId, optionId: item.defaultOption.id, quantity: item.quantity || 1 });
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToLoad"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (packageId) load();
  }, [packageId]);

  const total = useMemo(() => draft.totalPrice(), [draft.selectedItemOptions, customization]);

  async function submit() {
    if (!token) {
      router.push("/auth/login");
      return;
    }
    if (!customization || !draft.eventDate || !draft.eventTime || !draft.location || !draft.guestCount) {
      Alert.alert(t("requiredField"));
      return;
    }
    setSubmitting(true);
    try {
      const booking = await createBooking({
        eventTypeId: customization.eventType.id,
        bundleId: customization.package.id,
        eventDate: draft.eventDate,
        eventTime: draft.eventTime,
        location: draft.location,
        guestCount: Number(draft.guestCount),
        budget: draft.budget ? Number(draft.budget) : null,
        specialRequests: draft.specialRequests,
        questionnaireResponses: draft.questionnaireResponses,
        clientAttachments: draft.clientAttachments,
        selectedItemOptions: draft.selectedItemOptions,
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
      <PageHeader title={t("packageDetails")} subtitle={customization?.package.name} onBack={goBackOrHome} />
      {customization ? <MediaCarousel images={customization.package.images} videos={customization.package.videos} /> : null}
      {loading ? <LoadingState label={t("loading")} /> : null}
      {error ? <ErrorState message={error} retryLabel={t("retry")} onRetry={load} /> : null}
      {customization ? (
        <>
          <Section title={t("customize")}>
            {customization.items.map((item) => {
              const selected = draft.selectedItemOptions.find((choice) => choice.eventItemId === item.eventItemId);
              return (
                <Surface key={item.bundleItemId}>
                  <Text style={styles.itemName}>{item.itemName}</Text>
                  <Text style={styles.itemMeta}>{item.isRequired ? t("required") : t("optional")}</Text>
                  <View style={styles.options}>
                    {item.vendorOptions.map((option) => {
                      const active = selected?.optionId === option.id;
                      return (
                        <Pressable
                          key={option.id}
                          style={[styles.option, active && styles.optionActive]}
                          onPress={() => draft.selectItemOption({ eventItemId: item.eventItemId, optionId: option.id, quantity: item.quantity || 1 })}
                        >
                          <Text style={[styles.optionName, active && styles.optionNameActive]}>{option.optionName}</Text>
                          <Price value={option.price} currency={t("sar")} />
                        </Pressable>
                      );
                    })}
                  </View>
                </Surface>
              );
            })}
          </Section>
          <Section title={t("bookingDetails")}>
            <DateField label={t("eventDate")} value={draft.eventDate} onChange={(eventDate) => draft.setDetails({ eventDate })} />
            <TimeField label={t("eventTime")} value={draft.eventTime} onChange={(eventTime) => draft.setDetails({ eventTime })} />
            <CityField label={t("location")} value={draft.location} onChange={(location) => draft.setDetails({ location })} />
            <GuestCountField label={t("guests")} value={draft.guestCount} onChange={(guestCount) => draft.setDetails({ guestCount })} />
            <Field label={t("budgetRange")} value={draft.budget} onChangeText={(budget) => draft.setDetails({ budget })} keyboardType="number-pad" />
            <Field label={t("notes")} value={draft.specialRequests} onChangeText={(specialRequests) => draft.setDetails({ specialRequests })} multiline />
          </Section>
          <Section title={t("questionnaire")}>
            {questions.length === 0 ? <Text style={styles.itemMeta}>{t("noQuestions")}</Text> : null}
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
          <Surface>
            <View style={styles.totalRow}>
              <Text style={styles.itemName}>{t("total")}</Text>
              <Price value={total} currency={t("sar")} />
            </View>
          </Surface>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  itemName: { color: colors.black, fontFamily: "Almarai-Bold", fontSize: 16 },
  itemMeta: { color: colors.muted, fontFamily: "Almarai-Regular", fontSize: 13, marginTop: 4 },
  options: { gap: 8, marginTop: 12 },
  option: {
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  optionActive: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  optionName: { color: colors.black, fontFamily: "Almarai-Bold", fontSize: 14 },
  optionNameActive: { color: colors.green },
  totalRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
});
