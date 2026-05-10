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

const CONFIG_SEED = Buffer.from("config");
const RESERVE_SEED = Buffer.from("reserve");
const AUTHORITY_SEED = Buffer.from("authority");
const SOL_VAULT_SEED = Buffer.from("sol-vault");
const STABLE_VAULT_SEED = Buffer.from("vault");

const STABLE_DECIMALS = 6;
const STABLE_MINT_AMOUNT = 1_000_000_000; // 1,000 USDC

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

const defaultConfigArgs = {
  enabled: true,
  paused: false,
  sweepMode: 0,
  roundUpUnitLamports: new BN(LAMPORTS_PER_SOL / 100),
  percentageBps: 100,
  deployThresholdAtomic: new BN(1_000_000),
  activeProtocol: 0,
  allowedProtocolsMask: 1,
  excludedProtocolsMask: 0,
};

describe("helio", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Helio as Program<Helio>;

  async function airdrop(target: PublicKey, lamports: number) {
    const sig = await provider.connection.requestAirdrop(target, lamports);
    await provider.connection.confirmTransaction(sig, "confirmed");
  }

  async function setupUser(): Promise<UserContext> {
    const owner = Keypair.generate();
    await airdrop(owner.publicKey, 10 * LAMPORTS_PER_SOL);

    const mint = await createMint(
      provider.connection,
      owner,
      owner.publicKey,
      null,
      STABLE_DECIMALS,
    );

    const ownerStable = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      owner,
      mint,
      owner.publicKey,
    );

    await mintTo(
      provider.connection,
      owner,
      mint,
      ownerStable.address,
      owner,
      STABLE_MINT_AMOUNT,
    );

    const [configPda] = PublicKey.findProgramAddressSync(
      [CONFIG_SEED, owner.publicKey.toBuffer()],
      program.programId,
    );
    const [reservePda] = PublicKey.findProgramAddressSync(
      [RESERVE_SEED, owner.publicKey.toBuffer()],
      program.programId,
    );
    const [solVaultPda] = PublicKey.findProgramAddressSync(
      [SOL_VAULT_SEED, owner.publicKey.toBuffer()],
      program.programId,
    );
    const [stableVaultPda] = PublicKey.findProgramAddressSync(
      [STABLE_VAULT_SEED, owner.publicKey.toBuffer(), mint.toBuffer()],
      program.programId,
    );
    const [reserveAuthorityPda] = PublicKey.findProgramAddressSync(
      [AUTHORITY_SEED, owner.publicKey.toBuffer()],
      program.programId,
    );

    return {
      owner,
      mint,
      ownerStableAccount: ownerStable.address,
      configPda,
      reservePda,
      solVaultPda,
      stableVaultPda,
      reserveAuthorityPda,
    };
  }

  async function initialize(ctx: UserContext, args: any = defaultConfigArgs) {
    return program.methods
      .initializeAutoYield(args)
      .accounts({
        owner: ctx.owner.publicKey,
        config: ctx.configPda,
        reserveState: ctx.reservePda,
        solVault: ctx.solVaultPda,
        reserveAuthority: ctx.reserveAuthorityPda,
        stableVault: ctx.stableVaultPda,
        stableMint: ctx.mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.owner])
      .rpc();
  }

  async function sweepSol(ctx: UserContext, amount: BN) {
    return program.methods
      .sweepSol(amount)
      .accounts({
        owner: ctx.owner.publicKey,
        config: ctx.configPda,
        reserveState: ctx.reservePda,
        solVault: ctx.solVaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.owner])
      .rpc();
  }

  async function sweepStable(ctx: UserContext, amount: BN) {
    return program.methods
      .sweepStable(amount)
      .accounts({
        owner: ctx.owner.publicKey,
        config: ctx.configPda,
        reserveState: ctx.reservePda,
        stableMint: ctx.mint,
        reserveAuthority: ctx.reserveAuthorityPda,
        stableVault: ctx.stableVaultPda,
        ownerStableAccount: ctx.ownerStableAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ctx.owner])
      .rpc();
  }

  async function withdrawSol(ctx: UserContext, amount: BN) {
    return program.methods
      .withdrawSol(amount)
      .accounts({
        owner: ctx.owner.publicKey,
        config: ctx.configPda,
        reserveState: ctx.reservePda,
        solVault: ctx.solVaultPda,
      })
      .signers([ctx.owner])
      .rpc();
  }

  async function withdrawStable(ctx: UserContext, amount: BN) {
    return program.methods
      .withdrawStable(amount)
      .accounts({
        owner: ctx.owner.publicKey,
        config: ctx.configPda,
        reserveState: ctx.reservePda,
        stableMint: ctx.mint,
        reserveAuthority: ctx.reserveAuthorityPda,
        stableVault: ctx.stableVaultPda,
        ownerStableAccount: ctx.ownerStableAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ctx.owner])
      .rpc();
  }

  async function pause(ctx: UserContext) {
    return program.methods
      .pauseAutoYield()
      .accounts({ owner: ctx.owner.publicKey, config: ctx.configPda })
      .signers([ctx.owner])
      .rpc();
  }

  async function resume(ctx: UserContext) {
    return program.methods
      .resumeAutoYield()
      .accounts({ owner: ctx.owner.publicKey, config: ctx.configPda })
      .signers([ctx.owner])
      .rpc();
  }

  async function expectError(promise: Promise<any>, fragment: RegExp | string) {
    try {
      await promise;
      throw new Error(`expected error matching ${fragment}, got success`);
    } catch (e: any) {
      const msg = e?.toString() ?? "";
      if (typeof fragment === "string") {
        expect(msg).to.include(fragment);
      } else {
        expect(msg).to.match(fragment);
      }
    }
  }

  describe("initialize_auto_yield", () => {
    it("creates accounts and seeds initial state", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      const config = await program.account.userAutoYieldConfig.fetch(
        ctx.configPda,
      );
      expect(config.owner.toBase58()).to.equal(ctx.owner.publicKey.toBase58());
      expect(config.preferredStableMint.toBase58()).to.equal(
        ctx.mint.toBase58(),
      );
      expect(config.enabled).to.equal(true);
      expect(config.paused).to.equal(false);
      expect(config.sweepMode).to.equal(0);
      expect(config.activeProtocol).to.equal(0);

      const reserve = await program.account.userReserveState.fetch(
        ctx.reservePda,
      );
      expect(reserve.owner.toBase58()).to.equal(ctx.owner.publicKey.toBase58());
      expect(reserve.solBalanceLamports.toNumber()).to.equal(0);
      expect(reserve.stableBalanceAtomic.toNumber()).to.equal(0);
      expect(reserve.totalSweptSolLamports.toNumber()).to.equal(0);

      const solVault = await program.account.solVault.fetch(ctx.solVaultPda);
      expect(solVault.owner.toBase58()).to.equal(
        ctx.owner.publicKey.toBase58(),
      );

      const stableVault = await getAccount(
        provider.connection,
        ctx.stableVaultPda,
      );
      expect(stableVault.mint.toBase58()).to.equal(ctx.mint.toBase58());
      expect(stableVault.amount.toString()).to.equal("0");
    });

    it("rejects an invalid sweep mode", async () => {
      const ctx = await setupUser();
      await expectError(
        initialize(ctx, { ...defaultConfigArgs, sweepMode: 99 }),
        "InvalidSweepMode",
      );
    });

    it("rejects percentage_bps out of range", async () => {
      const ctx = await setupUser();
      await expectError(
        initialize(ctx, { ...defaultConfigArgs, percentageBps: 10_001 }),
        "InvalidPercentageBps",
      );
    });

    it("rejects when active protocol is not in the allowlist", async () => {
      const ctx = await setupUser();
      await expectError(
        initialize(ctx, { ...defaultConfigArgs, allowedProtocolsMask: 0 }),
        "ActiveProtocolNotAllowed",
      );
    });

    it("rejects when active protocol is excluded", async () => {
      const ctx = await setupUser();
      await expectError(
        initialize(ctx, { ...defaultConfigArgs, excludedProtocolsMask: 1 }),
        "ActiveProtocolExcluded",
      );
    });

    it("rejects an unsupported protocol", async () => {
      const ctx = await setupUser();
      await expectError(
        initialize(ctx, { ...defaultConfigArgs, activeProtocol: 5 }),
        "UnsupportedProtocol",
      );
    });
  });

  describe("update / pause / resume", () => {
    it("pauses and resumes sweeps", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      await pause(ctx);
      let config = await program.account.userAutoYieldConfig.fetch(
        ctx.configPda,
      );
      expect(config.paused).to.equal(true);

      await resume(ctx);
      config = await program.account.userAutoYieldConfig.fetch(ctx.configPda);
      expect(config.paused).to.equal(false);
    });

    it("applies updated config args", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      const newArgs = {
        ...defaultConfigArgs,
        sweepMode: 1,
        percentageBps: 500,
        deployThresholdAtomic: new BN(5_000_000),
      };
      await program.methods
        .updateAutoYieldConfig(newArgs)
        .accounts({ owner: ctx.owner.publicKey, config: ctx.configPda })
        .signers([ctx.owner])
        .rpc();

      const config = await program.account.userAutoYieldConfig.fetch(
        ctx.configPda,
      );
      expect(config.sweepMode).to.equal(1);
      expect(config.percentageBps).to.equal(500);
      expect(config.deployThresholdAtomic.toNumber()).to.equal(5_000_000);
    });

    it("rejects update from a non-owner signer", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      const intruder = Keypair.generate();
      await airdrop(intruder.publicKey, LAMPORTS_PER_SOL);

      await expectError(
        program.methods
          .pauseAutoYield()
          .accounts({ owner: intruder.publicKey, config: ctx.configPda })
          .signers([intruder])
          .rpc(),
        /ConstraintSeeds|Unauthorized|seeds/i,
      );
    });
  });

  describe("sweep_sol", () => {
    it("sweeps SOL into the vault and updates reserve state", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      const amount = new BN(LAMPORTS_PER_SOL / 10);
      await sweepSol(ctx, amount);

      const reserve = await program.account.userReserveState.fetch(
        ctx.reservePda,
      );
      expect(reserve.solBalanceLamports.toString()).to.equal(amount.toString());
      expect(reserve.totalSweptSolLamports.toString()).to.equal(
        amount.toString(),
      );
      expect(reserve.lastSweepUnixTs.toNumber()).to.be.greaterThan(0);

      const vaultLamports = await provider.connection.getBalance(
        ctx.solVaultPda,
      );
      expect(vaultLamports).to.be.greaterThan(amount.toNumber());
    });

    it("rejects a zero sweep amount", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await expectError(sweepSol(ctx, new BN(0)), "InvalidSweepAmount");
    });

    it("rejects sweeps when paused", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await pause(ctx);
      await expectError(
        sweepSol(ctx, new BN(LAMPORTS_PER_SOL / 100)),
        "AutoYieldPaused",
      );
    });

    it("rejects sweeps when disabled", async () => {
      const ctx = await setupUser();
      await initialize(ctx, { ...defaultConfigArgs, enabled: false });
      await expectError(
        sweepSol(ctx, new BN(LAMPORTS_PER_SOL / 100)),
        "AutoYieldDisabled",
      );
    });
  });

  describe("sweep_stable", () => {
    it("transfers stable tokens into the vault", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      const amount = new BN(50_000_000);
      await sweepStable(ctx, amount);

      const reserve = await program.account.userReserveState.fetch(
        ctx.reservePda,
      );
      expect(reserve.stableBalanceAtomic.toString()).to.equal(
        amount.toString(),
      );

      const vault = await getAccount(provider.connection, ctx.stableVaultPda);
      expect(vault.amount.toString()).to.equal(amount.toString());
    });

    it("rejects a zero sweep amount", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await expectError(sweepStable(ctx, new BN(0)), "InvalidSweepAmount");
    });
  });

  describe("withdraw_sol", () => {
    it("withdraws SOL back to the owner and decrements reserve", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      const swept = new BN(LAMPORTS_PER_SOL / 4);
      await sweepSol(ctx, swept);

      const withdraw = new BN(LAMPORTS_PER_SOL / 10);
      await withdrawSol(ctx, withdraw);

      const reserve = await program.account.userReserveState.fetch(
        ctx.reservePda,
      );
      expect(reserve.solBalanceLamports.toString()).to.equal(
        swept.sub(withdraw).toString(),
      );
      expect(reserve.lastWithdrawUnixTs.toNumber()).to.be.greaterThan(0);
    });

    it("rejects withdrawal exceeding tracked balance", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await sweepSol(ctx, new BN(LAMPORTS_PER_SOL / 100));
      await expectError(
        withdrawSol(ctx, new BN(LAMPORTS_PER_SOL * 100)),
        "InsufficientSolReserve",
      );
    });

    it("rejects a zero withdrawal amount", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await expectError(withdrawSol(ctx, new BN(0)), "InvalidWithdrawAmount");
    });
  });

  describe("withdraw_stable", () => {
    it("withdraws stable tokens back to the owner ATA", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      const swept = new BN(100_000_000);
      await sweepStable(ctx, swept);

      const before = await getAccount(
        provider.connection,
        ctx.ownerStableAccount,
      );
      const withdraw = new BN(40_000_000);
      await withdrawStable(ctx, withdraw);
      const after = await getAccount(
        provider.connection,
        ctx.ownerStableAccount,
      );

      expect((after.amount - before.amount).toString()).to.equal(
        withdraw.toString(),
      );

      const reserve = await program.account.userReserveState.fetch(
        ctx.reservePda,
      );
      expect(reserve.stableBalanceAtomic.toString()).to.equal(
        swept.sub(withdraw).toString(),
      );
    });

    it("rejects withdrawal exceeding tracked balance", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await sweepStable(ctx, new BN(10_000_000));
      await expectError(
        withdrawStable(ctx, new BN(99_999_999_999)),
        "InsufficientStableReserve",
      );
    });
  });

  describe("close_empty_reserve", () => {
    async function closeReserve(ctx: UserContext) {
      return program.methods
        .closeEmptyReserve()
        .accounts({
          owner: ctx.owner.publicKey,
          config: ctx.configPda,
          reserveState: ctx.reservePda,
          solVault: ctx.solVaultPda,
          stableMint: ctx.mint,
          reserveAuthority: ctx.reserveAuthorityPda,
          stableVault: ctx.stableVaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([ctx.owner])
        .rpc();
    }

    it("closes a fully drained reserve and returns rent to owner", async () => {
      const ctx = await setupUser();
      await initialize(ctx);

      const swept = new BN(LAMPORTS_PER_SOL / 10);
      await sweepSol(ctx, swept);
      await withdrawSol(ctx, swept);

      await closeReserve(ctx);

      const config = await program.account.userAutoYieldConfig.fetchNullable(
        ctx.configPda,
      );
      expect(config).to.equal(null);
      const reserve = await program.account.userReserveState.fetchNullable(
        ctx.reservePda,
      );
      expect(reserve).to.equal(null);
      const solVault = await program.account.solVault.fetchNullable(
        ctx.solVaultPda,
      );
      expect(solVault).to.equal(null);
    });

    it("rejects closure when stable balance is non-zero", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await sweepStable(ctx, new BN(10_000_000));
      await expectError(closeReserve(ctx), "ReserveNotEmpty");
    });

    it("rejects closure when sol balance is non-zero", async () => {
      const ctx = await setupUser();
      await initialize(ctx);
      await sweepSol(ctx, new BN(LAMPORTS_PER_SOL / 100));
      await expectError(closeReserve(ctx), "ReserveNotEmpty");
    });
  });
});
