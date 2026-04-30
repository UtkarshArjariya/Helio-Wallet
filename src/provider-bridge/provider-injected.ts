import { decodeBase64, encodeBase64 } from "../shared/base64";

const HELIO_PROVIDER_SOURCE = "helio-provider";
const HELIO_PROVIDER_REQUEST = "helio:provider-request";
const HELIO_PROVIDER_RESPONSE = "helio:provider-response";
const WALLET_STANDARD_APP_READY_EVENT = "wallet-standard:app-ready";
const WALLET_STANDARD_REGISTER_EVENT = "wallet-standard:register-wallet";
const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const HELIO_WALLET_STANDARD_ICON =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgZmlsbD0ibm9uZSI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iMTAiIGZpbGw9IiMwQTBFMTkiLz48cGF0aCBkPSJNMTYuMDAxIDYuNWw3Ljg5MiA0LjU1NnY5Ljg4OEwxNi4wMDEgMjUuNWwtNy44OTItNC41NTZ2LTkuODg4TDE2LjAwMSA2LjVaIiBmaWxsPSIjN0MzQUVEIi8+PHBhdGggZD0iTTE2LjAwNCAxMS4xNzFsMy44MzMgMi4yMTN2NC40MzdMMTYuMDA0IDIwLjAzbC0zLjgzMy0yLjIwOXYtNC40MzdMMTYuMDA0IDExLjE3MVoiIGZpbGw9IiM0Q0Q3RjYiLz48L3N2Zz4=";

type ProviderBridgeMethod =
  | "connect"
  | "disconnect"
  | "getConnectionState"
  | "signMessage"
  | "signTransaction";

type HelioProviderEvent = "change";

interface ProviderBridgeRequestMessage {
  readonly id: string;
  readonly method: ProviderBridgeMethod;
  readonly params?: {
    readonly messageBase64?: string;
    readonly serializedTransactionBase64?: string;
  };
  readonly source: typeof HELIO_PROVIDER_SOURCE;
  readonly type: typeof HELIO_PROVIDER_REQUEST;
}

interface ProviderBridgeResponseMessage {
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
  readonly id: string;
  readonly ok: boolean;
  readonly result?: ProviderBridgeResult;
  readonly source: typeof HELIO_PROVIDER_SOURCE;
  readonly type: typeof HELIO_PROVIDER_RESPONSE;
}

interface ProviderConnectionResult {
  readonly accountLabel: string | null;
  readonly isConnected: boolean;
  readonly publicKey: string | null;
}

interface ProviderSignedTransactionResult {
  readonly publicKey: string;
  readonly signature: string | null;
  readonly signedTransactionBase64: string;
}

interface ProviderSignedMessageWireResult {
  readonly publicKey: string;
  readonly signatureBase64: string;
  readonly signedMessageBase64: string;
}

type ProviderBridgeResult =
  | ProviderConnectionResult
  | ProviderSignedTransactionResult
  | ProviderSignedMessageWireResult;

type ProviderBridgeResultByMethod = {
  readonly connect: ProviderConnectionResult;
  readonly disconnect: ProviderConnectionResult;
  readonly getConnectionState: ProviderConnectionResult;
  readonly signMessage: ProviderSignedMessageWireResult;
  readonly signTransaction: ProviderSignedTransactionResult;
};

interface HelioProviderConnectionState extends ProviderConnectionResult {}

interface HelioProviderSignedMessageResult {
  readonly publicKey: string;
  readonly signature: Uint8Array;
  readonly signedMessage: Uint8Array;
}

interface HelioProviderApi extends HelioProviderConnectionState {
  connect(): Promise<HelioProviderConnectionState>;
  disconnect(): Promise<void>;
  off(event: HelioProviderEvent, listener: () => void): void;
  on(event: HelioProviderEvent, listener: () => void): () => void;
  signMessage(
    message: ArrayBuffer | string | Uint8Array,
  ): Promise<HelioProviderSignedMessageResult>;
  signTransaction<TTransaction>(
    transaction: TTransaction,
  ): Promise<TTransaction>;
}

interface WalletStandardAccount {
  readonly address: string;
  readonly chains: readonly string[];
  readonly features: readonly string[];
  readonly icon: string;
  readonly label: string | null;
  readonly publicKey: Uint8Array;
}

declare global {
  interface Window {
    helio?: HelioProviderApi;
  }
}

function isProviderBridgeResponseMessage(
  value: unknown,
): value is ProviderBridgeResponseMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return (
    "source" in value &&
    value.source === HELIO_PROVIDER_SOURCE &&
    "type" in value &&
    value.type === HELIO_PROVIDER_RESPONSE &&
    "id" in value &&
    typeof value.id === "string" &&
    "ok" in value &&
    typeof value.ok === "boolean"
  );
}

function createRequestId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `helio-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function createProviderError(error: {
  readonly code: string;
  readonly message: string;
}): Error & { readonly code: string } {
  const providerError = new Error(error.message) as Error & {
    readonly code: string;
  };

  providerError.name = "HelioProviderError";
  Object.defineProperty(providerError, "code", {
    enumerable: true,
    value: error.code,
  });

  return providerError;
}

function normalizeMessageBytes(
  message: ArrayBuffer | string | Uint8Array,
): Uint8Array {
  if (typeof message === "string") {
    return new TextEncoder().encode(message);
  }

  if (message instanceof Uint8Array) {
    return new Uint8Array(message);
  }

  return new Uint8Array(message);
}

function isTransactionLike(value: unknown): value is {
  readonly constructor: {
    readonly deserialize?: (bytes: Uint8Array) => unknown;
    readonly from?: (bytes: Uint8Array) => unknown;
  };
  serialize: (options?: {
    readonly requireAllSignatures?: boolean;
    readonly verifySignatures?: boolean;
  }) => Uint8Array;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "serialize" in value &&
    typeof value.serialize === "function" &&
    "constructor" in value
  );
}

function serializeTransactionForBridge(transaction: unknown): string {
  if (!isTransactionLike(transaction)) {
    throw new Error(
      "Transaction serialization is not supported for this value.",
    );
  }

  try {
    return encodeBase64(new Uint8Array(transaction.serialize()));
  } catch {
    return encodeBase64(
      new Uint8Array(
        transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        }),
      ),
    );
  }
}

function deserializeSignedTransaction<TTransaction>(
  originalTransaction: TTransaction,
  signedTransactionBase64: string,
): TTransaction {
  if (!isTransactionLike(originalTransaction)) {
    throw new Error(
      "Transaction deserialization is not supported for this value.",
    );
  }

  const serializedBytes = decodeBase64(signedTransactionBase64);
  const transactionConstructor = originalTransaction.constructor;

  if (typeof transactionConstructor.deserialize === "function") {
    return transactionConstructor.deserialize(serializedBytes) as TTransaction;
  }

  if (typeof transactionConstructor.from === "function") {
    return transactionConstructor.from(serializedBytes) as TTransaction;
  }

  throw new Error("The signed transaction format is not supported.");
}

function decodeBase58(base58Value: string): Uint8Array {
  const base58Digits = [0];

  for (const character of base58Value) {
    const alphabetIndex = BASE58_ALPHABET.indexOf(character);

    if (alphabetIndex === -1) {
      throw new Error("Public key is not valid base58.");
    }

    let carryValue = alphabetIndex;

    for (
      let digitIndex = 0;
      digitIndex < base58Digits.length;
      digitIndex += 1
    ) {
      const nextValue = base58Digits[digitIndex] * 58 + carryValue;

      base58Digits[digitIndex] = nextValue & 0xff;
      carryValue = nextValue >> 8;
    }

    while (carryValue > 0) {
      base58Digits.push(carryValue & 0xff);
      carryValue >>= 8;
    }
  }

  for (const character of base58Value) {
    if (character !== "1") {
      break;
    }

    base58Digits.push(0);
  }

  return Uint8Array.from(base58Digits.reverse());
}

class HelioProvider implements HelioProviderApi {
  public accountLabel: string | null = null;

  public isConnected = false;

  public publicKey: string | null = null;

  readonly #listeners = new Set<() => void>();

  readonly #pendingRequests = new Map<
    string,
    {
      readonly reject: (error: Error) => void;
      readonly resolve: (result: ProviderBridgeResult) => void;
    }
  >();

  public constructor() {
    window.addEventListener("message", this.handleBridgeMessage);
    void this.refreshConnectionState();
  }

  public async connect(): Promise<HelioProviderConnectionState> {
    const connectionState = await this.request("connect");

    return this.updateConnectionState(connectionState);
  }

  public async disconnect(): Promise<void> {
    const connectionState = await this.request("disconnect");

    this.updateConnectionState(connectionState);
  }

  public on(event: HelioProviderEvent, listener: () => void): () => void {
    if (event === "change") {
      this.#listeners.add(listener);
    }

    return () => {
      this.off(event, listener);
    };
  }

  public off(event: HelioProviderEvent, listener: () => void): void {
    if (event === "change") {
      this.#listeners.delete(listener);
    }
  }

  public async signTransaction<TTransaction>(
    transaction: TTransaction,
  ): Promise<TTransaction> {
    const response = await this.request("signTransaction", {
      serializedTransactionBase64: serializeTransactionForBridge(transaction),
    });

    if (response === undefined || !("signedTransactionBase64" in response)) {
      throw new Error("Helio did not return a signed transaction.");
    }

    return deserializeSignedTransaction(
      transaction,
      response.signedTransactionBase64,
    );
  }

  public async signMessage(
    message: ArrayBuffer | string | Uint8Array,
  ): Promise<HelioProviderSignedMessageResult> {
    const messageBytes = normalizeMessageBytes(message);
    const response = await this.request("signMessage", {
      messageBase64: encodeBase64(messageBytes),
    });

    if (response === undefined || !("signatureBase64" in response)) {
      throw new Error("Helio did not return a signed message.");
    }

    return {
      publicKey: response.publicKey,
      signature: decodeBase64(response.signatureBase64),
      signedMessage: decodeBase64(response.signedMessageBase64),
    };
  }

  readonly handleBridgeMessage = (event: MessageEvent): void => {
    if (
      event.source !== window ||
      !isProviderBridgeResponseMessage(event.data)
    ) {
      return;
    }

    const pendingRequest = this.#pendingRequests.get(event.data.id);

    if (pendingRequest === undefined) {
      return;
    }

    this.#pendingRequests.delete(event.data.id);

    if (event.data.ok && event.data.result !== undefined) {
      pendingRequest.resolve(event.data.result);
      return;
    }

    pendingRequest.reject(
      createProviderError(
        event.data.error ?? {
          code: "UNKNOWN_ERROR",
          message: "The Helio provider request failed.",
        },
      ),
    );
  };

  private emitChange(): void {
    for (const listener of this.#listeners) {
      listener();
    }
  }

  private async refreshConnectionState(): Promise<void> {
    try {
      const connectionState = await this.request("getConnectionState");

      this.updateConnectionState(connectionState);
    } catch {
      this.updateConnectionState({
        accountLabel: null,
        isConnected: false,
        publicKey: null,
      });
    }
  }

  private request<TMethod extends ProviderBridgeMethod>(
    method: TMethod,
    params?: ProviderBridgeRequestMessage["params"],
  ): Promise<ProviderBridgeResultByMethod[TMethod]> {
    const requestId = createRequestId();
    const request: ProviderBridgeRequestMessage = {
      id: requestId,
      method,
      params,
      source: HELIO_PROVIDER_SOURCE,
      type: HELIO_PROVIDER_REQUEST,
    };

    return new Promise<ProviderBridgeResultByMethod[TMethod]>(
      (resolve, reject) => {
        this.#pendingRequests.set(requestId, {
          reject,
          resolve: (result) =>
            resolve(result as ProviderBridgeResultByMethod[TMethod]),
        });
        window.postMessage(request, window.location.origin);
      },
    );
  }

  private updateConnectionState(
    state: ProviderConnectionResult,
  ): HelioProviderConnectionState {
    this.accountLabel = state.accountLabel;
    this.isConnected = state.isConnected;
    this.publicKey = state.publicKey;
    this.emitChange();

    return {
      accountLabel: this.accountLabel,
      isConnected: this.isConnected,
      publicKey: this.publicKey,
    };
  }
}

class HelioWalletStandardWallet {
  readonly version = "1.0.0";

  readonly name = "Helio";

  readonly icon = HELIO_WALLET_STANDARD_ICON;

  readonly chains = ["solana:mainnet", "solana:devnet"] as const;

  readonly #provider: HelioProvider;

  readonly #changeListeners = new Set<
    (properties: {
      readonly accounts: readonly WalletStandardAccount[];
    }) => void
  >();

  public constructor(provider: HelioProvider) {
    this.#provider = provider;
    this.#provider.on("change", () => {
      const changePayload = {
        accounts: this.accounts,
      };

      for (const listener of this.#changeListeners) {
        listener(changePayload);
      }
    });
  }

  public get accounts(): readonly WalletStandardAccount[] {
    if (!this.#provider.isConnected || this.#provider.publicKey === null) {
      return [];
    }

    return [
      {
        address: this.#provider.publicKey,
        chains: this.chains,
        features: ["solana:signMessage", "solana:signTransaction"],
        icon: this.icon,
        label: this.#provider.accountLabel,
        publicKey: decodeBase58(this.#provider.publicKey),
      },
    ];
  }

  public get features() {
    return {
      "solana:signMessage": {
        signMessage: async (
          ...inputs: readonly {
            readonly account: WalletStandardAccount;
            readonly message: Uint8Array;
          }[]
        ) =>
          Promise.all(
            inputs.map(async (input) => {
              const signedMessage = await this.#provider.signMessage(
                input.message,
              );

              return {
                account: input.account,
                signature: signedMessage.signature,
                signedMessage: signedMessage.signedMessage,
              };
            }),
          ),
        version: "1.0.0",
      },
      "solana:signTransaction": {
        signTransaction: async (
          ...inputs: readonly {
            readonly account: WalletStandardAccount;
            readonly transaction: unknown;
          }[]
        ) =>
          Promise.all(
            inputs.map(async (input) => ({
              account: input.account,
              signedTransaction: await this.#provider.signTransaction(
                input.transaction,
              ),
            })),
          ),
        supportedTransactionVersions: ["legacy", 0] as const,
        version: "1.0.0",
      },
      "standard:connect": {
        connect: async () => {
          await this.#provider.connect();

          return {
            accounts: this.accounts,
          };
        },
        version: "1.0.0",
      },
      "standard:disconnect": {
        disconnect: async () => {
          await this.#provider.disconnect();
        },
        version: "1.0.0",
      },
      "standard:events": {
        on: (
          event: "change",
          listener: (properties: {
            readonly accounts: readonly WalletStandardAccount[];
          }) => void,
        ) => {
          if (event === "change") {
            this.#changeListeners.add(listener);
          }

          return () => {
            this.#changeListeners.delete(listener);
          };
        },
        version: "1.0.0",
      },
    };
  }
}

function registerWalletStandardWallet(wallet: HelioWalletStandardWallet): void {
  const registerWithDetail = (detail: unknown) => {
    if (typeof detail === "function") {
      detail(wallet);
      return;
    }

    if (
      typeof detail === "object" &&
      detail !== null &&
      "register" in detail &&
      typeof detail.register === "function"
    ) {
      detail.register(wallet);
    }
  };

  window.dispatchEvent(
    new CustomEvent(WALLET_STANDARD_REGISTER_EVENT, {
      detail: registerWithDetail,
    }),
  );
  window.addEventListener(WALLET_STANDARD_APP_READY_EVENT, (event) => {
    registerWithDetail((event as CustomEvent).detail);
  });
}

if (window.helio === undefined) {
  const helioProvider = new HelioProvider();

  window.helio = helioProvider;
  registerWalletStandardWallet(new HelioWalletStandardWallet(helioProvider));
}
