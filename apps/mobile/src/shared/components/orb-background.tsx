import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { theme } from "@/app/theme/theme";

interface OrbBackgroundProps {
  readonly children: ReactNode;
}

/**
 * Decorative background layer that gives premium visual depth.
 */
export function OrbBackground({ children }: OrbBackgroundProps) {
  return (
    <View style={styles.root}>
      <View style={[styles.orb, styles.orbTop]} />
      <View style={[styles.orb, styles.orbBottom]} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  orb: {
    position: "absolute",
    borderRadius: theme.radius.pill,
    opacity: 0.28,
  },
  orbTop: {
    width: 280,
    height: 280,
    backgroundColor: "#0ea5e9",
    top: -80,
    right: -100,
  },
  orbBottom: {
    width: 320,
    height: 320,
    backgroundColor: "#f59e0b",
    bottom: -160,
    left: -120,
  },
  content: {
    flex: 1,
  },
});
