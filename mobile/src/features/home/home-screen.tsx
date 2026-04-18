import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/app/theme/theme";
import { PrimaryButton } from "@/shared/components/primary-button";
import { SafeScreen } from "@/shared/components/safe-screen";

interface HomeScreenProps {
  readonly onOpenSendReview: () => void;
}

/**
 * Temporary home shell for navigating core wallet surfaces.
 */
export function HomeScreen({ onOpenSendReview }: HomeScreenProps) {
  return (
    <SafeScreen>
      <Text style={styles.eyebrow}>Vault Overview</Text>
      <Text style={styles.title}>Primary Vault</Text>
      <Text style={styles.description}>
        Shared wallet logic is wired into a richer mobile shell now. Send review
        remains the next strongest surface to validate.
      </Text>
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Portfolio</Text>
        <Text style={styles.heroValue}>$126,404.82</Text>
        <Text style={styles.heroTrend}>+3.42% today</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Send Review</Text>
        <Text style={styles.cardBody}>
          Open the simulation-first review surface to inspect fees, rent
          reserves, and smart adjustment decisions.
        </Text>
        <PrimaryButton label="Open Send Review" onPress={onOpenSendReview} />
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: theme.colors.accentMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "800",
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
  heroCard: {
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surfaceLow,
    padding: theme.spacing.xl,
    gap: theme.spacing.xs,
  },
  heroLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  heroValue: {
    color: theme.colors.textPrimary,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
  },
  heroTrend: {
    color: theme.colors.accentMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  card: {
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.ghostStroke,
    backgroundColor: "rgba(49, 53, 63, 0.42)",
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  cardTitle: {
    color: theme.colors.accentMuted,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontWeight: "700",
    fontSize: 12,
  },
  cardBody: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
  },
});
