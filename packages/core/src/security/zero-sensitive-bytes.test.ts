import { describe, expect, it } from "vitest";

import { zeroSensitiveByteArray } from "./zero-sensitive-bytes";

describe("zeroSensitiveByteArray", () => {
  it("replaces every byte with zero", () => {
    const bytes = new Uint8Array([7, 11, 19, 23]);

    zeroSensitiveByteArray(bytes);

    expect([...bytes]).toEqual([0, 0, 0, 0]);
  });
});
