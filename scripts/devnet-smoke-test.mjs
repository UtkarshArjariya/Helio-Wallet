/**
 * Devnet smoke test for the ADR-0005 `@solana/kit` cutover — closes the one open
 * gate that byte-parity + fail-closed simulation cannot: whether the *deployed*
 * Helio AutoYield program (devnet `Bc5g2…`) actually ACCEPTS the Kit-built
 * transactions.
 *
 * It drives the SHIPPED runtime pipeline end-to-end against live devnet:
 *   - `createHelioKitRpc`     (@helio/api — the hardened, rate-limited Kit RPC)
 *   - `createHelioKitSigner`  (@helio/api — build → fail-closed simulate →
 *                              CU-sizing → WebCrypto sign → send → poll-confirm)
 *   - `helioClient`           (@helio/solana — the Codama-generated builders,
 *                              PDA finders, and account decoders)
 * i.e. the exact code the React `WalletContext` calls. (The only thing it does
 * NOT exercise is the thin WalletContext glue itself — that's follow-up #2.)
 *
 * Sequence (all 8 vault instructions + the plain-SOL send):
 *   1. initialize_auto_yield   (init vault: config + reserve + sol_vault + stable_vault)
 *   2. sweep_sol               (add-funds → sol_vault, tracked in reserve_state)
 *   3. send_sol                (send-with-sweep: transfer + 1% sweep into vault)
 *   4. <system transfer>       (plain send — the non-Anchor cutover path)
 *   5. withdraw_sol            (AutoYield-aware withdraw, balance-tracked)
 *   6. withdraw_vault_sol      (direct vault withdraw, rent-exempt-gated)
 *   7. pause_auto_yield
 *   8. resume_auto_yield
 *   9. update_auto_yield_config (change percentage_bps)
 * On-chain state is read + decoded between steps to prove each instruction
 * actually mutated program state (not merely that the signature confirmed).
 *
 * Run:
 *   node --env-file=.env.local scripts/devnet-smoke-test.mjs
 *
 * Needs: `keys/devnet-smoke-keypair.json` (a 64-byte secret-key JSON array, e.g.
 *        from `solana-keygen new`) funded with >= ~0.05 devnet SOL.
 *        Override the keypair path with SMOKE_KEYPAIR=… and the RPC with
 *        VITE_HELIO_DEVNET_RPC_PRIMARY_URL=… (read from .env.local by default).
 */

import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

import { createHelioKitRpc, createHelioKitSigner } from '@helio/api';
import { helioClient } from '@helio/solana';
import { address, getBase58Decoder } from '@solana/kit';

// ─── Config ───────────────────────────────────────────────────────────────────

/**
 * Resolve an env var, falling back to a direct parse of `.env.local` so the
 * harness runs identically under `node --env-file=…`, plain `node`, and
 * `vite-node` (which exposes VITE_* on `import.meta.env`, not `process.env`).
 */
function envVar(name) {
  if (process.env[name]) return process.env[name];
  if (existsSync('.env.local')) {
    const line = readFileSync('.env.local', 'utf8').match(
      new RegExp(`^${name}=(.*)$`, 'm'),
    );
    if (line) return line[1].trim();
  }
  return undefined;
}

/** Circle USDC on devnet — a real, classic-Token-program Mint (init needs a Mint). */
const DEVNET_USDC = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const KEYPAIR_PATH =
  process.env.SMOKE_KEYPAIR ?? 'keys/devnet-smoke-keypair.json';
const RPC_URL =
  envVar('VITE_HELIO_DEVNET_RPC_PRIMARY_URL') ??
  'https://api.devnet.solana.com';

const LAMPORTS_PER_SOL = 1_000_000_000;
const sol = (lamports) => (Number(lamports) / LAMPORTS_PER_SOL).toFixed(9);

// Amounts (lamports). Sends to fresh accounts stay above the ~0.00089 SOL
// rent-exempt floor; the sweep gives the reserve enough to withdraw from.
const SWEEP_ADD = 20_000_000; //   0.02  SOL  → vault (add-funds)
const SEND_WITH_SWEEP = 3_000_000; // 0.003 SOL  → recipient (+1% swept)
const SEND_PLAIN = 2_000_000; //     0.002 SOL  → recipient
const WITHDRAW_TRACKED = 10_000_000; // 0.01 SOL  ← reserve-tracked withdraw
const WITHDRAW_DIRECT = 5_000_000; //   0.005 SOL ← direct vault withdraw
const SWEEP_BPS = 100; // 1.0% — within the program's [10, 200] bps window
const PRIORITY_FEE = 1_000; // microLamports/CU — exercises the two-pass CU sizing
const MIN_BALANCE = 30_000_000; // 0.03 SOL — refuse to start below this

// ─── Secret + identities ────────────────────────────────────────────────────────

const secretArray = JSON.parse(readFileSync(KEYPAIR_PATH, 'utf8'));
if (!Array.isArray(secretArray) || secretArray.length !== 64) {
  throw new Error(
    `Expected a 64-byte secret-key JSON array at ${KEYPAIR_PATH}, got length ${secretArray?.length}.`,
  );
}
const SECRET = Uint8Array.from(secretArray);
/** A fresh copy per signing call — the Kit signer zeros the copy it's handed. */
const dupSecret = () => SECRET.slice();

const owner = address(getBase58Decoder().decode(SECRET.slice(32, 64)));
// A throwaway recipient (random 32-byte address); receives the test sends.
const recipient = address(getBase58Decoder().decode(randomBytes(32)));

const kitRpc = createHelioKitRpc({
  url: RPC_URL,
  label: 'devnet-smoke',
  network: 'devnet',
});
const signer = createHelioKitSigner(kitRpc);

const explorer = (sig) => `https://solscan.io/tx/${sig}?cluster=devnet`;

// ─── On-chain readers (generated decoders over the hardened Kit RPC) ────────────

async function decodeAccount(pda, decoder) {
  const info = await kitRpc.getAccountInfo(pda);
  if (!info) return null;
  return decoder().decode(Buffer.from(info.data, 'base64'));
}

async function readConfig() {
  const [pda] = await helioClient.findConfigPda({ owner });
  return decodeAccount(pda, helioClient.getUserAutoYieldConfigDecoder);
}
async function readReserve() {
  const [pda] = await helioClient.findReserveStatePda({ owner });
  return decodeAccount(pda, helioClient.getUserReserveStateDecoder);
}
async function readVaultLamports() {
  const [pda] = await helioClient.findSolVaultPda({ owner });
  const info = await kitRpc.getAccountInfo(pda);
  return info ? info.lamports : 0n;
}

// ─── Runner ─────────────────────────────────────────────────────────────────────

const results = [];
let aborted = false;

/** Run one labelled step; record outcome; abort the rest on the first failure. */
async function step(name, fn) {
  if (aborted) {
    results.push({ name, status: 'skipped' });
    console.log(`  ⏭  ${name} — skipped (a prior step failed)`);
    return;
  }
  process.stdout.write(`▶  ${name} … `);
  try {
    const sig = await fn();
    if (sig) {
      console.log(`✅\n     sig: ${sig}\n     ${explorer(sig)}`);
      results.push({ name, status: 'ok', sig });
    } else {
      console.log('✅');
      results.push({ name, status: 'ok' });
    }
  } catch (err) {
    console.log(`❌\n     ${err instanceof Error ? err.message : String(err)}`);
    results.push({
      name,
      status: 'fail',
      error: err instanceof Error ? err.message : String(err),
    });
    aborted = true;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(`verification failed: ${msg}`);
}

async function main() {
  console.log('═'.repeat(72));
  console.log('Helio Wallet — ADR-0005 Kit cutover · devnet smoke test');
  console.log('═'.repeat(72));
  console.log(`owner    : ${owner}`);
  console.log(`recipient: ${recipient}`);
  console.log(`program  : ${helioClient.HELIO_PROGRAM_ADDRESS}`);
  console.log(`rpc      : ${new URL(RPC_URL).host}`);
  console.log('─'.repeat(72));

  // Preflight: balance gate.
  const startBal = await kitRpc.getBalanceLamports(owner);
  console.log(`balance  : ${sol(startBal)} SOL`);
  if (startBal < BigInt(MIN_BALANCE)) {
    console.error(
      `\n✋ Insufficient devnet SOL (need >= ${sol(MIN_BALANCE)}). Fund ${owner} and re-run.`,
    );
    process.exit(2);
  }

  // If a previous run already initialized this wallet's vault, say so (init will
  // then fail with "already in use" — expected; the rest still exercises live).
  const existingConfig = await readConfig();
  if (existingConfig) {
    console.log('note     : vault already initialized from a prior run.');
  }
  console.log('─'.repeat(72));

  // 1 ─ initialize_auto_yield (idempotent: skipped on a re-run where the vault exists)
  if (existingConfig) {
    assert(existingConfig.owner === owner, 'existing config.owner != owner');
    console.log(
      '▶  initialize_auto_yield (init vault) … ⏭  skipped (already initialized)',
    );
    results.push({
      name: 'initialize_auto_yield (init vault)',
      status: 'skipped',
    });
  } else {
    await step('initialize_auto_yield (init vault)', async () => {
      const sig = await signer.initializeAutoYield(dupSecret(), DEVNET_USDC);
      const cfg = await readConfig();
      assert(cfg, 'config PDA not found after init');
      assert(cfg.owner === owner, 'config.owner != owner');
      assert(cfg.enabled === true, 'config.enabled should be true');
      assert(cfg.paused === false, 'config.paused should be false');
      const res = await readReserve();
      assert(
        res && res.owner === owner,
        'reserve_state not initialized for owner',
      );
      return sig;
    });
  }

  // 2 ─ sweep_sol (add-funds)
  await step('sweep_sol (add-funds → vault)', async () => {
    const before = (await readReserve())?.solBalanceLamports ?? 0n;
    const sig = await signer.sweepSol(dupSecret(), SWEEP_ADD);
    const after = (await readReserve())?.solBalanceLamports ?? 0n;
    assert(
      after === before + BigInt(SWEEP_ADD),
      `reserve.solBalance ${before}→${after}, expected +${SWEEP_ADD}`,
    );
    return sig;
  });

  // 3 ─ send_sol (send-with-sweep)
  await step('send_sol (send + 1% sweep)', async () => {
    const recipBefore = await kitRpc.getBalanceLamports(recipient);
    const vaultBefore = await readVaultLamports();
    const sig = await signer.sendSol(
      dupSecret(),
      recipient,
      SEND_WITH_SWEEP,
      SWEEP_BPS,
      PRIORITY_FEE,
    );
    const recipAfter = await kitRpc.getBalanceLamports(recipient);
    const vaultAfter = await readVaultLamports();
    assert(
      recipAfter === recipBefore + BigInt(SEND_WITH_SWEEP),
      `recipient ${recipBefore}→${recipAfter}, expected +${SEND_WITH_SWEEP}`,
    );
    assert(
      vaultAfter > vaultBefore,
      'vault lamports should grow by the swept fee',
    );
    return sig;
  });

  // 4 ─ plain send (system transfer — the non-Anchor cutover path)
  await step('plain send (system transfer)', async () => {
    const before = await kitRpc.getBalanceLamports(recipient);
    const sig = await signer.sendSolPlain(
      dupSecret(),
      recipient,
      SEND_PLAIN,
      PRIORITY_FEE,
    );
    const after = await kitRpc.getBalanceLamports(recipient);
    assert(
      after === before + BigInt(SEND_PLAIN),
      `recipient ${before}→${after}, expected +${SEND_PLAIN}`,
    );
    return sig;
  });

  // 5 ─ withdraw_sol (AutoYield-aware, balance-tracked)
  await step('withdraw_sol (reserve-tracked)', async () => {
    const before = (await readReserve())?.solBalanceLamports ?? 0n;
    const sig = await signer.withdrawSol(dupSecret(), WITHDRAW_TRACKED);
    const after = (await readReserve())?.solBalanceLamports ?? 0n;
    assert(
      after === before - BigInt(WITHDRAW_TRACKED),
      `reserve.solBalance ${before}→${after}, expected -${WITHDRAW_TRACKED}`,
    );
    return sig;
  });

  // 6 ─ withdraw_vault_sol (direct, rent-exempt-gated)
  await step('withdraw_vault_sol (direct)', async () => {
    const before = await readVaultLamports();
    const sig = await signer.withdrawVaultSol(dupSecret(), WITHDRAW_DIRECT);
    const after = await readVaultLamports();
    assert(
      after === before - BigInt(WITHDRAW_DIRECT),
      `vault lamports ${before}→${after}, expected -${WITHDRAW_DIRECT}`,
    );
    return sig;
  });

  // 7 ─ pause_auto_yield
  await step('pause_auto_yield', async () => {
    const sig = await signer.pauseAutoYield(dupSecret());
    assert(
      (await readConfig())?.paused === true,
      'config.paused should be true after pause',
    );
    return sig;
  });

  // 8 ─ resume_auto_yield
  await step('resume_auto_yield', async () => {
    const sig = await signer.resumeAutoYield(dupSecret());
    assert(
      (await readConfig())?.paused === false,
      'config.paused should be false after resume',
    );
    return sig;
  });

  // 9 ─ update_auto_yield_config (change percentage_bps, keep the rest valid)
  await step('update_auto_yield_config', async () => {
    const cfg = await readConfig();
    assert(cfg, 'config missing before update');
    const newBps = cfg.percentageBps === 150 ? 175 : 150;
    const sig = await signer.updateAutoYieldConfig(dupSecret(), {
      enabled: cfg.enabled,
      paused: cfg.paused,
      sweepMode: cfg.sweepMode,
      roundUpUnitLamports: cfg.roundUpUnitLamports,
      percentageBps: newBps,
      deployThresholdAtomic: cfg.deployThresholdAtomic,
      activeProtocol: cfg.activeProtocol,
      allowedProtocolsMask: cfg.allowedProtocolsMask,
      excludedProtocolsMask: cfg.excludedProtocolsMask,
    });
    const updated = await readConfig();
    assert(
      updated?.percentageBps === newBps,
      `config.percentageBps should be ${newBps}, got ${updated?.percentageBps}`,
    );
    return sig;
  });

  // ── Summary ──
  console.log('─'.repeat(72));
  const endBal = await kitRpc.getBalanceLamports(owner);
  const okCount = results.filter((r) => r.status === 'ok').length;
  const failCount = results.filter((r) => r.status === 'fail').length;
  const skipCount = results.filter((r) => r.status === 'skipped').length;
  console.log(
    `Result: ${okCount} ok · ${failCount} fail · ${skipCount} skipped`,
  );
  console.log(
    `Net SOL spent: ${sol(startBal - endBal)} SOL (start ${sol(startBal)} → end ${sol(endBal)})`,
  );
  console.log('─'.repeat(72));
  for (const r of results) {
    const mark = r.status === 'ok' ? '✅' : r.status === 'fail' ? '❌' : '⏭';
    console.log(`${mark} ${r.name}${r.sig ? `  ${explorer(r.sig)}` : ''}`);
  }
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
