import { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import { colors } from "../theme/colors";

export default function SplashScreen() {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let pulse: Animated.CompositeAnimation | undefined;

    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 45,
          friction: 9,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(500),
      Animated.timing(dotOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.delay(200),
    ]).start(() => {
      pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(dotOpacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
          Animated.timing(dotOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
    });

    return () => pulse?.stop();
  }, [dotOpacity, logoOpacity, logoScale]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoWrapper,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <Image
          source={require("../../assets/brand/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.View style={[styles.dot, { opacity: dotOpacity }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  logoWrapper: {
    alignItems: "center",
  },
  logo: {
    width: 260,
    height: 140,
  },
  dot: {
    position: "absolute",
    bottom: 72,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green,
  },
});
