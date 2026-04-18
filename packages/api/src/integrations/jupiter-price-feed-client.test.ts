import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createJupiterPriceFeedClient } from "./jupiter-price-feed-client";

function createJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
    status: 200,
  });
}

describe("createJupiterPriceFeedClient", () => {
  const fetchMock = vi.fn<typeof fetch>();

  function getRequestUrl(callIndex: number): string {
    const requestInput = fetchMock.mock.calls[callIndex]?.[0];

    if (typeof requestInput === "string") {
      return requestInput;
    }

    return requestInput instanceof URL || requestInput instanceof Request
      ? requestInput.url
      : "";
  }

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("maps Jupiter price payloads into token price snapshots", async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
          price: 1,
          priceChange24h: 0.02,
        },
      }),
    );
    const priceFeedClient = createJupiterPriceFeedClient({
      apiKey: "jup-key",
      baseUrls: ["https://api.jup.ag"],
    });

    const priceSnapshots = await priceFeedClient.listTokenPrices([
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    ]);

    expect(priceSnapshots).toEqual([
      expect.objectContaining({
        mintAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        usdPrice: 1,
        changePercentage24h: 0.02,
      }),
    ]);
    expect(getRequestUrl(0)).toContain("https://api.jup.ag/price/v3");
  });

  it("falls back to the next Jupiter base URL when the primary request fails", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("primary down"))
      .mockResolvedValueOnce(
        createJsonResponse({
          JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: {
            usdPrice: 1.34,
            priceChange24h: -0.04,
          },
        }),
      );
    const priceFeedClient = createJupiterPriceFeedClient({
      baseUrls: ["https://api.jup.ag", "https://lite-api.jup.ag"],
    });

    const priceSnapshots = await priceFeedClient.listTokenPrices([
      "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    ]);

    expect(priceSnapshots).toEqual([
      expect.objectContaining({
        mintAddress: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
        usdPrice: 1.34,
        changePercentage24h: -0.04,
      }),
    ]);
    expect(getRequestUrl(0)).toContain("https://api.jup.ag/price/v3");
    expect(getRequestUrl(1)).toContain("https://lite-api.jup.ag/price/v3");
  });
});
