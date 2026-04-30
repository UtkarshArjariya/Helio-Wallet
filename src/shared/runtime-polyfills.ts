import { Buffer } from "buffer";

type RuntimeGlobal = typeof globalThis & {
  Buffer?: typeof Buffer;
};

/**
 * Installs browser runtime globals required by Solana SDK dependencies.
 */
export function installRuntimePolyfills(): void {
  const runtimeGlobal = globalThis as RuntimeGlobal;

  if (runtimeGlobal.Buffer === undefined) {
    runtimeGlobal.Buffer = Buffer;
  }
}

installRuntimePolyfills();
