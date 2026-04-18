import type { NetworkPreference } from "@helio/types";
import { describe, expect, it } from "vitest";

import { resolveRpcEndpointPool } from "@helio/api";

const MAINNET_PREFERENCE: NetworkPreference = {
    commitment: "confirmed",
    customRpcUrl: null,
    selectedNetwork: "mainnet-beta",
};

describe("resolveRpcEndpointPool", () => {
    it("appends default Solana endpoint when custom pool is configured", () => {
        const endpointPool = resolveRpcEndpointPool(MAINNET_PREFERENCE, {
            "mainnet-beta": [
                {
                    label: "Private RPC",
                    network: "mainnet-beta",
                    url: "https://private-rpc.example.com",
                },
            ],
        });

        expect(endpointPool).toHaveLength(2);
        expect(endpointPool[0]?.url).toBe("https://private-rpc.example.com");
        expect(endpointPool[1]?.url).toContain("api.mainnet-beta.solana.com");
        expect(endpointPool[1]?.isFallback).toBe(true);
    });

    it("appends inferred public fallback for custom RPC mode", () => {
        const endpointPool = resolveRpcEndpointPool({
            commitment: "confirmed",
            customRpcUrl: "https://custom-rpc.example.com",
            selectedNetwork: "custom",
        });

        expect(endpointPool[0]).toEqual({
            label: "Custom RPC",
            network: "custom",
            url: "https://custom-rpc.example.com",
        });
        expect(endpointPool[1]?.url).toContain("api.mainnet-beta.solana.com");
        expect(endpointPool[1]?.isFallback).toBe(true);
    });
});
