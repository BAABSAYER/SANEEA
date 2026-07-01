import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { BottomNav } from "../src/components/bottom-nav";
import { BrandMark, ErrorState, Header, LoadingState, Screen } from "../src/components/ui";
import { EventType, getEventTypes } from "../src/api/mobile";
import { colors, radius } from "../src/theme/colors";

export default function HomeScreen() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setEvents(await getEventTypes());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToLoad"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Screen bottom={<BottomNav />} refreshing={loading} onRefresh={load}>
      <Header title={t("homeHeading")} subtitle={t("homeKicker")} right={<BrandMark />} />
      {loading ? <LoadingState label={t("loading")} /> : null}
      {error ? <ErrorState message={error} retryLabel={t("retry")} onRetry={load} /> : null}
      {!loading && !error ? (
        <View style={styles.grid}>
          {events.map((event) => (
            <Pressable key={event.id} onPress={() => router.push(`/event/${event.id}`)} style={styles.card}>
              <ImageBackground
                source={event.images?.[0] ? { uri: event.images[0] } : undefined}
                style={styles.image}
                imageStyle={styles.imageRadius}
              >
                <View style={styles.overlay} />
                <Text style={styles.icon}>{event.icon || "س"}</Text>
              </ImageBackground>
              <Text style={styles.name}>{event.name}</Text>
              <Text style={styles.meta}>
                {t("templateCount", {
                  count: event.packageCount,
                  defaultValue: "{{count}} options",
                })}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 14 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  image: { height: 150, justifyContent: "flex-end", padding: 16 },
  imageRadius: { borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.2)" },
  icon: { color: colors.surface, fontFamily: "Almarai-Bold", fontSize: 34 },
  name: { color: colors.black, fontFamily: "Almarai-Bold", fontSize: 20, paddingHorizontal: 14, paddingTop: 14 },
  meta: { color: colors.muted, fontFamily: "Almarai-Regular", fontSize: 13, padding: 14, paddingTop: 6 },
});
