const BASE64_ENCODE_CHUNK_SIZE = 0x8000;

export function encodeBase64(bytes: Uint8Array): string {
  let binaryValue = "";

  for (
    let startIndex = 0;
    startIndex < bytes.length;
    startIndex += BASE64_ENCODE_CHUNK_SIZE
  ) {
    binaryValue += String.fromCharCode(
      ...bytes.subarray(startIndex, startIndex + BASE64_ENCODE_CHUNK_SIZE),
    );
  }

  return btoa(binaryValue);
}

export function decodeBase64(base64Value: string): Uint8Array {
  const binaryValue = atob(base64Value);

  return Uint8Array.from(binaryValue, (character) => character.charCodeAt(0));
}
