import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Play } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { colors, radius } from "../theme/colors";

type MediaItem = {
  id: string;
  type: "image" | "video";
  uri: string;
};

type MediaCarouselProps = {
  images?: string[] | null;
  videos?: string[] | null;
  height?: number;
};

function InlineVideo({ uri, height, width }: { uri: string; height: number; width: number }) {
  const { t } = useTranslation();

  return (
    <View style={[styles.card, { height, width }]}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} blurRadius={14} />
      <View style={styles.videoScrim} />
      <View style={styles.videoLabel}>
        <Play color={colors.surface} size={13} fill={colors.surface} />
        <Text style={styles.videoLabelText}>{t("video")}</Text>
      </View>
    </View>
  );
}

export function MediaCarousel({ images = [], videos = [], height = 190 }: MediaCarouselProps) {
  const { width } = useWindowDimensions();
  const media: MediaItem[] = [
    ...(videos || []).filter(Boolean).map((uri, index) => ({ id: `video-${index}-${uri}`, type: "video" as const, uri })),
    ...(images || []).filter(Boolean).map((uri, index) => ({ id: `image-${index}-${uri}`, type: "image" as const, uri })),
  ];

  if (media.length === 0) return null;

  const cardWidth = Math.min(width - 48, 330);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      style={styles.scroller}
    >
      {media.map((item) => (
        item.type === "video" ? (
          <InlineVideo key={item.id} uri={item.uri} height={height} width={cardWidth} />
        ) : (
          <Image key={item.id} source={{ uri: item.uri }} style={[styles.card, { height, width: cardWidth }]} />
        )
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroller: {
    marginHorizontal: -2,
  },
  content: {
    flexDirection: "row-reverse",
    gap: 10,
    paddingHorizontal: 2,
  },
  card: {
    backgroundColor: colors.black,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  videoLabel: {
    alignItems: "center",
    backgroundColor: "rgba(10,10,10,0.72)",
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: 6,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    position: "absolute",
    top: 12,
  },
  videoScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,10,10,0.42)",
  },
  videoLabelText: {
    color: colors.surface,
    fontFamily: "Almarai-Bold",
    fontSize: 12,
  },
});
