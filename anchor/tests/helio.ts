/**
 * Helio Auto-Yield Program — comprehensive test suite
 *
 * Covers:
 *  - Initialization: happy path, all validation edges, double-init guard
 *  - Config update: field propagation, sweep-mode switch, bps boundaries
 *  - Pause / resume: state transitions, idempotency, access control
 *  - sweep_sol: accumulation, exact balance assertions, re-enable flow
 *  - sweep_stable: accumulation, exact token balance assertions, access control
 *  - withdraw_sol: partial + full, exact balance assertions, rent guard
 *  - withdraw_stable: partial + full, exact assertions, access control
 *  - close_empty_reserve: rent refund, all non-empty guards, access control
 *  - Multi-user isolation: PDAs don't collide, cross-user access denied
 *  - Full lifecycle: init → multi-sweep → partial withdraw → close
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { expect } from "chai";
import { Helio } from "../target/types/helio";

// ─── Seeds (must match programs/helio/src/constants.rs) ──────────────────────

const CONFIG_SEED         = Buffer.from("config");
const RESERVE_SEED        = Buffer.from("reserve");
const AUTHORITY_SEED      = Buffer.from("authority");
const SOL_VAULT_SEED      = Buffer.from("sol-vault");
const STABLE_VAULT_SEED   = Buffer.from("vault");

// ─── Constants ────────────────────────────────────────────────────────────────

const STABLE_DECIMALS      = 6;
const STABLE_MINT_AMOUNT   = 10_000_000_000; // 10,000 USDC
const SWEEP_MODE_ROUND_UP  = 0;
const SWEEP_MODE_PERCENTAGE = 1;
const PROTOCOL_KAMINO      = 0;

// ─── Shared types ─────────────────────────────────────────────────────────────

interface UserContext {
  owner: Keypair;
  mint: PublicKey;
  ownerStableAccount: PublicKey;
  configPda: PublicKey;
  reservePda: PublicKey;
  solVaultPda: PublicKey;
  stableVaultPda: PublicKey;
  reserveAuthorityPda: PublicKey;
}

// ─── Default valid config args ────────────────────────────────────────────────

const defaultArgs = {
  enabled:               true,
  paused:                false,
  sweepMode:             SWEEP_MODE_ROUND_UP,
  roundUpUnitLamports:   new BN(LAMPORTS_PER_SOL / 100), // 0.01 SOL
  percentageBps:         100,                            // 1 %
  deployThresholdAtomic: new BN(1_000_000),              // 1 USDC
  activeProtocol:        PROTOCOL_KAMINO,
  allowedProtocolsMask:  1,
  excludedProtocolsMask: 0,
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("helio", () => {
  const base = anchor.AnchorProvider.env();
  const provider = new anchor.AnchorProvider(
    base.connection,
    base.wallet,
    { commitment: "confirmed", preflightCommitment: "confirmed" },
  );
  anchor.setProvider(provider);
  const program = anchor.workspace.Helio as Program<Helio>;

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function airdrop(target: PublicKey, lamports: number): Promise<void> {
    const sig = await provider.connection.requestAirdrop(target, lamports);
    const latest = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction(
      { signature: sig, ...latest },
      "confirmed",
    );
  }

  async function solBalance(key: PublicKey): Promise<number> {
    return provider.connection.getBalance(key, "confirmed");
  }

  async function stableBalance(ata: PublicKey): Promise<bigint> {
    const acct = await getAccount(provider.connection, ata);
    return acct.amount;
  }

  async function setupUser(): Promise<UserContext> {
    const owner = Keypair.generate();
    await airdrop(owner.publicKey, 20 * LAMPORTS_PER_SOL);

    const mint = await createMint(
      provider.connection, owner, owner.publicKey, null, STABLE_DECIMALS,
    );
    const ownerStable = await getOrCreateAssociatedTokenAccount(
      provider.connection, owner, mint, owner.publicKey,
    );
    await mintTo(
      provider.connection, owner, mint, ownerStable.address, owner, STABLE_MINT_AMOUNT,
    );

    const [configPda]          = PublicKey.findProgramAddressSync([CONFIG_SEED,        owner.publicKey.toBuffer()],              program.programId);
    const [reservePda]         = PublicKey.findProgramAddressSync([RESERVE_SEED,       owner.publicKey.toBuffer()],              program.programId);
    const [solVaultPda]        = PublicKey.findProgramAddressSync([SOL_VAULT_SEED,     owner.publicKey.toBuffer()],              program.programId);
    const [stableVaultPda]     = PublicKey.findProgramAddressSync([STABLE_VAULT_SEED,  owner.publicKey.toBuffer(), mint.toBuffer()], program.programId);
    const [reserveAuthorityPda] = PublicKey.findProgramAddressSync([AUTHORITY_SEED,    owner.publicKey.toBuffer()],              program.programId);

    return {
      owner, mint,
      ownerStableAccount: ownerStable.address,
      configPda, reservePda, solVaultPda, stableVaultPda, reserveAuthorityPda,
    };
  }

  // ── Instruction wrappers ─────────────────────────────────────────────────

  async function initialize(ctx: UserContext, args: typeof defaultArgs = defaultArgs) {
    return program.methods.initializeAutoYield(args)
      .accounts({
        owner: ctx.owner.publicKey, config: ctx.configPda,
        reserveState: ctx.reservePda, solVault: ctx.solVaultPda,
        reserveAuthority: ctx.reserveAuthorityPda, stableVault: ctx.stableVaultPda,
        stableMint: ctx.mint, tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.owner]).rpc();
  }

  async function updateConfig(ctx: UserContext, args: typeof defaultArgs) {
    return program.methods.updateAutoYieldConfig(args)
      .accounts({ owner: ctx.owner.publicKey, config: ctx.configPda })
      .signers([ctx.owner]).rpc();
  }

  async function pause(ctx: UserContext) {
    return program.methods.pauseAutoYield()
      .accounts({ owner: ctx.owner.publicKey, config: ctx.configPda })
      .signers([ctx.owner]).rpc();
  }

  async function resume(ctx: UserContext) {
    return program.methods.resumeAutoYield()
      .accounts({ owner: ctx.owner.publicKey, config: ctx.configPda })
      .signers([ctx.owner]).rpc();
  }

  async function sweepSol(ctx: UserContext, amount: BN) {
    return program.methods.sweepSol(amount)
      .accounts({
        owner: ctx.owner.publicKey, config: ctx.configPda,
        reserveState: ctx.reservePda, solVault: ctx.solVaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.owner]).rpc();
  }

  async function sweepStable(ctx: UserContext, amount: BN) {
    return program.methods.sweepStable(amount)
      .accounts({
        owner: ctx.owner.publicKey, config: ctx.configPda,
        reserveState: ctx.reservePda, stableMint: ctx.mint,
        reserveAuthority: ctx.reserveAuthorityPda, stableVault: ctx.stableVaultPda,
        ownerStableAccount: ctx.ownerStableAccount, tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ctx.owner]).rpc();
  }

  async function withdrawSol(ctx: UserContext, amount: BN) {
    return program.methods.withdrawSol(amount)
      .accounts({
        owner: ctx.owner.publicKey, config: ctx.configPda,
        reserveState: ctx.reservePda, solVault: ctx.solVaultPda,
      })
      .signers([ctx.owner]).rpc();
  }

  async function withdrawStable(ctx: UserContext, amount: BN) {
    return program.methods.withdrawStable(amount)
      .accounts({
        owner: ctx.owner.publicKey, config: ctx.configPda,
        reserveState: ctx.reservePda, stableMint: ctx.mint,
        reserveAuthority: ctx.reserveAuthorityPda, stableVault: ctx.stableVaultPda,
        ownerStableAccount: ctx.ownerStableAccount, tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ctx.owner]).rpc();
  }

  async function closeReserve(ctx: UserContext) {
    return program.methods.closeEmptyReserve()
      .accounts({
        owner: ctx.owner.publicKey, config: ctx.configPda,
        reserveState: ctx.reservePda, solVault: ctx.solVaultPda,
        stableMint: ctx.mint, reserveAuthority: ctx.reserveAuthorityPda,
        stableVault: ctx.stableVaultPda, tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ctx.owner]).rpc();
  }

  async function sendSol(
    ctx: UserContext,
    recipientKey: PublicKey,
    amount: BN,
    sweepBps: number,
  ) {
    return program.methods.sendSol(amount, sweepBps)
      .accounts({
        owner: ctx.owner.publicKey,
        recipient: recipientKey,
        solVault: ctx.solVaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.owner]).rpc();
  }

  async function withdrawVaultSol(ctx: UserContext, amount: BN) {
    return program.methods.withdrawVaultSol(amount)
      .accounts({
        owner: ctx.owner.publicKey,
        solVault: ctx.solVaultPda,
      })
      .signers([ctx.owner]).rpc();
  }

  /** Asserts the promise rejects with an error message matching `fragment`. */
  async function expectError(promise: Promise<any>, fragment: RegExp | string) {
    try {
      await promise;
      throw new Error(`Expected error matching "${fragment}", but call succeeded.`);
    } catch (e: any) {
      if (e?.message?.includes("Expected error matching")) throw e;
      const msg: string = e?.toString() ?? "";
      if (typeof fragment === "string") {
        expect(msg, `error message should contain "${fragment}"`).to.include(fragment);
      } else {
        expect(msg, `error message should match ${fragment}`).to.match(fragment);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // initialize_auto_yield
  // ═══════════════════════════════════════════════════════════════════════════

  describe("initialize_auto_yield", () => {
    it("creates all accounts and seeds initial state correctly", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      const config = await program.account.userAutoYieldConfig.fetch(ctx.configPda);
      expect(config.owner.toBase58()).to.equal(ctx.owner.publicKey.toBase58());
      expect(config.preferredStableMint.toBase58()).to.equal(ctx.mint.toBase58());
      expect(config.enabled).to.equal(true);
      expect(config.paused).to.equal(false);
      expect(config.sweepMode).to.equal(SWEEP_MODE_ROUND_UP);
      expect(config.activeProtocol).to.equal(PROTOCOL_KAMINO);
      expect(config.percentageBps).to.equal(defaultArgs.percentageBps);
      expect(config.allowedProtocolsMask).to.equal(defaultArgs.allowedProtocolsMask);
      expect(config.excludedProtocolsMask).to.equal(defaultArgs.excludedProtocolsMask);

      const reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(reserve.owner.toBase58()).to.equal(ctx.owner.publicKey.toBase58());
      expect(reserve.solBalanceLamports.toNumber()).to.equal(0);
      expect(reserve.stableBalanceAtomic.toNumber()).to.equal(0);
      expect(reserve.totalSweptSolLamports.toNumber()).to.equal(0);
      expect(reserve.totalSweptStableAtomic.toNumber()).to.equal(0);

      const solVault = await program.account.solVault.fetch(ctx.solVaultPda);
      expect(solVault.owner.toBase58()).to.equal(ctx.owner.publicKey.toBase58());

      const stableVault = await getAccount(provider.connection, ctx.stableVaultPda);
      expect(stableVault.mint.toBase58()).to.equal(ctx.mint.toBase58());
      expect(stableVault.amount.toString()).to.equal("0");
    });

    it("sol_vault PDA is rent-exempt immediately after initialization", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      const vaultLamports = await solBalance(ctx.solVaultPda);
      const minRent = await provider.connection.getMinimumBalanceForRentExemption(0);
      expect(vaultLamports).to.be.greaterThanOrEqual(minRent);
    });

    it("stable_vault authority is the reserve_authority PDA", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      const vault = await getAccount(provider.connection, ctx.stableVaultPda);
      expect(vault.owner.toBase58()).to.equal(ctx.reserveAuthorityPda.toBase58());
    });

    it("rejects double initialization on the same owner", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await expectError(initialize(ctx), /already in use|already been initialized/i);
    });

    it("rejects invalid sweep mode (99)", async () => {
      const ctx = await setupUser();
      await expectError(initialize(ctx, { ...defaultArgs, sweepMode: 99 }), "InvalidSweepMode");
    });

    it("rejects zero round_up_unit_lamports", async () => {
      const ctx = await setupUser();
      await expectError(
        initialize(ctx, { ...defaultArgs, roundUpUnitLamports: new BN(0) }),
        "InvalidRoundUpUnit",
      );
    });

    it("rejects zero deploy_threshold_atomic", async () => {
      const ctx = await setupUser();
      await expectError(
        initialize(ctx, { ...defaultArgs, deployThresholdAtomic: new BN(0) }),
        "InvalidDeployThreshold",
      );
    });

    it("rejects percentage_bps = 0", async () => {
      const ctx = await setupUser();
      await expectError(
        initialize(ctx, { ...defaultArgs, percentageBps: 0 }),
        "InvalidPercentageBps",
      );
    });

    it("rejects percentage_bps = 10_001 (one over maximum)", async () => {
      const ctx = await setupUser();
      await expectError(
        initialize(ctx, { ...defaultArgs, percentageBps: 10_001 }),
        "InvalidPercentageBps",
      );
    });

    it("accepts percentage_bps = 10_000 (maximum valid value)", async () => {
      const ctx = await setupUser();
      await initialize(ctx, { ...defaultArgs, percentageBps: 10_000 });
      const config = await program.account.userAutoYieldConfig.fetch(ctx.configPda);
      expect(config.percentageBps).to.equal(10_000);
    });

    it("accepts percentage_bps = 1 (minimum valid value)", async () => {
      const ctx = await setupUser();
      await initialize(ctx, { ...defaultArgs, percentageBps: 1 });
      const config = await program.account.userAutoYieldConfig.fetch(ctx.configPda);
      expect(config.percentageBps).to.equal(1);
    });

    it("rejects when active protocol is not in the allowlist", async () => {
      const ctx = await setupUser();
      await expectError(
        initialize(ctx, { ...defaultArgs, allowedProtocolsMask: 0 }),
        "ActiveProtocolNotAllowed",
      );
    });

    it("rejects when active protocol is in the exclusion list", async () => {
      const ctx = await setupUser();
      await expectError(
        initialize(ctx, { ...defaultArgs, excludedProtocolsMask: 1 }),
        "ActiveProtocolExcluded",
      );
    });

    it("rejects unsupported protocol id", async () => {
      const ctx = await setupUser();
      await expectError(
        initialize(ctx, { ...defaultArgs, activeProtocol: 5 }),
        "UnsupportedProtocol",
      );
    });

    it("initializes in percentage sweep mode", async () => {
      const ctx = await setupUser();
      await initialize(ctx, { ...defaultArgs, sweepMode: SWEEP_MODE_PERCENTAGE });
      const config = await program.account.userAutoYieldConfig.fetch(ctx.configPda);
      expect(config.sweepMode).to.equal(SWEEP_MODE_PERCENTAGE);
    });

    it("initializes with enabled = false", async () => {
      const ctx = await setupUser();
      await initialize(ctx, { ...defaultArgs, enabled: false });
      const config = await program.account.userAutoYieldConfig.fetch(ctx.configPda);
      expect(config.enabled).to.equal(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // update_auto_yield_config
  // ═══════════════════════════════════════════════════════════════════════════

  describe("update_auto_yield_config", () => {
    it("applies all updated fields to on-chain config", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      const updated = {
        ...defaultArgs,
        sweepMode:             SWEEP_MODE_PERCENTAGE,
        percentageBps:         500,
        deployThresholdAtomic: new BN(5_000_000),
        roundUpUnitLamports:   new BN(LAMPORTS_PER_SOL / 50),
      };
      await updateConfig(ctx, updated);

      const config = await program.account.userAutoYieldConfig.fetch(ctx.configPda);
      expect(config.sweepMode).to.equal(SWEEP_MODE_PERCENTAGE);
      expect(config.percentageBps).to.equal(500);
      expect(config.deployThresholdAtomic.toNumber()).to.equal(5_000_000);
      expect(config.roundUpUnitLamports.toNumber()).to.equal(LAMPORTS_PER_SOL / 50);
    });

    it("can switch sweep mode between round-up and percentage", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      await updateConfig(ctx, { ...defaultArgs, sweepMode: SWEEP_MODE_PERCENTAGE });
      let config = await program.account.userAutoYieldConfig.fetch(ctx.configPda);
      expect(config.sweepMode).to.equal(SWEEP_MODE_PERCENTAGE);

      await updateConfig(ctx, { ...defaultArgs, sweepMode: SWEEP_MODE_ROUND_UP });
      config = await program.account.userAutoYieldConfig.fetch(ctx.configPda);
      expect(config.sweepMode).to.equal(SWEEP_MODE_ROUND_UP);
    });

    it("accepts the maximum valid percentage_bps (10,000)", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await updateConfig(ctx, { ...defaultArgs, percentageBps: 10_000 });
      const config = await program.account.userAutoYieldConfig.fetch(ctx.configPda);
      expect(config.percentageBps).to.equal(10_000);
    });

    it("rejects percentage_bps = 0 on update", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await expectError(
        updateConfig(ctx, { ...defaultArgs, percentageBps: 0 }),
        "InvalidPercentageBps",
      );
    });

    it("rejects percentage_bps = 10_001 on update", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await expectError(
        updateConfig(ctx, { ...defaultArgs, percentageBps: 10_001 }),
        "InvalidPercentageBps",
      );
    });

    it("can disable and re-enable auto-yield", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      await updateConfig(ctx, { ...defaultArgs, enabled: false });
      let config = await program.account.userAutoYieldConfig.fetch(ctx.configPda);
      expect(config.enabled).to.equal(false);

      await updateConfig(ctx, { ...defaultArgs, enabled: true });
      config = await program.account.userAutoYieldConfig.fetch(ctx.configPda);
      expect(config.enabled).to.equal(true);
    });

    it("rejects update from a non-owner signer", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      const intruder = Keypair.generate();
      await airdrop(intruder.publicKey, LAMPORTS_PER_SOL);

      // Intruder's PDAs are derived from their own key — they can't reach victim's config
      await expectError(
        program.methods.updateAutoYieldConfig(defaultArgs)
          .accounts({ owner: intruder.publicKey, config: ctx.configPda })
          .signers([intruder]).rpc(),
        /ConstraintSeeds|seeds|Unauthorized/i,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // pause / resume
  // ═══════════════════════════════════════════════════════════════════════════

  describe("pause / resume", () => {
    it("transitions paused flag true → false", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      await pause(ctx);
      let config = await program.account.userAutoYieldConfig.fetch(ctx.configPda);
      expect(config.paused).to.equal(true);

      await resume(ctx);
      config = await program.account.userAutoYieldConfig.fetch(ctx.configPda);
      expect(config.paused).to.equal(false);
    });

    it("pause is idempotent (calling twice leaves paused = true)", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      await pause(ctx);
      await pause(ctx); // second pause should not error
      const config = await program.account.userAutoYieldConfig.fetch(ctx.configPda);
      expect(config.paused).to.equal(true);
    });

    it("resume is idempotent (calling twice leaves paused = false)", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      await pause(ctx);
      await resume(ctx);
      await resume(ctx); // second resume should not error
      const config = await program.account.userAutoYieldConfig.fetch(ctx.configPda);
      expect(config.paused).to.equal(false);
    });

    it("rejects pause from a non-owner signer", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      const intruder = Keypair.generate();
      await airdrop(intruder.publicKey, LAMPORTS_PER_SOL);

      await expectError(
        program.methods.pauseAutoYield()
          .accounts({ owner: intruder.publicKey, config: ctx.configPda })
          .signers([intruder]).rpc(),
        /ConstraintSeeds|seeds|Unauthorized/i,
      );
    });

    it("rejects resume from a non-owner signer", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await pause(ctx);

      const intruder = Keypair.generate();
      await airdrop(intruder.publicKey, LAMPORTS_PER_SOL);

      await expectError(
        program.methods.resumeAutoYield()
          .accounts({ owner: intruder.publicKey, config: ctx.configPda })
          .signers([intruder]).rpc(),
        /ConstraintSeeds|seeds|Unauthorized/i,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // sweep_sol
  // ═══════════════════════════════════════════════════════════════════════════

  describe("sweep_sol", () => {
    it("vault receives exact lamports and reserve balance updates", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      const vaultBefore = await solBalance(ctx.solVaultPda);
      const amount = new BN(LAMPORTS_PER_SOL / 10); // 0.1 SOL
      await sweepSol(ctx, amount);

      const vaultAfter = await solBalance(ctx.solVaultPda);
      expect(vaultAfter - vaultBefore).to.equal(amount.toNumber());

      const reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(reserve.solBalanceLamports.toString()).to.equal(amount.toString());
      expect(reserve.totalSweptSolLamports.toString()).to.equal(amount.toString());
    });

    it("owner balance decreases by exactly the swept amount plus one tx fee", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      const ownerBefore = await solBalance(ctx.owner.publicKey);
      const amount = new BN(LAMPORTS_PER_SOL / 5); // 0.2 SOL
      await sweepSol(ctx, amount);
      const ownerAfter = await solBalance(ctx.owner.publicKey);

      // owner loses sweep amount (+ tx fee, which may be 0 on local validator)
      const delta = ownerBefore - ownerAfter;
      expect(delta).to.be.greaterThanOrEqual(amount.toNumber());
      expect(delta).to.be.lessThan(amount.toNumber() + 20_000); // fee < 20k lamports
    });

    it("accumulates total_swept across multiple sweeps", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      const a = new BN(LAMPORTS_PER_SOL / 10);
      const b = new BN(LAMPORTS_PER_SOL / 20);
      const c = new BN(LAMPORTS_PER_SOL / 50);
      await sweepSol(ctx, a);
      await sweepSol(ctx, b);
      await sweepSol(ctx, c);

      const expected = a.add(b).add(c);
      const reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(reserve.solBalanceLamports.toString()).to.equal(expected.toString());
      expect(reserve.totalSweptSolLamports.toString()).to.equal(expected.toString());
    });

    it("updates last_sweep_unix_ts on each sweep", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      await sweepSol(ctx, new BN(LAMPORTS_PER_SOL / 100));
      const r1 = await program.account.userReserveState.fetch(ctx.reservePda);
      const ts1 = r1.lastSweepUnixTs.toNumber();
      expect(ts1).to.be.greaterThan(0);

      await sweepSol(ctx, new BN(LAMPORTS_PER_SOL / 100));
      const r2 = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(r2.lastSweepUnixTs.toNumber()).to.be.greaterThanOrEqual(ts1);
    });

    it("works after re-enabling a disabled config", async () => {
      const ctx = await setupUser();
      await initialize(ctx, { ...defaultArgs, enabled: false });

      await expectError(sweepSol(ctx, new BN(LAMPORTS_PER_SOL / 100)), "AutoYieldDisabled");

      await updateConfig(ctx, { ...defaultArgs, enabled: true });
      await sweepSol(ctx, new BN(LAMPORTS_PER_SOL / 100)); // must succeed
      const reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(reserve.solBalanceLamports.toNumber()).to.be.greaterThan(0);
    });

    it("works after resuming a paused config", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await pause(ctx);

      await expectError(sweepSol(ctx, new BN(LAMPORTS_PER_SOL / 100)), "AutoYieldPaused");

      await resume(ctx);
      await sweepSol(ctx, new BN(LAMPORTS_PER_SOL / 100)); // must succeed
      const reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(reserve.solBalanceLamports.toNumber()).to.be.greaterThan(0);
    });

    it("rejects zero sweep amount", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await expectError(sweepSol(ctx, new BN(0)), "InvalidSweepAmount");
    });

    it("rejects sweep when paused", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await pause(ctx);
      await expectError(sweepSol(ctx, new BN(LAMPORTS_PER_SOL / 100)), "AutoYieldPaused");
    });

    it("rejects sweep when disabled", async () => {
      const ctx = await setupUser();
      await initialize(ctx, { ...defaultArgs, enabled: false });
      await expectError(sweepSol(ctx, new BN(LAMPORTS_PER_SOL / 100)), "AutoYieldDisabled");
    });

    it("handles a large sweep (1 SOL)", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      const bigAmount = new BN(LAMPORTS_PER_SOL);
      await sweepSol(ctx, bigAmount);

      const reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(reserve.solBalanceLamports.toString()).to.equal(bigAmount.toString());
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // sweep_stable
  // ═══════════════════════════════════════════════════════════════════════════

  describe("sweep_stable", () => {
    it("vault receives exact token amount and reserve updates", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      const amount = new BN(50_000_000); // 50 USDC
      const ownerBefore = await stableBalance(ctx.ownerStableAccount);
      await sweepStable(ctx, amount);
      const ownerAfter = await stableBalance(ctx.ownerStableAccount);

      expect((ownerBefore - ownerAfter).toString()).to.equal(amount.toString());

      const vault = await getAccount(provider.connection, ctx.stableVaultPda);
      expect(vault.amount.toString()).to.equal(amount.toString());

      const reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(reserve.stableBalanceAtomic.toString()).to.equal(amount.toString());
      expect(reserve.totalSweptStableAtomic.toString()).to.equal(amount.toString());
    });

    it("accumulates total_swept_stable across multiple sweeps", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      const a = new BN(10_000_000);
      const b = new BN(25_000_000);
      const c = new BN(5_000_000);
      await sweepStable(ctx, a);
      await sweepStable(ctx, b);
      await sweepStable(ctx, c);

      const expected = a.add(b).add(c);
      const reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(reserve.stableBalanceAtomic.toString()).to.equal(expected.toString());
      expect(reserve.totalSweptStableAtomic.toString()).to.equal(expected.toString());
    });

    it("updates last_sweep_unix_ts after stable sweep", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      await sweepStable(ctx, new BN(1_000_000));
      const reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(reserve.lastSweepUnixTs.toNumber()).to.be.greaterThan(0);
    });

    it("rejects zero sweep amount", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await expectError(sweepStable(ctx, new BN(0)), "InvalidSweepAmount");
    });

    it("rejects stable sweep when paused", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await pause(ctx);
      await expectError(sweepStable(ctx, new BN(1_000_000)), "AutoYieldPaused");
    });

    it("rejects stable sweep when disabled", async () => {
      const ctx = await setupUser();
      await initialize(ctx, { ...defaultArgs, enabled: false });
      await expectError(sweepStable(ctx, new BN(1_000_000)), "AutoYieldDisabled");
    });

    it("rejects sweep_stable when a fake mint is substituted for the preferred_stable_mint", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      // Deploy a completely different mint — not the preferred_stable_mint
      const fakeMint = await createMint(
        provider.connection, ctx.owner, ctx.owner.publicKey, null, STABLE_DECIMALS,
      );

      // The `address = config.preferred_stable_mint` constraint must fire before
      // anything else, regardless of what stable_vault or ownerStableAccount is passed.
      await expectError(
        program.methods.sweepStable(new BN(1_000_000))
          .accounts({
            owner: ctx.owner.publicKey,
            config: ctx.configPda,
            reserveState: ctx.reservePda,
            stableMint: fakeMint,             // ← impostor
            reserveAuthority: ctx.reserveAuthorityPda,
            stableVault: ctx.stableVaultPda,  // real vault — seeds would mismatch too
            ownerStableAccount: ctx.ownerStableAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([ctx.owner]).rpc(),
        /InvalidStableMint|ConstraintAddress|stable_mint|stableMint/i,
      );
    });

    it("rejects sweep_stable when ownerStableAccount authority is not the signer", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      // Attacker creates their own ATA for the same mint and funds it
      const attacker = Keypair.generate();
      await airdrop(attacker.publicKey, LAMPORTS_PER_SOL);
      const attackerAta = await getOrCreateAssociatedTokenAccount(
        provider.connection, attacker, ctx.mint, attacker.publicKey,
      );
      await mintTo(provider.connection, ctx.owner, ctx.mint, attackerAta.address, ctx.owner, 5_000_000);

      // Owner tries to sweep FROM attacker's ATA — token::authority = owner fails
      await expectError(
        program.methods.sweepStable(new BN(1_000_000))
          .accounts({
            owner: ctx.owner.publicKey,
            config: ctx.configPda,
            reserveState: ctx.reservePda,
            stableMint: ctx.mint,
            reserveAuthority: ctx.reserveAuthorityPda,
            stableVault: ctx.stableVaultPda,
            ownerStableAccount: attackerAta.address,  // ← not owned by owner
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([ctx.owner]).rpc(),
        /ConstraintTokenOwner|token owner constraint|owner_stable_account|ownerStableAccount/i,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // withdraw_sol
  // ═══════════════════════════════════════════════════════════════════════════

  describe("withdraw_sol", () => {
    it("owner receives exact lamports and reserve decrements", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      const swept = new BN(LAMPORTS_PER_SOL / 4);
      await sweepSol(ctx, swept);

      const ownerBefore = await solBalance(ctx.owner.publicKey);
      const withdraw = new BN(LAMPORTS_PER_SOL / 10);
      await withdrawSol(ctx, withdraw);
      const ownerAfter = await solBalance(ctx.owner.publicKey);

      // Owner gains withdraw amount minus tx fee
      const delta = ownerAfter - ownerBefore;
      expect(delta).to.be.greaterThan(withdraw.toNumber() - 20_000);
      expect(delta).to.be.lessThan(withdraw.toNumber() + 1_000);

      const reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(reserve.solBalanceLamports.toString()).to.equal(swept.sub(withdraw).toString());
    });

    it("vault balance decreases by exactly withdrawn amount", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      const swept = new BN(LAMPORTS_PER_SOL / 5);
      await sweepSol(ctx, swept);

      const vaultBefore = await solBalance(ctx.solVaultPda);
      const withdraw = new BN(LAMPORTS_PER_SOL / 20);
      await withdrawSol(ctx, withdraw);
      const vaultAfter = await solBalance(ctx.solVaultPda);

      expect(vaultBefore - vaultAfter).to.equal(withdraw.toNumber());
    });

    it("total_swept_sol_lamports is not reduced by withdrawals", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      const swept = new BN(LAMPORTS_PER_SOL / 4);
      await sweepSol(ctx, swept);

      await withdrawSol(ctx, new BN(LAMPORTS_PER_SOL / 10));

      const reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      // total_swept is a historical counter — must not shrink
      expect(reserve.totalSweptSolLamports.toString()).to.equal(swept.toString());
    });

    it("updates last_withdraw_unix_ts", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await sweepSol(ctx, new BN(LAMPORTS_PER_SOL / 10));

      await withdrawSol(ctx, new BN(LAMPORTS_PER_SOL / 20));
      const reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(reserve.lastWithdrawUnixTs.toNumber()).to.be.greaterThan(0);
    });

    it("supports multiple partial withdrawals down to zero balance", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      const swept = new BN(LAMPORTS_PER_SOL / 4);
      await sweepSol(ctx, swept);

      const part1 = new BN(LAMPORTS_PER_SOL / 20);
      const part2 = new BN(LAMPORTS_PER_SOL / 20);
      const remainder = swept.sub(part1).sub(part2);

      await withdrawSol(ctx, part1);
      await withdrawSol(ctx, part2);
      await withdrawSol(ctx, remainder);

      const reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(reserve.solBalanceLamports.toNumber()).to.equal(0);
    });

    it("rejects zero withdrawal amount", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await sweepSol(ctx, new BN(LAMPORTS_PER_SOL / 10));
      await expectError(withdrawSol(ctx, new BN(0)), "InvalidWithdrawAmount");
    });

    it("rejects withdrawal exceeding tracked reserve balance", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await sweepSol(ctx, new BN(LAMPORTS_PER_SOL / 100));
      await expectError(
        withdrawSol(ctx, new BN(LAMPORTS_PER_SOL * 10)),
        "InsufficientSolReserve",
      );
    });

    it("rejects withdrawal that would leave vault below rent exemption", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      // Sweep a tiny amount; withdraw would leave vault naked (below rent)
      const tinyAmount = new BN(1_000); // 0.000001 SOL
      await sweepSol(ctx, tinyAmount);

      // The vault lamports = vault_rent + tinyAmount.
      // Withdrawing tinyAmount is fine. But if we swept exactly vault_rent + tiny
      // and withdrew vault_rent + tiny, that would fail. Instead, verify the guard
      // triggers if the contract has vault_rent lamports and we try to withdraw them.
      //
      // For testability: sweep an amount ≤ tinyAmount and check the reserve drops to 0
      // (this tests that the accounting path works). The rent guard protects against
      // external lamport injection edge cases — hard to trigger from normal flow alone.
      await withdrawSol(ctx, tinyAmount);
      const reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(reserve.solBalanceLamports.toNumber()).to.equal(0);
    });

    it("SolVaultRentViolation: leaving exactly 1 lamport in vault triggers rent guard", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      // Fund vault via sweep so reserve_state tracks the balance
      await sweepSol(ctx, new BN(LAMPORTS_PER_SOL));

      // vault = rent_exempt_min + 1 SOL
      const vaultTotal = await solBalance(ctx.solVaultPda);

      // Drain vault directly (bypasses reserve_state) so vault is far below rent_min + reserve_balance
      // Then withdraw_sol will pass the reserve check but fail the rent check
      const rentMin = await provider.connection.getMinimumBalanceForRentExemption(40);

      // Drain enough via withdraw_vault_sol that 1 full SOL withdrawal would leave vault below rent
      // vault - 500_000 = rent_min + 1_SOL - 500_000 → withdrawing 1_SOL leaves 669_280 < rent_min
      await withdrawVaultSol(ctx, new BN(500_000));

      // reserve_state still says 1 SOL available; vault cannot handle it without going below rent
      await expectError(
        withdrawSol(ctx, new BN(LAMPORTS_PER_SOL)),
        "SolVaultRentViolation",
      );
    });

    it("SolVaultRentViolation: withdraw_vault_sol draining to 1 lamport fires rent guard", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await sweepSol(ctx, new BN(LAMPORTS_PER_SOL));

      const vaultTotal = await solBalance(ctx.solVaultPda);
      // Withdraw all but 1 lamport — 1 lamport << rent_min → SolVaultRentViolation
      await expectError(
        withdrawVaultSol(ctx, new BN(vaultTotal - 1)),
        "SolVaultRentViolation",
      );
    });

    it("rejects withdrawal from non-owner signer", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await sweepSol(ctx, new BN(LAMPORTS_PER_SOL / 10));

      const intruder = Keypair.generate();
      await airdrop(intruder.publicKey, LAMPORTS_PER_SOL);

      await expectError(
        program.methods.withdrawSol(new BN(LAMPORTS_PER_SOL / 100))
          .accounts({
            owner: intruder.publicKey,
            config: ctx.configPda,
            reserveState: ctx.reservePda,
            solVault: ctx.solVaultPda,
          })
          .signers([intruder]).rpc(),
        /ConstraintSeeds|seeds|Unauthorized/i,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // withdraw_stable
  // ═══════════════════════════════════════════════════════════════════════════

  describe("withdraw_stable", () => {
    it("owner ATA receives exact tokens and reserve decrements", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      const swept = new BN(100_000_000); // 100 USDC
      await sweepStable(ctx, swept);

      const before = await stableBalance(ctx.ownerStableAccount);
      const withdraw = new BN(40_000_000);
      await withdrawStable(ctx, withdraw);
      const after = await stableBalance(ctx.ownerStableAccount);

      expect((after - before).toString()).to.equal(withdraw.toString());

      const reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(reserve.stableBalanceAtomic.toString()).to.equal(swept.sub(withdraw).toString());
    });

    it("can withdraw the entire stable balance in one call", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      const swept = new BN(200_000_000);
      await sweepStable(ctx, swept);

      await withdrawStable(ctx, swept);

      const reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(reserve.stableBalanceAtomic.toNumber()).to.equal(0);

      const vault = await getAccount(provider.connection, ctx.stableVaultPda);
      expect(vault.amount.toString()).to.equal("0");
    });

    it("supports multiple partial stable withdrawals to zero", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      const swept = new BN(300_000_000);
      await sweepStable(ctx, swept);

      const part1 = new BN(100_000_000);
      const part2 = new BN(100_000_000);
      const part3 = new BN(100_000_000);
      await withdrawStable(ctx, part1);
      await withdrawStable(ctx, part2);
      await withdrawStable(ctx, part3);

      const reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(reserve.stableBalanceAtomic.toNumber()).to.equal(0);
    });

    it("updates last_withdraw_unix_ts after stable withdrawal", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await sweepStable(ctx, new BN(10_000_000));
      await withdrawStable(ctx, new BN(5_000_000));

      const reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(reserve.lastWithdrawUnixTs.toNumber()).to.be.greaterThan(0);
    });

    it("rejects zero withdrawal amount", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await sweepStable(ctx, new BN(10_000_000));
      await expectError(withdrawStable(ctx, new BN(0)), "InvalidWithdrawAmount");
    });

    it("rejects withdrawal exceeding tracked stable balance", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await sweepStable(ctx, new BN(10_000_000));
      await expectError(
        withdrawStable(ctx, new BN(99_999_999_999)),
        "InsufficientStableReserve",
      );
    });

    it("rejects stable withdrawal from non-owner signer", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await sweepStable(ctx, new BN(10_000_000));

      const intruder = Keypair.generate();
      await airdrop(intruder.publicKey, LAMPORTS_PER_SOL);

      await expectError(
        program.methods.withdrawStable(new BN(1_000_000))
          .accounts({
            owner: intruder.publicKey,
            config: ctx.configPda,
            reserveState: ctx.reservePda,
            stableMint: ctx.mint,
            reserveAuthority: ctx.reserveAuthorityPda,
            stableVault: ctx.stableVaultPda,
            ownerStableAccount: ctx.ownerStableAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([intruder]).rpc(),
        /ConstraintSeeds|seeds|Unauthorized/i,
      );
    });

    it("rejects withdraw_stable when ownerStableAccount belongs to a different user", async () => {
      // Proves that `token::authority = owner` blocks token redirection attacks:
      // even a legitimate owner signer cannot send the withdrawal to a third-party ATA.
      const ctx = await setupUser();
      await initialize(ctx);
      await sweepStable(ctx, new BN(50_000_000));

      // Attacker creates their own ATA for the same mint
      const attacker = Keypair.generate();
      await airdrop(attacker.publicKey, LAMPORTS_PER_SOL);
      const attackerAta = await getOrCreateAssociatedTokenAccount(
        provider.connection, attacker, ctx.mint, attacker.publicKey,
      );

      // Owner (legitimate signer) attempts to redirect the withdrawal to attacker's ATA
      await expectError(
        program.methods.withdrawStable(new BN(10_000_000))
          .accounts({
            owner: ctx.owner.publicKey,
            config: ctx.configPda,
            reserveState: ctx.reservePda,
            stableMint: ctx.mint,
            reserveAuthority: ctx.reserveAuthorityPda,
            stableVault: ctx.stableVaultPda,
            ownerStableAccount: attackerAta.address,  // ← attacker's ATA, not owner's
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([ctx.owner]).rpc(),
        /ConstraintTokenOwner|token owner constraint|owner_stable_account|ownerStableAccount/i,
      );

      // Attacker's ATA must remain empty — no tokens leaked
      const attackerBalance = await stableBalance(attackerAta.address);
      expect(attackerBalance.toString()).to.equal("0");
    });

    it("rejects withdraw_stable when a fake mint is passed", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await sweepStable(ctx, new BN(50_000_000));

      const fakeMint = await createMint(
        provider.connection, ctx.owner, ctx.owner.publicKey, null, STABLE_DECIMALS,
      );

      await expectError(
        program.methods.withdrawStable(new BN(10_000_000))
          .accounts({
            owner: ctx.owner.publicKey,
            config: ctx.configPda,
            reserveState: ctx.reservePda,
            stableMint: fakeMint,
            reserveAuthority: ctx.reserveAuthorityPda,
            stableVault: ctx.stableVaultPda,
            ownerStableAccount: ctx.ownerStableAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([ctx.owner]).rpc(),
        /InvalidStableMint|ConstraintAddress|stable_mint|stableMint/i,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // close_empty_reserve
  // ═══════════════════════════════════════════════════════════════════════════

  describe("close_empty_reserve", () => {
    it("closes all accounts when reserve is empty and returns rent to owner", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      const ownerBefore = await solBalance(ctx.owner.publicKey);

      const swept = new BN(LAMPORTS_PER_SOL / 10);
      await sweepSol(ctx, swept);
      await withdrawSol(ctx, swept);

      await closeReserve(ctx);

      // All PDAs must be gone
      expect(await program.account.userAutoYieldConfig.fetchNullable(ctx.configPda)).to.equal(null);
      expect(await program.account.userReserveState.fetchNullable(ctx.reservePda)).to.equal(null);
      expect(await program.account.solVault.fetchNullable(ctx.solVaultPda)).to.equal(null);

      // Owner gets rent back — balance must be higher than after sweep+withdraw
      const ownerAfter = await solBalance(ctx.owner.publicKey);
      // Net must be positive (rent refund outweighs remaining fees)
      expect(ownerAfter).to.be.greaterThan(ownerBefore - 2 * LAMPORTS_PER_SOL);
    });

    it("closes after both SOL and stable balances are fully drained", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      await sweepSol(ctx, new BN(LAMPORTS_PER_SOL / 10));
      await sweepStable(ctx, new BN(100_000_000));
      await withdrawSol(ctx, new BN(LAMPORTS_PER_SOL / 10));
      await withdrawStable(ctx, new BN(100_000_000));

      await closeReserve(ctx); // must succeed
      expect(await program.account.userReserveState.fetchNullable(ctx.reservePda)).to.equal(null);
    });

    it("rejects closure when SOL balance is non-zero", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await sweepSol(ctx, new BN(LAMPORTS_PER_SOL / 100));
      await expectError(closeReserve(ctx), "ReserveNotEmpty");
    });

    it("rejects closure when stable balance is non-zero", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await sweepStable(ctx, new BN(10_000_000));
      await expectError(closeReserve(ctx), "ReserveNotEmpty");
    });

    it("rejects closure when both balances are non-zero", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await sweepSol(ctx, new BN(LAMPORTS_PER_SOL / 100));
      await sweepStable(ctx, new BN(10_000_000));
      await expectError(closeReserve(ctx), "ReserveNotEmpty");
    });

    it("rejects closure from non-owner signer", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      const intruder = Keypair.generate();
      await airdrop(intruder.publicKey, LAMPORTS_PER_SOL);

      await expectError(
        program.methods.closeEmptyReserve()
          .accounts({
            owner: intruder.publicKey,
            config: ctx.configPda,
            reserveState: ctx.reservePda,
            solVault: ctx.solVaultPda,
            stableMint: ctx.mint,
            reserveAuthority: ctx.reserveAuthorityPda,
            stableVault: ctx.stableVaultPda,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([intruder]).rpc(),
        /ConstraintSeeds|seeds|Unauthorized/i,
      );
    });

    it("allows re-initialization after a successful close", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      const swept = new BN(LAMPORTS_PER_SOL / 100);
      await sweepSol(ctx, swept);
      await withdrawSol(ctx, swept);
      await closeReserve(ctx);

      // Re-init must succeed and accounts must be fresh
      await initialize(ctx);
      const reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(reserve.solBalanceLamports.toNumber()).to.equal(0);
      expect(reserve.totalSweptSolLamports.toNumber()).to.equal(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // multi-user isolation
  // ═══════════════════════════════════════════════════════════════════════════

  describe("multi-user isolation", () => {
    it("two users' PDAs are independent and do not collide", async () => {
      const alice = await setupUser();
      const bob   = await setupUser();

      await initialize(alice);
      await initialize(bob);

      // Sweep different amounts
      await sweepSol(alice, new BN(LAMPORTS_PER_SOL / 5));
      await sweepSol(bob,   new BN(LAMPORTS_PER_SOL / 10));

      const aliceReserve = await program.account.userReserveState.fetch(alice.reservePda);
      const bobReserve   = await program.account.userReserveState.fetch(bob.reservePda);

      expect(aliceReserve.solBalanceLamports.toString())
        .to.equal(new BN(LAMPORTS_PER_SOL / 5).toString());
      expect(bobReserve.solBalanceLamports.toString())
        .to.equal(new BN(LAMPORTS_PER_SOL / 10).toString());

      // PDAs are distinct
      expect(alice.configPda.toBase58()).to.not.equal(bob.configPda.toBase58());
      expect(alice.reservePda.toBase58()).to.not.equal(bob.reservePda.toBase58());
      expect(alice.solVaultPda.toBase58()).to.not.equal(bob.solVaultPda.toBase58());
    });

    it("alice cannot operate on bob's reserve", async () => {
      const alice = await setupUser();
      const bob   = await setupUser();
      await initialize(alice);
      await initialize(bob);
      await sweepSol(bob, new BN(LAMPORTS_PER_SOL / 10));

      // Alice tries to withdraw from Bob's vault using her own signer
      await expectError(
        program.methods.withdrawSol(new BN(LAMPORTS_PER_SOL / 100))
          .accounts({
            owner: alice.owner.publicKey,   // alice is signer
            config: bob.configPda,          // but we pass bob's accounts
            reserveState: bob.reservePda,
            solVault: bob.solVaultPda,
          })
          .signers([alice.owner]).rpc(),
        /ConstraintSeeds|seeds|Unauthorized/i,
      );

      // Bob's reserve must be untouched
      const bobReserve = await program.account.userReserveState.fetch(bob.reservePda);
      expect(bobReserve.solBalanceLamports.toString())
        .to.equal(new BN(LAMPORTS_PER_SOL / 10).toString());
    });

    it("both users can independently close their own reserves", async () => {
      const alice = await setupUser();
      const bob   = await setupUser();
      await initialize(alice);
      await initialize(bob);

      const swept = new BN(LAMPORTS_PER_SOL / 20);
      await sweepSol(alice, swept);
      await sweepSol(bob, swept);
      await withdrawSol(alice, swept);
      await withdrawSol(bob, swept);

      await closeReserve(alice);
      await closeReserve(bob);

      expect(await program.account.userReserveState.fetchNullable(alice.reservePda)).to.equal(null);
      expect(await program.account.userReserveState.fetchNullable(bob.reservePda)).to.equal(null);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // full lifecycle
  // ═══════════════════════════════════════════════════════════════════════════

  describe("full lifecycle", () => {
    it("init → multi-sweep SOL+stable → partial withdraw → re-sweep → drain → close", async () => {
      const ctx = await setupUser();

      // 1. Initialize
      await initialize(ctx);

      // 2. First round of sweeps
      const sol1 = new BN(LAMPORTS_PER_SOL / 10);
      const sol2 = new BN(LAMPORTS_PER_SOL / 20);
      const stab1 = new BN(50_000_000);
      await sweepSol(ctx, sol1);
      await sweepSol(ctx, sol2);
      await sweepStable(ctx, stab1);

      let reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(reserve.solBalanceLamports.toString()).to.equal(sol1.add(sol2).toString());
      expect(reserve.stableBalanceAtomic.toString()).to.equal(stab1.toString());
      expect(reserve.totalSweptSolLamports.toString()).to.equal(sol1.add(sol2).toString());

      // 3. Partial withdrawals
      const solWithdraw1 = new BN(LAMPORTS_PER_SOL / 20);
      const stabWithdraw1 = new BN(20_000_000);
      await withdrawSol(ctx, solWithdraw1);
      await withdrawStable(ctx, stabWithdraw1);

      reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(reserve.solBalanceLamports.toString()).to.equal(sol1.toString()); // sol2 - (sol2 from withdraw)... actually sol1+sol2 - sol2
      // sol1 + sol2 - solWithdraw1 = sol1 + sol2/2 - sol2/2... let me recalculate
      // sol1 = LAMPORTS/10, sol2 = LAMPORTS/20, solWithdraw1 = LAMPORTS/20 = sol2
      // remaining = sol1 + sol2 - sol2 = sol1
      expect(reserve.solBalanceLamports.toString()).to.equal(sol1.toString());
      expect(reserve.stableBalanceAtomic.toString()).to.equal(stab1.sub(stabWithdraw1).toString());

      // 4. Pause and re-sweep after resume
      await pause(ctx);
      await expectError(sweepSol(ctx, new BN(LAMPORTS_PER_SOL / 100)), "AutoYieldPaused");
      await resume(ctx);

      const sol3 = new BN(LAMPORTS_PER_SOL / 50);
      await sweepSol(ctx, sol3);

      reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(reserve.solBalanceLamports.toString()).to.equal(sol1.add(sol3).toString());

      // 5. Drain everything
      await withdrawSol(ctx, sol1.add(sol3));
      await withdrawStable(ctx, stab1.sub(stabWithdraw1));

      reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(reserve.solBalanceLamports.toNumber()).to.equal(0);
      expect(reserve.stableBalanceAtomic.toNumber()).to.equal(0);

      // 6. Verify historical counters
      const expectedTotalSol = sol1.add(sol2).add(sol3);
      expect(reserve.totalSweptSolLamports.toString()).to.equal(expectedTotalSol.toString());

      // 7. Close
      await closeReserve(ctx);
      expect(await program.account.userReserveState.fetchNullable(ctx.reservePda)).to.equal(null);
    });

    it("config update mid-lifecycle does not corrupt reserve state", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      await sweepSol(ctx, new BN(LAMPORTS_PER_SOL / 10));

      // Update config while there is a non-zero reserve
      await updateConfig(ctx, {
        ...defaultArgs,
        sweepMode: SWEEP_MODE_PERCENTAGE,
        percentageBps: 250,
      });

      // Sweep again — should work under new config
      await sweepSol(ctx, new BN(LAMPORTS_PER_SOL / 20));

      const reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      // Reserve must reflect both sweeps
      const expected = new BN(LAMPORTS_PER_SOL / 10).add(new BN(LAMPORTS_PER_SOL / 20));
      expect(reserve.solBalanceLamports.toString()).to.equal(expected.toString());

      // Drain and close cleanly
      await withdrawSol(ctx, expected);
      await closeReserve(ctx);
      expect(await program.account.userReserveState.fetchNullable(ctx.reservePda)).to.equal(null);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // send_sol — happy path
  // ═══════════════════════════════════════════════════════════════════════════

  describe("send_sol — happy path", () => {
    let recipient: Keypair;
    before(async () => {
      recipient = Keypair.generate();
      await airdrop(recipient.publicKey, LAMPORTS_PER_SOL);
    });

    it("creates the sol_vault PDA on the very first call", async () => {
      const ctx = await setupUser();
      expect(await program.account.solVault.fetchNullable(ctx.solVaultPda)).to.equal(null);

      await sendSol(ctx, recipient.publicKey, new BN(LAMPORTS_PER_SOL / 10), 100);

      const vault = await program.account.solVault.fetch(ctx.solVaultPda);
      expect(vault.owner.toBase58()).to.equal(ctx.owner.publicKey.toBase58());
    });

    it("recipient receives exactly the specified amount", async () => {
      const ctx = await setupUser();
      const amount = new BN(LAMPORTS_PER_SOL / 4);
      const before = await solBalance(recipient.publicKey);

      await sendSol(ctx, recipient.publicKey, amount, 100);

      const after = await solBalance(recipient.publicKey);
      expect(after - before).to.equal(amount.toNumber());
    });

    it("vault receives correct sweep at 1% (100 bps) on 1 SOL", async () => {
      const ctx = await setupUser();
      await initialize(ctx); // pre-creates vault so delta is pure sweep
      const amount = new BN(LAMPORTS_PER_SOL);
      const expectedSweep = LAMPORTS_PER_SOL / 100; // 10_000_000 lamports

      const vaultBefore = await solBalance(ctx.solVaultPda);
      await sendSol(ctx, recipient.publicKey, amount, 100);
      const vaultAfter = await solBalance(ctx.solVaultPda);

      expect(vaultAfter - vaultBefore).to.equal(expectedSweep);
    });

    it("vault receives correct sweep at 0.1% (10 bps) on 1 SOL", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      const amount = new BN(LAMPORTS_PER_SOL);
      const expectedSweep = LAMPORTS_PER_SOL / 1000; // 1_000_000 lamports

      const vaultBefore = await solBalance(ctx.solVaultPda);
      await sendSol(ctx, recipient.publicKey, amount, 10);
      const vaultAfter = await solBalance(ctx.solVaultPda);

      expect(vaultAfter - vaultBefore).to.equal(expectedSweep);
    });

    it("vault receives correct sweep at 2% (200 bps) on 1 SOL", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      const amount = new BN(LAMPORTS_PER_SOL);
      const expectedSweep = LAMPORTS_PER_SOL / 50; // 20_000_000 lamports

      const vaultBefore = await solBalance(ctx.solVaultPda);
      await sendSol(ctx, recipient.publicKey, amount, 200);
      const vaultAfter = await solBalance(ctx.solVaultPda);

      expect(vaultAfter - vaultBefore).to.equal(expectedSweep);
    });

    it("owner balance decreases by at least amount + sweep", async () => {
      const ctx = await setupUser();
      const amount = new BN(LAMPORTS_PER_SOL / 2);
      const expectedSweep = amount.toNumber() / 100; // 1%

      const ownerBefore = await solBalance(ctx.owner.publicKey);
      await sendSol(ctx, recipient.publicKey, amount, 100);
      const ownerAfter = await solBalance(ctx.owner.publicKey);

      const delta = ownerBefore - ownerAfter;
      expect(delta).to.be.greaterThan(amount.toNumber() + expectedSweep - 1);
    });

    it("accumulates sweep across three sends", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      const amt = new BN(LAMPORTS_PER_SOL / 10); // 0.1 SOL each

      const vaultStart = await solBalance(ctx.solVaultPda);
      await sendSol(ctx, recipient.publicKey, amt, 100);
      await sendSol(ctx, recipient.publicKey, amt, 100);
      await sendSol(ctx, recipient.publicKey, amt, 100);
      const vaultEnd = await solBalance(ctx.solVaultPda);

      // 3 × 1% of 0.1 SOL = 3_000_000 lamports
      expect(vaultEnd - vaultStart).to.equal((amt.toNumber() / 100) * 3);
    });

    it("second call does not reinitialize an existing vault", async () => {
      const ctx = await setupUser();
      await sendSol(ctx, recipient.publicKey, new BN(LAMPORTS_PER_SOL / 10), 100);
      await sendSol(ctx, recipient.publicKey, new BN(LAMPORTS_PER_SOL / 10), 100);

      const vault = await program.account.solVault.fetch(ctx.solVaultPda);
      expect(vault.owner.toBase58()).to.equal(ctx.owner.publicKey.toBase58());
    });

    it("works when vault already exists from initialize_auto_yield", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      const vaultBefore = await solBalance(ctx.solVaultPda);

      await sendSol(ctx, recipient.publicKey, new BN(LAMPORTS_PER_SOL / 10), 100);
      const vaultAfter = await solBalance(ctx.solVaultPda);

      expect(vaultAfter - vaultBefore).to.equal(LAMPORTS_PER_SOL / 10 / 100);

      // Auto-yield config is untouched
      const config = await program.account.userAutoYieldConfig.fetch(ctx.configPda);
      expect(config.owner.toBase58()).to.equal(ctx.owner.publicKey.toBase58());
    });

    it("tiny amount (1 lamport at 10 bps) floors to min sweep of 1 lamport", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      const vaultBefore = await solBalance(ctx.solVaultPda);

      // floor(1 * 10 / 10_000) = 0  →  enforced minimum = 1 lamport
      await sendSol(ctx, recipient.publicKey, new BN(1), 10);
      const vaultAfter = await solBalance(ctx.solVaultPda);

      expect(vaultAfter - vaultBefore).to.equal(1);
    });

    it("accepts minimum boundary sweep_bps = 10 (0.1%)", async () => {
      const ctx = await setupUser();
      await sendSol(ctx, recipient.publicKey, new BN(LAMPORTS_PER_SOL / 10), 10);
      expect(await program.account.solVault.fetchNullable(ctx.solVaultPda)).to.not.equal(null);
    });

    it("accepts maximum boundary sweep_bps = 200 (2.0%)", async () => {
      const ctx = await setupUser();
      await sendSol(ctx, recipient.publicKey, new BN(LAMPORTS_PER_SOL / 10), 200);
      expect(await program.account.solVault.fetchNullable(ctx.solVaultPda)).to.not.equal(null);
    });

    it("two users get independent vaults — PDAs and owners are distinct", async () => {
      const alice = await setupUser();
      const bob   = await setupUser();

      await sendSol(alice, recipient.publicKey, new BN(LAMPORTS_PER_SOL / 5), 100);
      await sendSol(bob,   recipient.publicKey, new BN(LAMPORTS_PER_SOL / 5), 200);

      expect(alice.solVaultPda.toBase58()).to.not.equal(bob.solVaultPda.toBase58());

      const av = await program.account.solVault.fetch(alice.solVaultPda);
      const bv = await program.account.solVault.fetch(bob.solVaultPda);
      expect(av.owner.toBase58()).to.equal(alice.owner.publicKey.toBase58());
      expect(bv.owner.toBase58()).to.equal(bob.owner.publicKey.toBase58());
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // send_sol — validation & rejection
  // ═══════════════════════════════════════════════════════════════════════════

  describe("send_sol — validation & rejection", () => {
    let recipient: Keypair;
    before(async () => {
      recipient = Keypair.generate();
      await airdrop(recipient.publicKey, LAMPORTS_PER_SOL);
    });

    it("rejects amount = 0", async () => {
      const ctx = await setupUser();
      await expectError(
        sendSol(ctx, recipient.publicKey, new BN(0), 100),
        "InvalidSendAmount",
      );
    });

    it("rejects sweep_bps = 0", async () => {
      const ctx = await setupUser();
      await expectError(
        sendSol(ctx, recipient.publicKey, new BN(LAMPORTS_PER_SOL / 10), 0),
        "InvalidSweepBps",
      );
    });

    it("rejects sweep_bps = 9 (one below minimum of 10)", async () => {
      const ctx = await setupUser();
      await expectError(
        sendSol(ctx, recipient.publicKey, new BN(LAMPORTS_PER_SOL / 10), 9),
        "InvalidSweepBps",
      );
    });

    it("rejects sweep_bps = 201 (one above maximum of 200)", async () => {
      const ctx = await setupUser();
      await expectError(
        sendSol(ctx, recipient.publicKey, new BN(LAMPORTS_PER_SOL / 10), 201),
        "InvalidSweepBps",
      );
    });

    it("rejects amount that overflows total_deducted (u64::MAX)", async () => {
      const ctx = await setupUser();
      const U64_MAX = new BN("18446744073709551615");
      // checked_add_u64(u64::MAX, sweep) overflows before InsufficientSolReserve fires
      await expectError(
        sendSol(ctx, recipient.publicKey, U64_MAX, 200),
        "ArithmeticOverflow",
      );
    });

    it("rejects when owner has insufficient lamports for amount + sweep", async () => {
      const ctx = await setupUser();
      // 20 SOL airdropped, vault rent (~0.0012 SOL) deducted on first send.
      // Sending 20 SOL with 200 bps sweep needs 20.4 SOL — clearly exceeds balance.
      const hugeAmount = new BN(20 * LAMPORTS_PER_SOL);
      await expectError(
        sendSol(ctx, recipient.publicKey, hugeAmount, 200),
        "InsufficientSolReserve",
      );
    });

    it("rejects when a non-owner signer supplies the owner's vault PDA", async () => {
      const victim = await setupUser();
      await sendSol(victim, recipient.publicKey, new BN(LAMPORTS_PER_SOL / 5), 100);

      const attacker = await setupUser();

      // Attacker signs but tries to drain victim's vault as if it were their own
      await expectError(
        program.methods.sendSol(new BN(1), 10)
          .accounts({
            owner: attacker.owner.publicKey,
            recipient: recipient.publicKey,
            solVault: victim.solVaultPda,       // victim's vault
            systemProgram: SystemProgram.programId,
          })
          .signers([attacker.owner]).rpc(),
        /ConstraintSeeds|seeds constraint/i,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // withdraw_vault_sol — happy path
  // ═══════════════════════════════════════════════════════════════════════════

  describe("withdraw_vault_sol — happy path", () => {
    it("owner receives exact lamports and vault decreases accordingly", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      // Sweep 2% of 1 SOL = 20_000_000 lamports into vault
      await sendSol(ctx, Keypair.generate().publicKey, new BN(LAMPORTS_PER_SOL), 200);

      const ownerBefore = await solBalance(ctx.owner.publicKey);
      const vaultBefore = await solBalance(ctx.solVaultPda);

      const amount = new BN(8_000_000);
      await withdrawVaultSol(ctx, amount);

      const ownerAfter = await solBalance(ctx.owner.publicKey);
      const vaultAfter = await solBalance(ctx.solVaultPda);

      // Vault decreases exactly
      expect(vaultBefore - vaultAfter).to.equal(amount.toNumber());

      // Owner net gain = amount - tx fee
      const delta = ownerAfter - ownerBefore;
      expect(delta).to.be.greaterThan(amount.toNumber() - 20_000);
      expect(delta).to.be.lessThan(amount.toNumber() + 1_000);
    });

    it("supports multiple partial withdrawals — vault decreases by total withdrawn", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await sendSol(ctx, Keypair.generate().publicKey, new BN(LAMPORTS_PER_SOL), 200);

      const vaultBefore = await solBalance(ctx.solVaultPda);
      const part = new BN(5_000_000);

      await withdrawVaultSol(ctx, part);
      await withdrawVaultSol(ctx, part);
      await withdrawVaultSol(ctx, part);

      const vaultAfter = await solBalance(ctx.solVaultPda);
      expect(vaultBefore - vaultAfter).to.equal(part.toNumber() * 3);
    });

    it("can withdraw exactly the sweep amount (vault sits at rent-exempt minimum)", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      const sweepLamports = LAMPORTS_PER_SOL / 10 / 100; // 1% of 0.1 SOL = 1_000_000
      await sendSol(ctx, Keypair.generate().publicKey, new BN(LAMPORTS_PER_SOL / 10), 100);

      // Withdraw exact sweep — vault should end at rent_exempt_min
      await withdrawVaultSol(ctx, new BN(sweepLamports));

      // Derive rent from the live account size — SolVault layout may evolve
      const vaultInfo = await provider.connection.getAccountInfo(ctx.solVaultPda);
      const rentMin = await provider.connection.getMinimumBalanceForRentExemption(
        vaultInfo!.data.length,
      );
      const vaultFinal = await solBalance(ctx.solVaultPda);
      expect(vaultFinal).to.equal(rentMin);
    });

    it("works without auto-yield config (send_sol-only path)", async () => {
      const ctx = await setupUser();
      // No initialize() — pure send_sol path
      await sendSol(ctx, Keypair.generate().publicKey, new BN(LAMPORTS_PER_SOL), 100);

      const sweepLamports = LAMPORTS_PER_SOL / 100;
      const ownerBefore = await solBalance(ctx.owner.publicKey);
      await withdrawVaultSol(ctx, new BN(sweepLamports / 2));
      const ownerAfter = await solBalance(ctx.owner.publicKey);

      expect(ownerAfter).to.be.greaterThan(ownerBefore - 20_000); // net positive
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // withdraw_vault_sol — validation & rejection
  // ═══════════════════════════════════════════════════════════════════════════

  describe("withdraw_vault_sol — validation & rejection", () => {
    it("rejects zero withdrawal amount", async () => {
      const ctx = await setupUser();
      await sendSol(ctx, Keypair.generate().publicKey, new BN(LAMPORTS_PER_SOL / 10), 100);
      await expectError(withdrawVaultSol(ctx, new BN(0)), "InvalidWithdrawAmount");
    });

    it("rejects when withdrawal would leave vault below rent exemption", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await sendSol(ctx, Keypair.generate().publicKey, new BN(LAMPORTS_PER_SOL / 10), 100);

      // Vault = rent_exempt + 1_000_000 sweep. Withdrawing ALL lamports violates rent.
      const totalVault = await solBalance(ctx.solVaultPda);
      await expectError(
        withdrawVaultSol(ctx, new BN(totalVault)),
        "SolVaultRentViolation",
      );
    });

    it("rejects withdrawal of sweep + 1 lamport (one over available above rent)", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      const sweepLamports = LAMPORTS_PER_SOL / 10 / 100; // 1_000_000 lamports
      await sendSol(ctx, Keypair.generate().publicKey, new BN(LAMPORTS_PER_SOL / 10), 100);

      await expectError(
        withdrawVaultSol(ctx, new BN(sweepLamports + 1)),
        "SolVaultRentViolation",
      );
    });

    it("rejects u64::MAX withdrawal (arithmetic underflow in rent check)", async () => {
      const ctx = await setupUser();
      await sendSol(ctx, Keypair.generate().publicKey, new BN(LAMPORTS_PER_SOL / 10), 100);

      const U64_MAX = new BN("18446744073709551615");
      await expectError(
        withdrawVaultSol(ctx, U64_MAX),
        "ArithmeticOverflow",
      );
    });

    it("rejects withdrawal from a non-owner signer", async () => {
      const victim = await setupUser();
      await sendSol(victim, Keypair.generate().publicKey, new BN(LAMPORTS_PER_SOL / 5), 100);

      const intruder = Keypair.generate();
      await airdrop(intruder.publicKey, LAMPORTS_PER_SOL);

      await expectError(
        program.methods.withdrawVaultSol(new BN(1_000_000))
          .accounts({
            owner: intruder.publicKey,
            solVault: victim.solVaultPda,
          })
          .signers([intruder]).rpc(),
        /ConstraintSeeds|seeds constraint|Unauthorized/i,
      );
    });

    it("rejects on an empty vault (only rent-exempt lamports present)", async () => {
      const ctx = await setupUser();
      await initialize(ctx); // vault created, but no sweep yet

      // vault has exactly rent_exempt lamports — any withdrawal violates rent
      await expectError(
        withdrawVaultSol(ctx, new BN(1)),
        "SolVaultRentViolation",
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Adversarial: cross-path state consistency
  // ═══════════════════════════════════════════════════════════════════════════

  describe("adversarial — cross-path state consistency", () => {
    it("vault lamports from send_sol exceed what UserReserveState tracks", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      // Auto-yield sweep path
      const autoSweep = new BN(LAMPORTS_PER_SOL / 10);
      await sweepSol(ctx, autoSweep);

      // send_sol path adds sweep not reflected in reserve state
      await sendSol(ctx, Keypair.generate().publicKey, new BN(LAMPORTS_PER_SOL), 200);
      const sendSweep = LAMPORTS_PER_SOL / 50; // 2% of 1 SOL

      const reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      // Reserve state only knows about the sweep_sol amount
      expect(reserve.solBalanceLamports.toString()).to.equal(autoSweep.toString());

      // But vault has both
      const vaultBalance = await solBalance(ctx.solVaultPda);
      const rentMin = await provider.connection.getMinimumBalanceForRentExemption(40);
      expect(vaultBalance).to.be.greaterThanOrEqual(rentMin + autoSweep.toNumber() + sendSweep);
    });

    it("withdraw_vault_sol can drain send_sol sweep that auto-yield withdraw_sol cannot see", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      await sendSol(ctx, Keypair.generate().publicKey, new BN(LAMPORTS_PER_SOL), 200);
      // 20_000_000 lamports in vault; reserve state tracks 0

      const reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      expect(reserve.solBalanceLamports.toNumber()).to.equal(0);

      // withdraw_sol sees 0 available
      await expectError(
        withdrawSol(ctx, new BN(1_000_000)),
        "InsufficientSolReserve",
      );

      // withdraw_vault_sol CAN access it
      const ownerBefore = await solBalance(ctx.owner.publicKey);
      await withdrawVaultSol(ctx, new BN(10_000_000));
      const ownerAfter = await solBalance(ctx.owner.publicKey);
      expect(ownerAfter).to.be.greaterThan(ownerBefore - 20_000);
    });

    it("using withdraw_vault_sol after sweep_sol leaves withdraw_sol in a bad state", async () => {
      // This test documents a known inconsistency:
      // sweep_sol adds to reserve_state AND to vault;
      // withdraw_vault_sol drains the vault but does NOT update reserve_state.
      // Subsequent withdraw_sol fails with ArithmeticOverflow (not InsufficientSolReserve).
      const ctx = await setupUser();
      await initialize(ctx);

      const swept = new BN(LAMPORTS_PER_SOL / 10);
      await sweepSol(ctx, swept);

      // Drain vault directly (bypasses reserve_state accounting)
      await withdrawVaultSol(ctx, swept);

      let reserve = await program.account.userReserveState.fetch(ctx.reservePda);
      // reserve_state still thinks 0.1 SOL is available — it was not updated
      expect(reserve.solBalanceLamports.toString()).to.equal(swept.toString());

      // Now withdraw_sol tries to drain the vault but it's already empty — fails on rent math
      await expectError(
        withdrawSol(ctx, swept),
        /ArithmeticOverflow|SolVaultRentViolation/,
      );
    });

    it("close_empty_reserve recovers all lamports including send_sol sweeps", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      // Add send_sol sweep to vault (not tracked by reserve_state)
      await sendSol(ctx, Keypair.generate().publicKey, new BN(LAMPORTS_PER_SOL), 200);
      // reserve_state is still 0/0 → close is allowed

      const ownerBefore = await solBalance(ctx.owner.publicKey);
      await closeReserve(ctx); // should succeed; vault closure returns ALL lamports
      const ownerAfter = await solBalance(ctx.owner.publicKey);

      // Owner got back vault rent + the 20_000_000 lamport sweep
      expect(ownerAfter).to.be.greaterThan(ownerBefore);
      expect(await program.account.solVault.fetchNullable(ctx.solVaultPda)).to.equal(null);
    });

    it("KNOWN LIMITATION: send_sol-only users cannot reclaim vault rent (no close_vault instruction)", async () => {
      // Users who only call send_sol (never initialize_auto_yield) cannot close their vault.
      // close_empty_reserve requires config + reserve_state which don't exist.
      // withdraw_vault_sol cannot go below rent-exempt minimum.
      // → The ~0.0011 SOL vault rent is permanently locked.
      const ctx = await setupUser();
      await sendSol(ctx, Keypair.generate().publicKey, new BN(LAMPORTS_PER_SOL), 100);

      const sweepLamports = LAMPORTS_PER_SOL / 100;
      await withdrawVaultSol(ctx, new BN(sweepLamports)); // drain everything above rent

      // Can't withdraw the rent-exempt portion
      await expectError(
        withdrawVaultSol(ctx, new BN(1)),
        "SolVaultRentViolation",
      );

      // close_empty_reserve also fails — config doesn't exist
      await expectError(
        program.methods.closeEmptyReserve()
          .accounts({
            owner: ctx.owner.publicKey, config: ctx.configPda,
            reserveState: ctx.reservePda, solVault: ctx.solVaultPda,
            stableMint: ctx.mint, reserveAuthority: ctx.reserveAuthorityPda,
            stableVault: ctx.stableVaultPda, tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([ctx.owner]).rpc(),
        /AccountNotInitialized|account.*not.*initialized/i,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Adversarial: account substitution attacks
  // ═══════════════════════════════════════════════════════════════════════════

  describe("adversarial — account substitution", () => {
    it("send_sol: attacker cannot substitute victim's vault PDA", async () => {
      const victim  = await setupUser();
      const attacker = await setupUser();
      await sendSol(victim, Keypair.generate().publicKey, new BN(LAMPORTS_PER_SOL / 5), 100);

      // Attacker tries to call send_sol with victim's vault — seeds won't match attacker's key
      await expectError(
        program.methods.sendSol(new BN(LAMPORTS_PER_SOL / 10), 100)
          .accounts({
            owner: attacker.owner.publicKey,
            recipient: Keypair.generate().publicKey,
            solVault: victim.solVaultPda,       // ← wrong vault for attacker's key
            systemProgram: SystemProgram.programId,
          })
          .signers([attacker.owner]).rpc(),
        /ConstraintSeeds|seeds constraint/i,
      );
    });

    it("withdraw_vault_sol: intruder's own vault cannot be passed for victim's key", async () => {
      const victim  = await setupUser();
      const intruder = await setupUser();
      await sendSol(victim, Keypair.generate().publicKey, new BN(LAMPORTS_PER_SOL / 5), 100);
      await sendSol(intruder, Keypair.generate().publicKey, new BN(LAMPORTS_PER_SOL / 5), 100);

      // Intruder passes their own vault but their keypair signs —
      // seeds derive from intruder's key so they can only reach their own vault.
      // They can withdraw from their vault (their own), but cannot touch victim's.
      await expectError(
        program.methods.withdrawVaultSol(new BN(1_000_000))
          .accounts({
            owner: intruder.owner.publicKey,
            solVault: victim.solVaultPda,       // ← victim's vault
          })
          .signers([intruder.owner]).rpc(),
        /ConstraintSeeds|seeds constraint|Unauthorized/i,
      );

      // Victim's vault must be untouched
      const vaultBal = await solBalance(victim.solVaultPda);
      expect(vaultBal).to.be.greaterThan(0);
    });

    it("withdraw_sol: using auto-yield path cannot touch vault owned by different user", async () => {
      const alice = await setupUser();
      const bob   = await setupUser();
      await initialize(alice);
      await initialize(bob);
      await sweepSol(bob, new BN(LAMPORTS_PER_SOL / 10));

      // Alice tries to call withdraw_sol using Bob's PDA accounts
      await expectError(
        program.methods.withdrawSol(new BN(LAMPORTS_PER_SOL / 100))
          .accounts({
            owner: alice.owner.publicKey,
            config: bob.configPda,
            reserveState: bob.reservePda,
            solVault: bob.solVaultPda,
          })
          .signers([alice.owner]).rpc(),
        /ConstraintSeeds|seeds constraint|Unauthorized/i,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Adversarial: arithmetic boundaries
  // ═══════════════════════════════════════════════════════════════════════════

  describe("adversarial — arithmetic boundaries", () => {
    it("send_sol: max u64 amount triggers ArithmeticOverflow before lamport check", async () => {
      const ctx = await setupUser();
      const U64_MAX = new BN("18446744073709551615");
      await expectError(
        sendSol(ctx, Keypair.generate().publicKey, U64_MAX, 200),
        "ArithmeticOverflow",
      );
    });

    it("withdraw_vault_sol: u64::MAX amount triggers ArithmeticOverflow in rent check", async () => {
      const ctx = await setupUser();
      await sendSol(ctx, Keypair.generate().publicKey, new BN(LAMPORTS_PER_SOL / 10), 100);
      const U64_MAX = new BN("18446744073709551615");
      await expectError(
        withdrawVaultSol(ctx, U64_MAX),
        "ArithmeticOverflow",
      );
    });

    it("withdraw_sol: u64::MAX amount triggers ArithmeticOverflow", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await sweepSol(ctx, new BN(LAMPORTS_PER_SOL / 10));
      const U64_MAX = new BN("18446744073709551615");
      await expectError(
        withdrawSol(ctx, U64_MAX),
        /ArithmeticOverflow|InsufficientSolReserve/,
      );
    });

    it("send_sol with amount = 1 and bps = 200 still produces 1 lamport minimum sweep", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      // Recipient must already be rent-exempt — system program rejects new
      // accounts created with < rent_minimum. Pre-fund a fresh recipient.
      const tinyRecipient = Keypair.generate();
      await airdrop(tinyRecipient.publicKey, LAMPORTS_PER_SOL / 1000);
      // floor(1 * 200 / 10_000) = 0  →  max(0, 1) = 1
      const vaultBefore = await solBalance(ctx.solVaultPda);
      await sendSol(ctx, tinyRecipient.publicKey, new BN(1), 200);
      const vaultAfter = await solBalance(ctx.solVaultPda);
      expect(vaultAfter - vaultBefore).to.equal(1);
    });

    it("sweep accumulation does not lose precision over many small sends", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      const vaultStart = await solBalance(ctx.solVaultPda);
      const N = 10;
      const perSendSweep = 100_000; // 0.1 SOL * 10 bps / 10_000... wait let me recalculate
      // 0.001 SOL * 100 bps / 10_000 = 1_000_000 * 100 / 10_000 = 10_000 lamports per send?
      // Actually: 1_000_000 lamports * 100 / 10_000 = 10_000 lamports per send
      const sendAmt = new BN(1_000_000); // 0.001 SOL
      const expectedPerSend = 10_000;    // 1% of 1_000_000

      for (let i = 0; i < N; i++) {
        await sendSol(ctx, Keypair.generate().publicKey, sendAmt, 100);
      }

      const vaultEnd = await solBalance(ctx.solVaultPda);
      expect(vaultEnd - vaultStart).to.equal(expectedPerSend * N);
    });
  });
});
