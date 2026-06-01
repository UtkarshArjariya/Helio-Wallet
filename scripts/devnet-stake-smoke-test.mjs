/**
 * Devnet smoke test for the native-staking Kit cutover (ADR-0004 Phase 4a) —
 * closes the on-chain gate that byte-construction + unit tests cannot: whether the
 * deployed **Stake program** accepts the Kit-built create + delegate + deactivate +
 * withdraw transactions.
 *
 * It drives the SHIPPED staking pipeline against live devnet:
 *   - `createHelioKitRpc`     (@helio/api — hardened, rate-limited Kit RPC + the
 *                              new staking reads getStakeAccountsByStaker/getVoteAccounts)
 *   - `createHelioStakeSigner`(@helio/api — @solana-program/stake builders over the
 *                              shared fail-closed pipeline; ephemeral stake signer)
 * i.e. the exact code `WalletContext.stakeSol` / `deactivateStake` / `withdrawStake` call.
 *
 * Sequence (self-contained — leaves no SOL locked):
 *   1. stake_and_delegate   (create + initialize + delegate 1 SOL → a validator)
 *   2. deactivate           (begin cooldown)
 *   3. withdraw_stake        (full balance back to the owner; closes the account)
 *
 * Why withdraw works in one run: the stake is created AND deactivated in the SAME
 * epoch, so it never activates — deactivation is immediate and the principal is
 * withdrawable right away. (For a stake that activated in a PRIOR epoch, withdraw of
 * principal would need the deactivation epoch to elapse; the *instruction* the Stake
 * program validates is identical either way, so this still proves on-chain acceptance.)
 *
 * Reclaim mode: set `STAKE_WITHDRAW_ONLY=<stakeAddress>` to skip create/deactivate and
 * just withdraw that (already-deactivated) account's full balance — used to reclaim a
 * stake account orphaned by an earlier partial run.
 *
 * Run:
 *   node node_modules/.pnpm/vite-node@*\/node_modules/vite-node/vite-node.mjs \
 *        scripts/devnet-stake-smoke-test.mjs
 *
 * Needs: `keys/devnet-smoke-keypair.json` funded with >= ~1.1 devnet SOL
 *        (devnet minimum stake delegation is 1 SOL).
 */

import { existsSync, readFileSync } from 'node:fs';

import { createHelioKitRpc, createHelioStakeSigner } from '@helio/api';
import { getBase58Decoder } from '@solana/kit';

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

const KEYPAIR_PATH =
  process.env.SMOKE_KEYPAIR ?? 'keys/devnet-smoke-keypair.json';
const RPC_URL =
  envVar('VITE_HELIO_DEVNET_RPC_PRIMARY_URL') ??
  'https://api.devnet.solana.com';
const WITHDRAW_ONLY = process.env.STAKE_WITHDRAW_ONLY;

const LAMPORTS_PER_SOL = 1_000_000_000;
const sol = (lamports) => (Number(lamports) / LAMPORTS_PER_SOL).toFixed(9);
const MAX_U64 = 18446744073709551615n;

const STAKE_AMOUNT = 1_000_000_000; // 1 SOL — devnet minimum stake delegation
const MIN_BALANCE = 1_100_000_000; // refuse to start below ~1.1 SOL

const secretArray = JSON.parse(readFileSync(KEYPAIR_PATH, 'utf8'));
if (!Array.isArray(secretArray) || secretArray.length !== 64) {
  throw new Error(
    `Expected a 64-byte secret-key JSON array at ${KEYPAIR_PATH}.`,
  );
}
const SECRET = Uint8Array.from(secretArray);
const dupSecret = () => SECRET.slice();
const owner = getBase58Decoder().decode(SECRET.slice(32, 64));

const kitRpc = createHelioKitRpc({
  url: RPC_URL,
  label: 'devnet-stake',
  network: 'devnet',
});
const signer = createHelioStakeSigner(kitRpc);

const explorer = (sig) => `https://solscan.io/tx/${sig}?cluster=devnet`;
const explorerAcct = (a) => `https://solscan.io/account/${a}?cluster=devnet`;

function assert(cond, msg) {
  if (!cond) throw new Error(`verification failed: ${msg}`);
}

/** Withdraw a (deactivated) stake account's full balance back to the owner + close it. */
async function withdrawFull(stakeAddress) {
  const stakeBal = await kitRpc.getBalanceLamports(stakeAddress);
  assert(stakeBal > 0n, `stake account ${stakeAddress} is empty or missing`);
  const ownerBefore = await kitRpc.getBalanceLamports(owner);
  console.log(`▶  withdraw_stake (full ${sol(stakeBal)} SOL → owner) …`);
  const sig = await signer.withdrawStake(
    dupSecret(),
    stakeAddress,
    Number(stakeBal),
  );
  console.log(`   ✅ ${sig}\n      ${explorer(sig)}`);
  const closed = await kitRpc.getAccountInfo(stakeAddress);
  const ownerAfter = await kitRpc.getBalanceLamports(owner);
  assert(
    closed === null,
    'stake account should be closed (0 lamports) after a full withdraw',
  );
  console.log(
    `   account closed; owner ${sol(ownerBefore)} → ${sol(ownerAfter)} SOL`,
  );
  return sig;
}

async function main() {
  console.log('═'.repeat(72));
  console.log('Helio Wallet — native staking Kit cutover · devnet smoke test');
  console.log('═'.repeat(72));
  console.log(`owner  : ${owner}`);
  console.log(`rpc    : ${new URL(RPC_URL).host}`);
  const startBal = await kitRpc.getBalanceLamports(owner);
  console.log(`balance: ${sol(startBal)} SOL`);

  // ── Reclaim mode: just withdraw an orphaned, already-deactivated stake account. ──
  if (WITHDRAW_ONLY) {
    console.log(`mode   : reclaim (STAKE_WITHDRAW_ONLY=${WITHDRAW_ONLY})`);
    console.log('─'.repeat(72));
    await withdrawFull(WITHDRAW_ONLY);
    console.log('─'.repeat(72));
    console.log(
      'Result: withdraw_stake landed + confirmed on-chain ✅ (account reclaimed)',
    );
    process.exit(0);
  }

  if (startBal < BigInt(MIN_BALANCE)) {
    console.error(
      `\n✋ Need >= ${sol(MIN_BALANCE)} SOL (devnet min delegation is 1 SOL). Fund ${owner} and re-run.`,
    );
    process.exit(2);
  }

  // Pick the highest-activated-stake current validator to delegate to.
  const validators = await kitRpc.getVoteAccounts();
  assert(
    validators.length > 0,
    'no current validators returned by getVoteAccounts',
  );
  const validator = [...validators].sort((a, b) =>
    a.activatedStakeLamports < b.activatedStakeLamports
      ? 1
      : a.activatedStakeLamports > b.activatedStakeLamports
        ? -1
        : 0,
  )[0];
  console.log(
    `validator: ${validator.votePubkey} (commission ${validator.commission}%, ${sol(validator.activatedStakeLamports)} SOL staked)`,
  );
  console.log('─'.repeat(72));

  // Snapshot existing stake accounts so we can isolate the one we create.
  const before = new Set(
    (await kitRpc.getStakeAccountsByStaker(owner)).map((a) => a.address),
  );

  // 1 ─ stake_and_delegate
  console.log('▶  stake_and_delegate (create + initialize + delegate 1 SOL) …');
  const stakeSig = await signer.stakeAndDelegate(
    dupSecret(),
    STAKE_AMOUNT,
    validator.votePubkey,
  );
  console.log(`   ✅ ${stakeSig}\n      ${explorer(stakeSig)}`);

  const afterStake = await kitRpc.getStakeAccountsByStaker(owner);
  const created = afterStake.find((a) => !before.has(a.address));
  assert(created, 'no new stake account found after stake_and_delegate');
  assert(
    created.voter === validator.votePubkey,
    `delegated voter ${created.voter} != ${validator.votePubkey}`,
  );
  assert(
    created.delegatedLamports === BigInt(STAKE_AMOUNT),
    `delegated ${created.delegatedLamports} != ${STAKE_AMOUNT}`,
  );
  assert(
    created.deactivationEpoch === MAX_U64,
    'freshly delegated stake should not be deactivating yet',
  );
  console.log(
    `   stake account: ${created.address} — delegated ${sol(created.delegatedLamports)} SOL`,
  );
  console.log(`      ${explorerAcct(created.address)}`);

  // 2 ─ deactivate
  console.log('▶  deactivate (begin cooldown — immediate, same epoch) …');
  const deactivateSig = await signer.deactivateStake(
    dupSecret(),
    created.address,
  );
  console.log(`   ✅ ${deactivateSig}\n      ${explorer(deactivateSig)}`);
  const afterDeactivate = (await kitRpc.getStakeAccountsByStaker(owner)).find(
    (a) => a.address === created.address,
  );
  assert(
    afterDeactivate &&
      afterDeactivate.deactivationEpoch !== null &&
      afterDeactivate.deactivationEpoch !== MAX_U64,
    'expected a deactivationEpoch to be set after deactivate',
  );
  console.log(`   deactivationEpoch=${afterDeactivate.deactivationEpoch}`);

  // 3 ─ withdraw_stake (full balance; closes the account)
  const withdrawSig = await withdrawFull(created.address);

  console.log('─'.repeat(72));
  const endBal = await kitRpc.getBalanceLamports(owner);
  console.log(
    'Result: 3/3 staking instructions landed + confirmed on-chain ✅',
  );
  console.log(
    '  (create+initialize+delegate · deactivate · withdraw — all accepted by the Stake program)',
  );
  console.log(
    `Net SOL spent: ${sol(startBal - endBal)} SOL (fees + rent churn; principal fully reclaimed)`,
  );
  console.log(
    `sigs: stake ${stakeSig.slice(0, 8)}… · deactivate ${deactivateSig.slice(0, 8)}… · withdraw ${withdrawSig.slice(0, 8)}…`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('\nFATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
