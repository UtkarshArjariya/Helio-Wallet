import { describe, expect, it } from "vitest";

import {
  createSeedPhraseVerificationChallenge,
  verifySeedPhraseChallenge,
} from "./seed-phrase";

const TEST_MNEMONIC = [
  "solar",
  "wallet",
  "violet",
  "harbor",
  "rocket",
  "glow",
  "canvas",
  "copper",
  "signal",
  "orbit",
  "ledger",
  "thrive",
];

describe("createSeedPhraseVerificationChallenge", () => {
  it("creates challenge items for the requested positions", () => {
    expect(
      createSeedPhraseVerificationChallenge(TEST_MNEMONIC, [1, 6, 12]),
    ).toEqual({
      mnemonicWordCount: 12,
      items: [
        { position: 1, expectedWord: "solar" },
        { position: 6, expectedWord: "glow" },
        { position: 12, expectedWord: "thrive" },
      ],
    });
  });
});

describe("verifySeedPhraseChallenge", () => {
  it("returns true when every submitted word matches", () => {
    const challenge = createSeedPhraseVerificationChallenge(
      TEST_MNEMONIC,
      [2, 4, 8],
    );

    expect(
      verifySeedPhraseChallenge(challenge, {
        wordsByPosition: {
          2: "wallet",
          4: "harbor",
          8: " copper ",
        },
      }),
    ).toBe(true);
  });

  it("returns false when any submitted word is incorrect", () => {
    const challenge = createSeedPhraseVerificationChallenge(
      TEST_MNEMONIC,
      [3, 5, 9],
    );

    expect(
      verifySeedPhraseChallenge(challenge, {
        wordsByPosition: {
          3: "violet",
          5: "wrong",
          9: "signal",
        },
      }),
    ).toBe(false);
  });
});
