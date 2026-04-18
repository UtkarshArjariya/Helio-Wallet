import { describe, expect, it } from "vitest";

import { createHelioExtensionService } from "./extension-service";
import {
  createExtensionStorageAdapter,
  resetExtensionMemoryStorage,
} from "./extension-storage";
import {
  createMockRpcClient,
  resetMockRpcClientState,
} from "./mock-rpc-client";

async function createWalletInTestRuntime() {
  const extensionService = createHelioExtensionService(
    createExtensionStorageAdapter(),
    createMockRpcClient,
  );
  const walletCreation = await extensionService.handleRequest(
    "helio/begin-wallet-creation",
    undefined,
  );

  await extensionService.handleRequest("helio/create-wallet", {
    biometricsEnabled: false,
    mnemonicWords: walletCreation.mnemonicWords,
    password: "StrongPass1",
  });

  return extensionService;
}

function encodeBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

const KNOWN_TEST_PRIVATE_KEY =
  "5p4Sds58a1chesFsLYKQRk25hmExyBEyXK6EeYUPSNWZmpkkv3Evqav6R9ZA1kGPqrpzzp9naXw5Fe8GBqkGhedK";
const KNOWN_TEST_PUBLIC_KEY = "HKcw4AEPZ7Z5Luv9FPinwZ42x6wKQH4RCJeLHjdVMtZs";
const KNOWN_TEST_TRANSACTION_BASE64 =
  "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAED8oAS5F0QpyxBClNbFce0QVymVAiE6IxL3oiV6tLPqH5MDN15ctGfkTz5dBHh+CpCvi6xO8Mv09Ko9jeidCYpuwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAgIAAQwCAAAAQHh9AQAAAAA=";

async function createImportedWalletInTestRuntime() {
  const extensionService = createHelioExtensionService(
    createExtensionStorageAdapter(),
    createMockRpcClient,
  );

  await extensionService.handleRequest("helio/import-wallet", {
    biometricsEnabled: false,
    importMethod: "private-key",
    importValue: KNOWN_TEST_PRIVATE_KEY,
    password: "StrongPass1",
  });

  return extensionService;
}

describe("extension-service dapp connection flow", () => {
  it("queues approval for an untrusted origin before connect succeeds", async () => {
    resetExtensionMemoryStorage();
    resetMockRpcClientState();

    const extensionService = await createWalletInTestRuntime();

    await expect(
      extensionService.handleRequest("helio/connect-dapp", {
        origin: "https://app.jupiter.exchange",
        name: "Jupiter",
        iconUrl: null,
      }),
    ).rejects.toMatchObject({
      code: "DAPP_APPROVAL_REQUIRED",
    });

    expect(
      await extensionService.handleRequest(
        "helio/get-pending-dapp-request",
        undefined,
      ),
    ).toMatchObject({
      kind: "connect",
      dapp: {
        name: "Jupiter",
        origin: "https://app.jupiter.exchange",
      },
      permissions: ["connect"],
    });
  });

  it("approves a queued origin and returns a connected account", async () => {
    resetExtensionMemoryStorage();
    resetMockRpcClientState();

    const extensionService = await createWalletInTestRuntime();

    await extensionService
      .handleRequest("helio/connect-dapp", {
        origin: "https://app.tensor.trade",
        name: "Tensor",
        iconUrl: null,
      })
      .catch(() => undefined);

    const pendingRequest = await extensionService.handleRequest(
      "helio/get-pending-dapp-request",
      undefined,
    );

    expect(pendingRequest).not.toBeNull();

    const approvedRequest = await extensionService.handleRequest(
      "helio/approve-dapp-request",
      {
        requestId: pendingRequest?.id ?? "",
      },
    );

    expect(approvedRequest.kind).toBe("connect");
    expect(approvedRequest.connectionState?.isConnected).toBe(true);
    expect(approvedRequest.connectionState?.account?.address).toBeTruthy();
    expect(approvedRequest.connectionState?.origin).toBe(
      "https://app.tensor.trade",
    );
  });

  it("removes a trusted origin when the dapp disconnects", async () => {
    resetExtensionMemoryStorage();
    resetMockRpcClientState();

    const extensionService = await createWalletInTestRuntime();

    await extensionService
      .handleRequest("helio/connect-dapp", {
        origin: "https://app.drift.trade",
        name: "Drift",
        iconUrl: null,
      })
      .catch(() => undefined);

    const pendingRequest = await extensionService.handleRequest(
      "helio/get-pending-dapp-request",
      undefined,
    );

    await extensionService.handleRequest("helio/approve-dapp-request", {
      requestId: pendingRequest?.id ?? "",
    });

    const disconnectedState = await extensionService.handleRequest(
      "helio/disconnect-dapp",
      {
        origin: "https://app.drift.trade",
      },
    );

    expect(disconnectedState.isConnected).toBe(false);
    expect(disconnectedState.account).toBeNull();
  });

  it("queues and approves a message signature request", async () => {
    resetExtensionMemoryStorage();
    resetMockRpcClientState();

    const extensionService = await createWalletInTestRuntime();
    const messageBase64 = encodeBase64(new TextEncoder().encode("helio-test"));

    await expect(
      extensionService.handleRequest("helio/sign-dapp-message", {
        origin: "https://app.marginfi.com",
        name: "Marginfi",
        iconUrl: null,
        messageBase64,
      }),
    ).rejects.toMatchObject({
      code: "DAPP_APPROVAL_REQUIRED",
    });

    const pendingRequest = await extensionService.handleRequest(
      "helio/get-pending-dapp-request",
      undefined,
    );

    expect(pendingRequest).toMatchObject({
      kind: "sign-message",
      dapp: {
        origin: "https://app.marginfi.com",
      },
    });

    const approvedRequest = await extensionService.handleRequest(
      "helio/approve-dapp-request",
      {
        requestId: pendingRequest?.id ?? "",
      },
    );

    expect(approvedRequest.kind).toBe("sign-message");
    expect(approvedRequest.signedMessage?.publicKey).toBeTruthy();
    expect(approvedRequest.signedMessage?.signedMessageBase64).toBe(
      messageBase64,
    );
  });

  it("queues and approves a transaction signature request", async () => {
    resetExtensionMemoryStorage();
    resetMockRpcClientState();

    const extensionService = await createImportedWalletInTestRuntime();
    const runtimeSnapshot = await extensionService.handleRequest(
      "helio/get-runtime-snapshot",
      undefined,
    );
    const senderAddress = runtimeSnapshot.wallet.account?.address;

    expect(senderAddress).toBe(KNOWN_TEST_PUBLIC_KEY);

    await expect(
      extensionService.handleRequest("helio/sign-dapp-transaction", {
        origin: "https://app.jupiter.exchange",
        name: "Jupiter",
        iconUrl: null,
        serializedTransactionBase64: KNOWN_TEST_TRANSACTION_BASE64,
      }),
    ).rejects.toMatchObject({
      code: "DAPP_APPROVAL_REQUIRED",
    });

    const pendingRequest = await extensionService.handleRequest(
      "helio/get-pending-dapp-request",
      undefined,
    );

    expect(pendingRequest).toMatchObject({
      kind: "sign-transaction",
      dapp: {
        origin: "https://app.jupiter.exchange",
      },
    });

    const approvedRequest = await extensionService.handleRequest(
      "helio/approve-dapp-request",
      {
        requestId: pendingRequest?.id ?? "",
      },
    );

    expect(approvedRequest.kind).toBe("sign-transaction");
    expect(approvedRequest.signedTransaction?.publicKey).toBe(
      KNOWN_TEST_PUBLIC_KEY,
    );
    expect(
      approvedRequest.signedTransaction?.signedTransactionBase64,
    ).toBeTruthy();
  });
});
