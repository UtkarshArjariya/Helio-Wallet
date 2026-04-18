import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/app/theme/theme";
import { OnboardingCard } from "@/features/onboarding/components/onboarding-card";
import { OnboardingProgress } from "@/features/onboarding/components/onboarding-progress";
import {
  getNextOnboardingIndex,
  getOnboardingSteps,
  isFinalOnboardingStep,
} from "@/features/onboarding/onboarding.utils";
import { PrimaryButton } from "@/shared/components/primary-button";
import { SafeScreen } from "@/shared/components/safe-screen";

interface OnboardingScreenProps {
  readonly onComplete: () => void;
  readonly onPreviewSend: () => void;
}

/**
 * First-run premium onboarding flow for mobile wallet users.
 */
export function OnboardingScreen({
  onComplete,
  onPreviewSend,
}: OnboardingScreenProps) {
  const steps = getOnboardingSteps();
  const [activeIndex, setActiveIndex] = useState(0);
  const activeStep = steps[activeIndex];

  const handleAdvanceInsight = () => {
    if (isFinalOnboardingStep(activeIndex, steps.length)) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex(getNextOnboardingIndex(activeIndex, steps.length));
  };

  return (
    <SafeScreen contentStyle={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Text style={styles.brandIcon}>◈</Text>
          <Text style={styles.brand}>Helio</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={handleAdvanceInsight}>
          <Text style={styles.helpIcon}>?</Text>
        </Pressable>
      </View>

      <OnboardingCard step={activeStep} />
      <OnboardingProgress total={steps.length} current={activeIndex} />

      <View style={styles.copyBlock}>
        <Text style={styles.title}>Welcome to the{"\n"}Sovereign Vault</Text>
        <Text style={styles.description}>
          Your portal to Solana, engineered for explicit review, premium
          security, and simulation-first sends.
        </Text>
      </View>

      <View style={styles.chipRow}>
        {steps.map((step) => (
          <View key={step.id} style={styles.featureChip}>
            <Text style={styles.featureChipText}>{step.highlight}</Text>
          </View>
        ))}
      </View>

      <View style={styles.insightCard}>
        <Text style={styles.insightLabel}>Security preview</Text>
        <Text style={styles.insightTitle}>{activeStep.title}</Text>
        <Text style={styles.insightBody}>{activeStep.description}</Text>
        <Pressable accessibilityRole="button" onPress={handleAdvanceInsight}>
          <View style={styles.insightAction}>
            <Text style={styles.insightActionText}>Next insight</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.actionCluster}>
        <PrimaryButton label="Create New Wallet" onPress={onComplete} />
        <PrimaryButton
          label="Import Existing Wallet"
          onPress={onComplete}
          tone="ghost"
        />
      </View>

      <Pressable accessibilityRole="button" onPress={onPreviewSend}>
        <View style={styles.previewPill}>
          <Text style={styles.previewText}>Preview send review surface</Text>
        </View>
      </Pressable>

      <View style={styles.securityPill}>
        <Text style={styles.securityIcon}>⬢</Text>
        <Text style={styles.securityText}>
          Self-custodial. Audited. Secure.
        </Text>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: "center",
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  brandIcon: {
    color: theme.colors.accent,
    fontSize: 24,
  },
  brand: {
    color: theme.colors.accentSoft,
    fontSize: 24,
    fontWeight: "900",
  },
  helpIcon: {
    color: theme.colors.textMuted,
    fontSize: 20,
    fontWeight: "700",
  },
  copyBlock: {
    gap: theme.spacing.sm,
    alignItems: "center",
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "900",
    textAlign: "center",
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: 17,
    lineHeight: 26,
    textAlign: "center",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  featureChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(38, 42, 52, 0.5)",
    borderWidth: 1,
    borderColor: theme.colors.ghostStroke,
  },
  featureChipText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  insightCard: {
    backgroundColor: "rgba(28, 31, 41, 0.72)",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.ghostStroke,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  insightLabel: {
    color: theme.colors.accentMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  insightTitle: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  insightBody: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
  insightAction: {
    alignSelf: "flex-start",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceHigh,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  insightActionText: {
    color: theme.colors.accentSecondarySoft,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  actionCluster: {
    gap: theme.spacing.sm,
  },
  previewPill: {
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.sm,
    alignItems: "center",
  },
  previewText: {
    color: theme.colors.textSecondary,
    fontWeight: "600",
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  securityPill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    borderRadius: 18,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: "rgba(3, 181, 211, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(76, 215, 246, 0.14)",
  },
  securityIcon: {
    color: theme.colors.accentMuted,
    fontSize: 16,
  },
  securityText: {
    color: theme.colors.accentSecondarySoft,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
