import { ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius } from "../theme/colors";

export function Screen({
  children,
  scroll = true,
  bottom,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  scroll?: boolean;
  bottom?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const content = <View style={styles.content}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screenBody}>
        {scroll ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.green} /> : undefined}
          >
            {content}
          </ScrollView>
        ) : content}
      </View>
      {bottom ? <View style={styles.bottom}>{bottom}</View> : null}
    </SafeAreaView>
  );
}

export function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function PageHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function BrandMark() {
  return (
    <View style={styles.brandWrap}>
      <Image source={require("../../assets/brand/logo.png")} style={styles.brandImage} resizeMode="contain" />
    </View>
  );
}

export function Button({
  title,
  onPress,
  disabled,
  variant = "primary",
}: {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "dark";
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === "ghost" && styles.ghostButton,
        variant === "dark" && styles.darkButton,
        disabled && styles.disabledButton,
        pressed && !disabled && { opacity: 0.86 },
      ]}
    >
      <Text style={[styles.buttonText, variant === "ghost" && styles.ghostButtonText]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function Surface({ children }: { children: ReactNode }) {
  return <View style={styles.surface}>{children}</View>;
}

export function Price({ value, currency }: { value?: number | null; currency: string }) {
  return <Text style={styles.price}>{Number(value || 0).toLocaleString()} {currency}</Text>;
}

export function LoadingState({ label }: { label: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.green} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.error}>{message}</Text>
      {onRetry ? <Button title={retryLabel} onPress={onRetry} variant="dark" /> : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.softSurface,
  },
  content: {
    gap: 18,
    padding: 20,
    paddingBottom: 36,
  },
  screenBody: {
    flex: 1,
  },
  bottom: {
    backgroundColor: colors.softSurface,
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 8,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  backText: {
    color: colors.black,
    fontFamily: "Almarai-Bold",
    fontSize: 30,
    lineHeight: 34,
    marginTop: -2,
  },
  title: {
    color: colors.black,
    fontFamily: "Almarai-Bold",
    fontSize: 28,
    lineHeight: 36,
    textAlign: "left",
  },
  subtitle: {
    color: colors.muted,
    fontFamily: "Almarai-Regular",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 6,
  },
  brandWrap: {
    alignItems: "flex-start",
    backgroundColor: "transparent",
    flexShrink: 0,
    height: 58,
    justifyContent: "center",
    overflow: "hidden",
    width: 150,
  },
  brandImage: {
    height: 52,
    marginLeft: -2,
    width: 142,
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: radius.md,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  darkButton: {
    backgroundColor: colors.black,
  },
  ghostButton: {
    backgroundColor: colors.greenSoft,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.surface,
    fontFamily: "Almarai-Bold",
    fontSize: 15,
  },
  ghostButtonText: {
    color: colors.green,
  },
  fieldWrap: {
    gap: 8,
  },
  label: {
    color: colors.ink,
    fontFamily: "Almarai-Bold",
    fontSize: 13,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: "Almarai-Regular",
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.black,
    fontFamily: "Almarai-Bold",
    fontSize: 18,
  },
  surface: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 14,
  },
  price: {
    color: colors.green,
    fontFamily: "Almarai-Bold",
    fontSize: 18,
  },
  center: {
    alignItems: "center",
    gap: 12,
    justifyContent: "center",
    minHeight: 220,
  },
  muted: {
    color: colors.muted,
    fontFamily: "Almarai-Regular",
    fontSize: 14,
  },
  error: {
    color: colors.danger,
    fontFamily: "Almarai-Bold",
    fontSize: 14,
    textAlign: "center",
  },
});
