import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { decodeBase64, encodeBase64 } from "../shared/base64";

const HELIO_PROVIDER_REQUEST = "helio:provider-request";
const HELIO_PROVIDER_RESPONSE = "helio:provider-response";
const WALLET_STANDARD_APP_READY_EVENT = "wallet-standard:app-ready";
const WALLET_STANDARD_REGISTER_EVENT = "wallet-standard:register-wallet";
const TEST_PUBLIC_KEY = "4b8seY2gGNX25SmaUQbc1MP5vaezovRwoviXmRszh2h1";

interface MockWalletStandardWallet {
  readonly accounts: readonly {
    readonly address: string;
    readonly features: readonly string[];
    readonly label: string | null;
    readonly publicKey: Uint8Array;
  }[];
  readonly features: {
    readonly "solana:signMessage": {
      readonly signMessage: (
        ...inputs: readonly {
          readonly account: unknown;
          readonly message: Uint8Array;
        }[]
      ) => Promise<
        readonly {
          readonly account: unknown;
          readonly signature: Uint8Array;
          readonly signedMessage: Uint8Array;
        }[]
      >;
    };
    readonly "solana:signTransaction": {
      readonly signTransaction: (
        ...inputs: readonly {
          readonly account: unknown;
          readonly transaction: MockTransaction;
        }[]
      ) => Promise<
        readonly {
          readonly account: unknown;
          readonly signedTransaction: MockTransaction;
        }[]
      >;
    };
    readonly "standard:connect": {
      readonly connect: () => Promise<{
        readonly accounts: readonly unknown[];
      }>;
    };
    readonly "standard:disconnect": {
      readonly disconnect: () => Promise<void>;
    };
    readonly "standard:events": {
      readonly on: (
        event: "change",
        listener: (properties: {
          readonly accounts: readonly unknown[];
        }) => void,
      ) => () => void;
    };
  };
  readonly icon: string;
  readonly name: string;
  readonly version: string;
}

interface MockHelioProvider {
  readonly accountLabel: string | null;
  readonly isConnected: boolean;
  readonly publicKey: string | null;
  connect(): Promise<{
    readonly accountLabel: string | null;
    readonly isConnected: boolean;
    readonly publicKey: string | null;
  }>;
  disconnect(): Promise<void>;
  on(event: "change", listener: () => void): () => void;
  off(event: "change", listener: () => void): void;
  signMessage(message: ArrayBuffer | string | Uint8Array): Promise<{
    readonly publicKey: string;
    readonly signature: Uint8Array;
    readonly signedMessage: Uint8Array;
  }>;
  signTransaction<TTransaction>(
    transaction: TTransaction,
  ): Promise<TTransaction>;
}

interface ProviderBridgeRequestMessage {
  readonly id: string;
  readonly method:
    | "connect"
    | "disconnect"
    | "getConnectionState"
    | "signMessage"
    | "signTransaction";
  readonly params?: {
    readonly messageBase64?: string;
    readonly serializedTransactionBase64?: string;
  };
  readonly source: "helio-provider";
  readonly type: "helio:provider-request";
}

class MockTransaction {
  public constructor(readonly payload: string) {}

  public serialize(): Uint8Array {
    return new TextEncoder().encode(this.payload);
  }

  public static deserialize(bytes: Uint8Array): MockTransaction {
    return new MockTransaction(new TextDecoder().decode(bytes));
  }
}

describe("provider-injected wallet standard bridge", () => {
  let bridgeState = {
    accountLabel: null as string | null,
    isConnected: false,
    publicKey: null as string | null,
  };
  let helioProvider: MockHelioProvider;
  let registeredWallet: MockWalletStandardWallet | null = null;
  let appReadyWallet: MockWalletStandardWallet | null = null;
  let requestLog: ProviderBridgeRequestMessage[] = [];
  let bridgeListener: ((event: MessageEvent) => void) | null = null;
  let postMessageSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeAll(async () => {
    delete window.helio;
    requestLog = [];
    postMessageSpy = vi
      .spyOn(window, "postMessage")
      .mockImplementation((message: unknown) => {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: message,
            origin: window.location.origin,
            source: window,
          }),
        );
      });

    bridgeListener = (event: MessageEvent) => {
      if (event.source !== window) {
        return;
      }

      const request = event.data as ProviderBridgeRequestMessage;

      if (
        typeof request !== "object" ||
        request === null ||
        request.type !== HELIO_PROVIDER_REQUEST
      ) {
        return;
      }

      requestLog.push(request);

      if (request.method === "getConnectionState") {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              id: request.id,
              ok: true,
              result: bridgeState,
              source: "helio-provider",
              type: HELIO_PROVIDER_RESPONSE,
            },
            origin: window.location.origin,
            source: window,
          }),
        );
        return;
      }

      if (request.method === "connect") {
        bridgeState = {
          accountLabel: "Primary Vault",
          isConnected: true,
          publicKey: TEST_PUBLIC_KEY,
        };

        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              id: request.id,
              ok: true,
              result: bridgeState,
              source: "helio-provider",
              type: HELIO_PROVIDER_RESPONSE,
            },
            origin: window.location.origin,
            source: window,
          }),
        );
        return;
      }

      if (request.method === "disconnect") {
        bridgeState = {
          accountLabel: null,
          isConnected: false,
          publicKey: null,
        };

        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              id: request.id,
              ok: true,
              result: bridgeState,
              source: "helio-provider",
              type: HELIO_PROVIDER_RESPONSE,
            },
            origin: window.location.origin,
            source: window,
          }),
        );
        return;
      }

      if (request.method === "signMessage") {
        const messageBytes = decodeBase64(request.params?.messageBase64 ?? "");
        const signatureBytes = new Uint8Array([9, 8, 7, 6]);

        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              id: request.id,
              ok: true,
              result: {
                publicKey: TEST_PUBLIC_KEY,
                signatureBase64: encodeBase64(signatureBytes),
                signedMessageBase64: encodeBase64(messageBytes),
              },
              source: "helio-provider",
              type: HELIO_PROVIDER_RESPONSE,
            },
            origin: window.location.origin,
            source: window,
          }),
        );
        return;
      }

      if (request.method === "signTransaction") {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              id: request.id,
              ok: true,
              result: {
                publicKey: TEST_PUBLIC_KEY,
                signature: "signed-signature",
                signedTransactionBase64: encodeBase64(
                  new TextEncoder().encode("signed-transaction"),
                ),
              },
              source: "helio-provider",
              type: HELIO_PROVIDER_RESPONSE,
            },
            origin: window.location.origin,
            source: window,
          }),
        );
      }
    };

    window.addEventListener("message", bridgeListener);
    window.addEventListener(WALLET_STANDARD_REGISTER_EVENT, (event) => {
      const registerWallet = (event as CustomEvent).detail as (
        callback: (wallet: MockWalletStandardWallet) => void,
      ) => void;

      registerWallet((wallet) => {
        registeredWallet = wallet;
      });
    });

    await import("./provider-injected");

    helioProvider = window.helio as unknown as MockHelioProvider;
    window.dispatchEvent(
      new CustomEvent(WALLET_STANDARD_APP_READY_EVENT, {
        detail: {
          register(wallet: MockWalletStandardWallet) {
            appReadyWallet = wallet;
          },
        },
      }),
    );
  });

  afterAll(() => {
    if (bridgeListener !== null) {
      window.removeEventListener("message", bridgeListener);
    }

    postMessageSpy?.mockRestore();
    delete window.helio;
  });

  it("registers itself through wallet standard window events", async () => {
    expect(helioProvider).toBeDefined();
    expect(registeredWallet?.name).toBe("Helio");
    expect(registeredWallet?.version).toBe("1.0.0");
    expect(
      registeredWallet?.icon.startsWith("data:image/svg+xml;base64,"),
    ).toBe(true);
    expect(appReadyWallet?.name).toBe("Helio");
    expect(Object.keys(registeredWallet?.features ?? {}).sort()).toStrictEqual([
      "solana:signMessage",
      "solana:signTransaction",
      "standard:connect",
      "standard:disconnect",
      "standard:events",
    ]);
  });

  it("connects through the bridge and notifies provider and wallet-standard listeners", async () => {
    const providerChangeListener = vi.fn();
    const walletChangeListener = vi.fn();
    const removeWalletListener =
      registeredWallet?.features["standard:events"].on(
        "change",
        walletChangeListener,
      ) ?? (() => undefined);
    const removeProviderListener = helioProvider.on(
      "change",
      providerChangeListener,
    );

    const connectionState = await helioProvider.connect();

    expect(connectionState).toStrictEqual({
      accountLabel: "Primary Vault",
      isConnected: true,
      publicKey: TEST_PUBLIC_KEY,
    });
    expect(helioProvider.isConnected).toBe(true);
    expect(helioProvider.accountLabel).toBe("Primary Vault");
    expect(helioProvider.publicKey).toBe(TEST_PUBLIC_KEY);
    expect(providerChangeListener).toHaveBeenCalled();
    expect(walletChangeListener).toHaveBeenCalledWith({
      accounts: registeredWallet?.accounts,
    });
    expect(registeredWallet?.accounts[0]?.address).toBe(TEST_PUBLIC_KEY);
    expect(registeredWallet?.accounts[0]?.features).toStrictEqual([
      "solana:signMessage",
      "solana:signTransaction",
    ]);

    removeWalletListener();
    removeProviderListener();
  });

  it("round-trips signMessage and signTransaction through wallet standard features", async () => {
    await registeredWallet?.features["standard:connect"].connect();

    const account = registeredWallet?.accounts[0];
    const signedMessageResults = await registeredWallet?.features[
      "solana:signMessage"
    ].signMessage({
      account,
      message: new TextEncoder().encode("hello"),
    });
    const signedTransactionResults = await registeredWallet?.features[
      "solana:signTransaction"
    ].signTransaction({
      account,
      transaction: new MockTransaction("unsigned-transaction"),
    });

    expect(signedMessageResults?.[0]?.signature).toStrictEqual(
      new Uint8Array([9, 8, 7, 6]),
    );
    expect(
      new TextDecoder().decode(signedMessageResults?.[0]?.signedMessage),
    ).toBe("hello");
    expect(signedTransactionResults?.[0]?.signedTransaction).toBeInstanceOf(
      MockTransaction,
    );
    expect(signedTransactionResults?.[0]?.signedTransaction.payload).toBe(
      "signed-transaction",
    );
    expect(requestLog.some((request) => request.method === "signMessage")).toBe(
      true,
    );
    expect(
      requestLog.some((request) => request.method === "signTransaction"),
    ).toBe(true);
  });

  it("disconnects through wallet standard and clears accounts", async () => {
    await registeredWallet?.features["standard:disconnect"].disconnect();

    expect(helioProvider.isConnected).toBe(false);
    expect(helioProvider.publicKey).toBeNull();
    expect(registeredWallet?.accounts).toStrictEqual([]);
  });
});
