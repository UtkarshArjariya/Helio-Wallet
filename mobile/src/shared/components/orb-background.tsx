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
      <View style={styles.mesh} />
      <View style={[styles.orb, styles.orbTop]} />
      <View style={[styles.orb, styles.orbMiddle]} />
      <View style={[styles.orb, styles.orbBottom]} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.backgroundCanvas,
  },
  mesh: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(223, 226, 239, 0.015)",
  },
  orb: {
    position: "absolute",
    borderRadius: theme.radius.pill,
    opacity: 0.18,
  },
  orbTop: {
    width: 300,
    height: 300,
    backgroundColor: theme.colors.accent,
    top: -110,
    right: -120,
  },
  orbMiddle: {
    width: 240,
    height: 240,
    backgroundColor: theme.colors.accentMuted,
    top: "28%",
    right: -120,
  },
  orbBottom: {
    width: 320,
    height: 320,
    backgroundColor: theme.colors.accentMuted,
    bottom: -160,
    left: -140,
  },
  content: {
    flex: 1,
  },
});
