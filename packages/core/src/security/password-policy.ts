import type {
  PasswordValidationIssue,
  PasswordValidationResult,
} from "@helio/types";

const MIN_PASSWORD_LENGTH = 8;

const PASSWORD_REQUIREMENT_DEFINITIONS = [
  {
    code: "min-length",
    label: "At least 8 characters",
    test: (password: string) => password.length >= MIN_PASSWORD_LENGTH,
  },
  {
    code: "uppercase",
    label: "At least 1 uppercase letter",
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    code: "lowercase",
    label: "At least 1 lowercase letter",
    test: (password: string) => /[a-z]/.test(password),
  },
  {
    code: "number",
    label: "At least 1 number",
    test: (password: string) => /[0-9]/.test(password),
  },
  {
    code: "special-character",
    label: "At least 1 special character",
    test: (password: string) => /[^A-Za-z0-9]/.test(password),
  },
] as const satisfies ReadonlyArray<{
  code: PasswordValidationIssue["code"];
  label: string;
  test: (password: string) => boolean;
}>;

function createPasswordIssueStatus(
  password: string,
  requirement: (typeof PASSWORD_REQUIREMENT_DEFINITIONS)[number],
): PasswordValidationIssue {
  return {
    code: requirement.code,
    label: requirement.label,
    satisfied: requirement.test(password),
  };
}

/**
 * Evaluates Helio's wallet password requirements.
 *
 * @param password - Candidate password entered by the user.
 * @returns Detailed validation state for each requirement.
 */
export function validateWalletPassword(
  password: string,
): PasswordValidationResult {
  const issues = PASSWORD_REQUIREMENT_DEFINITIONS.map((requirement) =>
    createPasswordIssueStatus(password, requirement),
  );

  return {
    isValid: issues.every((issue) => issue.satisfied),
    issues,
  };
}
