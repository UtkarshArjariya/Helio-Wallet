import type {
  ActivityItem,
  NetworkPreference,
  PendingDappRequest,
  StoredWalletVault,
  WalletAccountSummary,
  WalletSecurityPreferences,
} from "@helio/types";

const LOCAL_STATE_KEY = "helio-local-state";
const SESSION_STATE_KEY = "helio-session-state";

export interface ExtensionLocalState {
  readonly vault: StoredWalletVault | null;
  readonly activity: readonly ActivityItem[];
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

const isTestRuntime = import.meta.env.MODE === "test";

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

function parseWebStorageValue<TValue>(
  value: string | null,
): TValue | null {
  if (value === null) {
    return null;
  }

  try {
    return JSON.parse(value) as TValue;
  } catch {
    return null;
  }
}

function getWebStorageAdapter(): ExtensionStorageAdapter {
  return {
    async clearSessionState() {
      window.sessionStorage.removeItem(SESSION_STATE_KEY);
    },

    async getLocalState() {
      return (
        parseWebStorageValue<ExtensionLocalState>(
          window.localStorage.getItem(LOCAL_STATE_KEY),
        ) ?? DEFAULT_LOCAL_STATE
      );
    },

    async getSessionState() {
      return parseWebStorageValue<ExtensionSessionState>(
        window.sessionStorage.getItem(SESSION_STATE_KEY),
      );
    },

    async setLocalState(state) {
      window.localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state));
    },

    async setSessionState(state) {
      if (state === null) {
        await this.clearSessionState();
        return;
      }

      window.sessionStorage.setItem(SESSION_STATE_KEY, JSON.stringify(state));
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

  if (
    !isTestRuntime &&
    typeof window !== "undefined" &&
    window.localStorage !== undefined &&
    window.sessionStorage !== undefined
  ) {
    return getWebStorageAdapter();
  }

  return getMemoryStorageAdapter();
}
