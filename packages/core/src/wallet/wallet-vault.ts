import type {
  ExtensionVaultKind,
  StoredWalletVault,
  WalletAccountSummary,
} from "@helio/types";
import {
  generateMnemonic,
  mnemonicToSeed,
  validateMnemonic,
} from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

import { decodeHex, encodeHex } from "../encoding/hex";
import { HelioCoreError } from "../errors/helio-core-error";
import { zeroSensitiveByteArray } from "../security/zero-sensitive-bytes";

const DEFAULT_DERIVATION_INDEX = 0;
const DEFAULT_SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";
const ED25519_SEED_KEY = new TextEncoder().encode("ed25519 seed");
const HARDENED_OFFSET = 0x80000000;
const PBKDF2_ITERATIONS = 310_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const PBKDF2_HASH = "SHA-256";
const PBKDF2_KEY_LENGTH = 256;

interface DerivedWalletAccount {
  readonly account: WalletAccountSummary;
  readonly secretKey: Uint8Array;
}

interface Slip10Node {
  readonly privateKey: Uint8Array;
  readonly chainCode: Uint8Array;
}

export interface UnlockedWalletVault {
  readonly account: WalletAccountSummary;
  readonly secretKey: Uint8Array;
}

function assertSupportedMnemonicWordCount(wordCount: number): void {
  if (wordCount === 12 || wordCount === 24) {
    return;
  }

  throw new HelioCoreError(
    "Seed phrase must contain 12 or 24 words.",
    "INVALID_MNEMONIC",
    { wordCount },
  );
}

function assertSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;

  if (subtle !== undefined) {
    return subtle;
  }

  throw new HelioCoreError(
    "Secure encryption is unavailable in this runtime.",
    "ENCRYPTION_FAILED",
  );
}

function normalizeMnemonicWords(mnemonicWords: readonly string[]): string[] {
  return mnemonicWords.map((word) => word.trim().toLowerCase()).filter(Boolean);
}

function normalizeMnemonic(mnemonicWords: readonly string[]): string {
  const normalizedWords = normalizeMnemonicWords(mnemonicWords);
  assertSupportedMnemonicWordCount(normalizedWords.length);

  return normalizedWords.join(" ");
}

function createShortAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function concatUint8Arrays(chunks: readonly Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce(
    (currentLength, chunk) => currentLength + chunk.length,
    0,
  );
  const combined = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return combined;
}

function encodeUint32BigEndian(value: number): Uint8Array {
  const buffer = new Uint8Array(4);
  const view = new DataView(buffer.buffer);

  view.setUint32(0, value, false);

  return buffer;
}

function getMnemonicStrength(wordCount: 12 | 24): 128 | 256 {
  return wordCount === 24 ? 256 : 128;
}

function createPasswordBytes(password: string): Uint8Array {
  return new TextEncoder().encode(password);
}

async function signHmacSha512(
  keyBytes: Uint8Array,
  dataBytes: Uint8Array,
): Promise<Uint8Array> {
  const subtle = assertSubtleCrypto();
  const cryptoKey = await subtle.importKey(
    "raw",
    keyBytes,
    {
      name: "HMAC",
      hash: "SHA-512",
    },
    false,
    ["sign"],
  );
  const signature = await subtle.sign(
    "HMAC",
    cryptoKey,
    dataBytes,
  );

  return new Uint8Array(signature);
}

async function derivePasswordKey(
  passwordBytes: Uint8Array,
  salt: Uint8Array,
  usage: KeyUsage[],
): Promise<CryptoKey> {
  const subtle = assertSubtleCrypto();
  const baseKey = await subtle.importKey(
    "raw",
    passwordBytes,
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: PBKDF2_HASH,
      iterations: PBKDF2_ITERATIONS,
      salt,
    },
    baseKey,
    {
      name: "AES-GCM",
      length: PBKDF2_KEY_LENGTH,
    },
    false,
    usage,
  );
}

function createAccountSummary(
  address: string,
  kind: WalletAccountSummary["kind"],
  label: string,
): WalletAccountSummary {
  return {
    address,
    shortAddress: createShortAddress(address),
    derivationIndex: DEFAULT_DERIVATION_INDEX,
    kind,
    label,
  };
}

function createKeypairFromSecretBytes(secretBytes: Uint8Array): Keypair {
  if (secretBytes.length === 32) {
    return Keypair.fromSeed(secretBytes);
  }

  if (secretBytes.length === 64) {
    return Keypair.fromSecretKey(secretBytes);
  }

  throw new HelioCoreError(
    "Private key must decode to 32 or 64 bytes.",
    "INVALID_PRIVATE_KEY",
    { byteLength: secretBytes.length },
  );
}

function createImportedAccount(secretKey: Uint8Array): DerivedWalletAccount {
  const keypair = createKeypairFromSecretBytes(secretKey);
  const derivedSecretKey = new Uint8Array(keypair.secretKey);
  const address = keypair.publicKey.toBase58();

  zeroSensitiveByteArray(keypair.secretKey);

  return {
    account: createAccountSummary(address, "imported", "Imported Vault"),
    secretKey: derivedSecretKey,
  };
}

function parseHardenedDerivationPath(path: string): readonly number[] {
  const segments = path.split("/");

  if (segments[0] !== "m" || segments.length < 2) {
    throw new HelioCoreError(
      "Wallet derivation path is invalid.",
      "INVALID_MNEMONIC",
      { path },
    );
  }

  return segments.slice(1).map((segment) => {
    if (!segment.endsWith("'")) {
      throw new HelioCoreError(
        "Wallet derivation path must use hardened indexes only.",
        "INVALID_MNEMONIC",
        { path, segment },
      );
    }

    const numericSegment = Number.parseInt(segment.slice(0, -1), 10);

    if (!Number.isInteger(numericSegment) || numericSegment < 0) {
      throw new HelioCoreError(
        "Wallet derivation path contains an invalid index.",
        "INVALID_MNEMONIC",
        { path, segment },
      );
    }

    return numericSegment + HARDENED_OFFSET;
  });
}

async function deriveSlip10Node(
  parentNode: Slip10Node,
  index: number,
): Promise<Slip10Node> {
  const serializedIndex = encodeUint32BigEndian(index);
  const dataBytes = concatUint8Arrays([
    new Uint8Array([0]),
    parentNode.privateKey,
    serializedIndex,
  ]);

  try {
    const hmacOutput = await signHmacSha512(parentNode.chainCode, dataBytes);
    const privateKey = hmacOutput.slice(0, 32);
    const chainCode = hmacOutput.slice(32);

    return {
      privateKey,
      chainCode,
    };
  } finally {
    zeroSensitiveByteArray(serializedIndex);
    zeroSensitiveByteArray(dataBytes);
  }
}

async function deriveSlip10PrivateKey(
  seedBytes: Uint8Array,
  path: string,
): Promise<Uint8Array> {
  const masterOutput = await signHmacSha512(ED25519_SEED_KEY, seedBytes);
  let currentNode: Slip10Node = {
    privateKey: masterOutput.slice(0, 32),
    chainCode: masterOutput.slice(32),
  };

  try {
    for (const index of parseHardenedDerivationPath(path)) {
      const nextNode = await deriveSlip10Node(currentNode, index);

      zeroSensitiveByteArray(currentNode.privateKey);
      zeroSensitiveByteArray(currentNode.chainCode);
      currentNode = nextNode;
    }

    return new Uint8Array(currentNode.privateKey);
  } finally {
    zeroSensitiveByteArray(masterOutput);
    zeroSensitiveByteArray(currentNode.privateKey);
    zeroSensitiveByteArray(currentNode.chainCode);
  }
}

async function createDerivedMnemonicAccount(
  mnemonicWords: readonly string[],
): Promise<DerivedWalletAccount> {
  const normalizedMnemonic = normalizeMnemonic(mnemonicWords);

  if (!validateMnemonic(normalizedMnemonic, wordlist)) {
    throw new HelioCoreError(
      "Seed phrase is not a valid BIP39 mnemonic.",
      "INVALID_MNEMONIC",
    );
  }

  const seedBytes = await mnemonicToSeed(normalizedMnemonic);
  const seedArray = new Uint8Array(seedBytes);

  try {
    const derivedSeed = await deriveSlip10PrivateKey(
      seedArray,
      DEFAULT_SOLANA_DERIVATION_PATH,
    );

    try {
      const keypair = Keypair.fromSeed(derivedSeed);
      const secretKey = new Uint8Array(keypair.secretKey);
      const address = keypair.publicKey.toBase58();

      zeroSensitiveByteArray(keypair.secretKey);

      return {
        account: createAccountSummary(address, "derived", "Primary Vault"),
        secretKey,
      };
    } finally {
      zeroSensitiveByteArray(derivedSeed);
    }
  } finally {
    zeroSensitiveByteArray(seedArray);
  }
}

async function encryptBytes(
  secretBytes: Uint8Array,
  password: string,
): Promise<StoredWalletVault["encryptedPayload"]> {
  const subtle = assertSubtleCrypto();
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const passwordBytes = createPasswordBytes(password);

  try {
    const encryptionKey = await derivePasswordKey(passwordBytes, salt, [
      "encrypt",
    ]);
    const encryptedBuffer = await subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      encryptionKey,
      secretBytes,
    );

    return {
      algorithm: "aes-gcm",
      keyDerivation: "pbkdf2",
      iterations: PBKDF2_ITERATIONS,
      saltHex: encodeHex(salt),
      ivHex: encodeHex(iv),
      cipherTextHex: encodeHex(new Uint8Array(encryptedBuffer)),
    };
  } catch (cause) {
    throw new HelioCoreError(
      "Failed to encrypt the wallet vault.",
      "ENCRYPTION_FAILED",
      { cause },
    );
  } finally {
    zeroSensitiveByteArray(passwordBytes);
    zeroSensitiveByteArray(salt);
    zeroSensitiveByteArray(iv);
  }
}

async function decryptBytes(
  encryptedPayload: StoredWalletVault["encryptedPayload"],
  password: string,
): Promise<Uint8Array> {
  const subtle = assertSubtleCrypto();
  const salt = decodeHex(encryptedPayload.saltHex);
  const iv = decodeHex(encryptedPayload.ivHex);
  const cipherText = decodeHex(encryptedPayload.cipherTextHex);
  const passwordBytes = createPasswordBytes(password);

  try {
    const encryptionKey = await derivePasswordKey(passwordBytes, salt, [
      "decrypt",
    ]);
    const decryptedBuffer = await subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      encryptionKey,
      cipherText,
    );

    return new Uint8Array(decryptedBuffer);
  } catch (cause) {
    throw new HelioCoreError(
      "Wallet password is incorrect.",
      "DECRYPTION_FAILED",
      { cause },
    );
  } finally {
    zeroSensitiveByteArray(passwordBytes);
    zeroSensitiveByteArray(salt);
    zeroSensitiveByteArray(iv);
    zeroSensitiveByteArray(cipherText);
  }
}

function createVaultRecord(
  kind: ExtensionVaultKind,
  primaryAccount: WalletAccountSummary,
  encryptedPayload: StoredWalletVault["encryptedPayload"],
  mnemonicWordCount: StoredWalletVault["mnemonicWordCount"],
): StoredWalletVault {
  const timestampIso = new Date().toISOString();

  return {
    schemaVersion: 1,
    kind,
    primaryAccount,
    encryptedPayload,
    mnemonicWordCount,
    createdAtIso: timestampIso,
    updatedAtIso: timestampIso,
  };
}

/**
 * Generates a new BIP39 mnemonic for wallet onboarding.
 *
 * @param wordCount - Desired mnemonic length.
 * @returns Generated mnemonic words in order.
 * @throws {HelioCoreError} When the requested word count is unsupported.
 */
export function generateWalletMnemonicWords(
  wordCount: 12 | 24 = 12,
): readonly string[] {
  assertSupportedMnemonicWordCount(wordCount);

  return generateMnemonic(wordlist, getMnemonicStrength(wordCount)).split(" ");
}

/**
 * Validates a mnemonic entered during wallet creation or import.
 *
 * @param mnemonicWords - Candidate mnemonic words in order.
 * @returns `true` when the mnemonic is valid.
 */
export function validateWalletMnemonicWords(
  mnemonicWords: readonly string[],
): boolean {
  try {
    return validateMnemonic(normalizeMnemonic(mnemonicWords), wordlist);
  } catch {
    return false;
  }
}

/**
 * Creates an encrypted vault record for a BIP39 mnemonic.
 *
 * @param mnemonicWords - Mnemonic words to encrypt.
 * @param password - User password used to derive the encryption key.
 * @returns Stored vault record containing only encrypted wallet material.
 */
export async function createStoredMnemonicVault(
  mnemonicWords: readonly string[],
  password: string,
): Promise<StoredWalletVault> {
  const mnemonicBytes = new TextEncoder().encode(
    normalizeMnemonic(mnemonicWords),
  );
  const derivedAccount = await createDerivedMnemonicAccount(mnemonicWords);

  try {
    const encryptedPayload = await encryptBytes(mnemonicBytes, password);

    return createVaultRecord(
      "mnemonic",
      derivedAccount.account,
      encryptedPayload,
      mnemonicWords.length as 12 | 24,
    );
  } finally {
    zeroSensitiveByteArray(mnemonicBytes);
    zeroSensitiveByteArray(derivedAccount.secretKey);
  }
}

/**
 * Creates an encrypted vault record for a base58 private key import.
 *
 * @param privateKeyBase58 - Base58-encoded private key.
 * @param password - User password used to derive the encryption key.
 * @returns Stored vault record containing the encrypted imported private key.
 * @throws {HelioCoreError} When the private key is invalid.
 */
export async function createStoredPrivateKeyVault(
  privateKeyBase58: string,
  password: string,
): Promise<StoredWalletVault> {
  let decodedSecretKey: Uint8Array;

  try {
    decodedSecretKey = bs58.decode(privateKeyBase58.trim());
  } catch (cause) {
    throw new HelioCoreError(
      "Private key must be a valid base58 value.",
      "INVALID_PRIVATE_KEY",
      { cause },
    );
  }

  const importedAccount = createImportedAccount(decodedSecretKey);

  try {
    const encryptedPayload = await encryptBytes(
      importedAccount.secretKey,
      password,
    );

    return createVaultRecord(
      "private-key",
      importedAccount.account,
      encryptedPayload,
      null,
    );
  } finally {
    zeroSensitiveByteArray(decodedSecretKey);
    zeroSensitiveByteArray(importedAccount.secretKey);
  }
}

/**
 * Unlocks a stored vault and derives the active account secret key in memory.
 *
 * @param vault - Encrypted vault record from extension storage.
 * @param password - User password supplied at unlock time.
 * @returns Active account summary and secret key for session-only usage.
 */
export async function unlockStoredWalletVault(
  vault: StoredWalletVault,
  password: string,
): Promise<UnlockedWalletVault> {
  const decryptedBytes = await decryptBytes(vault.encryptedPayload, password);

  try {
    if (vault.kind === "mnemonic") {
      const mnemonicWords = new TextDecoder()
        .decode(decryptedBytes)
        .split(/\s+/)
        .filter(Boolean);
      const derivedAccount = await createDerivedMnemonicAccount(mnemonicWords);

      return {
        account: derivedAccount.account,
        secretKey: derivedAccount.secretKey,
      };
    }

    const importedAccount = createImportedAccount(decryptedBytes);

    return {
      account: importedAccount.account,
      secretKey: importedAccount.secretKey,
    };
  } finally {
    zeroSensitiveByteArray(decryptedBytes);
  }
}

/**
 * Re-authenticates and returns the mnemonic words for export.
 *
 * @param vault - Stored mnemonic vault.
 * @param password - Wallet password.
 * @returns Mnemonic words in display order.
 * @throws {HelioCoreError} When the vault does not contain a mnemonic.
 */
export async function exportMnemonicWordsFromVault(
  vault: StoredWalletVault,
  password: string,
): Promise<readonly string[]> {
  if (vault.kind !== "mnemonic") {
    throw new HelioCoreError(
      "This wallet cannot export a recovery phrase.",
      "UNSUPPORTED_VAULT_OPERATION",
    );
  }

  const decryptedBytes = await decryptBytes(vault.encryptedPayload, password);

  try {
    return new TextDecoder()
      .decode(decryptedBytes)
      .split(/\s+/)
      .filter(Boolean);
  } finally {
    zeroSensitiveByteArray(decryptedBytes);
  }
}
