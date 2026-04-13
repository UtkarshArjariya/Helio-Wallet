import { describe, expect, it } from "vitest";
import {
  getNextOnboardingIndex,
  getOnboardingSteps,
  isFinalOnboardingStep,
} from "@/features/onboarding/onboarding.utils";

describe("onboarding.utils", () => {
  it("returns predefined onboarding steps", () => {
    const steps = getOnboardingSteps();
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0].id).toBe("secure-seed");
  });

  it("advances step index while staying within bounds", () => {
    expect(getNextOnboardingIndex(0, 3)).toBe(1);
    expect(getNextOnboardingIndex(2, 3)).toBe(2);
  });

  it("throws when index is invalid", () => {
    expect(() => getNextOnboardingIndex(-1, 3)).toThrow();
    expect(() => getNextOnboardingIndex(3, 3)).toThrow();
  });

  it("detects final step correctly", () => {
    expect(isFinalOnboardingStep(2, 3)).toBe(true);
    expect(isFinalOnboardingStep(1, 3)).toBe(false);
  });
});
