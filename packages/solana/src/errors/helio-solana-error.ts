export type HelioSolanaErrorCode =
  | "INSUFFICIENT_PRIORITY_FEE_DATA"
  | "INVALID_AMOUNT";

export class HelioSolanaError extends Error {
  public readonly code: HelioSolanaErrorCode;

  public readonly context?: Record<string, unknown>;

  public constructor(
    message: string,
    code: HelioSolanaErrorCode,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "HelioSolanaError";
    this.code = code;
    this.context = context;
  }
}
