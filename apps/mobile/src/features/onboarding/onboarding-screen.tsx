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
  const isFinalStep = isFinalOnboardingStep(activeIndex, steps.length);

  const handlePrimaryAction = () => {
    if (isFinalStep) {
      onComplete();
      return;
    }
    const nextIndex = getNextOnboardingIndex(activeIndex, steps.length);
    setActiveIndex(nextIndex);
  };

  return (
    <SafeScreen>
      <Text style={styles.brand}>HELIO WALLET</Text>
      <OnboardingProgress total={steps.length} current={activeIndex} />
      <OnboardingCard step={activeStep} />
      <PrimaryButton
        label={isFinalStep ? "Secure My Wallet" : "Continue"}
        onPress={handlePrimaryAction}
      />
      <Pressable onPress={onPreviewSend}>
        <View style={styles.previewPill}>
          <Text style={styles.previewText}>Preview Send Review Surface</Text>
        </View>
      </Pressable>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  brand: {
    color: theme.colors.accentMuted,
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: "700",
    marginTop: theme.spacing.md,
  },
  previewPill: {
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    paddingVertical: theme.spacing.sm,
    alignItems: "center",
  },
  previewText: {
    color: theme.colors.textSecondary,
    fontWeight: "600",
    fontSize: 14,
  },
});
