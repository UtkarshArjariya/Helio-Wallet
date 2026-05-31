import {
  address,
  createSolanaRpcFromTransport,
  type RpcTransport,
} from "@solana/kit";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { describe, expect, it, vi } from "vitest";

import { createHelioKitRpcReaderFromTransport } from "./kit-rpc";

// Valid base58 addresses (the reader validates inputs via `toKitAddress`).
const OWNER = "11111111111111111111111111111111";
const MISSING_ACCOUNT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JUP_MINT = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";

type JsonRpcHandler = (method: string, params: readonly unknown[]) => unknown;

/**
 * Builds a mock {@link RpcTransport} that returns a JSON-RPC envelope around the
 * value produced by `handler`. This exercises the *real* Kit RPC API response
 * pipeline (error check → result extraction → bigint upcast) plus the reader's
 * own mapping — without any network access.
 */
function createMockTransport(handler: JsonRpcHandler): {
  transport: RpcTransport;
  fn: ReturnType<typeof vi.fn>;
} {
  const fn = vi.fn(async (config: { payload: unknown }) => {
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
  });
  return { transport: fn as unknown as RpcTransport, fn };
}

function tokenEntry(input: {
  pubkey: string;
  programId: string;
  mint: string;
  amount: string;
  decimals: number;
  uiAmountString: string | null;
}) {
  return {
    pubkey: input.pubkey,
    account: {
      lamports: 2039280,
      executable: false,
      rentEpoch: 0,
      space: 165,
      owner: input.programId,
      data: {
        parsed: {
          info: {
            mint: input.mint,
            owner: OWNER,
            state: "initialized",
            isNative: false,
            tokenAmount: {
              amount: input.amount,
              decimals: input.decimals,
              uiAmount:
                input.uiAmountString === null
                  ? null
                  : Number(input.uiAmountString),
              uiAmountString: input.uiAmountString,
            },
          },
          type: "account",
        },
        program: input.programId,
        space: 165,
      },
    },
  };
}

describe("HelioKitRpcReader (Kit read leaf, mocked transport)", () => {
  it("getBalanceLamports returns the balance as a bigint", async () => {
    const { transport } = createMockTransport((method) => {
      if (method === "getBalance") {
        return { context: { slot: 100 }, value: 1_234_567 };
      }
      throw new Error(`unexpected method ${method}`);
    });
    const reader = createHelioKitRpcReaderFromTransport(transport);

    await expect(reader.getBalanceLamports(OWNER)).resolves.toBe(1_234_567n);
  });

  it("getLatestBlockhash returns the blockhash and lastValidBlockHeight (bigint)", async () => {
    const { transport } = createMockTransport((method) => {
      if (method === "getLatestBlockhash") {
        return {
          context: { slot: 100 },
          value: { blockhash: "BlockhashAaBbCc", lastValidBlockHeight: 200 },
        };
      }
      throw new Error(`unexpected method ${method}`);
    });
    const reader = createHelioKitRpcReaderFromTransport(transport);

    await expect(reader.getLatestBlockhash()).resolves.toEqual({
      blockhash: "BlockhashAaBbCc",
      lastValidBlockHeight: 200n,
    });
  });

  it("getAccountInfo maps an existing account to normalized info", async () => {
    const { transport } = createMockTransport((method) => {
      if (method === "getAccountInfo") {
        return {
          context: { slot: 100 },
          value: {
            lamports: 5_000_000,
            owner: TOKEN_PROGRAM_ID.toBase58(),
            executable: false,
            rentEpoch: 0,
            space: 165,
            data: ["AQIDBA==", "base64"],
          },
        };
      }
      throw new Error(`unexpected method ${method}`);
    });
    const reader = createHelioKitRpcReaderFromTransport(transport);

    await expect(reader.getAccountInfo(OWNER)).resolves.toEqual({
      lamports: 5_000_000n,
      ownerAddress: TOKEN_PROGRAM_ID.toBase58(),
      executable: false,
      space: 165n,
      // base64 account data is preserved (not silently dropped).
      data: "AQIDBA==",
    });
  });

  it("getAccountInfo returns null when the account does not exist", async () => {
    const { transport } = createMockTransport((method) => {
      if (method === "getAccountInfo") {
        return { context: { slot: 100 }, value: null };
      }
      throw new Error(`unexpected method ${method}`);
    });
    const reader = createHelioKitRpcReaderFromTransport(transport);

    await expect(reader.getAccountInfo(MISSING_ACCOUNT)).resolves.toBeNull();
  });

  it("getParsedTokenAccountsByOwner merges both token programs, filters zero balances, and maps fields", async () => {
    const { transport, fn } = createMockTransport((method, params) => {
      if (method !== "getTokenAccountsByOwner") {
        throw new Error(`unexpected method ${method}`);
      }
      const filter = params[1] as { programId: string };
      if (filter.programId === TOKEN_PROGRAM_ID.toBase58()) {
        return {
          context: { slot: 100 },
          value: [
            tokenEntry({
              pubkey: "AtaUsdc",
              programId: TOKEN_PROGRAM_ID.toBase58(),
              mint: USDC_MINT,
              amount: "1500000",
              decimals: 6,
              uiAmountString: "1.5",
            }),
            tokenEntry({
              pubkey: "AtaEmpty",
              programId: TOKEN_PROGRAM_ID.toBase58(),
              mint: JUP_MINT,
              amount: "0",
              decimals: 6,
              uiAmountString: "0",
            }),
          ],
        };
      }
      if (filter.programId === TOKEN_2022_PROGRAM_ID.toBase58()) {
        return {
          context: { slot: 100 },
          value: [
            // uiAmountString omitted (null) → exercises the formatAtomicAmount fallback.
            tokenEntry({
              pubkey: "Ata2022",
              programId: TOKEN_2022_PROGRAM_ID.toBase58(),
              mint: JUP_MINT,
              amount: "42",
              decimals: 0,
              uiAmountString: null,
            }),
          ],
        };
      }
      return { context: { slot: 100 }, value: [] };
    });
    const reader = createHelioKitRpcReaderFromTransport(transport);

    const accounts = await reader.getParsedTokenAccountsByOwner(OWNER);

    // Both token programs queried; zero-balance account filtered out.
    expect(fn).toHaveBeenCalledTimes(2);
    expect(accounts).toHaveLength(2);

    const usdc = accounts.find((account) => account.mintAddress === USDC_MINT);
    expect(usdc).toEqual({
      tokenAccountAddress: "AtaUsdc",
      mintAddress: USDC_MINT,
      tokenProgramAddress: TOKEN_PROGRAM_ID.toBase58(),
      amountAtomic: "1500000",
      amountDisplay: "1.5",
      decimals: 6,
    });

    const token2022 = accounts.find(
      (account) =>
        account.tokenProgramAddress === TOKEN_2022_PROGRAM_ID.toBase58(),
    );
    expect(token2022).toEqual({
      tokenAccountAddress: "Ata2022",
      mintAddress: JUP_MINT,
      tokenProgramAddress: TOKEN_2022_PROGRAM_ID.toBase58(),
      amountAtomic: "42",
      // uiAmountString was null → computed via formatAtomicAmount(42n, 0).
      amountDisplay: "42",
      decimals: 0,
    });
  });

  it("rejects an invalid owner address before issuing any RPC call", async () => {
    const { transport, fn } = createMockTransport(() => ({
      context: { slot: 1 },
      value: 0,
    }));
    const reader = createHelioKitRpcReaderFromTransport(transport);

    await expect(
      reader.getBalanceLamports("not-a-valid-address"),
    ).rejects.toThrow();
    expect(fn).not.toHaveBeenCalled();
  });

  it("rejects when the transport returns a JSON-RPC error envelope", async () => {
    const fn = vi.fn(async (config: { payload: unknown }) => {
      const payload = config.payload as { id: number };
      return {
        jsonrpc: "2.0",
        id: payload.id,
        error: { code: -32601, message: "Method not found" },
      };
    });
    const reader = createHelioKitRpcReaderFromTransport(
      fn as unknown as RpcTransport,
    );

    await expect(reader.getBalanceLamports(OWNER)).rejects.toThrow();
  });

  it("propagates a transport-level (network) rejection", async () => {
    const fn = vi.fn(async () => {
      throw new Error("network down");
    });
    const reader = createHelioKitRpcReaderFromTransport(
      fn as unknown as RpcTransport,
    );

    await expect(reader.getLatestBlockhash()).rejects.toThrow("network down");
  });

  it("relies on the Kit pipeline upcasting integer scalars to bigint — not just the reader's BigInt()", async () => {
    // The reader defensively wraps values in BigInt(), so a happy-path assertion
    // alone can't prove the upcast ran. Read the raw Kit response to confirm the
    // pipeline (result extraction → bigint upcast) produced a bigint itself.
    const { transport } = createMockTransport(() => ({
      context: { slot: 100 },
      value: 1_234_567,
    }));
    const rpc = createSolanaRpcFromTransport(transport);

    const response = await rpc
      .getBalance(address(OWNER), { commitment: "confirmed" })
      .send();

    expect(typeof response.value).toBe("bigint");
    expect(response.value).toBe(1_234_567n);
  });
});

describe("HelioKitRpc writer methods (key-free, mocked transport)", () => {
  const WIRE = "AQAB"; // dummy base64 wire tx — the mock ignores its content

  it("simulateTransactionBase64 maps err/logs/unitsConsumed (units upcast to bigint)", async () => {
    const { transport, fn } = createMockTransport((method) => {
      if (method !== "simulateTransaction") {
        throw new Error(`unexpected method ${method}`);
      }
      return {
        context: { slot: 100 },
        value: {
          err: null,
          logs: ["Program log: ok"],
          unitsConsumed: 4321,
          accounts: null,
          replacementBlockhash: {
            blockhash: "Bh",
            lastValidBlockHeight: 5,
          },
        },
      };
    });
    const rpc = createHelioKitRpcReaderFromTransport(transport);

    await expect(rpc.simulateTransactionBase64(WIRE)).resolves.toEqual({
      err: null,
      logs: ["Program log: ok"],
      unitsConsumed: 4321n,
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("simulateTransactionBase64 surfaces a program error (caller fail-closes on it)", async () => {
    const { transport } = createMockTransport((method) => {
      if (method !== "simulateTransaction") {
        throw new Error(`unexpected method ${method}`);
      }
      return {
        context: { slot: 1 },
        value: {
          err: { InstructionError: [0, { Custom: 6001 }] },
          logs: ["Program failed"],
          unitsConsumed: 10,
          accounts: null,
          replacementBlockhash: { blockhash: "Bh", lastValidBlockHeight: 5 },
        },
      };
    });
    const rpc = createHelioKitRpcReaderFromTransport(transport);

    const result = await rpc.simulateTransactionBase64(WIRE);
    // Kit's response pipeline recursively upcasts integers in the `err` payload to
    // bigint. Irrelevant to callers (they fail-close on `err != null` + render logs,
    // not the numeric codes), but the assertion must reflect the real shape.
    expect(result.err).toEqual({ InstructionError: [0n, { Custom: 6001n }] });
    expect(result.logs).toEqual(["Program failed"]);
  });

  it("simulateTransactionBase64 propagates a transport-level (network) failure", async () => {
    const fn = vi.fn(async () => {
      throw new Error("network down");
    });
    const rpc = createHelioKitRpcReaderFromTransport(
      fn as unknown as RpcTransport,
    );

    // Fail-closed: callers must NOT send when simulation cannot run.
    await expect(rpc.simulateTransactionBase64(WIRE)).rejects.toThrow(
      "network down",
    );
  });

  it("sendTransactionBase64 returns the signature", async () => {
    const { transport } = createMockTransport((method) => {
      if (method !== "sendTransaction") {
        throw new Error(`unexpected method ${method}`);
      }
      return "5oVcqHk2cLwY9xY8rTn3PqaWZ2mF8gPzk6sV1bN3dE4t";
    });
    const rpc = createHelioKitRpcReaderFromTransport(transport);

    await expect(rpc.sendTransactionBase64(WIRE)).resolves.toBe(
      "5oVcqHk2cLwY9xY8rTn3PqaWZ2mF8gPzk6sV1bN3dE4t",
    );
  });

  it("getSignatureStatus maps a confirmed status (slot upcast to bigint)", async () => {
    const { transport } = createMockTransport((method) => {
      if (method !== "getSignatureStatuses") {
        throw new Error(`unexpected method ${method}`);
      }
      return {
        context: { slot: 100 },
        value: [
          {
            slot: 99,
            confirmations: null,
            err: null,
            confirmationStatus: "confirmed",
          },
        ],
      };
    });
    const rpc = createHelioKitRpcReaderFromTransport(transport);

    await expect(rpc.getSignatureStatus("5sig")).resolves.toEqual({
      confirmationStatus: "confirmed",
      err: null,
      slot: 99n,
    });
  });

  it("getSignatureStatus returns null for an unknown signature", async () => {
    const { transport } = createMockTransport((method) => {
      if (method !== "getSignatureStatuses") {
        throw new Error(`unexpected method ${method}`);
      }
      return { context: { slot: 100 }, value: [null] };
    });
    const rpc = createHelioKitRpcReaderFromTransport(transport);

    await expect(rpc.getSignatureStatus("5sig")).resolves.toBeNull();
  });
});
