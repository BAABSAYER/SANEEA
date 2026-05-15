import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { getEventPackages, EventPackage } from "../../src/api/mobile";
import { MediaCarousel } from "../../src/components/media-carousel";
import { BottomNav } from "../../src/components/bottom-nav";
import { ErrorState, LoadingState, PageHeader, Price, Screen, Surface } from "../../src/components/ui";
import { goBackOrHome } from "../../src/navigation/safe-router";
import { useBookingStore } from "../../src/state/booking-store";
import { colors, radius } from "../../src/theme/colors";

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [packages, setPackages] = useState<EventPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const eventTypeId = Number(id);
  const eventName = packages[0]?.name?.split(" ").slice(1).join(" ") || t("packages");
  const setPackage = useBookingStore((state) => state.setPackage);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setPackages(await getEventPackages(eventTypeId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToLoad"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (eventTypeId) load();
  }, [eventTypeId]);

  const heroMedia = useMemo(() => packages.find((item) => item.images.length || item.videos.length), [packages]);

  return (
    <Screen bottom={<BottomNav />} refreshing={loading} onRefresh={load}>
      <PageHeader title={t("choosePackage")} subtitle={eventName} onBack={goBackOrHome} />
      {heroMedia ? <MediaCarousel images={heroMedia.images} videos={heroMedia.videos} /> : null}
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
          {packages.map((eventPackage) => (
            <Pressable
              key={eventPackage.id}
              style={styles.packageCard}
              onPress={() => {
                setPackage(eventTypeId, eventPackage);
                router.push(`/package/${eventPackage.id}`);
              }}
            >
              <Text style={styles.tier}>{t(eventPackage.tier) || eventPackage.tier}</Text>
              <Text style={styles.name}>{eventPackage.name}</Text>
              <Text style={styles.description}>{eventPackage.description}</Text>
              <Surface>
                <View style={styles.row}>
                  <Text style={styles.meta}>{t("startsAt")}</Text>
                  <Price value={eventPackage.calculatedBasePrice || eventPackage.basePrice} currency={t("sar")} />
                </View>
              </Surface>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  tier: { color: colors.green, fontFamily: "Almarai-Bold", fontSize: 13 },
  name: { color: colors.black, fontFamily: "Almarai-Bold", fontSize: 20 },
  description: { color: colors.muted, fontFamily: "Almarai-Regular", fontSize: 13, lineHeight: 20 },
  row: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  meta: { color: colors.muted, fontFamily: "Almarai-Regular", fontSize: 13 },
});
