import type {
  ActivityItem,
  DappRequestMetadata,
  DappTransactionReview,
  NetworkPreference,
  NetworkStatus,
  PriorityFeeSample,
  RpcEndpointConfig,
  SendAssetSummary,
  SendReviewModel,
  SendTransactionResult,
  TokenHolding,
  TransactionReviewWarning,
  TransactionUrgency,
  WalletAccountSummary,
  WalletDashboardSnapshot,
} from "@helio/types";
import {
  ACCOUNT_SIZE,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  decodeApproveInstruction,
  decodeSetAuthorityInstruction,
  decodeTransferCheckedInstruction,
  decodeTransferInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type {
  AddressLookupTableAccount,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ComputeBudgetProgram,
  Connection,
  clusterApiUrl,
  Keypair,
  LAMPORTS_PER_SOL,
  type ParsedAccountData,
  PublicKey,
  SystemInstruction,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { executeWithOrderedFailover } from "../failover/ordered-failover";
import type {
  DappRiskProvider,
  PriceFeedClient,
  TokenPriceSnapshot,
} from "../integrations/integration-contracts";
import { createLocalDappRiskProvider } from "../integrations/local-risk-provider";

const SOL_MINT_ADDRESS = "So11111111111111111111111111111111111111112";
const DEFAULT_COMMITMENT = "confirmed";
const DEFAULT_FALLBACK_SOL_USD_PRICE = 172;
const KNOWN_TOKEN_METADATA: Readonly<
  Record<string, Pick<SendAssetSummary, "iconUrl" | "name" | "symbol">>
> = {
  [SOL_MINT_ADDRESS]: {
    iconUrl: null,
    name: "Solana",
    symbol: "SOL",
  },
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    iconUrl: null,
    name: "USD Coin",
    symbol: "USDC",
  },
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: {
    iconUrl: null,
    name: "Jupiter",
    symbol: "JUP",
  },
};

interface ParsedTokenAccountSnapshot {
  readonly amountAtomic: string;
  readonly amountDisplay: string;
  readonly decimals: number;
  readonly mintAddress: string;
  readonly programId: PublicKey;
  readonly tokenAccountAddress: PublicKey;
}

export interface HelioRpcClient {
  getWalletDashboardSnapshot(
    account: WalletAccountSummary,
    activity: readonly ActivityItem[],
  ): Promise<WalletDashboardSnapshot>;
  getNetworkStatus(): Promise<NetworkStatus>;
  reviewSendTransfer(input: {
    readonly senderAccount: WalletAccountSummary;
    readonly asset: SendAssetSummary;
    readonly recipientAddress: string;
    readonly recipientLabel: string | null;
    readonly amountInput: string;
    readonly urgency: TransactionUrgency;
  }): Promise<SendReviewModel>;
  reviewDappTransaction(input: {
    readonly dapp: DappRequestMetadata;
    readonly senderAccount: WalletAccountSummary;
    readonly serializedTransactionBase64: string;
  }): Promise<Omit<DappTransactionReview, "requestId">>;
  submitSendTransfer(input: {
    readonly senderSecretKey: Uint8Array;
    readonly reviewModel: SendReviewModel;
    readonly useAdjustedAmount: boolean;
  }): Promise<SendTransactionResult>;
}

type ManagedNetwork = Exclude<NetworkPreference["selectedNetwork"], "custom">;

export interface HelioRpcClientOptions {
  readonly priceFeedClient?: PriceFeedClient;
  readonly riskProvider?: DappRiskProvider;
  readonly rpcEndpointPool?: Partial<
    Record<ManagedNetwork, readonly RpcEndpointConfig[]>
  >;
}

interface RpcTransport {
  readonly connection: Connection;
  readonly endpoint: RpcEndpointConfig;
}

const DEFAULT_ENDPOINTS: Record<ManagedNetwork, RpcEndpointConfig> = {
  "mainnet-beta": {
    label: "Solana Mainnet",
    network: "mainnet-beta",
    url: clusterApiUrl("mainnet-beta"),
  },
  devnet: {
    label: "Solana Devnet",
    network: "devnet",
    url: clusterApiUrl("devnet"),
  },
};

function createShortAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function formatUsdValue(value: number): number {
  return Number(value.toFixed(2));
}

function buildExplorerUrl(
  signature: string,
  network: RpcEndpointConfig["network"],
) {
  if (network === "mainnet-beta") {
    return `https://solscan.io/tx/${signature}`;
  }

  if (network === "devnet") {
    return `https://solscan.io/tx/${signature}?cluster=devnet`;
  }

  return null;
}

function parsePublicKey(address: string): PublicKey {
  try {
    return new PublicKey(address.trim());
  } catch (cause) {
    throw new Error(`Invalid Solana address: ${String(cause)}`);
  }
}

function parseDecimalToAtomic(amountInput: string, decimals: number): bigint {
  const normalizedAmount = amountInput.trim();

  if (!/^\d+(\.\d+)?$/.test(normalizedAmount)) {
    throw new Error("Amount must be a positive numeric value.");
  }

  const [wholePart, fractionalPart = ""] = normalizedAmount.split(".");
  const paddedFraction = fractionalPart
    .padEnd(decimals, "0")
    .slice(0, decimals);

  return BigInt(`${wholePart}${paddedFraction}`);
}

function trimTrailingZeros(value: string): string {
  return value.replace(/\.?0+$/, "");
}

function formatAtomicAmount(amountAtomic: bigint, decimals: number): string {
  if (decimals === 0) {
    return amountAtomic.toString();
  }

  const paddedAmount = amountAtomic.toString().padStart(decimals + 1, "0");
  const wholePart = paddedAmount.slice(0, -decimals);
  const fractionalPart = paddedAmount.slice(-decimals);

  return trimTrailingZeros(`${wholePart}.${fractionalPart}`);
}

function formatAssetAmount(
  amountAtomic: bigint,
  asset: SendAssetSummary,
): string {
  return `${formatAtomicAmount(amountAtomic, asset.decimals)} ${asset.symbol}`;
}

function createSolAsset(usdPrice: number) {
  return {
    kind: "native-sol" as const,
    mintAddress: null,
    name: "Solana",
    symbol: "SOL",
    decimals: 9,
    iconUrl: null,
    usdPrice,
  };
}

function createFallbackTokenMetadata(mintAddress: string) {
  return {
    iconUrl: null,
    name: `Token ${createShortAddress(mintAddress)}`,
    symbol: mintAddress.slice(0, 4).toUpperCase(),
  };
}

function createTokenAsset(
  mintAddress: string,
  decimals: number,
  usdPrice: number | null,
): SendAssetSummary {
  const tokenMetadata =
    KNOWN_TOKEN_METADATA[mintAddress] ??
    createFallbackTokenMetadata(mintAddress);

  return {
    kind: "spl-token",
    mintAddress,
    name: tokenMetadata.name,
    symbol: tokenMetadata.symbol,
    decimals,
    iconUrl: tokenMetadata.iconUrl,
    usdPrice,
  };
}

function createConnection(endpoint: RpcEndpointConfig): Connection {
  return new Connection(endpoint.url, DEFAULT_COMMITMENT);
}

function createRpcTransports(
  endpoints: readonly RpcEndpointConfig[],
): readonly RpcTransport[] {
  return endpoints.map((endpoint) => ({
    connection: createConnection(endpoint),
    endpoint,
  }));
}

async function withRpcFailover<TResult>(
  transports: readonly RpcTransport[],
  operation: (transport: RpcTransport) => Promise<TResult>,
): Promise<TResult> {
  return executeWithOrderedFailover(transports, operation);
}

async function getSolPriceUsd(
  priceFeedClient?: PriceFeedClient,
): Promise<number> {
  if (priceFeedClient === undefined) {
    return DEFAULT_FALLBACK_SOL_USD_PRICE;
  }

  try {
    const priceSnapshots = await priceFeedClient.listTokenPrices([
      SOL_MINT_ADDRESS,
    ]);

    return priceSnapshots[0]?.usdPrice ?? DEFAULT_FALLBACK_SOL_USD_PRICE;
  } catch {
    return DEFAULT_FALLBACK_SOL_USD_PRICE;
  }
}

async function getTokenPriceSnapshotMap(
  mintAddresses: readonly string[],
  priceFeedClient?: PriceFeedClient,
): Promise<ReadonlyMap<string, TokenPriceSnapshot>> {
  if (priceFeedClient === undefined || mintAddresses.length === 0) {
    return new Map();
  }

  try {
    const uniqueMintAddresses = [...new Set(mintAddresses)];
    const priceSnapshots =
      await priceFeedClient.listTokenPrices(uniqueMintAddresses);

    return new Map(
      priceSnapshots.map((priceSnapshot) => [
        priceSnapshot.mintAddress,
        priceSnapshot,
      ]),
    );
  } catch {
    return new Map();
  }
}

function isParsedAccountData(data: unknown): data is ParsedAccountData {
  return typeof data === "object" && data !== null && "parsed" in data;
}

function parseTokenAccountSnapshot(tokenAccount: {
  readonly account: {
    readonly data: unknown;
    readonly owner: PublicKey;
  };
  readonly pubkey: PublicKey;
}): ParsedTokenAccountSnapshot | null {
  if (!isParsedAccountData(tokenAccount.account.data)) {
    return null;
  }

  const parsedInfo = tokenAccount.account.data.parsed.info as {
    readonly mint: string;
    readonly tokenAmount: {
      readonly amount: string;
      readonly decimals: number;
      readonly uiAmountString: string | null;
    };
  };

  if (parsedInfo.tokenAmount.amount === "0") {
    return null;
  }

  return {
    amountAtomic: parsedInfo.tokenAmount.amount,
    amountDisplay:
      parsedInfo.tokenAmount.uiAmountString ??
      formatAtomicAmount(
        BigInt(parsedInfo.tokenAmount.amount),
        parsedInfo.tokenAmount.decimals,
      ),
    decimals: parsedInfo.tokenAmount.decimals,
    mintAddress: parsedInfo.mint,
    programId: tokenAccount.account.owner,
    tokenAccountAddress: tokenAccount.pubkey,
  };
}

async function loadParsedTokenAccounts(
  connection: Connection,
  owner: PublicKey,
): Promise<readonly ParsedTokenAccountSnapshot[]> {
  const [tokenAccounts, token2022Accounts] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(
      owner,
      { programId: TOKEN_PROGRAM_ID },
      DEFAULT_COMMITMENT,
    ),
    connection.getParsedTokenAccountsByOwner(
      owner,
      { programId: TOKEN_2022_PROGRAM_ID },
      DEFAULT_COMMITMENT,
    ),
  ]);

  return [...tokenAccounts.value, ...token2022Accounts.value]
    .map((tokenAccount) => parseTokenAccountSnapshot(tokenAccount))
    .filter(
      (tokenAccount): tokenAccount is ParsedTokenAccountSnapshot =>
        tokenAccount !== null,
    );
}

function createTokenHolding(
  tokenAccount: ParsedTokenAccountSnapshot,
  priceSnapshot: TokenPriceSnapshot | null,
): TokenHolding {
  const asset = createTokenAsset(
    tokenAccount.mintAddress,
    tokenAccount.decimals,
    priceSnapshot?.usdPrice ?? null,
  );
  const tokenAmount =
    Number(tokenAccount.amountAtomic) / 10 ** tokenAccount.decimals;
  const usdValue =
    asset.usdPrice === null ? 0 : formatUsdValue(tokenAmount * asset.usdPrice);

  return {
    assetKind: "spl-token",
    mintAddress: tokenAccount.mintAddress,
    name: asset.name,
    symbol: asset.symbol,
    iconUrl: asset.iconUrl,
    decimals: tokenAccount.decimals,
    amountAtomic: tokenAccount.amountAtomic,
    amountDisplay: tokenAccount.amountDisplay,
    usdPrice: asset.usdPrice,
    usdValue,
    dailyChangePercentage: priceSnapshot?.changePercentage24h ?? 0,
    isSpam: false,
  } as TokenHolding;
}

function createSolTokenHolding(
  solBalanceLamports: number,
  solPriceUsd: number,
): TokenHolding {
  const solAmountAtomic = BigInt(solBalanceLamports);
  const solAmount = solBalanceLamports / LAMPORTS_PER_SOL;

  return {
    assetKind: "native-sol",
    mintAddress: SOL_MINT_ADDRESS,
    name: "Solana",
    symbol: "SOL",
    iconUrl: null,
    decimals: 9,
    amountAtomic: solAmountAtomic.toString(),
    amountDisplay: solAmount.toLocaleString("en-US", {
      maximumFractionDigits: 9,
    }),
    usdPrice: solPriceUsd,
    usdValue: formatUsdValue(solAmount * solPriceUsd),
    dailyChangePercentage: 0,
    isSpam: false,
  } as TokenHolding;
}

function createPriorityFeeSamples(
  recentPrioritizationFees: readonly {
    readonly slot: number;
    readonly prioritizationFee: number;
  }[],
): readonly PriorityFeeSample[] {
  if (recentPrioritizationFees.length > 0) {
    return recentPrioritizationFees.map((feeSample) => ({
      slot: feeSample.slot,
      feeLamports: feeSample.prioritizationFee,
    }));
  }

  return [
    { slot: 1, feeLamports: 1_000 },
    { slot: 2, feeLamports: 2_500 },
    { slot: 3, feeLamports: 5_000 },
  ];
}

async function buildUnsignedNativeSolTransfer(input: {
  readonly connection: Connection;
  readonly senderPublicKey: PublicKey;
  readonly recipientPublicKey: PublicKey;
  readonly amountLamports: bigint;
  readonly urgency: TransactionUrgency;
}) {
  const recentPriorityFees =
    await input.connection.getRecentPrioritizationFees();
  const priorityFeeSamples = createPriorityFeeSamples(recentPriorityFees);
  const estimatedPriorityFeeMicroLamports =
    priorityFeeSamples[Math.max(priorityFeeSamples.length - 1, 0)]
      ?.feeLamports ?? 0;
  const latestBlockhash =
    await input.connection.getLatestBlockhash(DEFAULT_COMMITMENT);
  const transferInstruction = SystemProgram.transfer({
    fromPubkey: input.senderPublicKey,
    lamports: Number(input.amountLamports),
    toPubkey: input.recipientPublicKey,
  });
  const instructions = [
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: estimatedPriorityFeeMicroLamports,
    }),
    transferInstruction,
  ];
  const versionedMessage = new TransactionMessage({
    payerKey: input.senderPublicKey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions,
  }).compileToV0Message();
  const transaction = new VersionedTransaction(versionedMessage);
  const estimatedNetworkFee =
    (await input.connection.getFeeForMessage(versionedMessage)).value ?? 5_000;

  return {
    transaction,
    priorityFeeSamples,
    estimatedNetworkFeeLamports: estimatedNetworkFee,
  };
}

async function resolveOwnedTokenAccount(input: {
  readonly connection: Connection;
  readonly mintAddress: string;
  readonly owner: PublicKey;
}): Promise<ParsedTokenAccountSnapshot> {
  const tokenAccounts = await loadParsedTokenAccounts(
    input.connection,
    input.owner,
  );
  const tokenAccount = tokenAccounts.find(
    (account) => account.mintAddress === input.mintAddress,
  );

  if (tokenAccount !== undefined) {
    return tokenAccount;
  }

  throw new Error("The selected token account was not found in this wallet.");
}

async function buildUnsignedSplTokenTransfer(input: {
  readonly asset: SendAssetSummary;
  readonly amountAtomic: bigint;
  readonly connection: Connection;
  readonly recipientPublicKey: PublicKey;
  readonly senderPublicKey: PublicKey;
  readonly urgency: TransactionUrgency;
}) {
  if (input.asset.mintAddress === null) {
    throw new Error("Token transfers require a valid mint address.");
  }

  const mintPublicKey = parsePublicKey(input.asset.mintAddress);
  const senderTokenAccount = await resolveOwnedTokenAccount({
    connection: input.connection,
    mintAddress: input.asset.mintAddress,
    owner: input.senderPublicKey,
  });
  const recipientTokenAccountAddress = getAssociatedTokenAddressSync(
    mintPublicKey,
    input.recipientPublicKey,
    false,
    senderTokenAccount.programId,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const [recentPriorityFees, latestBlockhash, recipientTokenAccountInfo] =
    await Promise.all([
      input.connection.getRecentPrioritizationFees(),
      input.connection.getLatestBlockhash(DEFAULT_COMMITMENT),
      input.connection.getAccountInfo(
        recipientTokenAccountAddress,
        DEFAULT_COMMITMENT,
      ),
    ]);
  const priorityFeeSamples = createPriorityFeeSamples(recentPriorityFees);
  const estimatedPriorityFeeMicroLamports =
    priorityFeeSamples[Math.max(priorityFeeSamples.length - 1, 0)]
      ?.feeLamports ?? 0;
  const recipientRequiresAssociatedTokenAccount =
    recipientTokenAccountInfo === null;
  const associatedTokenAccountRentLamports =
    recipientRequiresAssociatedTokenAccount
      ? await input.connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE)
      : 0;
  const instructions = [
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: estimatedPriorityFeeMicroLamports,
    }),
  ];

  if (recipientRequiresAssociatedTokenAccount) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        input.senderPublicKey,
        recipientTokenAccountAddress,
        input.recipientPublicKey,
        mintPublicKey,
        senderTokenAccount.programId,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }

  instructions.push(
    createTransferCheckedInstruction(
      senderTokenAccount.tokenAccountAddress,
      mintPublicKey,
      recipientTokenAccountAddress,
      input.senderPublicKey,
      input.amountAtomic,
      input.asset.decimals,
      [],
      senderTokenAccount.programId,
    ),
  );

  const versionedMessage = new TransactionMessage({
    payerKey: input.senderPublicKey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions,
  }).compileToV0Message();
  const transaction = new VersionedTransaction(versionedMessage);
  const estimatedNetworkFee =
    (await input.connection.getFeeForMessage(versionedMessage)).value ?? 5_000;

  return {
    associatedTokenAccountRentLamports,
    estimatedNetworkFeeLamports: estimatedNetworkFee,
    priorityFeeSamples,
    recipientRequiresAssociatedTokenAccount,
    transaction,
  };
}

function getSimulationWarning(
  simulationResponse: Awaited<ReturnType<Connection["simulateTransaction"]>>,
): string | null {
  if (simulationResponse.value.err === null) {
    return null;
  }

  return `Simulation failed: ${JSON.stringify(simulationResponse.value.err)}`;
}

function getSentAmount(
  reviewModel: SendReviewModel,
  useAdjustedAmount: boolean,
) {
  return useAdjustedAmount
    ? reviewModel.review.adjustedAmount
    : reviewModel.review.originalAmount;
}

function zeroSensitiveByteArray(bytes: Uint8Array): void {
  // Best effort only: managed runtimes may retain copies or elide dead writes.
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = 0;
  }
}

async function analyzeTransactionReview(input: {
  readonly asset: SendAssetSummary;
  readonly requestedAmountAtomic: bigint;
  readonly senderSolBalanceLamports: number;
  readonly rentExemptionReserveLamports: number;
  readonly estimatedNetworkFeeLamports: number;
  readonly recentPriorityFeeSamples: readonly PriorityFeeSample[];
  readonly urgency: TransactionUrgency;
  readonly requiresAssociatedTokenAccount: boolean;
  readonly associatedTokenAccountRentLamports: number;
  readonly simulationWarning: string | null;
}): Promise<SendReviewModel["review"]> {
  const { analyzeSmartTransactionReview } = await import("@helio/solana");

  return analyzeSmartTransactionReview({
    asset: input.asset,
    requestedAmount: {
      amountAtomic: input.requestedAmountAtomic.toString(),
      amountDisplay: formatAssetAmount(
        input.requestedAmountAtomic,
        input.asset,
      ),
      usdEquivalent:
        input.asset.usdPrice === null
          ? null
          : (Number(input.requestedAmountAtomic) / 10 ** input.asset.decimals) *
            input.asset.usdPrice,
    },
    senderSolBalanceLamports: input.senderSolBalanceLamports,
    rentExemptionReserveLamports: input.rentExemptionReserveLamports,
    estimatedNetworkFeeLamports: input.estimatedNetworkFeeLamports,
    recentPriorityFeeSamples: input.recentPriorityFeeSamples,
    urgency: input.urgency,
    requiresAssociatedTokenAccount: input.requiresAssociatedTokenAccount,
    associatedTokenAccountRentLamports:
      input.associatedTokenAccountRentLamports,
    simulationWarning: input.simulationWarning,
    wouldLikelyFailFromSlippage: false,
    slippageWarningMessage: null,
  });
}

function decodeBase64(base64Value: string): Uint8Array {
  const binaryValue = atob(base64Value);

  return Uint8Array.from(binaryValue, (character) => character.charCodeAt(0));
}

function createReviewWarningKey(warning: TransactionReviewWarning): string {
  return [warning.code, warning.message, warning.severity, warning.title].join(
    ":",
  );
}

function mergeWarnings(
  warningGroups: ReadonlyArray<readonly TransactionReviewWarning[]>,
): readonly TransactionReviewWarning[] {
  const uniqueWarnings = new Map<string, TransactionReviewWarning>();

  for (const warningGroup of warningGroups) {
    for (const warning of warningGroup) {
      uniqueWarnings.set(createReviewWarningKey(warning), warning);
    }
  }

  return [...uniqueWarnings.values()];
}

function createUnknownProgramWarning(
  programAddress: string,
): TransactionReviewWarning {
  return {
    code: "unknown-program",
    title: "Unknown program interaction",
    message: `This request interacts with program ${createShortAddress(programAddress)}.`,
    severity: "warning",
  };
}

function createSimulationFailureWarning(
  simulationWarning: string,
): TransactionReviewWarning {
  return {
    code: "simulation-failed",
    title: "Simulation reported a failure",
    message: simulationWarning,
    severity: "critical",
  };
}

function createSummaryLine(label: string, value: string): string {
  return `${label}: ${value}`;
}

function createSendReviewRecipient(
  address: string,
  label: string | null = null,
) {
  return {
    address,
    isSavedContact: false,
    label,
    shortAddress: createShortAddress(address),
  };
}

async function loadAddressLookupTableAccounts(
  connection: Connection,
  transaction: VersionedTransaction,
): Promise<readonly AddressLookupTableAccount[]> {
  if (transaction.message.addressTableLookups.length === 0) {
    return [];
  }

  const tableAccounts = await Promise.all(
    transaction.message.addressTableLookups.map((lookup) =>
      connection.getAddressLookupTable(lookup.accountKey, {
        commitment: DEFAULT_COMMITMENT,
      }),
    ),
  );

  return tableAccounts
    .map((tableAccount) => tableAccount.value)
    .filter(
      (tableAccount): tableAccount is AddressLookupTableAccount =>
        tableAccount !== null,
    );
}

function parseSerializedTransaction(serializedTransactionBase64: string):
  | {
      readonly instructions: readonly TransactionInstruction[];
      readonly messageBytes: Uint8Array;
      readonly messageForFee: ReturnType<Transaction["compileMessage"]>;
      readonly transaction: Transaction;
      readonly version: "legacy";
    }
  | {
      readonly instructions: readonly TransactionInstruction[];
      readonly messageBytes: Uint8Array;
      readonly messageForFee: VersionedTransaction["message"];
      readonly transaction: VersionedTransaction;
      readonly version: "v0";
    } {
  const serializedBytes = decodeBase64(serializedTransactionBase64);

  try {
    const transaction = VersionedTransaction.deserialize(serializedBytes);

    return {
      instructions: [],
      messageBytes: transaction.message.serialize(),
      messageForFee: transaction.message,
      transaction,
      version: "v0",
    };
  } catch {
    const transaction = Transaction.from(serializedBytes);
    const compiledMessage = transaction.compileMessage();

    return {
      instructions: transaction.instructions,
      messageBytes: compiledMessage.serialize(),
      messageForFee: compiledMessage,
      transaction,
      version: "legacy",
    };
  }
}

async function getTransactionInstructions(
  connection: Connection,
  parsedTransaction: ReturnType<typeof parseSerializedTransaction>,
): Promise<readonly TransactionInstruction[]> {
  if (parsedTransaction.version === "legacy") {
    return parsedTransaction.instructions;
  }

  const addressLookupTableAccounts = await loadAddressLookupTableAccounts(
    connection,
    parsedTransaction.transaction,
  );

  return TransactionMessage.decompile(parsedTransaction.transaction.message, {
    addressLookupTableAccounts: [...addressLookupTableAccounts],
  }).instructions;
}

function createFallbackAssetFromMint(
  mintAddress: string,
  decimals: number,
): SendAssetSummary {
  return createTokenAsset(mintAddress, decimals, null);
}

function createDappIdentity(
  dapp: DappRequestMetadata,
  trustLevel: DappTransactionReview["dapp"]["trustLevel"],
) {
  return {
    iconUrl: dapp.iconUrl,
    name: dapp.name,
    origin: dapp.origin,
    trustLevel,
  };
}

function isKnownProgram(programAddress: string): boolean {
  return [
    ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(),
    ComputeBudgetProgram.programId.toBase58(),
    SystemProgram.programId.toBase58(),
    TOKEN_2022_PROGRAM_ID.toBase58(),
    TOKEN_PROGRAM_ID.toBase58(),
  ].includes(programAddress);
}

async function buildDappTransactionReview(input: {
  readonly dapp: DappRequestMetadata;
  readonly riskProvider: DappRiskProvider;
  readonly senderAccount: WalletAccountSummary;
  readonly serializedTransactionBase64: string;
  readonly transport: RpcTransport;
}): Promise<Omit<DappTransactionReview, "requestId">> {
  const parsedTransaction = parseSerializedTransaction(
    input.serializedTransactionBase64,
  );
  const instructions = await getTransactionInstructions(
    input.transport.connection,
    parsedTransaction,
  );
  const senderPublicKey = parsePublicKey(input.senderAccount.address);
  const senderAddress = senderPublicKey.toBase58();
  const summaryLines: string[] = [];
  const warningList: TransactionReviewWarning[] = [];
  const programAddresses = instructions.map((instruction) =>
    instruction.programId.toBase58(),
  );
  let sendReviewInput: {
    readonly asset: SendAssetSummary;
    readonly associatedTokenAccountRentLamports: number;
    readonly recipientAddress: string;
    readonly requestedAmountAtomic: bigint;
    readonly requiresAssociatedTokenAccount: boolean;
    readonly rentExemptionReserveLamports: number;
  } | null = null;

  for (const instruction of instructions) {
    const programAddress = instruction.programId.toBase58();

    if (programAddress === ComputeBudgetProgram.programId.toBase58()) {
      continue;
    }

    if (programAddress === SystemProgram.programId.toBase58()) {
      try {
        const decodedTransfer = SystemInstruction.decodeTransfer(instruction);

        if (decodedTransfer.fromPubkey.toBase58() === senderAddress) {
          summaryLines.push(
            createSummaryLine(
              "Send",
              `${formatAtomicAmount(
                BigInt(decodedTransfer.lamports),
                9,
              )} SOL to ${createShortAddress(
                decodedTransfer.toPubkey.toBase58(),
              )}`,
            ),
          );
          sendReviewInput = {
            asset: createSolAsset(DEFAULT_FALLBACK_SOL_USD_PRICE),
            associatedTokenAccountRentLamports: 0,
            recipientAddress: decodedTransfer.toPubkey.toBase58(),
            requestedAmountAtomic: BigInt(decodedTransfer.lamports),
            requiresAssociatedTokenAccount: false,
            rentExemptionReserveLamports: 890_880,
          };
        } else {
          summaryLines.push(
            createSummaryLine(
              "System",
              `System transfer touching ${createShortAddress(
                decodedTransfer.toPubkey.toBase58(),
              )}`,
            ),
          );
        }

        continue;
      } catch {}
    }

    if (
      programAddress === TOKEN_PROGRAM_ID.toBase58() ||
      programAddress === TOKEN_2022_PROGRAM_ID.toBase58()
    ) {
      try {
        const decodedTransferChecked = decodeTransferCheckedInstruction(
          instruction,
          instruction.programId,
        );

        summaryLines.push(
          createSummaryLine(
            "Transfer",
            `${formatAtomicAmount(
              decodedTransferChecked.data.amount,
              decodedTransferChecked.data.decimals,
            )} token units to ${createShortAddress(
              decodedTransferChecked.keys.destination.pubkey.toBase58(),
            )}`,
          ),
        );
        sendReviewInput = {
          asset: createFallbackAssetFromMint(
            decodedTransferChecked.keys.mint.pubkey.toBase58(),
            decodedTransferChecked.data.decimals,
          ),
          associatedTokenAccountRentLamports: 0,
          recipientAddress:
            decodedTransferChecked.keys.destination.pubkey.toBase58(),
          requestedAmountAtomic: decodedTransferChecked.data.amount,
          requiresAssociatedTokenAccount: false,
          rentExemptionReserveLamports: 0,
        };

        continue;
      } catch {}

      try {
        const decodedTransfer = decodeTransferInstruction(
          instruction,
          instruction.programId,
        );

        summaryLines.push(
          createSummaryLine(
            "Transfer",
            `${decodedTransfer.data.amount.toString()} atomic units to ${createShortAddress(
              decodedTransfer.keys.destination.pubkey.toBase58(),
            )}`,
          ),
        );

        continue;
      } catch {}

      try {
        const decodedApprove = decodeApproveInstruction(
          instruction,
          instruction.programId,
        );

        warningList.push({
          code: "token-approval",
          title: "Token approval detected",
          message: `This request grants ${createShortAddress(
            decodedApprove.keys.delegate.pubkey.toBase58(),
          )} permission to spend tokens.`,
          severity: "critical",
        });
        summaryLines.push(
          createSummaryLine(
            "Approval",
            `Approve delegate ${createShortAddress(
              decodedApprove.keys.delegate.pubkey.toBase58(),
            )}`,
          ),
        );

        continue;
      } catch {}

      try {
        const decodedSetAuthority = decodeSetAuthorityInstruction(
          instruction,
          instruction.programId,
        );

        warningList.push({
          code: "authority-change",
          title: "Authority change detected",
          message: `This request updates authority on ${createShortAddress(
            decodedSetAuthority.keys.account.pubkey.toBase58(),
          )}.`,
          severity: "critical",
        });
        summaryLines.push(
          createSummaryLine(
            "Authority",
            `Change authority on ${createShortAddress(
              decodedSetAuthority.keys.account.pubkey.toBase58(),
            )}`,
          ),
        );

        continue;
      } catch {}
    }

    if (programAddress === ASSOCIATED_TOKEN_PROGRAM_ID.toBase58()) {
      summaryLines.push(
        createSummaryLine(
          "Account",
          "Create an associated token account before transfer.",
        ),
      );

      if (sendReviewInput !== null) {
        sendReviewInput = {
          ...sendReviewInput,
          associatedTokenAccountRentLamports: ACCOUNT_SIZE,
          requiresAssociatedTokenAccount: true,
        };
      }

      continue;
    }

    summaryLines.push(
      createSummaryLine(
        "Program",
        `Interact with ${createShortAddress(programAddress)}`,
      ),
    );

    if (!isKnownProgram(programAddress)) {
      warningList.push(createUnknownProgramWarning(programAddress));
    }
  }

  const simulationResponse =
    parsedTransaction.version === "legacy"
      ? await input.transport.connection.simulateTransaction(
          parsedTransaction.transaction,
          undefined,
          false,
        )
      : await input.transport.connection.simulateTransaction(
          parsedTransaction.transaction,
          {
            commitment: DEFAULT_COMMITMENT,
            replaceRecentBlockhash: true,
            sigVerify: false,
          },
        );
  const simulationWarning = getSimulationWarning(simulationResponse);
  const riskAssessment = await input.riskProvider.assessTransaction({
    ...input.dapp,
    programAddresses,
    serializedTransactionBase64: input.serializedTransactionBase64,
    summaryLines,
  });
  const senderSolBalanceLamports = await input.transport.connection.getBalance(
    senderPublicKey,
    DEFAULT_COMMITMENT,
  );
  const estimatedNetworkFeeLamports =
    (
      await input.transport.connection.getFeeForMessage(
        parsedTransaction.messageForFee,
        DEFAULT_COMMITMENT,
      )
    ).value ?? 5_000;
  const recentPriorityFeeSamples = createPriorityFeeSamples(
    await input.transport.connection.getRecentPrioritizationFees(),
  );
  const associatedTokenAccountRentLamports =
    sendReviewInput?.requiresAssociatedTokenAccount === true
      ? await input.transport.connection.getMinimumBalanceForRentExemption(
          ACCOUNT_SIZE,
        )
      : 0;
  const sendReview =
    sendReviewInput === null
      ? null
      : {
          asset: sendReviewInput.asset,
          network: input.transport.endpoint.network,
          recipient: createSendReviewRecipient(
            sendReviewInput.recipientAddress,
          ),
          review: await analyzeTransactionReview({
            asset: sendReviewInput.asset,
            requestedAmountAtomic: sendReviewInput.requestedAmountAtomic,
            senderSolBalanceLamports,
            rentExemptionReserveLamports:
              sendReviewInput.rentExemptionReserveLamports,
            estimatedNetworkFeeLamports,
            recentPriorityFeeSamples,
            urgency: "high",
            requiresAssociatedTokenAccount:
              sendReviewInput.requiresAssociatedTokenAccount,
            associatedTokenAccountRentLamports:
              associatedTokenAccountRentLamports,
            simulationWarning,
          }),
          urgency: "high" as const,
        };

  return {
    dapp: createDappIdentity(input.dapp, riskAssessment.trustLevel),
    sendReview,
    summaryLines:
      summaryLines.length > 0
        ? summaryLines
        : ["Review the transaction details before signing."],
    warnings: mergeWarnings([
      warningList,
      riskAssessment.warnings,
      simulationWarning === null
        ? []
        : [createSimulationFailureWarning(simulationWarning)],
    ]),
  };
}

/**
 * Resolves the configured RPC endpoint for the selected network.
 *
 * @param networkPreference - User-selected network preference.
 * @returns RPC endpoint configuration used by the extension runtime.
 */
export function resolveRpcEndpointPool(
  networkPreference: NetworkPreference,
  rpcEndpointPool?: HelioRpcClientOptions["rpcEndpointPool"],
): readonly RpcEndpointConfig[] {
  if (networkPreference.selectedNetwork === "custom") {
    if (networkPreference.customRpcUrl === null) {
      throw new Error("A custom RPC URL is required for the custom network.");
    }

    return [
      {
        label: "Custom RPC",
        network: "custom",
        url: networkPreference.customRpcUrl,
      },
    ];
  }

  const configuredPool = rpcEndpointPool?.[networkPreference.selectedNetwork];

  if (configuredPool !== undefined && configuredPool.length > 0) {
    return configuredPool;
  }

  return [DEFAULT_ENDPOINTS[networkPreference.selectedNetwork]];
}

/**
 * Resolves the primary RPC endpoint for the selected network.
 *
 * @param networkPreference - User-selected network preference.
 * @param rpcEndpointPool - Optional configured failover endpoints.
 * @returns First endpoint in the resolved pool.
 */
export function resolveRpcEndpoint(
  networkPreference: NetworkPreference,
  rpcEndpointPool?: HelioRpcClientOptions["rpcEndpointPool"],
): RpcEndpointConfig {
  return resolveRpcEndpointPool(networkPreference, rpcEndpointPool)[0];
}

/**
 * Creates the validated Solana RPC client used by the extension backend.
 *
 * @param networkPreference - Selected network and optional custom RPC URL.
 * @param priceFeedClient - Optional price feed integration for USD portfolio display.
 * @returns High-level RPC client methods for dashboard and transaction flows.
 */
export function createHelioRpcClient(
  networkPreference: NetworkPreference,
  options: HelioRpcClientOptions = {},
): HelioRpcClient {
  const endpointPool = resolveRpcEndpointPool(
    networkPreference,
    options.rpcEndpointPool,
  );
  const transports = createRpcTransports(endpointPool);
  const priceFeedClient = options.priceFeedClient;
  const riskProvider = options.riskProvider ?? createLocalDappRiskProvider();

  return {
    async getWalletDashboardSnapshot(account, activity) {
      const ownerPublicKey = parsePublicKey(account.address);
      const solPriceUsd = await getSolPriceUsd(priceFeedClient);

      return withRpcFailover(transports, async (transport) => {
        const [solBalanceLamports, tokenAccounts] = await Promise.all([
          transport.connection.getBalance(ownerPublicKey, DEFAULT_COMMITMENT),
          loadParsedTokenAccounts(transport.connection, ownerPublicKey),
        ]);
        const tokenPriceMap = await getTokenPriceSnapshotMap(
          tokenAccounts.map((tokenAccount) => tokenAccount.mintAddress),
          priceFeedClient,
        );
        const tokenRows = [
          createSolTokenHolding(solBalanceLamports, solPriceUsd),
          ...tokenAccounts.map((tokenAccount) =>
            createTokenHolding(
              tokenAccount,
              tokenPriceMap.get(tokenAccount.mintAddress) ?? null,
            ),
          ),
        ].sort((left, right) => {
          if (right.usdValue !== left.usdValue) {
            return right.usdValue - left.usdValue;
          }

          return left.symbol.localeCompare(right.symbol);
        });
        const totalUsdValue = formatUsdValue(
          tokenRows.reduce(
            (currentTotal, tokenRow) => currentTotal + tokenRow.usdValue,
            0,
          ),
        );

        return {
          account,
          activity,
          network: {
            network: transport.endpoint.network,
            endpointLabel: transport.endpoint.label,
            averageLatencyMs: null,
            lastHealthyAtIso: new Date().toISOString(),
            isHealthy: true,
          },
          portfolio: {
            totalUsdValue,
            dailyChangePercentage: 0,
            dailyChangeUsd: 0,
            lastUpdatedIso: new Date().toISOString(),
          },
          tokenRows,
        };
      });
    },

    async getNetworkStatus() {
      for (const transport of transports) {
        const startedAt = Date.now();

        try {
          await transport.connection.getLatestBlockhash(DEFAULT_COMMITMENT);

          return {
            network: transport.endpoint.network,
            endpointLabel: transport.endpoint.label,
            averageLatencyMs: Date.now() - startedAt,
            lastHealthyAtIso: new Date().toISOString(),
            isHealthy: true,
          } satisfies NetworkStatus;
        } catch {}
      }

      return {
        network: endpointPool[0]?.network ?? networkPreference.selectedNetwork,
        endpointLabel: endpointPool[0]?.label ?? "Unavailable RPC",
        averageLatencyMs: null,
        lastHealthyAtIso: null,
        isHealthy: false,
      } satisfies NetworkStatus;
    },

    async reviewSendTransfer(input) {
      const senderPublicKey = parsePublicKey(input.senderAccount.address);
      const recipientPublicKey = parsePublicKey(input.recipientAddress);

      if (input.asset.kind === "native-sol") {
        const solAsset = createSolAsset(
          input.asset.usdPrice ?? (await getSolPriceUsd(priceFeedClient)),
        );
        const requestedAmountLamports = parseDecimalToAtomic(
          input.amountInput,
          9,
        );

        return withRpcFailover(transports, async (transport) => {
          const [senderSolBalanceLamports, unsignedTransfer] =
            await Promise.all([
              transport.connection.getBalance(
                senderPublicKey,
                DEFAULT_COMMITMENT,
              ),
              buildUnsignedNativeSolTransfer({
                connection: transport.connection,
                senderPublicKey,
                recipientPublicKey,
                amountLamports: requestedAmountLamports,
                urgency: input.urgency,
              }),
            ]);
          const simulationResponse =
            await transport.connection.simulateTransaction(
              unsignedTransfer.transaction,
              {
                commitment: DEFAULT_COMMITMENT,
                replaceRecentBlockhash: true,
                sigVerify: false,
              },
            );

          return {
            network: transport.endpoint.network,
            urgency: input.urgency,
            asset: solAsset,
            recipient: {
              address: input.recipientAddress,
              shortAddress: createShortAddress(input.recipientAddress),
              label: input.recipientLabel,
              isSavedContact: input.recipientLabel !== null,
            },
            review: await analyzeTransactionReview({
              asset: solAsset,
              requestedAmountAtomic: requestedAmountLamports,
              senderSolBalanceLamports,
              rentExemptionReserveLamports: 890_880,
              estimatedNetworkFeeLamports:
                unsignedTransfer.estimatedNetworkFeeLamports,
              recentPriorityFeeSamples: unsignedTransfer.priorityFeeSamples,
              urgency: input.urgency,
              requiresAssociatedTokenAccount: false,
              associatedTokenAccountRentLamports: 0,
              simulationWarning: getSimulationWarning(simulationResponse),
            }),
          };
        });
      }

      const requestedAmountAtomic = parseDecimalToAtomic(
        input.amountInput,
        input.asset.decimals,
      );

      return withRpcFailover(transports, async (transport) => {
        const [senderSolBalanceLamports, unsignedTransfer] = await Promise.all([
          transport.connection.getBalance(senderPublicKey, DEFAULT_COMMITMENT),
          buildUnsignedSplTokenTransfer({
            asset: input.asset,
            connection: transport.connection,
            senderPublicKey,
            recipientPublicKey,
            amountAtomic: requestedAmountAtomic,
            urgency: input.urgency,
          }),
        ]);
        const simulationResponse =
          await transport.connection.simulateTransaction(
            unsignedTransfer.transaction,
            {
              commitment: DEFAULT_COMMITMENT,
              replaceRecentBlockhash: true,
              sigVerify: false,
            },
          );

        return {
          network: transport.endpoint.network,
          urgency: input.urgency,
          asset: input.asset,
          recipient: {
            address: input.recipientAddress,
            shortAddress: createShortAddress(input.recipientAddress),
            label: input.recipientLabel,
            isSavedContact: input.recipientLabel !== null,
          },
          review: await analyzeTransactionReview({
            asset: input.asset,
            requestedAmountAtomic,
            senderSolBalanceLamports,
            rentExemptionReserveLamports: 0,
            estimatedNetworkFeeLamports:
              unsignedTransfer.estimatedNetworkFeeLamports,
            recentPriorityFeeSamples: unsignedTransfer.priorityFeeSamples,
            urgency: input.urgency,
            requiresAssociatedTokenAccount:
              unsignedTransfer.recipientRequiresAssociatedTokenAccount,
            associatedTokenAccountRentLamports:
              unsignedTransfer.associatedTokenAccountRentLamports,
            simulationWarning: getSimulationWarning(simulationResponse),
          }),
        };
      });
    },

    async reviewDappTransaction(input) {
      return withRpcFailover(transports, async (transport) =>
        buildDappTransactionReview({
          dapp: input.dapp,
          riskProvider,
          senderAccount: input.senderAccount,
          serializedTransactionBase64: input.serializedTransactionBase64,
          transport,
        }),
      );
    },

    async submitSendTransfer(input) {
      const senderSecretKey = Uint8Array.from(input.senderSecretKey);

      try {
        const senderKeypair = Keypair.fromSecretKey(senderSecretKey);
        const selectedAmount = getSentAmount(
          input.reviewModel,
          input.useAdjustedAmount,
        );
        const recipientPublicKey = parsePublicKey(
          input.reviewModel.recipient.address,
        );
        const transactionResult = await withRpcFailover(
          transports,
          async (transport) => {
            const unsignedTransfer =
              input.reviewModel.asset.kind === "native-sol"
                ? await buildUnsignedNativeSolTransfer({
                    connection: transport.connection,
                    senderPublicKey: senderKeypair.publicKey,
                    recipientPublicKey,
                    amountLamports: BigInt(selectedAmount.amountAtomic),
                    urgency: input.reviewModel.urgency,
                  })
                : await buildUnsignedSplTokenTransfer({
                    asset: input.reviewModel.asset,
                    amountAtomic: BigInt(selectedAmount.amountAtomic),
                    connection: transport.connection,
                    recipientPublicKey,
                    senderPublicKey: senderKeypair.publicKey,
                    urgency: input.reviewModel.urgency,
                  });

            unsignedTransfer.transaction.sign([senderKeypair]);
            zeroSensitiveByteArray(senderKeypair.secretKey);

            const simulationResponse =
              await transport.connection.simulateTransaction(
                unsignedTransfer.transaction,
                { commitment: DEFAULT_COMMITMENT },
              );

            if (simulationResponse.value.err !== null) {
              throw new Error(
                getSimulationWarning(simulationResponse) ??
                  "Transaction simulation failed.",
              );
            }

            const signature = await transport.connection.sendTransaction(
              unsignedTransfer.transaction,
              { preflightCommitment: DEFAULT_COMMITMENT },
            );
            const latestBlockhash =
              await transport.connection.getLatestBlockhash(DEFAULT_COMMITMENT);

            await transport.connection.confirmTransaction(
              {
                signature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
              },
              DEFAULT_COMMITMENT,
            );

            return {
              signature,
              status: "confirmed" as const,
              sentAmountDisplay: selectedAmount.amountDisplay,
              recipientShortAddress: createShortAddress(
                input.reviewModel.recipient.address,
              ),
              explorerLabel: "View on Solscan",
              explorerUrl: buildExplorerUrl(
                signature,
                transport.endpoint.network,
              ),
            };
          },
        );

        return transactionResult;
      } finally {
        zeroSensitiveByteArray(senderSecretKey);
      }
    },
  };
}
