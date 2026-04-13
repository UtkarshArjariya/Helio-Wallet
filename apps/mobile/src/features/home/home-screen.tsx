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
      <Text style={styles.title}>Helio Wallet</Text>
      <Text style={styles.description}>
        Mobile shell initialized. Secure wallet creation, unlock, and signing
        boundaries plug in next through shared packages.
      </Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Send Flow</Text>
        <Text style={styles.cardBody}>
          Open premium send review to validate simulation and fee impact before
          signing.
        </Text>
        <PrimaryButton label="Open Send Review" onPress={onOpenSendReview} />
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: theme.colors.textPrimary,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700",
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
  card: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  cardTitle: {
    color: theme.colors.accentMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "700",
    fontSize: 12,
  },
  cardBody: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
  },
});
