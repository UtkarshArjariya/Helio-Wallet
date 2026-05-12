import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createJupiterTokensClient,
  JUPITER_TOKENS_BATCH_LIMIT,
  TokenNotFoundError,
} from "./jupiter-tokens-client";

function createJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

function getRequestUrl(fetchMock: ReturnType<typeof vi.fn>, callIndex: number): string {
  const requestInput = fetchMock.mock.calls[callIndex]?.[0];
  if (typeof requestInput === "string") return requestInput;
  return requestInput instanceof URL || requestInput instanceof Request
    ? requestInput.url
    : "";
}

describe("createJupiterTokensClient", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => { vi.stubGlobal("fetch", fetchMock); });
  afterEach(() => { fetchMock.mockReset(); vi.unstubAllGlobals(); });

  it("getToken returns normalized metadata when Jupiter has the mint", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse([
      {
        id: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        name: "USD Coin",
        symbol: "USDC",
        decimals: 6,
        icon: "https://example.com/usdc.png",
        isVerified: true,
        organicScore: 0.94,
        tags: ["verified"],
      },
    ]));

    const client = createJupiterTokensClient({
      apiKey: "jup-key",
      baseUrls: ["https://api.jup.ag"],
    });

    const meta = await client.getToken("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    expect(meta).toMatchObject({
      mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      symbol: "USDC",
      decimals: 6,
      icon: "https://example.com/usdc.png",
      isVerified: true,
    });
    expect(typeof meta.fetchedAt).toBe("string");
    expect(getRequestUrl(fetchMock, 0)).toContain("tokens/v2/search");
  });

  it("getToken throws TokenNotFoundError when Jupiter has no row", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse([]));
    const client = createJupiterTokensClient({ baseUrls: ["https://api.jup.ag"] });
    await expect(client.getToken("NoSuchMint11111111111111111111111111111111"))
      .rejects.toBeInstanceOf(TokenNotFoundError);
  });

  it("getTokens fills missing mints with the fallback object", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse([
      { id: "Found1", symbol: "FND", name: "Found", decimals: 9, isVerified: true },
    ]));
    const client = createJupiterTokensClient({ baseUrls: ["https://api.jup.ag"] });

    const result = await client.getTokens(["Found1", "Missing2"]);
    expect(result.get("Found1")?.symbol).toBe("FND");
    expect(result.get("Missing2")).toMatchObject({
      mint: "Missing2",
      symbol: "—",
      isVerified: false,
    });
  });

  it("getTokens dedupes input mints and batches at the configured cap", async () => {
    // 101 unique mints should produce 2 batches (100 + 1).
    fetchMock
      .mockResolvedValueOnce(createJsonResponse([]))
      .mockResolvedValueOnce(createJsonResponse([]));

    const client = createJupiterTokensClient({ baseUrls: ["https://api.jup.ag"] });

    const mints: string[] = [];
    for (let i = 0; i < JUPITER_TOKENS_BATCH_LIMIT + 1; i++) {
      mints.push(`Mint${i.toString().padStart(40, "0")}`);
    }
    // duplicate one mint twice — must still be 2 fetch calls, not 3.
    await client.getTokens([...mints, mints[0], mints[0]]);

    expect(fetchMock.mock.calls.length).toBe(2);
  });

  it("falls over to the next base URL when the primary fails", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("primary down"))
      .mockResolvedValueOnce(createJsonResponse([
        { id: "FallbackHit1", symbol: "FBH", name: "Fallback", decimals: 9 },
      ]));

    const client = createJupiterTokensClient({
      baseUrls: ["https://api.jup.ag", "https://lite-api.jup.ag"],
    });

    const rows = await client.searchTokens("FallbackHit1");
    expect(rows[0]?.mint).toBe("FallbackHit1");
    expect(getRequestUrl(fetchMock, 0)).toContain("https://api.jup.ag/tokens/v2/search");
    expect(getRequestUrl(fetchMock, 1)).toContain("https://lite-api.jup.ag/tokens/v2/search");
  });

  it("listVerifiedTokens hits the /tokens/v2/tag endpoint with query=verified", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse([
      { id: "Mint1", symbol: "M1", name: "Mint One", decimals: 6, isVerified: true },
    ]));
    const client = createJupiterTokensClient({ baseUrls: ["https://api.jup.ag"] });
    await client.listVerifiedTokens();
    const url = getRequestUrl(fetchMock, 0);
    expect(url).toContain("tokens/v2/tag");
    expect(url).toContain("query=verified");
  });
});
