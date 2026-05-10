import { router, usePathname } from "expo-router";
import { CalendarDays, Package, UserRound } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { colors, radius } from "../theme/colors";

export function BottomNav() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const items = [
    { label: t("packages"), path: "/home", icon: Package },
    { label: t("bookings"), path: "/bookings", icon: CalendarDays },
    { label: t("profile"), path: "/profile", icon: UserRound },
  ];

  return (
    <View style={styles.wrap}>
      {items.map((item) => {
        const active = pathname === item.path || (item.path === "/home" && pathname.startsWith("/event"));
        const Icon = item.icon;
        return (
          <Pressable key={item.path} style={styles.item} onPress={() => router.replace(item.path)}>
            <Icon color={active ? colors.green : colors.muted} size={22} />
            <Text style={[styles.label, active && styles.activeLabel]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    padding: 6,
  },
  item: {
    alignItems: "center",
    flex: 1,
    gap: 4,
    justifyContent: "center",
    minHeight: 58,
  },
  label: {
    color: colors.muted,
    fontFamily: "Almarai-Bold",
    fontSize: 11,
  },
  activeLabel: {
    color: colors.green,
  },
});
