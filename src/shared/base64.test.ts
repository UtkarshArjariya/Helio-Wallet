import { describe, expect, it } from "vitest";

import { decodeBase64, encodeBase64 } from "./base64";

describe("base64", () => {
  it("round-trips large byte arrays without overflowing the call stack", () => {
    const bytes = Uint8Array.from(
      { length: 100_000 },
      (_, index) => index % 256,
    );

    expect(decodeBase64(encodeBase64(bytes))).toEqual(bytes);
  });
});
