import { Alert, StyleSheet, Text, View } from "react-native";
import { theme } from "@/app/theme/theme";
import { ReviewSectionCard } from "@/features/send-review/components/review-section-card";
import { WarningBanner } from "@/features/send-review/components/warning-banner";
import type { SendReviewDraft } from "@/features/send-review/send-review.types";
import { buildSendReviewSections } from "@/features/send-review/send-review.utils";
import { PrimaryButton } from "@/shared/components/primary-button";
import { SafeScreen } from "@/shared/components/safe-screen";

interface SendReviewScreenProps {
  readonly draft: SendReviewDraft;
  readonly onBack: () => void;
}

/**
 * Simulation-first send review flow that surfaces risk before signing.
 */
export function SendReviewScreen({ draft, onBack }: SendReviewScreenProps) {
  const sections = buildSendReviewSections(draft);
  const hasBlockingWarning = draft.warnings.some((warning) => warning.blocking);

  const handleConfirm = () => {
    if (hasBlockingWarning) {
      Alert.alert(
        "Review required",
        "This transaction has blocking warnings. Edit and re-simulate before signing.",
      );
      return;
    }
    Alert.alert(
      "Shell action",
      "Signing is intentionally not implemented in this mobile shell yet.",
    );
  };

  return (
    <SafeScreen>
      <Text style={styles.heading}>Send Review</Text>
      <Text style={styles.subheading}>
        Clear summary before secure signing boundary in core package.
      </Text>
      {draft.warnings.map((warning) => (
        <WarningBanner key={warning.code} warning={warning} />
      ))}
      {sections.map((section) => (
        <ReviewSectionCard key={section.title} section={section} />
      ))}
      <View style={styles.actions}>
        <PrimaryButton label="Back" onPress={onBack} />
        <PrimaryButton
          disabled={hasBlockingWarning}
          label={
            hasBlockingWarning ? "Blocked Until Fixed" : "Confirm and Sign"
          }
          onPress={handleConfirm}
        />
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: theme.colors.textPrimary,
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "700",
  },
  subheading: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  actions: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
});
