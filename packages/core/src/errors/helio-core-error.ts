export type HelioCoreErrorCode =
  | "INVALID_PASSWORD"
  | "INVALID_MNEMONIC"
  | "INVALID_CHALLENGE"
  | "INVALID_NUMERIC_INPUT";

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
