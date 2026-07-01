import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { getEventTemplates, getEventTypeDetail, EventTemplate, EventTypeDetail } from "../../src/api/mobile";
import { MediaCarousel } from "../../src/components/media-carousel";
import { BottomNav } from "../../src/components/bottom-nav";
import { ErrorState, LoadingState, PageHeader, Price, Screen, Surface } from "../../src/components/ui";
import { goBackOrHome } from "../../src/navigation/safe-router";
import { useBookingStore } from "../../src/state/booking-store";
import { colors, radius } from "../../src/theme/colors";

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [event, setEvent] = useState<EventTypeDetail | null>(null);
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const eventTypeId = Number(id);
  const eventName = event?.name || t("templates", { defaultValue: "Ready options" });
  const setPackage = useBookingStore((state) => state.setPackage);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [eventDetail, eventTemplates] = await Promise.all([
        getEventTypeDetail(eventTypeId),
        getEventTemplates(eventTypeId),
      ]);
      setEvent(eventDetail);
      setTemplates(eventTemplates);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToLoad"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (eventTypeId) load();
  }, [eventTypeId]);

  const heroMedia = useMemo(() => templates.find((item) => item.images.length || item.videos.length), [templates]);

  return (
    <Screen bottom={<BottomNav />} refreshing={loading} onRefresh={load}>
      <PageHeader
        title={t("chooseTemplate", { defaultValue: "Choose an option" })}
        subtitle={eventName}
        onBack={goBackOrHome}
      />
      {heroMedia ? <MediaCarousel images={heroMedia.images} videos={heroMedia.videos} height={175} /> : null}
      <View style={styles.explainCard}>
        <Text style={styles.explainTitle}>{t("templateHelpTitle", { defaultValue: "Look first, then choose" })}</Text>
        <Text style={styles.explainText}>
          {t("templateHelpBody", {
            defaultValue: "Prices shown here are estimates. After you send the request, Saneea prepares the final proposal for you.",
          })}
        </Text>
      </View>
      {loading ? <LoadingState label={t("loading")} /> : null}
      {error ? <ErrorState message={error} retryLabel={t("retry")} onRetry={load} /> : null}
      {!loading && !error ? (
        <View style={{ gap: 12 }}>
          <Pressable
            style={[styles.packageCard, styles.directCard]}
            onPress={() => router.push(`/event-request/${eventTypeId}`)}
          >
            <Text style={styles.tier}>{t("directRequest")}</Text>
            <Text style={styles.name}>{t("directRequestTitle")}</Text>
            <Text style={styles.description}>{t("directRequestSubtitle")}</Text>
          </Pressable>
          {templates.map((eventPackage) => (
            <Pressable
              key={eventPackage.id}
              style={styles.templateCard}
              onPress={() => {
                setPackage(eventTypeId, eventPackage);
                router.push(`/package/${eventPackage.id}`);
              }}
            >
              <ImageBackground
                source={eventPackage.images?.[0] ? { uri: eventPackage.images[0] } : undefined}
                style={styles.templateImage}
                imageStyle={styles.templateImageRadius}
              >
                <View style={styles.imageOverlay} />
                <Text style={styles.templateBadge}>{t(eventPackage.tier, { defaultValue: eventPackage.tier })}</Text>
              </ImageBackground>
              <View style={styles.templateBody}>
                <Text style={styles.name}>{eventPackage.name}</Text>
                {eventPackage.description ? <Text style={styles.description}>{eventPackage.description}</Text> : null}
                {eventPackage.items?.length ? (
                  <View style={styles.includedList}>
                    {eventPackage.items.slice(0, 3).map((item) => (
                      <Text key={`${eventPackage.id}-${item.eventItemId}`} style={styles.includedItem}>
                        {item.itemName}
                      </Text>
                    ))}
                  </View>
                ) : null}
                <Surface>
                  <View style={styles.row}>
                    <Text style={styles.meta}>{t("estimatedFrom", { defaultValue: "Estimated from" })}</Text>
                    <Price value={eventPackage.calculatedBasePrice || eventPackage.basePrice} currency={t("sar")} />
                  </View>
                </Surface>
                <Text style={styles.previewText}>{t("previewTemplate", { defaultValue: "Preview and customize" })}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  explainCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  explainTitle: {
    color: colors.black,
    fontFamily: "Almarai-Bold",
    fontSize: 16,
  },
  explainText: {
    color: colors.muted,
    fontFamily: "Almarai-Regular",
    fontSize: 13,
    lineHeight: 22,
  },
  packageCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  directCard: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  templateCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  templateImage: {
    height: 170,
    justifyContent: "flex-end",
    padding: 12,
  },
  templateImageRadius: {
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  templateBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: radius.sm,
    color: colors.green,
    fontFamily: "Almarai-Bold",
    fontSize: 12,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  templateBody: {
    gap: 10,
    padding: 14,
  },
  tier: { color: colors.green, fontFamily: "Almarai-Bold", fontSize: 13 },
  name: { color: colors.black, fontFamily: "Almarai-Bold", fontSize: 20 },
  description: { color: colors.muted, fontFamily: "Almarai-Regular", fontSize: 13, lineHeight: 20 },
  row: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  meta: { color: colors.muted, fontFamily: "Almarai-Regular", fontSize: 13 },
  includedList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  includedItem: {
    backgroundColor: colors.softSurface,
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: "Almarai-Regular",
    fontSize: 12,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  previewText: {
    color: colors.green,
    fontFamily: "Almarai-Bold",
    fontSize: 14,
  },
});
