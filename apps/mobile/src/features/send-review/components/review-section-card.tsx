import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/app/theme/theme";
import type { SendReviewSection } from "@/features/send-review/send-review.types";

interface ReviewSectionCardProps {
  readonly section: SendReviewSection;
}

/**
 * Structured send-review section card.
 */
export function ReviewSectionCard({ section }: ReviewSectionCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{section.title}</Text>
      {section.items.map((item) => (
        <View key={`${section.title}-${item.label}`} style={styles.row}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.value}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.colors.accentMuted,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  value: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },
});
