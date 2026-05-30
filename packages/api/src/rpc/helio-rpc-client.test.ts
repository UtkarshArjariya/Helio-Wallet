import type {
  AutoYieldState,
  NetworkPreference,
  WalletAccountSummary,
} from "@helio/types";
import type { RpcTransport } from "@solana/kit";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { describe, expect, it } from "vitest";

import { createHelioRpcClient } from "./helio-rpc-client";

/**
 * Integration coverage for the Phase-1 wiring: `getWalletDashboardSnapshot` and
 * `getNetworkStatus` now read through the Kit leaf (`createKitRpcTransports` →
 * `withRpcFailover`). The Kit transport is injected via the `kitTransport`
 * option's `transportFactory`, so the real Kit RPC pipeline runs end-to-end
 * without any network access.
 */

const OWNER = "11111111111111111111111111111111";

const ACCOUNT: WalletAccountSummary = {
  address: OWNER,
  label: "Account 1",
  derivationIndex: 0,
  kind: "derived",
  shortAddress: "1111...1111",
};

const AUTO_YIELD_STATE: AutoYieldState = {
  status: "disabled",
  settings: {
    enabled: false,
    paused: false,
    sweepMode: "round-up",
    roundUpUnit: 1,
    percentageBps: 0,
    deployThresholdUsd: 0,
    preferredStableMintAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    activeProtocol: "kamino",
    allowedProtocols: ["kamino"],
    excludedProtocols: [],
  },
  reserve: {
    balances: [],
    totalUsdValue: 0,
    totalSweptUsd: 0,
    totalDeployedUsd: 0,
    availableToDeploy: false,
    lastSweepAtIso: null,
    lastDeployAtIso: null,
  },
};

const DEVNET_PREFERENCE: NetworkPreference = {
  selectedNetwork: "devnet",
  customRpcUrl: null,
  commitment: "confirmed",
};

const JUP_MINT = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";

type JsonRpcHandler = (method: string, params: readonly unknown[]) => unknown;

function mockTransport(handler: JsonRpcHandler): RpcTransport {
  const fn = async (config: { payload: unknown }) => {
    const payload = config.payload as {
      id: number;
      method: string;
      params: readonly unknown[];
    };
    return {
      jsonrpc: "2.0",
      id: payload.id,
      result: handler(payload.method, payload.params),
    };
  };
  return fn as unknown as RpcTransport;
}

function dashboardHandler(): JsonRpcHandler {
  return (method, params) => {
    if (method === "getBalance") {
      return { context: { slot: 1 }, value: 1_000_000_000 }; // 1 SOL
    }
    if (method === "getTokenAccountsByOwner") {
      const filter = params[1] as { programId: string };
      if (filter.programId === TOKEN_PROGRAM_ID.toBase58()) {
        return {
          context: { slot: 1 },
          value: [
            {
              pubkey: "AtaJup",
              account: {
                lamports: 2039280,
                executable: false,
                rentEpoch: 0,
                space: 165,
                owner: TOKEN_PROGRAM_ID.toBase58(),
                data: {
                  parsed: {
                    info: {
                      mint: JUP_MINT,
                      owner: OWNER,
                      state: "initialized",
                      isNative: false,
                      tokenAmount: {
                        amount: "2500000",
                        decimals: 6,
                        uiAmount: 2.5,
                        uiAmountString: "2.5",
                      },
                    },
                    type: "account",
                  },
                  program: TOKEN_PROGRAM_ID.toBase58(),
                  space: 165,
                },
              },
            },
          ],
        };
      }
      // Token-2022: none.
      return { context: { slot: 1 }, value: [] };
    }
    throw new Error(`unexpected method ${method}`);
  };
}

describe("createHelioRpcClient — dashboard + network status via the Kit read leaf", () => {
  it("getWalletDashboardSnapshot assembles SOL + SPL holdings from the Kit reader", async () => {
    const client = createHelioRpcClient(DEVNET_PREFERENCE, {
      rpcEndpointPool: {
        devnet: [
          {
            label: "Mock Devnet",
            network: "devnet",
            url: "https://mock.devnet.example",
          },
        ],
      },
      kitTransport: {
        transportFactory: () => mockTransport(dashboardHandler()),
      },
    });

    const snapshot = await client.getWalletDashboardSnapshot(
      ACCOUNT,
      [],
      AUTO_YIELD_STATE,
    );

    // Network metadata comes from the resolved endpoint.
    expect(snapshot.network.network).toBe("devnet");
    expect(snapshot.network.endpointLabel).toBe("Mock Devnet");
    expect(snapshot.network.isHealthy).toBe(true);

    // SOL holding (no price feed → fallback 172 USD/SOL).
    const sol = snapshot.tokenRows.find(
      (row) => row.assetKind === "native-sol",
    );
    expect(sol?.amountAtomic).toBe("1000000000");
    expect(sol?.usdValue).toBe(172);

    // SPL holding mapped from the Kit jsonParsed account.
    const jup = snapshot.tokenRows.find((row) => row.mintAddress === JUP_MINT);
    expect(jup?.amountAtomic).toBe("2500000");
    expect(jup?.amountDisplay).toBe("2.5");
    expect(jup?.decimals).toBe(6);

    // Sorted by USD value descending → SOL (172) before the unpriced token (0).
    expect(snapshot.tokenRows[0]?.symbol).toBe("SOL");
    expect(snapshot.portfolio.totalUsdValue).toBe(172);
    // The pass-through AutoYield state is preserved on the snapshot.
    expect(snapshot.autoYield).toBe(AUTO_YIELD_STATE);
  });

  it("getNetworkStatus reports healthy when the Kit reader's getLatestBlockhash succeeds", async () => {
    const client = createHelioRpcClient(DEVNET_PREFERENCE, {
      rpcEndpointPool: {
        devnet: [
          {
            label: "Mock Devnet",
            network: "devnet",
            url: "https://mock.devnet.example",
          },
        ],
      },
      kitTransport: {
        transportFactory: () =>
          mockTransport((method) => {
            if (method === "getLatestBlockhash") {
              return {
                context: { slot: 1 },
                value: { blockhash: "Bhash", lastValidBlockHeight: 100 },
              };
            }
            throw new Error(`unexpected method ${method}`);
          }),
      },
    });

    const status = await client.getNetworkStatus();

    expect(status.isHealthy).toBe(true);
    expect(status.endpointLabel).toBe("Mock Devnet");
    expect(status.averageLatencyMs).toBeTypeOf("number");
  });

  it("fails over to the secondary endpoint when the primary Kit transport rejects", async () => {
    const client = createHelioRpcClient(DEVNET_PREFERENCE, {
      rpcEndpointPool: {
        devnet: [
          {
            label: "Primary (down)",
            network: "devnet",
            url: "https://primary.example",
          },
          {
            label: "Fallback (ok)",
            network: "devnet",
            url: "https://fallback.example",
          },
        ],
      },
      kitTransport: {
        transportFactory: (url) =>
          mockTransport((method) => {
            if (url.includes("primary")) {
              throw new Error("primary offline");
            }
            if (method === "getLatestBlockhash") {
              return {
                context: { slot: 1 },
                value: { blockhash: "Bhash", lastValidBlockHeight: 100 },
              };
            }
            throw new Error(`unexpected method ${method}`);
          }),
      },
    });

    const status = await client.getNetworkStatus();

    expect(status.isHealthy).toBe(true);
    expect(status.endpointLabel).toBe("Fallback (ok)");
  });

  it("reports unhealthy when every Kit transport fails", async () => {
    const client = createHelioRpcClient(DEVNET_PREFERENCE, {
      rpcEndpointPool: {
        devnet: [
          {
            label: "Only (down)",
            network: "devnet",
            url: "https://only.example",
          },
        ],
      },
      kitTransport: {
        transportFactory: () =>
          mockTransport(() => {
            throw new Error("offline");
          }),
      },
    });

    const status = await client.getNetworkStatus();

    expect(status.isHealthy).toBe(false);
    expect(status.lastHealthyAtIso).toBeNull();
  });
});
