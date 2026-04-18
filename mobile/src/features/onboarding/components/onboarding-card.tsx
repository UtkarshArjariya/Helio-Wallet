import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/app/theme/theme";
import type { OnboardingStep } from "@/features/onboarding/onboarding.types";

interface OnboardingCardProps {
  readonly step: OnboardingStep;
}

/**
 * Branded content card for each onboarding step.
 */
export function OnboardingCard({ step }: OnboardingCardProps) {
  return (
    <View style={styles.stack}>
      <View style={styles.backplateOne} />
      <View style={styles.backplateTwo} />
      <View style={styles.card}>
        <View style={styles.beam} />
        <View style={styles.iconWrap}>
          <View style={styles.iconGlow} />
          <Text style={styles.icon}>⬢</Text>
        </View>
        <Text style={styles.highlight}>{step.highlight}</Text>
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <View style={styles.statusDot} />
          <View style={styles.statusDot} />
          <View style={styles.statusDotMuted} />
        </View>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.description}>{step.description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
  },
  backplateOne: {
    position: "absolute",
    width: "86%",
    height: "72%",
    borderRadius: 32,
    backgroundColor: theme.colors.surface,
    opacity: 0.42,
    transform: [{ rotate: "7deg" }],
  },
  backplateTwo: {
    position: "absolute",
    width: "86%",
    height: "72%",
    borderRadius: 32,
    backgroundColor: theme.colors.surfaceHigh,
    borderWidth: 1,
    borderColor: theme.colors.ghostStroke,
    opacity: 0.86,
    transform: [{ rotate: "-4deg" }],
  },
  card: {
    width: "86%",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 32,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xxl,
    gap: theme.spacing.sm,
    alignItems: "center",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 20,
    },
    shadowOpacity: 0.28,
    shadowRadius: 40,
  },
  beam: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: theme.colors.accentMuted,
  },
  iconWrap: {
    marginBottom: theme.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  iconGlow: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
    opacity: 0.18,
  },
  icon: {
    fontSize: 72,
    color: theme.colors.accentSoft,
  },
  highlight: {
    color: theme.colors.accentMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2.4,
  },
  statusRow: {
    flexDirection: "row",
    gap: theme.spacing.xxs,
    marginBottom: theme.spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentMuted,
  },
  statusDotMuted: {
    width: 6,
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ghostStroke,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "800",
    textAlign: "center",
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
});
