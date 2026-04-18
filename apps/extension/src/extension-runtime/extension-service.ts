import {
  createLocalDappRiskProvider,
  type DappRiskProvider,
  type HelioRpcClient,
} from "@helio/api";
import {
  createSeedPhraseVerificationChallenge,
  createStoredMnemonicVault,
  createStoredPrivateKeyVault,
  exportMnemonicWordsFromVault,
  generateWalletMnemonicWords,
  HelioCoreError,
  signMessageWithSecretKey,
  unlockStoredWalletVault,
  validateWalletMnemonicWords,
  validateWalletPassword,
} from "@helio/core";
import type {
  CreateWalletRequest,
  ExtensionRequestMap,
  ExtensionRequestType,
  ImportWalletRequest,
  SendDraftRequest,
  SendTransactionRequest,
  UnlockWalletRequest,
  UpdateNetworkPreferenceRequest,
  WalletRuntimeSnapshot,
} from "@helio/types";
import { Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";

import {
  createExtensionStorageAdapter,
  type ExtensionLocalState,
  type ExtensionSessionState,
  type ExtensionStorageAdapter,
} from "./extension-storage";
import {
  createExtensionRpcClient,
  resolveActiveExtensionRpcEndpoint,
} from "./runtime-dependencies";

function encodeHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function decodeHex(hex: string): Uint8Array {
  return Uint8Array.from(
    Array.from({ length: hex.length / 2 }, (_, index) =>
      Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16),
    ),
  );
}

function encodeBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function decodeBase64(base64Value: string): Uint8Array {
  const binaryValue = atob(base64Value);

  return Uint8Array.from(binaryValue, (character) => character.charCodeAt(0));
}

function hasSessionExpired(sessionState: ExtensionSessionState): boolean {
  if (sessionState.autoLockDeadlineIso === null) {
    return false;
  }

  return Date.parse(sessionState.autoLockDeadlineIso) <= Date.now();
}

function createAutoLockDeadlineIso(
  autoLockTimeoutMinutes: number,
): string | null {
  if (autoLockTimeoutMinutes === 0) {
    return null;
  }

  return new Date(Date.now() + autoLockTimeoutMinutes * 60_000).toISOString();
}

function createSessionState(
  localState: ExtensionLocalState,
  activeAccount: ExtensionSessionState["activeAccount"],
  secretKeyHex: string,
): ExtensionSessionState {
  return {
    activeAccount,
    secretKeyHex,
    unlockedAtIso: new Date().toISOString(),
    autoLockDeadlineIso: createAutoLockDeadlineIso(
      localState.securityPreferences.autoLockTimeoutMinutes,
    ),
  };
}

async function getNormalizedState(
  storageAdapter: ExtensionStorageAdapter,
): Promise<{
  readonly localState: ExtensionLocalState;
  readonly sessionState: ExtensionSessionState | null;
}> {
  const localState = await storageAdapter.getLocalState();
  const sessionState = await storageAdapter.getSessionState();

  if (sessionState !== null && hasSessionExpired(sessionState)) {
    await storageAdapter.clearSessionState();
    return {
      localState,
      sessionState: null,
    };
  }

  return {
    localState,
    sessionState,
  };
}

function assertValidPassword(password: string): void {
  if (!validateWalletPassword(password).isValid) {
    throw new HelioCoreError(
      "Password does not meet Helio security requirements.",
      "INVALID_PASSWORD",
    );
  }
}

function createWalletSnapshot(
  localState: ExtensionLocalState,
  sessionState: ExtensionSessionState | null,
): WalletRuntimeSnapshot["wallet"] {
  return {
    hasWallet: localState.vault !== null,
    lockState: sessionState === null ? "locked" : "unlocked",
    account:
      sessionState?.activeAccount ?? localState.vault?.primaryAccount ?? null,
    securityPreferences: localState.securityPreferences,
    networkPreference: localState.networkPreference,
    activeRpcEndpoint: resolveActiveExtensionRpcEndpoint(localState),
  };
}

async function createRuntimeSnapshot(
  storageAdapter: ExtensionStorageAdapter,
  rpcClientFactory: (localState: ExtensionLocalState) => HelioRpcClient,
): Promise<WalletRuntimeSnapshot> {
  const { localState, sessionState } = await getNormalizedState(storageAdapter);

  if (sessionState === null) {
    return {
      wallet: createWalletSnapshot(localState, null),
      dashboard: null,
    };
  }

  const rpcClient = rpcClientFactory(localState);
  const dashboard = await rpcClient.getWalletDashboardSnapshot(
    sessionState.activeAccount,
    localState.activity,
  );

  return {
    wallet: createWalletSnapshot(localState, sessionState),
    dashboard,
  };
}

async function persistUnlockedWallet(input: {
  readonly createRequest: CreateWalletRequest;
  readonly rpcClientFactory: (
    localState: ExtensionLocalState,
  ) => HelioRpcClient;
  readonly storageAdapter: ExtensionStorageAdapter;
  readonly vaultCreator: () => Promise<ExtensionLocalState["vault"]>;
}): Promise<WalletRuntimeSnapshot> {
  assertValidPassword(input.createRequest.password);

  const localState = await input.storageAdapter.getLocalState();
  const vault = await input.vaultCreator();

  if (vault === null) {
    throw new HelioCoreError(
      "Wallet vault could not be created.",
      "WALLET_NOT_FOUND",
    );
  }

  const unlockedVault = await unlockStoredWalletVault(
    vault,
    input.createRequest.password,
  );
  const nextLocalState: ExtensionLocalState = {
    ...localState,
    vault,
    securityPreferences: {
      ...localState.securityPreferences,
      biometricsEnabled: input.createRequest.biometricsEnabled,
    },
  };
  const nextSessionState = createSessionState(
    nextLocalState,
    unlockedVault.account,
    encodeHex(unlockedVault.secretKey),
  );

  await input.storageAdapter.setLocalState(nextLocalState);
  await input.storageAdapter.setSessionState(nextSessionState);

  return createRuntimeSnapshot(input.storageAdapter, input.rpcClientFactory);
}

function assertUnlockedSession(
  sessionState: ExtensionSessionState | null,
): ExtensionSessionState {
  if (sessionState !== null) {
    return sessionState;
  }

  throw new HelioCoreError(
    "Unlock the wallet before continuing.",
    "SESSION_LOCKED",
  );
}

function asCreateWalletRequest(
  payload: ExtensionRequestMap[ExtensionRequestType]["request"],
): CreateWalletRequest {
  return payload as CreateWalletRequest;
}

function asImportWalletRequest(
  payload: ExtensionRequestMap[ExtensionRequestType]["request"],
): ImportWalletRequest {
  return payload as ImportWalletRequest;
}

function asUnlockWalletRequest(
  payload: ExtensionRequestMap[ExtensionRequestType]["request"],
): UnlockWalletRequest {
  return payload as UnlockWalletRequest;
}

function asExportMnemonicRequest(
  payload: ExtensionRequestMap[ExtensionRequestType]["request"],
) {
  return payload as ExtensionRequestMap["helio/export-mnemonic"]["request"];
}

function asSendDraftRequest(
  payload: ExtensionRequestMap[ExtensionRequestType]["request"],
): SendDraftRequest {
  return payload as SendDraftRequest;
}

function asSendTransactionRequest(
  payload: ExtensionRequestMap[ExtensionRequestType]["request"],
): SendTransactionRequest {
  return payload as SendTransactionRequest;
}

function asUpdateNetworkPreferenceRequest(
  payload: ExtensionRequestMap[ExtensionRequestType]["request"],
): UpdateNetworkPreferenceRequest {
  return payload as UpdateNetworkPreferenceRequest;
}

function asConnectDappRequest(
  payload: ExtensionRequestMap[ExtensionRequestType]["request"],
) {
  return payload as ExtensionRequestMap["helio/connect-dapp"]["request"];
}

function asSignDappTransactionRequest(
  payload: ExtensionRequestMap[ExtensionRequestType]["request"],
) {
  return payload as ExtensionRequestMap["helio/sign-dapp-transaction"]["request"];
}

function asSignDappMessageRequest(
  payload: ExtensionRequestMap[ExtensionRequestType]["request"],
) {
  return payload as ExtensionRequestMap["helio/sign-dapp-message"]["request"];
}

function asDappOriginRequest(
  payload: ExtensionRequestMap[ExtensionRequestType]["request"],
) {
  return payload as ExtensionRequestMap["helio/get-dapp-connection-state"]["request"];
}

function asDappRequestDecisionRequest(
  payload: ExtensionRequestMap[ExtensionRequestType]["request"],
) {
  return payload as ExtensionRequestMap["helio/approve-dapp-request"]["request"];
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

function normalizeDappOrigin(origin: string): string {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(origin);
  } catch {
    throw new HelioCoreError(
      "The dApp origin is not a valid URL.",
      "INVALID_DAPP_ORIGIN",
    );
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new HelioCoreError(
      "Only http and https dApp origins are supported.",
      "INVALID_DAPP_ORIGIN",
    );
  }

  return parsedUrl.origin;
}

function assertWalletExists(
  localState: ExtensionLocalState,
): NonNullable<ExtensionLocalState["vault"]> {
  if (localState.vault !== null) {
    return localState.vault;
  }

  throw new HelioCoreError(
    "Create or import a wallet before connecting a dApp.",
    "WALLET_NOT_FOUND",
  );
}

function hasTrustedOrigin(
  localState: ExtensionLocalState,
  origin: string,
): boolean {
  return localState.securityPreferences.trustedOrigins.includes(origin);
}

function addTrustedOrigin(
  trustedOrigins: readonly string[],
  origin: string,
): readonly string[] {
  if (trustedOrigins.includes(origin)) {
    return trustedOrigins;
  }

  return [...trustedOrigins, origin];
}

function removeTrustedOrigin(
  trustedOrigins: readonly string[],
  origin: string,
): readonly string[] {
  return trustedOrigins.filter((trustedOrigin) => trustedOrigin !== origin);
}

function createDappConnectionState(
  localState: ExtensionLocalState,
  origin: string,
) {
  const normalizedOrigin = normalizeDappOrigin(origin);
  const isConnected =
    localState.vault !== null && hasTrustedOrigin(localState, normalizedOrigin);

  return {
    origin: normalizedOrigin,
    isConnected,
    account: isConnected ? localState.vault.primaryAccount : null,
  } satisfies ExtensionRequestMap["helio/connect-dapp"]["response"];
}

function clearPendingDappRequestForOrigin(
  localState: ExtensionLocalState,
  origin: string,
): ExtensionLocalState {
  if (localState.pendingDappRequest?.dapp.origin !== origin) {
    return localState;
  }

  return {
    ...localState,
    pendingDappRequest: null,
  };
}

function createPendingDappIdentity(
  localState: ExtensionLocalState,
  request: {
    readonly iconUrl: string | null;
    readonly name: string;
    readonly origin: string;
  },
  trustLevel: "verified" | "unknown" | "flagged",
) {
  const normalizedOrigin = normalizeDappOrigin(request.origin);

  return {
    iconUrl: request.iconUrl,
    name: request.name.trim() || new URL(normalizedOrigin).hostname,
    origin: normalizedOrigin,
    trustLevel: hasTrustedOrigin(localState, normalizedOrigin)
      ? "verified"
      : trustLevel,
  };
}

function assertPendingDappRequest(
  localState: ExtensionLocalState,
  requestId: string,
): NonNullable<ExtensionLocalState["pendingDappRequest"]> {
  if (localState.pendingDappRequest?.id === requestId) {
    return localState.pendingDappRequest;
  }

  throw new HelioCoreError(
    "The dApp request could not be found.",
    "DAPP_REQUEST_NOT_FOUND",
  );
}

function createPendingApprovalError(requestId: string): HelioCoreError {
  return new HelioCoreError(
    "Review this request in Helio before continuing.",
    "DAPP_APPROVAL_REQUIRED",
    { requestId },
  );
}

function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;

    if (
      (codePoint >= 0x00 && codePoint <= 0x08) ||
      codePoint === 0x0b ||
      codePoint === 0x0c ||
      (codePoint >= 0x0e && codePoint <= 0x1f)
    ) {
      return true;
    }
  }

  return false;
}

function createMessagePreview(messageBase64: string): string {
  const messageBytes = decodeBase64(messageBase64);
  const messageText = new TextDecoder().decode(messageBytes);
  const isReadableText =
    messageText.length > 0 && !hasControlCharacters(messageText);

  if (isReadableText) {
    return messageText.slice(0, 280);
  }

  return `[Binary message: ${messageBytes.length} bytes]`;
}

function parseDappTransaction(
  serializedTransactionBase64: string,
): Transaction | VersionedTransaction {
  const serializedBytes = decodeBase64(serializedTransactionBase64);

  try {
    return VersionedTransaction.deserialize(serializedBytes);
  } catch {
    return Transaction.from(serializedBytes);
  }
}

function decodeShortVectorLength(bytes: Uint8Array): {
  readonly length: number;
  readonly size: number;
} {
  let length = 0;
  let shift = 0;
  let size = 0;

  while (size < bytes.length) {
    const nextByte = bytes[size] ?? 0;

    length |= (nextByte & 0x7f) << shift;
    size += 1;

    if ((nextByte & 0x80) === 0) {
      return {
        length,
        size,
      };
    }

    shift += 7;
  }

  throw new HelioCoreError(
    "The dApp transaction signature header could not be decoded.",
    "INVALID_DAPP_TRANSACTION",
  );
}

function getDappTransactionMessageBytes(
  serializedTransactionBase64: string,
): Uint8Array {
  const serializedBytes = decodeBase64(serializedTransactionBase64);
  const { length: signatureCount, size: signatureHeaderSize } =
    decodeShortVectorLength(serializedBytes);
  const messageOffset = signatureHeaderSize + signatureCount * 64;

  return serializedBytes.slice(messageOffset);
}

function getDappTransactionSignerIndex(input: {
  readonly parsedTransaction: Transaction | VersionedTransaction;
  readonly signerAddress: string;
}): number {
  if (input.parsedTransaction instanceof VersionedTransaction) {
    const signerKeys = input.parsedTransaction.message.staticAccountKeys.slice(
      0,
      input.parsedTransaction.message.header.numRequiredSignatures,
    );

    return signerKeys.findIndex(
      (signerKey) => signerKey.toBase58() === input.signerAddress,
    );
  }

  return input.parsedTransaction.signatures.findIndex(
    (signature) => signature.publicKey.toBase58() === input.signerAddress,
  );
}

function applySignatureToSerializedTransaction(input: {
  readonly serializedTransactionBase64: string;
  readonly signatureBytes: Uint8Array;
  readonly signerIndex: number;
}): string {
  const serializedBytes = decodeBase64(input.serializedTransactionBase64);
  const { size: signatureHeaderSize } =
    decodeShortVectorLength(serializedBytes);
  const nextSerializedBytes = serializedBytes.slice();
  const signatureOffset = signatureHeaderSize + input.signerIndex * 64;

  nextSerializedBytes.set(input.signatureBytes, signatureOffset);

  return encodeBase64(nextSerializedBytes);
}

async function signSerializedDappTransaction(input: {
  readonly senderSecretKey: Uint8Array;
  readonly serializedTransactionBase64: string;
}) {
  const signerKeypair = Keypair.fromSecretKey(input.senderSecretKey);

  try {
    const parsedTransaction = parseDappTransaction(
      input.serializedTransactionBase64,
    );
    const signerAddress = signerKeypair.publicKey.toBase58();
    const signerIndex = getDappTransactionSignerIndex({
      parsedTransaction,
      signerAddress,
    });

    if (signerIndex === -1) {
      throw new HelioCoreError(
        "The active wallet is not a required signer for this transaction.",
        "INVALID_DAPP_TRANSACTION",
      );
    }

    const signatureBytes = await signMessageWithSecretKey(
      getDappTransactionMessageBytes(input.serializedTransactionBase64),
      input.senderSecretKey,
    );

    return {
      publicKey: signerAddress,
      signature: encodeBase64(signatureBytes),
      signedTransactionBase64: applySignatureToSerializedTransaction({
        serializedTransactionBase64: input.serializedTransactionBase64,
        signatureBytes,
        signerIndex,
      }),
    } satisfies ExtensionRequestMap["helio/sign-dapp-transaction"]["response"];
  } finally {
    signerKeypair.secretKey.fill(0);
  }
}

export interface HelioExtensionService {
  handleRequest<TType extends ExtensionRequestType>(
    type: TType,
    payload: ExtensionRequestMap[TType]["request"],
  ): Promise<ExtensionRequestMap[TType]["response"]>;
}

/**
 * Creates the extension backend service used by the popup and background worker.
 *
 * @param storageAdapter - Optional storage adapter override for tests.
 * @returns Service methods for the extension runtime.
 */
export function createHelioExtensionService(
  storageAdapter: ExtensionStorageAdapter = createExtensionStorageAdapter(),
  rpcClientFactory: (
    localState: ExtensionLocalState,
  ) => HelioRpcClient = createExtensionRpcClient,
  dappRiskProvider: DappRiskProvider = createLocalDappRiskProvider(),
): HelioExtensionService {
  return {
    async handleRequest(type, payload) {
      switch (type) {
        case "helio/get-runtime-snapshot":
          return createRuntimeSnapshot(storageAdapter, rpcClientFactory);

        case "helio/begin-wallet-creation": {
          const mnemonicWords = generateWalletMnemonicWords();

          return {
            mnemonicWords,
            verificationChallenge:
              createSeedPhraseVerificationChallenge(mnemonicWords),
          };
        }

        case "helio/create-wallet": {
          const request = asCreateWalletRequest(payload);

          return persistUnlockedWallet({
            createRequest: request,
            rpcClientFactory,
            storageAdapter,
            vaultCreator: () =>
              createStoredMnemonicVault(
                request.mnemonicWords,
                request.password,
              ),
          });
        }

        case "helio/import-wallet": {
          const request = asImportWalletRequest(payload);

          return persistUnlockedWallet({
            createRequest: {
              biometricsEnabled: request.biometricsEnabled,
              mnemonicWords: [],
              password: request.password,
            },
            rpcClientFactory,
            storageAdapter,
            vaultCreator: async () => {
              if (request.importMethod === "seed-phrase") {
                const mnemonicWords = request.importValue
                  .trim()
                  .split(/\s+/)
                  .filter(Boolean);

                if (!validateWalletMnemonicWords(mnemonicWords)) {
                  throw new HelioCoreError(
                    "Seed phrase is not valid.",
                    "INVALID_MNEMONIC",
                  );
                }

                return createStoredMnemonicVault(
                  mnemonicWords,
                  request.password,
                );
              }

              return createStoredPrivateKeyVault(
                request.importValue,
                request.password,
              );
            },
          });
        }

        case "helio/unlock-wallet": {
          const request = asUnlockWalletRequest(payload);
          const { localState } = await getNormalizedState(storageAdapter);

          if (localState.vault === null) {
            throw new HelioCoreError(
              "Wallet vault was not found.",
              "WALLET_NOT_FOUND",
            );
          }

          const unlockedVault = await unlockStoredWalletVault(
            localState.vault,
            request.password,
          );
          const nextSessionState = createSessionState(
            localState,
            unlockedVault.account,
            encodeHex(unlockedVault.secretKey),
          );

          await storageAdapter.setSessionState(nextSessionState);

          return createRuntimeSnapshot(storageAdapter, rpcClientFactory);
        }

        case "helio/lock-wallet":
          await storageAdapter.clearSessionState();
          return createRuntimeSnapshot(storageAdapter, rpcClientFactory);

        case "helio/export-mnemonic": {
          const request = asExportMnemonicRequest(payload);
          const localState = await storageAdapter.getLocalState();

          if (localState.vault === null) {
            throw new HelioCoreError(
              "Wallet vault was not found.",
              "WALLET_NOT_FOUND",
            );
          }

          return exportMnemonicWordsFromVault(
            localState.vault,
            request.password,
          );
        }

        case "helio/refresh-dashboard": {
          const { localState, sessionState } =
            await getNormalizedState(storageAdapter);
          const activeSession = assertUnlockedSession(sessionState);
          const rpcClient = rpcClientFactory(localState);

          return rpcClient.getWalletDashboardSnapshot(
            activeSession.activeAccount,
            localState.activity,
          );
        }

        case "helio/review-send": {
          const request = asSendDraftRequest(payload);
          const { localState, sessionState } =
            await getNormalizedState(storageAdapter);
          const activeSession = assertUnlockedSession(sessionState);

          return rpcClientFactory(localState).reviewSendTransfer({
            asset: request.asset,
            amountInput: request.amountInput,
            recipientAddress: request.recipientAddress,
            recipientLabel: request.recipientLabel,
            senderAccount: activeSession.activeAccount,
            urgency: request.urgency,
          });
        }

        case "helio/submit-send": {
          const request = asSendTransactionRequest(payload);
          const { localState, sessionState } =
            await getNormalizedState(storageAdapter);
          const activeSession = assertUnlockedSession(sessionState);

          const rpcClient = rpcClientFactory(localState);
          const reviewModel = await rpcClient.reviewSendTransfer({
            asset: request.draft.asset,
            amountInput: request.draft.amountInput,
            recipientAddress: request.draft.recipientAddress,
            recipientLabel: request.draft.recipientLabel,
            senderAccount: activeSession.activeAccount,
            urgency: request.draft.urgency,
          });

          if (reviewModel.review.status === "blocked") {
            throw new HelioCoreError(
              "Transaction review is blocked and cannot be sent.",
              "INVALID_NUMERIC_INPUT",
            );
          }

          const transactionResult = await rpcClient.submitSendTransfer({
            reviewModel,
            senderSecretKey: decodeHex(activeSession.secretKeyHex),
            useAdjustedAmount: request.useAdjustedAmount,
          });
          const sentAmount = request.useAdjustedAmount
            ? reviewModel.review.adjustedAmount
            : reviewModel.review.originalAmount;
          const nextLocalState: ExtensionLocalState = {
            ...localState,
            activity: [
              {
                id: transactionResult.signature,
                kind: "send" as const,
                title: `Sent ${reviewModel.asset.symbol}`,
                subtitle: `To ${transactionResult.recipientShortAddress}`,
                amountDisplay: sentAmount.amountDisplay,
                status: transactionResult.status,
                timestampIso: new Date().toISOString(),
                explorerUrl: transactionResult.explorerUrl,
              },
              ...localState.activity,
            ].slice(0, 10),
          };
          const nextSessionState = createSessionState(
            nextLocalState,
            activeSession.activeAccount,
            activeSession.secretKeyHex,
          );

          await storageAdapter.setLocalState(nextLocalState);
          await storageAdapter.setSessionState(nextSessionState);

          return transactionResult;
        }

        case "helio/update-network-preference": {
          const request = asUpdateNetworkPreferenceRequest(payload);
          const localState = await storageAdapter.getLocalState();
          const nextLocalState: ExtensionLocalState = {
            ...localState,
            networkPreference: {
              ...localState.networkPreference,
              customRpcUrl: request.customRpcUrl,
              selectedNetwork: request.selectedNetwork,
            },
          };
          const rpcClient = rpcClientFactory(nextLocalState);
          const networkStatus = await rpcClient.getNetworkStatus();

          if (!networkStatus.isHealthy) {
            throw new Error("The selected RPC endpoint is not healthy.");
          }

          await storageAdapter.setLocalState(nextLocalState);

          return createRuntimeSnapshot(storageAdapter, rpcClientFactory);
        }

        case "helio/get-pending-dapp-request": {
          const localState = await storageAdapter.getLocalState();

          return localState.pendingDappRequest;
        }

        case "helio/connect-dapp": {
          const request = asConnectDappRequest(payload);
          const localState = await storageAdapter.getLocalState();

          assertWalletExists(localState);

          const connectionState = createDappConnectionState(
            localState,
            request.origin,
          );

          if (connectionState.isConnected) {
            const nextLocalState = clearPendingDappRequestForOrigin(
              localState,
              connectionState.origin,
            );

            if (nextLocalState !== localState) {
              await storageAdapter.setLocalState(nextLocalState);
            }

            return connectionState;
          }

          const riskAssessment =
            await dappRiskProvider.assessConnection(request);
          const pendingRequest = {
            dapp: createPendingDappIdentity(
              localState,
              request,
              riskAssessment.trustLevel,
            ),
            id: createRequestId(),
            kind: "connect" as const,
            permissions: ["connect"] as const,
            requestedAtIso: new Date().toISOString(),
            warnings: riskAssessment.warnings,
          };

          await storageAdapter.setLocalState({
            ...localState,
            pendingDappRequest: pendingRequest,
          });

          throw createPendingApprovalError(pendingRequest.id);
        }

        case "helio/sign-dapp-transaction": {
          const request = asSignDappTransactionRequest(payload);
          const localState = await storageAdapter.getLocalState();
          const walletVault = assertWalletExists(localState);
          const reviewModel = await rpcClientFactory(
            localState,
          ).reviewDappTransaction({
            dapp: request,
            senderAccount: walletVault.primaryAccount,
            serializedTransactionBase64: request.serializedTransactionBase64,
          });
          const pendingRequest = {
            dapp: reviewModel.dapp,
            id: createRequestId(),
            kind: "sign-transaction" as const,
            requestedAtIso: new Date().toISOString(),
            review: {
              ...reviewModel,
              requestId: "",
            },
            serializedTransactionBase64: request.serializedTransactionBase64,
          };
          const nextPendingRequest = {
            ...pendingRequest,
            review: {
              ...pendingRequest.review,
              requestId: pendingRequest.id,
            },
          };

          await storageAdapter.setLocalState({
            ...localState,
            pendingDappRequest: nextPendingRequest,
          });

          throw createPendingApprovalError(nextPendingRequest.id);
        }

        case "helio/sign-dapp-message": {
          const request = asSignDappMessageRequest(payload);
          const localState = await storageAdapter.getLocalState();

          assertWalletExists(localState);

          const messagePreview = createMessagePreview(request.messageBase64);
          const riskAssessment = await dappRiskProvider.assessMessage({
            ...request,
            messagePreview,
          });
          const pendingRequest = {
            dapp: createPendingDappIdentity(
              localState,
              request,
              riskAssessment.trustLevel,
            ),
            id: createRequestId(),
            kind: "sign-message" as const,
            messageBase64: request.messageBase64,
            messagePreview,
            requestedAtIso: new Date().toISOString(),
            summaryLines: [
              `Message preview: ${messagePreview}`,
              "Only sign this message if you trust the requesting site.",
            ],
            warnings: riskAssessment.warnings,
          };

          await storageAdapter.setLocalState({
            ...localState,
            pendingDappRequest: pendingRequest,
          });

          throw createPendingApprovalError(pendingRequest.id);
        }

        case "helio/disconnect-dapp": {
          const request = asDappOriginRequest(payload);
          const normalizedOrigin = normalizeDappOrigin(request.origin);
          const localState = await storageAdapter.getLocalState();
          const nextLocalState: ExtensionLocalState = {
            ...clearPendingDappRequestForOrigin(localState, normalizedOrigin),
            securityPreferences: {
              ...localState.securityPreferences,
              trustedOrigins: removeTrustedOrigin(
                localState.securityPreferences.trustedOrigins,
                normalizedOrigin,
              ),
            },
          };

          await storageAdapter.setLocalState(nextLocalState);

          return createDappConnectionState(nextLocalState, normalizedOrigin);
        }

        case "helio/get-dapp-connection-state": {
          const request = asDappOriginRequest(payload);
          const localState = await storageAdapter.getLocalState();

          return createDappConnectionState(localState, request.origin);
        }

        case "helio/approve-dapp-request": {
          const request = asDappRequestDecisionRequest(payload);
          const { localState, sessionState } =
            await getNormalizedState(storageAdapter);

          assertWalletExists(localState);

          const pendingRequest = assertPendingDappRequest(
            localState,
            request.requestId,
          );

          if (pendingRequest.kind === "connect") {
            const approvedOrigin = pendingRequest.dapp.origin;
            const nextLocalState: ExtensionLocalState = {
              ...localState,
              pendingDappRequest: null,
              securityPreferences: {
                ...localState.securityPreferences,
                trustedOrigins: addTrustedOrigin(
                  localState.securityPreferences.trustedOrigins,
                  approvedOrigin,
                ),
              },
            };

            await storageAdapter.setLocalState(nextLocalState);

            return {
              connectionState: createDappConnectionState(
                nextLocalState,
                approvedOrigin,
              ),
              kind: "connect",
              requestId: request.requestId,
            };
          }

          const activeSession = assertUnlockedSession(sessionState);
          const refreshedSession = createSessionState(
            localState,
            activeSession.activeAccount,
            activeSession.secretKeyHex,
          );

          if (pendingRequest.kind === "sign-transaction") {
            const senderSecretKey = decodeHex(activeSession.secretKeyHex);

            try {
              const signedTransaction = await signSerializedDappTransaction({
                senderSecretKey,
                serializedTransactionBase64:
                  pendingRequest.serializedTransactionBase64,
              });

              await storageAdapter.setLocalState({
                ...localState,
                pendingDappRequest: null,
              });
              await storageAdapter.setSessionState(refreshedSession);

              return {
                kind: "sign-transaction",
                requestId: request.requestId,
                signedTransaction,
              };
            } finally {
              senderSecretKey.fill(0);
            }
          }

          const senderSecretKey = decodeHex(activeSession.secretKeyHex);
          const messageBytes = decodeBase64(pendingRequest.messageBase64);

          try {
            const signatureBytes = await signMessageWithSecretKey(
              messageBytes,
              senderSecretKey,
            );

            await storageAdapter.setLocalState({
              ...localState,
              pendingDappRequest: null,
            });
            await storageAdapter.setSessionState(refreshedSession);

            return {
              kind: "sign-message",
              requestId: request.requestId,
              signedMessage: {
                publicKey: activeSession.activeAccount.address,
                signatureBase64: encodeBase64(signatureBytes),
                signedMessageBase64: pendingRequest.messageBase64,
              },
            };
          } finally {
            senderSecretKey.fill(0);
          }
        }

        case "helio/reject-dapp-request": {
          const request = asDappRequestDecisionRequest(payload);
          const localState = await storageAdapter.getLocalState();
          assertPendingDappRequest(localState, request.requestId);

          await storageAdapter.setLocalState({
            ...localState,
            pendingDappRequest: null,
          });

          return {
            requestId: request.requestId,
          };
        }
      }
    },
  };
}
