import type { ExtensionRequestMap, ExtensionRequestType } from "@helio/types";

import { createHelioExtensionService } from "./extension-service";
import { createExtensionStorageAdapter } from "./extension-storage";
import { createMockRpcClient } from "./mock-rpc-client";
import { createExtensionRpcClient } from "./runtime-dependencies";

const localRpcClientFactory =
  import.meta.env.MODE === "test" ? createMockRpcClient : createExtensionRpcClient;

const localExtensionService = createHelioExtensionService(
  createExtensionStorageAdapter(),
  localRpcClientFactory,
);

/**
 * Sends a request through the local fallback runtime used in tests and non-Chrome environments.
 *
 * @param type - Extension request type.
 * @param payload - Request payload for the chosen type.
 * @returns Response payload from the local runtime service.
 */
export async function sendLocalExtensionMessage<
  TType extends ExtensionRequestType,
>(
  type: TType,
  payload: ExtensionRequestMap[TType]["request"],
): Promise<ExtensionRequestMap[TType]["response"]> {
  return localExtensionService.handleRequest(type, payload);
}
