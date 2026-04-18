export type HelioCoreErrorCode =
  | "INVALID_PASSWORD"
  | "INVALID_MNEMONIC"
  | "INVALID_CHALLENGE"
  | "INVALID_NUMERIC_INPUT"
  | "INVALID_DAPP_ORIGIN"
  | "INVALID_DAPP_TRANSACTION"
  | "INVALID_PRIVATE_KEY"
  | "ENCRYPTION_FAILED"
  | "DECRYPTION_FAILED"
  | "DAPP_APPROVAL_REQUIRED"
  | "DAPP_REQUEST_NOT_FOUND"
  | "WALLET_NOT_FOUND"
  | "SESSION_LOCKED"
  | "UNSUPPORTED_VAULT_OPERATION";

export class HelioCoreError extends Error {
  public readonly code: HelioCoreErrorCode;

  public readonly context?: Record<string, unknown>;

  public constructor(
    message: string,
    code: HelioCoreErrorCode,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "HelioCoreError";
    this.code = code;
    this.context = context;
  }
}
