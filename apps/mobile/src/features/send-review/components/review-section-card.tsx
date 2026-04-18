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
    backgroundColor: "rgba(49, 53, 63, 0.42)",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.ghostStroke,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.colors.accentMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  value: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },
});
