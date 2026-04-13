import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/app/theme/theme";
import type { SendReviewWarning } from "@/features/send-review/send-review.types";

interface WarningBannerProps {
  readonly warning: SendReviewWarning;
}

/**
 * Warning card for surfaced simulation or risk alerts.
 */
export function WarningBanner({ warning }: WarningBannerProps) {
  return (
    <View style={[styles.card, warning.blocking ? styles.blocking : undefined]}>
      <Text style={styles.title}>{warning.title}</Text>
      <Text style={styles.detail}>{warning.detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#2f1f15",
    borderWidth: 1,
    borderColor: theme.colors.warning,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  blocking: {
    borderColor: theme.colors.danger,
    backgroundColor: "#3a1717",
  },
  title: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: 15,
  },
  detail: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
