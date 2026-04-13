import type {
  SeedPhraseVerificationChallenge,
  SeedPhraseVerificationItem,
  SeedPhraseVerificationSubmission,
} from "@helio/types";

import { HelioCoreError } from "../errors/helio-core-error";

function assertValidMnemonicWordCount(words: readonly string[]): void {
  if (words.length === 12 || words.length === 24) {
    return;
  }

  throw new HelioCoreError(
    "Seed phrase must contain 12 or 24 words.",
    "INVALID_MNEMONIC",
    {
      wordCount: words.length,
    },
  );
}

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

function createChallengeItem(
  mnemonicWords: readonly string[],
  position: number,
): SeedPhraseVerificationItem {
  return {
    position,
    expectedWord: normalizeWord(mnemonicWords[position - 1] ?? ""),
  };
}

function normalizeChallengePositions(
  mnemonicWords: readonly string[],
  positions: readonly number[],
): number[] {
  const uniquePositions = [...new Set(positions)].sort(
    (left, right) => left - right,
  );

  if (uniquePositions.length === 0) {
    return [2, Math.ceil(mnemonicWords.length / 2), mnemonicWords.length];
  }

  const isEveryPositionValid = uniquePositions.every(
    (position) => position >= 1 && position <= mnemonicWords.length,
  );

  if (isEveryPositionValid) {
    return uniquePositions;
  }

  throw new HelioCoreError(
    "Seed phrase verification positions are out of range.",
    "INVALID_CHALLENGE",
    {
      positions,
      wordCount: mnemonicWords.length,
    },
  );
}

/**
 * Builds a seed phrase verification challenge for the onboarding flow.
 *
 * @param mnemonicWords - Full mnemonic words in order.
 * @param positions - Optional 1-based positions to verify.
 * @returns Verification challenge describing the required words.
 * @throws {HelioCoreError} When the mnemonic length or positions are invalid.
 */
export function createSeedPhraseVerificationChallenge(
  mnemonicWords: readonly string[],
  positions: readonly number[] = [],
): SeedPhraseVerificationChallenge {
  assertValidMnemonicWordCount(mnemonicWords);

  const normalizedPositions = normalizeChallengePositions(
    mnemonicWords,
    positions,
  );

  return {
    mnemonicWordCount: mnemonicWords.length as 12 | 24,
    items: normalizedPositions.map((position) =>
      createChallengeItem(mnemonicWords, position),
    ),
  };
}

function normalizeSubmission(
  submission: SeedPhraseVerificationSubmission,
): Readonly<Record<number, string>> {
  return Object.fromEntries(
    Object.entries(submission.wordsByPosition).map(([position, word]) => [
      Number(position),
      normalizeWord(word),
    ]),
  );
}

/**
 * Verifies a seed phrase challenge against the user's submitted words.
 *
 * @param challenge - Challenge generated for the wallet backup confirmation flow.
 * @param submission - User-provided words keyed by 1-based position.
 * @returns `true` when every requested word matches.
 */
export function verifySeedPhraseChallenge(
  challenge: SeedPhraseVerificationChallenge,
  submission: SeedPhraseVerificationSubmission,
): boolean {
  const normalizedSubmission = normalizeSubmission(submission);

  return challenge.items.every(
    (item) =>
      normalizedSubmission[item.position] === normalizeWord(item.expectedWord),
  );
}
