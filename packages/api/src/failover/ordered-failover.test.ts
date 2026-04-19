import { describe, expect, it, vi } from "vitest";

import { executeWithOrderedFailover } from "./ordered-failover";

describe("executeWithOrderedFailover", () => {
  it("returns the first successful result after an earlier provider fails", async () => {
    const operation = vi
      .fn<(candidate: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error("primary offline"))
      .mockResolvedValueOnce("fallback-ok");

    const result = await executeWithOrderedFailover(
      ["primary", "fallback"],
      operation,
    );

    expect(result).toBe("fallback-ok");
    expect(operation).toHaveBeenNthCalledWith(1, "primary");
    expect(operation).toHaveBeenNthCalledWith(2, "fallback");
  });

  it("throws when every provider fails", async () => {
    const operation = vi
      .fn<(candidate: string) => Promise<string>>()
      .mockRejectedValue(new Error("still offline"));

    await expect(
      executeWithOrderedFailover(["primary", "fallback"], operation),
    ).rejects.toThrow("still offline");
  });

  it("throws a generic error when providers reject with non-Error values", async () => {
    const operation = vi
      .fn<(candidate: string) => Promise<string>>()
      .mockRejectedValue("offline");

    await expect(
      executeWithOrderedFailover(["primary", "fallback"], operation),
    ).rejects.toThrow("All configured providers failed.");
  });
});
