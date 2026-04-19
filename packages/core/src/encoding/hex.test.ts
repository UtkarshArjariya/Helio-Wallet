import { describe, expect, it } from "vitest";

import { decodeHex, encodeHex } from "./hex";

describe("hex", () => {
  it("round-trips bytes through hex encoding", () => {
    const bytes = Uint8Array.from([0, 1, 15, 16, 127, 255]);

    expect(decodeHex(encodeHex(bytes))).toEqual(bytes);
  });

  it("rejects invalid hex payloads with a core domain error", () => {
    expect(() => decodeHex("abc")).toThrowError(
      expect.objectContaining({
        code: "DECRYPTION_FAILED",
      }),
    );
  });
});
