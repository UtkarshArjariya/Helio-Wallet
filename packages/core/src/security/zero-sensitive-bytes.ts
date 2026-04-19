/**
 * Best-effort in-place clearing for mutable byte arrays.
 *
 * Managed runtimes may retain copies of the data or optimize away writes once
 * the buffer becomes unreachable, so this reduces exposure but does not provide
 * a hard guarantee of secure memory erasure.
 *
 * @param bytes - Mutable byte array containing sensitive data.
 */
export function zeroSensitiveByteArray(bytes: Uint8Array): void {
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = 0;
  }
}
