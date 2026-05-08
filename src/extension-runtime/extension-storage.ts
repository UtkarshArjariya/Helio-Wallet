import { createDefaultAutoYieldState } from "@helio/solana";
import type {
  ActivityItem,
  NetworkPreference,
  PendingDappRequest,
  StoredWalletVault,
  AutoYieldState,
  WalletAccountSummary,
  WalletSecurityPreferences,
} from "@helio/types";

const LOCAL_STATE_KEY = "helio-local-state";
const SESSION_STATE_KEY = "helio-session-state";

export interface ExtensionLocalState {
  readonly vault: StoredWalletVault | null;
  readonly activity: readonly ActivityItem[];
  readonly autoYield: AutoYieldState;
  readonly pendingDappRequest: PendingDappRequest | null;
  readonly networkPreference: NetworkPreference;
  readonly securityPreferences: WalletSecurityPreferences;
}

export interface ExtensionSessionState {
  readonly activeAccount: WalletAccountSummary;
  readonly secretKeyHex: string;
  readonly unlockedAtIso: string;
  readonly autoLockDeadlineIso: string | null;
}

export interface ExtensionStorageAdapter {
  clearSessionState(): Promise<void>;
  getLocalState(): Promise<ExtensionLocalState>;
  getSessionState(): Promise<ExtensionSessionState | null>;
  setLocalState(state: ExtensionLocalState): Promise<void>;
  setSessionState(state: ExtensionSessionState | null): Promise<void>;
}

const DEFAULT_LOCAL_STATE: ExtensionLocalState = {
  vault: null,
  activity: [],
  autoYield: createDefaultAutoYieldState(),
  pendingDappRequest: null,
  networkPreference: {
    commitment: "confirmed",
    customRpcUrl: null,
    selectedNetwork: "mainnet-beta",
  },
  securityPreferences: {
    autoLockTimeoutMinutes: 5,
    biometricsEnabled: false,
    trustedOrigins: [],
  },
};

let memoryLocalState: ExtensionLocalState = DEFAULT_LOCAL_STATE;
let memorySessionState: ExtensionSessionState | null = null;

async function getChromeStorageValue<TValue>(
  storageArea: chrome.storage.StorageArea,
  key: string,
): Promise<TValue | null> {
  const storageValue = await storageArea.get(key);

  return (storageValue[key] as TValue | undefined) ?? null;
}

function getChromeStorageAdapter(): ExtensionStorageAdapter {
  return {
    async clearSessionState() {
      await chrome.storage.session.remove(SESSION_STATE_KEY);
    },

    async getLocalState() {
      return (
        (await getChromeStorageValue<ExtensionLocalState>(
          chrome.storage.local,
          LOCAL_STATE_KEY,
        )) ?? DEFAULT_LOCAL_STATE
      );
    },

    async getSessionState() {
      return getChromeStorageValue<ExtensionSessionState>(
        chrome.storage.session,
        SESSION_STATE_KEY,
      );
    },

    async setLocalState(state) {
      await chrome.storage.local.set({ [LOCAL_STATE_KEY]: state });
    },

    async setSessionState(state) {
      if (state === null) {
        await this.clearSessionState();
        return;
      }

      await chrome.storage.session.set({ [SESSION_STATE_KEY]: state });
    },
  };
}

function getMemoryStorageAdapter(): ExtensionStorageAdapter {
  return {
    async clearSessionState() {
      memorySessionState = null;
    },

    async getLocalState() {
      return memoryLocalState;
    },

    async getSessionState() {
      return memorySessionState;
    },

    async setLocalState(state) {
      memoryLocalState = state;
    },

    async setSessionState(state) {
      memorySessionState = state;
    },
  };
}

/**
 * Resets the in-memory fallback storage used in tests and local non-extension runtimes.
 */
export function resetExtensionMemoryStorage(): void {
  memoryLocalState = DEFAULT_LOCAL_STATE;
  memorySessionState = null;
}

/**
 * Returns the extension storage adapter for the current runtime.
 *
 * @returns Chrome-backed storage in the extension, otherwise an in-memory fallback.
 */
export function createExtensionStorageAdapter(): ExtensionStorageAdapter {
  if (typeof chrome !== "undefined" && chrome.storage?.local !== undefined) {
    return getChromeStorageAdapter();
  }

  return getMemoryStorageAdapter();
}
