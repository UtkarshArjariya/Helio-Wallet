import { describe, expect, it } from "vitest";

import {
  createInitialWalletWorkflowState,
  createTransactionStatusModel,
  isLikelySolanaAddress,
  validateImportInput,
} from "./wallet-workflow.utils";

describe("wallet-workflow.utils", () => {
  it("creates the loading-first workflow state", () => {
    const state = createInitialWalletWorkflowState();

    expect(state.activeScreen).toBe("loading");
    expect(state.dashboardSnapshot).toBeNull();
  });

  it("validates import input for both supported methods", () => {
    expect(
      validateImportInput(
        "seed-phrase",
        "glow anchor velvet harbor signal quantum lunar cedar ripple ember atlas silver",
      ),
    ).toBe(true);
    expect(validateImportInput("seed-phrase", "too short")).toBe(false);
    expect(
      validateImportInput(
        "private-key",
        "5Z5fRAjQvQWn6SqKJwP9kGmRrQ8LD8QY2g9x4d3LkJ8p",
      ),
    ).toBe(true);
  });

  it("detects likely Solana recipient addresses", () => {
    expect(
      isLikelySolanaAddress("67sN4CYjR1a3vK5WpfRppGhN3VnWui6cKVXfQePk9n5G"),
    ).toBe(true);
    expect(isLikelySolanaAddress("not-an-address")).toBe(false);
  });

  it("creates the final transaction status model", () => {
    expect(
      createTransactionStatusModel({
        explorerLabel: "View on Explorer",
        explorerUrl: null,
        recipientShortAddress: "67sN...9n5G",
        sentAmountDisplay: "1.25 SOL",
        signature: "mock-signature",
        status: "confirmed",
      }),
    ).toEqual({
      explorerLabel: "View on Explorer",
      explorerUrl: null,
      recipientShortAddress: "67sN...9n5G",
      sentAmountDisplay: "1.25 SOL",
      signature: "mock-signature",
      status: "confirmed",
    });
  });
});
