import { describe, expect, it } from "vitest";

import {
  resolveRpcEndpoint,
  resolveRpcEndpointPool,
} from "./index";

describe("@helio/api public exports", () => {
  it("exposes the RPC endpoint helpers from the package entrypoint", () => {
    expect(resolveRpcEndpointPool).toBeTypeOf("function");
    expect(resolveRpcEndpoint).toBeTypeOf("function");
  });
});
