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
  StakeOverviewSnapshot,
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
  StakeProgram,
  Authorized,
  Lockup,
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
  SwapExecutionClient,
  SwapQuoteClient,
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

interface KnownTokenProbeSnapshot {
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
  getSwapQuote(input: {
    readonly inputMintAddress: string;
    readonly outputMintAddress: string;
    readonly inputAmountAtomic: string;
    readonly slippageBps: number;
  }): Promise<{
    readonly inputMintAddress: string;
    readonly outputMintAddress: string;
    readonly inputAmountAtomic: string;
    readonly outputAmountAtomic: string;
    readonly routeLabel: string;
    readonly priceImpactPercentage: number;
    readonly slippageBps: number;
  }>;
  submitSwap(input: {
    readonly senderAccount: WalletAccountSummary;
    readonly senderSecretKey: Uint8Array;
    readonly quote: {
      readonly inputMintAddress: string;
      readonly outputMintAddress: string;
      readonly inputAmountAtomic: string;
      readonly slippageBps: number;
    };
  }): Promise<SendTransactionResult>;
  getStakeOverview(account: WalletAccountSummary): Promise<StakeOverviewSnapshot>;
  stakeSol(input: {
    readonly amountInput: string;
    readonly senderAccount: WalletAccountSummary;
    readonly senderSecretKey: Uint8Array;
    readonly validatorVoteAddress: string;
  }): Promise<SendTransactionResult>;
  unstakeSol(input: {
    readonly senderAccount: WalletAccountSummary;
    readonly senderSecretKey: Uint8Array;
    readonly stakeAccountAddress: string;
  }): Promise<SendTransactionResult>;
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
  readonly swapExecutionClient?: SwapExecutionClient;
  readonly swapQuoteClient?: SwapQuoteClient;
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

function inferManagedNetworkFromCustomUrl(
  customRpcUrl: string,
): ManagedNetwork {
  return /devnet/i.test(customRpcUrl) ? "devnet" : "mainnet-beta";
}

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

function createKnownTokenProbeSnapshots(
  owner: PublicKey,
): readonly KnownTokenProbeSnapshot[] {
  const knownMintAddresses = Object.keys(KNOWN_TOKEN_METADATA).filter(
    (mintAddress) => mintAddress !== SOL_MINT_ADDRESS,
  );

  return knownMintAddresses.flatMap((mintAddress) => {
    const mintPublicKey = parsePublicKey(mintAddress);

    return [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID].map((programId) => ({
      mintAddress,
      programId,
      tokenAccountAddress: getAssociatedTokenAddressSync(
        mintPublicKey,
        owner,
        false,
        programId,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    }));
  });
}

async function loadKnownTokenAccountFallbacks(
  connection: Connection,
  owner: PublicKey,
  existingMintAddresses: ReadonlySet<string>,
): Promise<readonly ParsedTokenAccountSnapshot[]> {
  const probeCandidates = createKnownTokenProbeSnapshots(owner).filter(
    (candidate) => !existingMintAddresses.has(candidate.mintAddress),
  );

  if (probeCandidates.length === 0) {
    return [];
  }

  const probeResults = await Promise.all(
    probeCandidates.map(async (candidate) => {
      try {
        const tokenBalance = await connection.getTokenAccountBalance(
          candidate.tokenAccountAddress,
          DEFAULT_COMMITMENT,
        );

        if (tokenBalance.value.amount === "0") {
          return null;
        }

        return {
          amountAtomic: tokenBalance.value.amount,
          amountDisplay:
            tokenBalance.value.uiAmountString ??
            formatAtomicAmount(
              BigInt(tokenBalance.value.amount),
              tokenBalance.value.decimals,
            ),
          decimals: tokenBalance.value.decimals,
          mintAddress: candidate.mintAddress,
          programId: candidate.programId,
          tokenAccountAddress: candidate.tokenAccountAddress,
        } satisfies ParsedTokenAccountSnapshot;
      } catch {
        return null;
      }
    }),
  );

  return probeResults.filter(
    (probeResult): probeResult is ParsedTokenAccountSnapshot =>
      probeResult !== null,
  );
}

async function loadKnownMintTokenAccountsByOwner(
  connection: Connection,
  owner: PublicKey,
  existingMintAddresses: ReadonlySet<string>,
): Promise<readonly ParsedTokenAccountSnapshot[]> {
  const knownMintAddresses = Object.keys(KNOWN_TOKEN_METADATA).filter(
    (mintAddress) =>
      mintAddress !== SOL_MINT_ADDRESS &&
      !existingMintAddresses.has(mintAddress),
  );

  const mintSnapshots = await Promise.all(
    knownMintAddresses.map(async (mintAddress) => {
      try {
        const mintPublicKey = parsePublicKey(mintAddress);
        const tokenAccounts = await connection.getTokenAccountsByOwner(
          owner,
          { mint: mintPublicKey },
          DEFAULT_COMMITMENT,
        );

        const accountSnapshots = await Promise.all(
          tokenAccounts.value.map(async (tokenAccount) => {
            try {
              const balance = await connection.getTokenAccountBalance(
                tokenAccount.pubkey,
                DEFAULT_COMMITMENT,
              );

              if (balance.value.amount === "0") {
                return null;
              }

              return {
                amountAtomic: balance.value.amount,
                amountDisplay:
                  balance.value.uiAmountString ??
                  formatAtomicAmount(
                    BigInt(balance.value.amount),
                    balance.value.decimals,
                  ),
                decimals: balance.value.decimals,
                mintAddress,
                programId: tokenAccount.account.owner,
                tokenAccountAddress: tokenAccount.pubkey,
              } satisfies ParsedTokenAccountSnapshot;
            } catch {
              return null;
            }
          }),
        );

        return accountSnapshots.filter(
          (accountSnapshot): accountSnapshot is ParsedTokenAccountSnapshot =>
            accountSnapshot !== null,
        );
      } catch {
        return [];
      }
    }),
  );

  return mintSnapshots.flat();
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

function createChainActivityItem(input: {
  readonly network: RpcEndpointConfig["network"];
  readonly signature: string;
  readonly status: "pending" | "confirmed" | "failed";
  readonly timestampIso: string;
  readonly title?: string;
  readonly subtitle?: string;
  readonly amountDisplay?: string;
  readonly kind?: ActivityItem["kind"];
}): ActivityItem {
  return {
    id: input.signature,
    kind: input.kind ?? "dapp",
    title: input.title ?? "On-chain transaction",
    subtitle:
      input.subtitle ?? `Signature ${createShortAddress(input.signature)}`,
    amountDisplay: input.amountDisplay ?? "--",
    status: input.status,
    timestampIso: input.timestampIso,
    explorerUrl: buildExplorerUrl(input.signature, input.network),
  };
}

function deriveParsedTransactionSummary(parsedTransaction: unknown): {
  readonly title: string;
  readonly subtitle: string;
  readonly amountDisplay: string;
  readonly kind: ActivityItem["kind"];
} {
  if (
    parsedTransaction === null ||
    typeof parsedTransaction !== "object" ||
    !("transaction" in parsedTransaction)
  ) {
    return {
      title: "On-chain transaction",
      subtitle: "Unknown program",
      amountDisplay: "--",
      kind: "dapp",
    };
  }

  const txRecord = parsedTransaction as {
    readonly transaction?: {
      readonly message?: {
        readonly instructions?: readonly {
          readonly parsed?: {
            readonly type?: string;
            readonly info?: {
              readonly lamports?: number;
              readonly amount?: string;
              readonly mint?: string;
              readonly destination?: string;
            };
          };
          readonly program?: string;
        }[];
      };
    };
  };
  const firstInstruction = txRecord.transaction?.message?.instructions?.[0];

  if (firstInstruction === undefined) {
    return {
      title: "On-chain transaction",
      subtitle: "Unknown program",
      amountDisplay: "--",
      kind: "dapp",
    };
  }

  const instructionType = firstInstruction?.parsed?.type;
  const instructionProgram = firstInstruction?.program ?? "unknown";

  if (instructionType === "transfer") {
    const lamports = firstInstruction.parsed?.info?.lamports ?? 0;

    return {
      title: "SOL transfer",
      subtitle: `To ${createShortAddress(firstInstruction.parsed?.info?.destination ?? "unknown")}`,
      amountDisplay: `${(lamports / LAMPORTS_PER_SOL).toFixed(6)} SOL`,
      kind: "send",
    };
  }

  if (
    instructionType === "transferChecked" ||
    instructionType === "transferCheckedWithFee"
  ) {
    const amount = firstInstruction.parsed?.info?.amount ?? "0";
    const mint = firstInstruction.parsed?.info?.mint ?? "token";

    return {
      title: "Token transfer",
      subtitle: `Mint ${createShortAddress(mint)}`,
      amountDisplay: amount,
      kind: "send",
    };
  }

  return {
    title: "On-chain transaction",
    subtitle: instructionProgram,
    amountDisplay: "--",
    kind: "dapp",
  };
}

async function loadRecentOnChainActivity(input: {
  readonly connection: Connection;
  readonly endpoint: RpcEndpointConfig;
  readonly owner: PublicKey;
}): Promise<readonly ActivityItem[]> {
  const signatures = await input.connection.getSignaturesForAddress(input.owner, {
    limit: 10,
  });

  const parsedTransactions = await Promise.all(
    signatures.map((signatureInfo) =>
      input.connection
        .getParsedTransaction(signatureInfo.signature, {
          commitment: DEFAULT_COMMITMENT,
          maxSupportedTransactionVersion: 0,
        })
        .catch(() => null),
    ),
  );

  return signatures.map((signatureInfo, index) => {
    const status: ActivityItem["status"] =
      signatureInfo.err === null
        ? signatureInfo.confirmationStatus === "processed"
          ? "pending"
          : "confirmed"
        : "failed";
    const txSummary = deriveParsedTransactionSummary(parsedTransactions[index]);

    return createChainActivityItem({
      amountDisplay: txSummary.amountDisplay,
      kind: txSummary.kind,
      network: input.endpoint.network,
      signature: signatureInfo.signature,
      status,
      subtitle: txSummary.subtitle,
      timestampIso:
        signatureInfo.blockTime === null || signatureInfo.blockTime === undefined
          ? new Date().toISOString()
          : new Date(signatureInfo.blockTime * 1_000).toISOString(),
      title: txSummary.title,
    });
  });
}

function mergeActivityItems(
  localActivity: readonly ActivityItem[],
  chainActivity: readonly ActivityItem[],
): readonly ActivityItem[] {
  const mergedById = new Map<string, ActivityItem>();

  for (const activityItem of [...localActivity, ...chainActivity]) {
    mergedById.set(activityItem.id, activityItem);
  }

  return [...mergedById.values()]
    .sort(
      (left, right) =>
        Date.parse(right.timestampIso) - Date.parse(left.timestampIso),
    )
    .slice(0, 20);
}

function createStakeOverviewFromAccounts(input: {
  readonly parsedAccounts: readonly {
    readonly pubkey: PublicKey;
    readonly account: {
      readonly data: ParsedAccountData;
    };
  }[];
}): StakeOverviewSnapshot {
  let delegatedLamports = 0;
  const positions: Array<StakeOverviewSnapshot["positions"][number]> = [];

  for (const parsedStakeAccount of input.parsedAccounts) {
    const parsedInfo = parsedStakeAccount.account.data.parsed as {
      readonly info?: {
        readonly stake?: {
          readonly delegation?: {
            readonly stake?: number;
            readonly voter?: string;
          };
        };
      };
      readonly type?: string;
    };
    const stakeLamports = parsedInfo.info?.stake?.delegation?.stake ?? 0;

    if (stakeLamports <= 0) {
      continue;
    }

    delegatedLamports += stakeLamports;
    positions.push({
      stakeAccountAddress: parsedStakeAccount.pubkey.toBase58(),
      delegatedVoteAddress: parsedInfo.info?.stake?.delegation?.voter ?? null,
      delegatedAmountSol: stakeLamports / LAMPORTS_PER_SOL,
      activationState: parsedInfo.type === "delegated" ? "active" : "inactive",
    });
  }

  return {
    totalStakedSol: Number((delegatedLamports / LAMPORTS_PER_SOL).toFixed(6)),
    positions,
  };
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
      } catch { }
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
      } catch { }

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
      } catch { }

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
      } catch { }

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
      } catch { }
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

    const customEndpoint = {
      label: "Custom RPC",
      network: "custom" as const,
      url: networkPreference.customRpcUrl,
    };
    const inferredManagedNetwork = inferManagedNetworkFromCustomUrl(
      networkPreference.customRpcUrl,
    );
    const inferredFallbackEndpoint = {
      ...DEFAULT_ENDPOINTS[inferredManagedNetwork],
      isFallback: true,
    };

    if (customEndpoint.url === inferredFallbackEndpoint.url) {
      return [customEndpoint];
    }

    return [customEndpoint, inferredFallbackEndpoint];
  }

  const configuredPool = rpcEndpointPool?.[networkPreference.selectedNetwork];
  const defaultEndpoint = DEFAULT_ENDPOINTS[networkPreference.selectedNetwork];

  if (configuredPool !== undefined && configuredPool.length > 0) {
    const hasDefaultEndpoint = configuredPool.some(
      (configuredEndpoint) => configuredEndpoint.url === defaultEndpoint.url,
    );

    if (hasDefaultEndpoint) {
      return configuredPool;
    }

    return [
      ...configuredPool,
      {
        ...defaultEndpoint,
        isFallback: true,
      },
    ];
  }

  return [defaultEndpoint];
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
  const swapQuoteClient = options.swapQuoteClient;
  const swapExecutionClient = options.swapExecutionClient;

  return {
    async getWalletDashboardSnapshot(account, activity) {
      const ownerPublicKey = parsePublicKey(account.address);
      const solPriceUsd = await getSolPriceUsd(priceFeedClient);

      return withRpcFailover(transports, async (transport) => {
        const [solBalanceLamports, tokenAccounts] = await Promise.all([
          transport.connection.getBalance(ownerPublicKey, DEFAULT_COMMITMENT),
          withRpcFailover(transports, async (tokenTransport) =>
            loadParsedTokenAccounts(tokenTransport.connection, ownerPublicKey),
          ).catch(() => []),
        ]);
        const discoveredMintAddresses = new Set(
          tokenAccounts.map((tokenAccount) => tokenAccount.mintAddress),
        );
        const knownTokenFallbacks = await withRpcFailover(
          transports,
          async (tokenTransport) =>
            loadKnownTokenAccountFallbacks(
              tokenTransport.connection,
              ownerPublicKey,
              discoveredMintAddresses,
            ),
        ).catch(() => []);
        const knownMintTokenAccounts = await withRpcFailover(
          transports,
          async (tokenTransport) =>
            loadKnownMintTokenAccountsByOwner(
              tokenTransport.connection,
              ownerPublicKey,
              new Set([
                ...discoveredMintAddresses,
                ...knownTokenFallbacks.map(
                  (tokenAccount) => tokenAccount.mintAddress,
                ),
              ]),
            ),
        ).catch(() => []);
        const mergedTokenAccounts = [
          ...tokenAccounts,
          ...knownTokenFallbacks,
          ...knownMintTokenAccounts,
        ];
        const onChainActivity = await withRpcFailover(
          transports,
          async (activityTransport) =>
            loadRecentOnChainActivity({
              connection: activityTransport.connection,
              endpoint: activityTransport.endpoint,
              owner: ownerPublicKey,
            }),
        ).catch(() => []);
        const tokenPriceMap = await getTokenPriceSnapshotMap(
          mergedTokenAccounts.map((tokenAccount) => tokenAccount.mintAddress),
          priceFeedClient,
        );
        const tokenRows = [
          createSolTokenHolding(solBalanceLamports, solPriceUsd),
          ...mergedTokenAccounts.map((tokenAccount) =>
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
          activity: mergeActivityItems(activity, onChainActivity),
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
        } catch { }
      }

      return {
        network: endpointPool[0]?.network ?? networkPreference.selectedNetwork,
        endpointLabel: endpointPool[0]?.label ?? "Unavailable RPC",
        averageLatencyMs: null,
        lastHealthyAtIso: null,
        isHealthy: false,
      } satisfies NetworkStatus;
    },

    async getSwapQuote(input) {
      if (swapQuoteClient === undefined) {
        throw new Error("Swap quote provider is not configured.");
      }

      return swapQuoteClient.getQuote(
        input.inputMintAddress,
        input.outputMintAddress,
        input.inputAmountAtomic,
        input.slippageBps,
      );
    },

    async submitSwap(input) {
      if (swapExecutionClient === undefined) {
        throw new Error("Swap execution provider is not configured.");
      }

      const senderSecretKey = Uint8Array.from(input.senderSecretKey);

      try {
        const senderKeypair = Keypair.fromSecretKey(senderSecretKey);
        const executionPlan = await swapExecutionClient.buildSwapTransaction({
          inputAmountAtomic: input.quote.inputAmountAtomic,
          inputMintAddress: input.quote.inputMintAddress,
          outputMintAddress: input.quote.outputMintAddress,
          slippageBps: input.quote.slippageBps,
          userPublicKey: senderKeypair.publicKey.toBase58(),
        });

        return withRpcFailover(transports, async (transport) => {
          const transaction = VersionedTransaction.deserialize(
            Uint8Array.from(
              Buffer.from(executionPlan.serializedTransactionBase64, "base64"),
            ),
          );
          transaction.sign([senderKeypair]);
          zeroSensitiveByteArray(senderKeypair.secretKey);

          const simulationResponse = await transport.connection.simulateTransaction(
            transaction,
            { commitment: DEFAULT_COMMITMENT },
          );

          if (simulationResponse.value.err !== null) {
            throw new Error(
              getSimulationWarning(simulationResponse) ??
              "Swap simulation failed.",
            );
          }

          const signature = await transport.connection.sendTransaction(
            transaction,
            { preflightCommitment: DEFAULT_COMMITMENT },
          );
          const latestBlockhash = await transport.connection.getLatestBlockhash(
            DEFAULT_COMMITMENT,
          );

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
            sentAmountDisplay: "Swap submitted",
            recipientShortAddress: "Jupiter",
            explorerLabel: "View on Solscan",
            explorerUrl: buildExplorerUrl(signature, transport.endpoint.network),
          };
        });
      } finally {
        zeroSensitiveByteArray(senderSecretKey);
      }
    },

    async getStakeOverview(account) {
      const accountPublicKey = parsePublicKey(account.address);

      return withRpcFailover(transports, async (transport) => {
        const parsedStakeAccounts =
          await transport.connection.getParsedProgramAccounts(
            StakeProgram.programId,
            {
            filters: [
              {
                memcmp: {
                  offset: 12,
                  bytes: accountPublicKey.toBase58(),
                },
              },
            ],
            },
          );
        const parsedAccountRows = parsedStakeAccounts.filter(
          (stakeAccount) => {
            return (
              typeof stakeAccount.account.data === "object" &&
              "parsed" in stakeAccount.account.data
            );
          },
        ) as {
          readonly pubkey: PublicKey;
          readonly account: {
            readonly data: ParsedAccountData;
          };
        }[];

        return createStakeOverviewFromAccounts({
          parsedAccounts: parsedAccountRows,
        });
      });
    },

    async stakeSol(input) {
      const senderSecretKey = Uint8Array.from(input.senderSecretKey);

      try {
        const senderKeypair = Keypair.fromSecretKey(senderSecretKey);
        const amountLamports = Number(
          parseDecimalToAtomic(input.amountInput, 9),
        );

        return withRpcFailover(transports, async (transport) => {
          const stakeAccountKeypair = Keypair.generate();
          const rentExemptionLamports =
            await transport.connection.getMinimumBalanceForRentExemption(
              StakeProgram.space,
              DEFAULT_COMMITMENT,
            );
          const latestBlockhash = await transport.connection.getLatestBlockhash(
            DEFAULT_COMMITMENT,
          );
          const createStakeAccountTransaction = StakeProgram.createAccount({
            authorized: new Authorized(
              senderKeypair.publicKey,
              senderKeypair.publicKey,
            ),
            fromPubkey: senderKeypair.publicKey,
            lamports: amountLamports + rentExemptionLamports,
            lockup: new Lockup(0, 0, senderKeypair.publicKey),
            stakePubkey: stakeAccountKeypair.publicKey,
          });
          const delegateStakeTransaction = StakeProgram.delegate({
            authorizedPubkey: senderKeypair.publicKey,
            stakePubkey: stakeAccountKeypair.publicKey,
            votePubkey: parsePublicKey(input.validatorVoteAddress),
          });
          const instructions = [
            ...createStakeAccountTransaction.instructions,
            ...delegateStakeTransaction.instructions,
          ];
          const message = new TransactionMessage({
            payerKey: senderKeypair.publicKey,
            recentBlockhash: latestBlockhash.blockhash,
            instructions,
          }).compileToV0Message();
          const transaction = new VersionedTransaction(message);
          transaction.sign([senderKeypair, stakeAccountKeypair]);
          zeroSensitiveByteArray(senderKeypair.secretKey);
          zeroSensitiveByteArray(stakeAccountKeypair.secretKey);

          const signature = await transport.connection.sendTransaction(
            transaction,
            { preflightCommitment: DEFAULT_COMMITMENT },
          );

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
            sentAmountDisplay: `${input.amountInput} SOL staked`,
            recipientShortAddress: createShortAddress(input.validatorVoteAddress),
            explorerLabel: "View on Solscan",
            explorerUrl: buildExplorerUrl(signature, transport.endpoint.network),
          };
        });
      } finally {
        zeroSensitiveByteArray(senderSecretKey);
      }
    },

    async unstakeSol(input) {
      const senderSecretKey = Uint8Array.from(input.senderSecretKey);

      try {
        const senderKeypair = Keypair.fromSecretKey(senderSecretKey);
        const stakeAccountPublicKey = parsePublicKey(input.stakeAccountAddress);

        return withRpcFailover(transports, async (transport) => {
          const latestBlockhash = await transport.connection.getLatestBlockhash(
            DEFAULT_COMMITMENT,
          );
          const deactivateStakeTransaction = StakeProgram.deactivate({
            authorizedPubkey: senderKeypair.publicKey,
            stakePubkey: stakeAccountPublicKey,
          });
          const instructions = [...deactivateStakeTransaction.instructions];
          const message = new TransactionMessage({
            payerKey: senderKeypair.publicKey,
            recentBlockhash: latestBlockhash.blockhash,
            instructions,
          }).compileToV0Message();
          const transaction = new VersionedTransaction(message);
          transaction.sign([senderKeypair]);
          zeroSensitiveByteArray(senderKeypair.secretKey);

          const signature = await transport.connection.sendTransaction(
            transaction,
            { preflightCommitment: DEFAULT_COMMITMENT },
          );

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
            sentAmountDisplay: "Stake deactivation submitted",
            recipientShortAddress: createShortAddress(input.stakeAccountAddress),
            explorerLabel: "View on Solscan",
            explorerUrl: buildExplorerUrl(signature, transport.endpoint.network),
          };
        });
      } finally {
        zeroSensitiveByteArray(senderSecretKey);
      }
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
