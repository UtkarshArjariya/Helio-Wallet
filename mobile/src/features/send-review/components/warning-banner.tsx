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
      <View style={styles.row}>
        <Text
          style={[
            styles.icon,
            warning.blocking ? styles.iconBlocking : undefined,
          ]}
        >
          {warning.blocking ? "!" : "i"}
        </Text>
        <View style={styles.copy}>
          <Text style={styles.title}>{warning.title}</Text>
          <Text style={styles.detail}>{warning.detail}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(143, 66, 0, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(255, 182, 139, 0.18)",
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  blocking: {
    borderColor: "rgba(255, 180, 171, 0.18)",
    backgroundColor: "rgba(147, 0, 10, 0.22)",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
  },
  icon: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.pill,
    overflow: "hidden",
    color: theme.colors.warning,
    textAlign: "center",
    lineHeight: 24,
    fontSize: 14,
    fontWeight: "800",
    backgroundColor: "rgba(255, 182, 139, 0.08)",
  },
  iconBlocking: {
    color: theme.colors.danger,
    backgroundColor: "rgba(255, 180, 171, 0.08)",
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  title: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  detail: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
});
