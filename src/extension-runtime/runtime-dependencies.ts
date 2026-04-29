import {
  createHelioRpcClient,
  createJupiterPriceFeedClient,
  createLocalDappRiskProvider,
  type HelioRpcClient,
  resolveRpcEndpoint,
} from "@helio/api";
import type { RpcEndpointConfig } from "@helio/types";

import type { ExtensionLocalState } from "./extension-storage";
import { getExtensionProviderConfig } from "./provider-config";

const extensionProviderConfig = getExtensionProviderConfig();
const extensionPriceFeedClient = createJupiterPriceFeedClient({
  apiKey: extensionProviderConfig.jupiter.apiKey ?? undefined,
  baseUrls: extensionProviderConfig.jupiter.apiBaseUrls,
});
const extensionRiskProvider = createLocalDappRiskProvider();

/**
 * Creates the production RPC client for the extension runtime with provider failover.
 *
 * @param localState - Current extension state containing the selected network.
 * @returns RPC client backed by configured Solana and Jupiter providers.
 */
export function createExtensionRpcClient(
  localState: ExtensionLocalState,
): HelioRpcClient {
  return createHelioRpcClient(localState.networkPreference, {
    priceFeedClient: extensionPriceFeedClient,
    riskProvider: extensionRiskProvider,
    rpcEndpointPool: extensionProviderConfig.rpcEndpointPool,
  });
}

/**
 * Resolves the extension's active primary RPC endpoint for the current network.
 *
 * @param localState - Current extension state containing the selected network.
 * @returns Active RPC endpoint metadata shown in the runtime snapshot.
 */
export function resolveActiveExtensionRpcEndpoint(
  localState: Pick<ExtensionLocalState, "networkPreference">,
): RpcEndpointConfig {
  return resolveRpcEndpoint(
    localState.networkPreference,
    extensionProviderConfig.rpcEndpointPool,
  );
}

/**
 * Returns whether a Blowfish API key is configured for future transaction risk scanning.
 *
 * @returns Blowfish provider readiness for the extension runtime.
 */
export function getExtensionRiskScannerStatus(): {
  readonly isConfigured: boolean;
  readonly provider: "local";
} {
  return {
    isConfigured: true,
    provider: "local",
  };
}
