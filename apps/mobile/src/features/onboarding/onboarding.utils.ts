import type { OnboardingStep } from "@/features/onboarding/onboarding.types";

const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: "secure-seed",
    title: "Own your keys. Always.",
    description:
      "Helio keeps signing local and guarded. Recovery setup is explicit, verified, and recoverable.",
    highlight: "Hardware-grade boundaries",
  },
  {
    id: "fee-clarity",
    title: "Know the real send impact.",
    description:
      "Before any signature, review simulation outcomes, fee details, and account safety warnings.",
    highlight: "Simulation-first sends",
  },
  {
    id: "fast-returns",
    title: "Unlock in a second.",
    description:
      "Return quickly with biometric unlock while preserving strict transaction signing controls.",
    highlight: "Fast and controlled",
  },
];

/**
 * Returns immutable onboarding configuration in display order.
 */
export function getOnboardingSteps(): readonly OnboardingStep[] {
  return ONBOARDING_STEPS;
}

/**
 * Calculates the next onboarding step index within valid bounds.
 */
export function getNextOnboardingIndex(
  currentIndex: number,
  totalSteps: number,
): number {
  if (totalSteps <= 0) {
    throw new Error("Onboarding must include at least one step.");
  }
  if (currentIndex < 0 || currentIndex >= totalSteps) {
    throw new Error("Current onboarding index is out of bounds.");
  }
  return Math.min(currentIndex + 1, totalSteps - 1);
}

/**
 * Returns true when the active index is the final onboarding step.
 */
export function isFinalOnboardingStep(
  currentIndex: number,
  totalSteps: number,
): boolean {
  if (totalSteps <= 0) {
    throw new Error("Onboarding must include at least one step.");
  }
  return currentIndex === totalSteps - 1;
}
