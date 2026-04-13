import { describe, expect, it } from "vitest";

import { validateWalletPassword } from "./password-policy";

describe("validateWalletPassword", () => {
  it("accepts a password that satisfies every rule", () => {
    expect(validateWalletPassword("HelioPass9").isValid).toBe(true);
  });

  it("returns unmet requirements for a weak password", () => {
    expect(validateWalletPassword("short")).toEqual({
      isValid: false,
      issues: [
        {
          code: "min-length",
          label: "At least 8 characters",
          satisfied: false,
        },
        {
          code: "uppercase",
          label: "At least 1 uppercase letter",
          satisfied: false,
        },
        {
          code: "lowercase",
          label: "At least 1 lowercase letter",
          satisfied: true,
        },
        {
          code: "number",
          label: "At least 1 number",
          satisfied: false,
        },
      ],
    });
  });
});
