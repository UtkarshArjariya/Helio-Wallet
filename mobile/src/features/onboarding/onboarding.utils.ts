import type { OnboardingStep } from "@/features/onboarding/onboarding.types";

const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: "secure-seed",
    title: "Vault encryption stays local.",
    description:
      "Recovery setup is explicit, verified, and never leaves the device boundary.",
    highlight: "Self-custodial",
  },
  {
    id: "fee-clarity",
    title: "See the real send impact.",
    description:
      "Simulation, fees, rent reserve, and safety warnings surface before you sign.",
    highlight: "Smart simulation",
  },
  {
    id: "fast-returns",
    title: "Return with speed and control.",
    description:
      "Biometric unlock is fast, while signing and approval stay explicit and reviewable.",
    highlight: "Audited security",
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
