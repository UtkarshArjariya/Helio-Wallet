import { HelioCoreError } from "../errors/helio-core-error";
import { zeroSensitiveByteArray } from "./zero-sensitive-bytes";

const ED25519_PKCS8_PREFIX = Uint8Array.from([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04,
  0x22, 0x04, 0x20,
]);

function assertSubtleCrypto(): SubtleCrypto {
  const subtleCrypto = globalThis.crypto?.subtle;

  if (subtleCrypto !== undefined) {
    return subtleCrypto;
  }

  throw new HelioCoreError(
    "Message signing is unavailable in this runtime.",
    "ENCRYPTION_FAILED",
  );
}

function concatUint8Arrays(chunks: readonly Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce(
    (currentLength, chunk) => currentLength + chunk.length,
    0,
  );
  const combinedBytes = new Uint8Array(totalLength);
  let currentOffset = 0;

  for (const chunk of chunks) {
    combinedBytes.set(chunk, currentOffset);
    currentOffset += chunk.length;
  }

  return combinedBytes;
}

function toBufferSource(bytes: Uint8Array): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);

  new Uint8Array(arrayBuffer).set(bytes);

  return arrayBuffer;
}

/**
 * Signs an arbitrary message with an Ed25519 secret key.
 *
 * @param messageBytes - Arbitrary message bytes to sign.
 * @param secretKey - Solana secret key bytes, either 32-byte seed or 64-byte secret key.
 * @returns Detached Ed25519 signature bytes.
 * @throws {HelioCoreError} When the runtime cannot import or use the private key.
 */
export async function signMessageWithSecretKey(
  messageBytes: Uint8Array,
  secretKey: Uint8Array,
): Promise<Uint8Array> {
  if (messageBytes.length === 0) {
    throw new HelioCoreError(
      "Message bytes are required before signing.",
      "INVALID_NUMERIC_INPUT",
    );
  }

  if (secretKey.length !== 32 && secretKey.length !== 64) {
    throw new HelioCoreError(
      "Secret key must contain 32 or 64 bytes.",
      "INVALID_PRIVATE_KEY",
      { byteLength: secretKey.length },
    );
  }

  const subtleCrypto = assertSubtleCrypto();
  const privateKeySeed = new Uint8Array(secretKey.slice(0, 32));
  const pkcs8PrivateKey = concatUint8Arrays([
    ED25519_PKCS8_PREFIX,
    privateKeySeed,
  ]);

  try {
    const cryptoKey = await subtleCrypto.importKey(
      "pkcs8",
      toBufferSource(pkcs8PrivateKey),
      "Ed25519",
      false,
      ["sign"],
    );
    const signatureBuffer = await subtleCrypto.sign(
      "Ed25519",
      cryptoKey,
      toBufferSource(messageBytes),
    );

    return new Uint8Array(signatureBuffer);
  } catch (cause) {
    throw new HelioCoreError(
      "Message signing failed for this request.",
      "ENCRYPTION_FAILED",
      {
        cause:
          cause instanceof Error ? cause.message : "Unknown signing failure",
      },
    );
  } finally {
    zeroSensitiveByteArray(privateKeySeed);
    zeroSensitiveByteArray(pkcs8PrivateKey);
  }
}
