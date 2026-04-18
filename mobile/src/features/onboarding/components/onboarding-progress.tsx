import { StyleSheet, View } from "react-native";
import { theme } from "@/app/theme/theme";

interface OnboardingProgressProps {
  readonly total: number;
  readonly current: number;
}

/**
 * Progress indicator for onboarding pagination.
 */
export function OnboardingProgress({
  total,
  current,
}: OnboardingProgressProps) {
  const progressDotIds = Array.from(
    { length: total },
    (_, position) => `progress-${position + 1}`,
  );

  return (
    <View style={styles.row}>
      {progressDotIds.map((dotId, index) => {
        const isActive = index === current;
        return (
          <View
            key={dotId}
            style={[styles.dot, isActive ? styles.dotActive : undefined]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: theme.spacing.xs,
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ghostStroke,
  },
  dotActive: {
    width: 24,
    backgroundColor: theme.colors.accentMuted,
  },
});
