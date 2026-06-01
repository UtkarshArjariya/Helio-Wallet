export * from './auto-yield/auto-yield-program';
export * from './auto-yield/auto-yield-state';
export * from './errors/helio-solana-error';
/**
 * The Codama-generated `@solana/kit` client for the Helio AutoYield program
 * (ADR-0005 / ADR-0004 Phase 3), exposed under a namespace to keep its ~100
 * generated symbols from colliding with this package's flat surface (e.g. the
 * generated `HELIO_PROGRAM_ADDRESS` vs the hand-written `HELIO_AUTO_YIELD_PROGRAM_ID`).
 * Regenerate with `pnpm --filter @helio/solana generate:client`.
 */
export * as helioClient from './generated/helio';
export * from './smart-transaction/priority-fee';
export * from './smart-transaction/smart-transaction-review';
