import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { describe, expect, it } from "vitest";

import type { HelioCoreError } from "../errors/helio-core-error";
import {
  createStoredMnemonicVault,
  createStoredPrivateKeyVault,
  exportMnemonicWordsFromVault,
  generateWalletMnemonicWords,
  unlockStoredWalletVault,
  validateWalletMnemonicWords,
} from "./wallet-vault";

describe("wallet-vault", () => {
  it("generates a 12-word mnemonic for onboarding", () => {
    const mnemonicWords = generateWalletMnemonicWords();

    expect(mnemonicWords).toHaveLength(12);
    expect(validateWalletMnemonicWords(mnemonicWords)).toBe(true);
  });

  it("creates and unlocks an encrypted mnemonic vault", async () => {
    const mnemonicWords = generateWalletMnemonicWords();
    const vault = await createStoredMnemonicVault(mnemonicWords, "StrongPass1!");
    const unlockedVault = await unlockStoredWalletVault(vault, "StrongPass1!");

    expect(vault.kind).toBe("mnemonic");
    expect(unlockedVault.account.address).toBe(vault.primaryAccount.address);
    expect(unlockedVault.secretKey).toHaveLength(64);
  });

  it("derives the expected Solana account for a known mnemonic", async () => {
    const mnemonicWords =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about".split(
        " ",
      );
    const vault = await createStoredMnemonicVault(mnemonicWords, "StrongPass1!");
    const unlockedVault = await unlockStoredWalletVault(vault, "StrongPass1!");

    expect(unlockedVault.account.address).toBe(
      "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk",
    );
  });

  it("exports mnemonic words after re-authentication", async () => {
    const mnemonicWords = generateWalletMnemonicWords();
    const vault = await createStoredMnemonicVault(mnemonicWords, "StrongPass1!");
    const exportedWords = await exportMnemonicWordsFromVault(
      vault,
      "StrongPass1!",
    );

    expect(exportedWords).toEqual(mnemonicWords);
  });

  it("creates and unlocks an imported private-key vault", async () => {
    const keypair = Keypair.generate();
    const vault = await createStoredPrivateKeyVault(
      bs58.encode(keypair.secretKey),
      "StrongPass1!",
    );
    const unlockedVault = await unlockStoredWalletVault(vault, "StrongPass1!");

    expect(vault.kind).toBe("private-key");
    expect(unlockedVault.account.address).toBe(keypair.publicKey.toBase58());
  });

  it("throws a domain error for an incorrect password", async () => {
    const mnemonicWords = generateWalletMnemonicWords();
    const vault = await createStoredMnemonicVault(mnemonicWords, "StrongPass1!");

    await expect(unlockStoredWalletVault(vault, "WrongPass1")).rejects.toEqual(
      expect.objectContaining<Partial<HelioCoreError>>({
        code: "DECRYPTION_FAILED",
      }),
    );
  });
});
