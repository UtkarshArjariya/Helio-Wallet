/**
 * Compat boundary — the single, auditable seam between web3.js **v1**
 * (`@solana/web3.js`) and web3.js **v2** (`@solana/kit`).
 *
 * Per ADR-0004, Helio is migrating to Kit incrementally: the read-only RPC leaf
 * moves first while every signing/Anchor path stays on v1. During that (long)
 * transition the two SDKs coexist, and values must occasionally cross the seam
 * — a v1 `PublicKey` into a Kit RPC call, a Kit `Address`/`Lamports` back into
 * v1-shaped DTOs. **Centralizing every `fromLegacy*` / `toLegacy*` conversion
 * here** keeps that seam in one place so it is easy to find, review, and
 * eventually delete once v1 is fully retired.
 *
 * Keep this module dependency-light: it should only ever bridge types, never
 * perform I/O.
 */

import { fromLegacyPublicKey } from "@solana/compat";
import { type Address, address, type Lamports } from "@solana/kit";
import { PublicKey } from "@solana/web3.js";

/**
 * Converts a base58 address string or a legacy v1 {@link PublicKey} into a Kit
 * {@link Address}.
 *
 * @param value - A base58-encoded address string, or a v1 `PublicKey`.
 * @returns The corresponding Kit `Address`.
 * @throws {Error} If a string is supplied that is not a valid base58 address.
 */
export function toKitAddress(value: string | PublicKey): Address {
  return value instanceof PublicKey
    ? fromLegacyPublicKey(value)
    : address(value);
}

/**
 * Converts a Kit {@link Address} (or any base58 address string) back into a
 * legacy v1 {@link PublicKey}.
 *
 * Kit has no `toLegacyPublicKey` helper because an `Address` is already a
 * branded base58 string, so the v1 `PublicKey` constructor accepts it directly.
 *
 * @param value - A Kit `Address` or base58 address string.
 * @returns The corresponding v1 `PublicKey`.
 * @throws {Error} If the value is not a valid base58 address.
 */
export function toLegacyPublicKey(value: Address | string): PublicKey {
  return new PublicKey(value);
}

/**
 * Converts a Kit {@link Lamports} value (a branded `bigint`) into a JavaScript
 * `number`.
 *
 * This is the "convert at the UI/DTO edge" helper from ADR-0004: Kit returns
 * lamports as `bigint`, but the existing `@helio/types` DTOs and screens expect
 * `number`. Lamport balances comfortably fit within `Number.MAX_SAFE_INTEGER`
 * (~9.007e15 — i.e. ~9.007M SOL), so this conversion is lossless in practice.
 *
 * @param value - A lamport amount as a Kit `Lamports` or plain `bigint`.
 * @returns The lamport amount as a `number`.
 */
export function lamportsToNumber(value: Lamports | bigint): number {
  return Number(value);
}
