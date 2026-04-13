/**
 * Overwrites a mutable byte array in place so sensitive material does not remain
 * in memory longer than necessary.
 *
 * @param bytes - Mutable byte array containing sensitive data.
 */
export function zeroSensitiveByteArray(bytes: Uint8Array): void {
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = 0;
  }
}
