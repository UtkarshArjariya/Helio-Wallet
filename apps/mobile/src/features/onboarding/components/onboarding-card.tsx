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
    <View style={styles.card}>
      <Text style={styles.highlight}>{step.highlight}</Text>
      <Text style={styles.title}>{step.title}</Text>
      <Text style={styles.description}>{step.description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  highlight: {
    color: theme.colors.accentMuted,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
});
