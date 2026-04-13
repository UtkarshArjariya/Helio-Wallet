export type WalletImportMethod = "seed-phrase" | "private-key";

export type PasswordValidationIssueCode =
  | "min-length"
  | "uppercase"
  | "lowercase"
  | "number";

export interface PasswordValidationIssue {
  readonly code: PasswordValidationIssueCode;
  readonly label: string;
  readonly satisfied: boolean;
}

export interface PasswordValidationResult {
  readonly isValid: boolean;
  readonly issues: readonly PasswordValidationIssue[];
}

export interface SeedPhraseVerificationItem {
  readonly position: number;
  readonly expectedWord: string;
}

export interface SeedPhraseVerificationChallenge {
  readonly mnemonicWordCount: 12 | 24;
  readonly items: readonly SeedPhraseVerificationItem[];
}

export interface SeedPhraseVerificationSubmission {
  readonly wordsByPosition: Readonly<Record<number, string>>;
}
