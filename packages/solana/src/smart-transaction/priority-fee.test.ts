import { describe, expect, it } from "vitest";

import { estimatePriorityFeeLamports } from "./priority-fee";

describe("estimatePriorityFeeLamports", () => {
  it("returns a median-like value for medium urgency", () => {
    expect(
      estimatePriorityFeeLamports(
        [100, 200, 300, 400, 500].map((feeLamports, slot) => ({
          feeLamports,
          slot,
        })),
        "medium",
      ),
    ).toBe(300);
  });

  it("returns the highest bucket for high urgency", () => {
    expect(
      estimatePriorityFeeLamports(
        [100, 200, 300, 400, 500].map((feeLamports, slot) => ({
          feeLamports,
          slot,
        })),
        "high",
      ),
    ).toBe(400);
  });
});
