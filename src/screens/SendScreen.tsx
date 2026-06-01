import type {
  SmartAdjustmentReason,
  SmartTransactionReview,
} from '@helio/types';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle,
  ChevronDown,
  ExternalLink,
  Loader2,
  Send,
  Shield,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import {
  CloseButton,
  ScreenHeader,
} from '../components/wallet/ui/ScreenHeader';
import { TokenIcon } from '../components/wallet/ui/TokenIcon';
import { useRouter } from '../contexts/RouterContext';
import { useWallet } from '../contexts/WalletContext';
import { cn } from '../lib/utils';

const SWEEP_BPS_DEFAULT = 50; // 0.5% vault sweep on every send

/**
 * Jito bundle tip for private sends. Set near the 95th-percentile of recent
 * landed tips (~0.0001 SOL, ≈100k lamports) so the bundle lands reliably.
 * Source: https://bundles.jito.wtf/api/v1/bundles/tip_floor
 *
 * NOTE: Private send is not yet implemented — clicking submit in this mode is
 * blocked. When the Jito bundle path is wired in, replace this constant with a
 * live fetch of the tip floor.
 */
const PRIVATE_TIP_SOL = 0.0001;

function isValidAmount(raw: string): boolean {
  const n = parseFloat(raw);
  return !Number.isNaN(n) && n > 0 && Number.isFinite(n);
}

export function SendScreen() {
  const { navigate } = useRouter();
  const { tokens, vault, reviewSend, submitSend, hasKeypair } = useWallet();

  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [mode, setMode] = useState<'standard' | 'private'>('standard');
  const [sending, setSending] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState<SmartTransactionReview | null>(null);
  const [txResult, setTxResult] = useState<{ sig: string; url: string } | null>(
    null,
  );
  const [txError, setTxError] = useState<string | null>(null);
  // Default to creating the vault until the user explicitly opts out *for this send*.
  // Resets to true on every mount: any send before the vault exists re-prompts.
  const [createVault, setCreateVault] = useState(true);

  const showVaultPrompt = !vault.initialized;
  const willSweep = !showVaultPrompt || createVault;

  const token = tokens.find((t) => t.id === 'sol') ?? tokens[0];
  const solPrice = token?.price ?? 0;
  const numericAmount = isValidAmount(amount) ? parseFloat(amount) : 0;
  const fiatValue = numericAmount * solPrice;
  const sweepAmount = Math.max(
    1,
    Math.floor((numericAmount * LAMPORTS_PER_SOL * SWEEP_BPS_DEFAULT) / 10_000),
  );
  const sweepSol = sweepAmount / LAMPORTS_PER_SOL;
  const sweepUsd = sweepSol * solPrice;

  // Solana's base fee is constant at 5000 lamports per signature.
  // (Live tip via getRecentPrioritizationFees would change this; current send
  //  flow doesn't add a priority fee, so the base is accurate.)
  const networkFeeSol = 0.000005;
  const networkFeeUsd = networkFeeSol * solPrice;
  const isPrivate = mode === 'private';
  const privateTipSol = isPrivate ? PRIVATE_TIP_SOL : 0;
  const privateTipUsd = privateTipSol * solPrice;
  const _totalFeeSol = networkFeeSol + privateTipSol;
  const insufficient =
    numericAmount > 0 && numericAmount > (token?.balance ?? 0);
  const recipientValid =
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(recipient) ||
    recipient.endsWith('.sol');
  // Private send is fee-accurate in the UI but not yet implemented on the wire.
  // Block submission so we don't leak the transaction publicly while charging
  // for privacy. Remove this gate once the Jito bundle path lands.
  const valid =
    numericAmount > 0 &&
    !insufficient &&
    recipientValid &&
    hasKeypair &&
    !sending &&
    !isPrivate;

  const sweepBpsArg = willSweep ? SWEEP_BPS_DEFAULT : null;

  /** Step 1 — build + simulate + analyze, then show the Smart Adjust review. */
  const handleReview = async () => {
    if (!valid) return;
    if (recipient.endsWith('.sol')) {
      setTxError(
        '.sol domains aren’t supported for sending yet — paste the full wallet address.',
      );
      return;
    }
    setReviewing(true);
    setTxError(null);
    setTxResult(null);
    try {
      const lamports = Math.floor(numericAmount * LAMPORTS_PER_SOL);
      const result = await reviewSend(recipient, lamports, sweepBpsArg);
      setReview(result);
    } catch (err) {
      setTxError(
        err instanceof Error
          ? err.message
          : 'Could not review the transaction.',
      );
    } finally {
      setReviewing(false);
    }
  };

  /** Step 2 — submit the reviewed amount (re-simulated inside submitSend). */
  const handleConfirm = async () => {
    if (!review || review.status === 'blocked') return;
    const finalLamports = Number(review.adjustedAmount.amountAtomic);
    setReview(null);
    setSending(true);
    setTxError(null);
    try {
      const result = await submitSend(recipient, finalLamports, sweepBpsArg);
      setTxResult({ sig: result.signature, url: result.explorerUrl });
      setAmount('');
      setRecipient('');
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Transaction failed.');
    } finally {
      setSending(false);
    }
  };

  /* Success screen */
  if (txResult) {
    return (
      <div className="flex flex-col">
        <ScreenHeader
          title="Sent"
          subtitle="Transaction confirmed"
          showBack={false}
          rightSlot={<CloseButton onClose={() => navigate('/')} />}
        />
        <div className="p-4 flex flex-col items-center text-center gap-4 pt-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
            <CheckCircle className="h-10 w-10 text-success" />
          </div>
          <div>
            <div className="text-text-primary font-heading font-semibold text-lg">
              Transaction sent
            </div>
            <div className="text-text-muted text-sm mt-1 font-mono break-all px-4">
              {txResult.sig.slice(0, 20)}…
            </div>
          </div>
          <a
            href={txResult.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-accent-primary px-5 py-2.5 text-sm font-semibold text-accent-primary-foreground hover:bg-accent-primary-hover transition-colors"
          >
            <ExternalLink className="h-4 w-4" /> View on Solscan
          </a>
          <button
            type="button"
            onClick={() => setTxResult(null)}
            className="text-text-muted text-sm hover:text-text-primary"
          >
            Send another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <ScreenHeader
        title="Send"
        subtitle={
          isPrivate
            ? 'Solana · private via Jito bundle'
            : willSweep
              ? `Solana · ${SWEEP_BPS_DEFAULT / 100}% auto-swept to vault`
              : 'Solana · plain transfer'
        }
      />

      <div className="relative p-4 space-y-4" style={{ isolation: 'isolate' }}>
        {/* Red ambient glow — signals outflow */}
        <div
          className="pointer-events-none absolute -right-12 top-12 h-56 w-56 rounded-full"
          style={{
            background: 'rgba(255,59,63,0.10)',
            filter: 'blur(70px)',
            zIndex: -1,
          }}
        />

        {!hasKeypair && (
          <div
            className="relative flex items-start gap-2 rounded-2xl border p-3 text-xs text-warning"
            style={{
              background: 'rgba(255,184,77,0.06)',
              borderColor: 'rgba(255,184,77,0.2)',
            }}
          >
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Wallet is locked. Import your wallet or create a new one to sign
              transactions.
            </span>
          </div>
        )}

        {/* Token + amount */}
        <div
          className="relative rounded-3xl helio-card p-5"
          style={{ boxShadow: 'inset 1px 0 0 0 rgba(255,59,63,0.22)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-eyebrow text-text-muted text-[10px] inline-flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-danger" />
              You send
            </span>
            <button
              type="button"
              onClick={() => setAmount(String(token?.balance ?? 0))}
              className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-accent-primary hover:opacity-80"
              style={{ background: 'rgba(198,240,0,0.12)' }}
            >
              MAX
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-3 transition-colors"
              style={{
                background: 'var(--surface-2)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <TokenIcon token={{ symbol: 'SOL' }} size={24} />
              SOL
              <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
            </button>
            <input
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-transparent text-right font-figure text-3xl font-bold text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-xs text-text-muted font-mono">
            <span>
              Balance: {(token?.balance ?? 0).toFixed(4)}{' '}
              {token?.symbol ?? 'SOL'}
            </span>
            <span>≈ ${fiatValue.toFixed(2)}</span>
          </div>
        </div>

        {/* Recipient */}
        <div className="rounded-3xl helio-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-eyebrow text-text-muted text-[10px]">
              Recipient
            </span>
            <button
              type="button"
              onClick={() => navigate('/settings/address-book')}
              className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Address book
            </button>
          </div>
          <input
            type="text"
            placeholder="Wallet address or .sol domain"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-mono text-text-primary outline-none placeholder:text-text-muted transition-colors"
            style={{
              background: 'var(--surface-2)',
              borderColor:
                recipient && !recipientValid
                  ? 'var(--danger)'
                  : 'var(--border-subtle)',
            }}
          />
          {recipient && !recipientValid && (
            <p className="text-xs text-danger mt-1.5">
              Enter a valid Solana address or .sol domain.
            </p>
          )}
        </div>

        {/* Vault creation prompt (only when vault not yet initialized) */}
        {showVaultPrompt && (
          // biome-ignore lint/a11y/useSemanticElements: styled card control kept as button with role=checkbox + aria-checked; a native input would break the card layout
          <button
            type="button"
            role="checkbox"
            aria-checked={createVault}
            onClick={() => setCreateVault((v) => !v)}
            className="w-full rounded-3xl helio-card p-4 flex items-start gap-3 text-left hover:bg-surface-3 transition-colors"
            style={
              createVault
                ? { boxShadow: 'inset 1px 0 0 0 rgba(198,240,0,0.25)' }
                : undefined
            }
          >
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                createVault
                  ? 'bg-accent-primary border-accent-primary text-accent-primary-foreground'
                  : 'border-border-subtle bg-surface-2',
              )}
            >
              {createVault && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-accent-primary" />
                <span className="text-text-primary text-sm font-medium">
                  Create my Helio Vault with this send
                </span>
              </div>
              <p className="text-text-muted text-xs mt-1 leading-relaxed">
                {createVault
                  ? `Bundles vault creation with this transfer. Sweeps ${SWEEP_BPS_DEFAULT / 100}% (${sweepSol.toFixed(6)} SOL) into your personal vault PDA. You pay the one-time vault rent (~0.0013 SOL).`
                  : `This transaction will skip vault creation. We'll ask again on your next send until your vault is created.`}
              </p>
            </div>
          </button>
        )}

        {/* Mode toggle */}
        <div className="rounded-3xl helio-card p-3">
          <div
            className="grid grid-cols-2 gap-1 rounded-full p-1"
            style={{ background: 'var(--surface-2)' }}
          >
            {(['standard', 'private'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                  mode === m
                    ? 'bg-surface-3 text-text-primary'
                    : 'text-text-muted hover:text-text-primary',
                )}
              >
                {m === 'private' && <Shield className="h-3 w-3" />}
                {m === 'standard' ? 'Standard' : 'Private (beta)'}
              </button>
            ))}
          </div>
        </div>

        {/* Fee summary */}
        <div className="rounded-3xl helio-card p-5 space-y-2.5">
          <FeeRow
            label="Network fee"
            value={`~${networkFeeSol.toFixed(6)} SOL`}
            sub={solPrice > 0 ? `≈ $${networkFeeUsd.toFixed(4)}` : undefined}
          />
          {isPrivate && (
            <FeeRow
              label="Private bundle tip"
              value={`+${privateTipSol.toFixed(6)} SOL`}
              accent
              sub={
                solPrice > 0
                  ? `Jito MEV-protect · ~p95 tip · ≈ $${privateTipUsd.toFixed(4)}`
                  : 'Jito MEV-protect · ~p95 tip'
              }
            />
          )}
          {willSweep && (
            <FeeRow
              label="Vault round-up"
              value={`+${sweepSol.toFixed(6)} SOL`}
              accent
              sub={
                solPrice > 0
                  ? `${SWEEP_BPS_DEFAULT / 100}% of send · ≈ $${sweepUsd.toFixed(4)}`
                  : `${SWEEP_BPS_DEFAULT / 100}% of send`
              }
            />
          )}
          <FeeRow
            label="You'll send"
            value={`${numericAmount.toFixed(4)} SOL`}
            bold
            sub={
              solPrice > 0 && numericAmount > 0
                ? `≈ $${fiatValue.toFixed(2)}`
                : undefined
            }
          />
        </div>

        {isPrivate && (
          <div
            className="flex items-start gap-2 rounded-2xl border p-3 text-xs"
            style={{
              background: 'rgba(255,184,77,0.06)',
              borderColor: 'rgba(255,184,77,0.2)',
              color: 'var(--warning)',
            }}
          >
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="leading-relaxed">
              Private sends route through a Jito bundle (≈{' '}
              {(PRIVATE_TIP_SOL * LAMPORTS_PER_SOL).toLocaleString()} lamports
              tip, ~p95 of recent landed tips) to hide the tx from the public
              mempool and prevent sandwich attacks. This path is in beta —
              submission is disabled until the bundle integration ships.
            </span>
          </div>
        )}

        {insufficient && (
          <div
            className="flex items-start gap-2 rounded-2xl border p-3 text-xs text-danger"
            style={{
              background: 'rgba(255,59,63,0.08)',
              borderColor: 'rgba(255,59,63,0.25)',
            }}
          >
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Insufficient balance. Reduce the amount or top up your wallet.
            </span>
          </div>
        )}

        {txError && (
          <div
            className="flex items-start gap-2 rounded-2xl border p-3 text-xs text-danger"
            style={{
              background: 'rgba(255,59,63,0.08)',
              borderColor: 'rgba(255,59,63,0.25)',
            }}
          >
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="break-all">{txError}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleReview}
          disabled={!valid || reviewing || sending}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold transition-colors',
            valid && !reviewing && !sending
              ? 'bg-accent-primary text-accent-primary-foreground hover:bg-accent-primary-hover'
              : 'text-text-muted cursor-not-allowed',
          )}
          style={
            !valid || reviewing || sending
              ? { background: 'var(--surface-3)' }
              : {}
          }
        >
          {reviewing || sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          {sending
            ? 'Sending…'
            : reviewing
              ? 'Simulating…'
              : !hasKeypair
                ? 'Wallet locked'
                : isPrivate
                  ? 'Private send · coming soon'
                  : valid
                    ? 'Review & send'
                    : 'Enter amount and recipient'}
        </button>
      </div>

      {review && (
        <SmartAdjustReviewModal
          review={review}
          solPrice={solPrice}
          onCancel={() => setReview(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}

const REASON_TONE: Record<SmartAdjustmentReason['severity'], string> = {
  info: 'var(--text-secondary)',
  warning: 'var(--warning)',
  critical: 'var(--danger)',
};

function lamportsToSol(atomic: string | number): number {
  return Number(atomic) / LAMPORTS_PER_SOL;
}

/**
 * Smart Transaction Adjustment review — shown after simulation, before signing.
 * Surfaces the fee breakdown, any rent/fee adjustment the engine made, and
 * blocks confirmation when simulation flagged the transaction.
 */
function SmartAdjustReviewModal({
  review,
  solPrice,
  onCancel,
  onConfirm,
}: {
  review: SmartTransactionReview;
  solPrice: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const blocked = review.status === 'blocked';
  const adjusted = review.status === 'adjusted';
  const fees = review.feeBreakdown;
  const originalSol = lamportsToSol(review.originalAmount.amountAtomic);
  const finalSol = lamportsToSol(review.adjustedAmount.amountAtomic);
  const usd = (sol: number) =>
    solPrice > 0 ? `≈ $${(sol * solPrice).toFixed(2)}` : undefined;

  const tone = blocked
    ? 'var(--danger)'
    : adjusted
      ? 'var(--warning)'
      : 'var(--accent-primary)';
  const heading = blocked
    ? 'Can’t send safely'
    : adjusted
      ? 'Helio adjusted your send'
      : 'Ready to send';
  const Icon = blocked ? AlertTriangle : adjusted ? Sparkles : ShieldCheck;

  return (
    /* biome-ignore lint/a11y/useSemanticElements: styled interactive container kept as div with role=button + keyboard handler */
    <div
      role="button"
      tabIndex={0}
      aria-label="Dismiss review"
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: handlers only stop event propagation to the backdrop, not a real interactive control */}
      <div
        role="presentation"
        className="w-full max-w-md rounded-3xl helio-card p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full shrink-0"
            style={{
              background: `color-mix(in srgb, ${tone} 16%, transparent)`,
              color: tone,
            }}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <div className="text-text-primary font-heading font-semibold text-base">
              {heading}
            </div>
            <div className="text-text-muted text-xs">
              Simulated against the live cluster
            </div>
          </div>
        </div>

        {/* Amount — original struck through if adjusted */}
        <div
          className="rounded-2xl border p-4"
          style={{
            background: 'var(--surface-2)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          {adjusted && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">Requested</span>
              <span className="text-text-muted line-through font-mono">
                {originalSol.toFixed(6)} SOL
              </span>
            </div>
          )}
          <div className="flex items-center justify-between mt-1">
            <span className="text-text-secondary text-sm">
              {adjusted ? 'Adjusted send' : 'You send'}
            </span>
            <div className="text-right">
              <div className="text-text-primary font-figure font-bold text-lg font-mono">
                {finalSol.toFixed(6)} SOL
              </div>
              {usd(finalSol) && (
                <div className="text-text-muted text-xs">{usd(finalSol)}</div>
              )}
            </div>
          </div>
        </div>

        {/* Reasons */}
        {review.reasons.length > 0 && (
          <div className="space-y-2">
            {review.reasons.map((r, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: reason codes can repeat within one review; the index disambiguates them in this render-only, never-reordered list
                key={`${r.code}-${i}`}
                className="flex items-start gap-2 rounded-xl border p-3 text-xs"
                style={{
                  background: 'var(--surface-2)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <span
                  className="mt-0.5 h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: REASON_TONE[r.severity] }}
                />
                <div className="min-w-0">
                  <div className="text-text-primary font-medium">{r.title}</div>
                  <div className="text-text-muted leading-relaxed">
                    {r.message}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Fee breakdown */}
        <div className="rounded-2xl helio-card p-4 space-y-1.5 text-xs">
          <ReviewFeeRow
            label="Network fee"
            lamports={fees.networkFeeLamports}
            solPrice={solPrice}
          />
          {fees.priorityFeeLamports > 0 && (
            <ReviewFeeRow
              label="Priority fee"
              lamports={fees.priorityFeeLamports}
              solPrice={solPrice}
            />
          )}
          <ReviewFeeRow
            label="Rent reserve kept"
            lamports={fees.rentExemptionReserveLamports}
            solPrice={solPrice}
          />
          <div
            className="h-px my-1"
            style={{ background: 'var(--border-subtle)' }}
          />
          <ReviewFeeRow
            label="Est. total fees + reserve"
            lamports={fees.totalLamports}
            solPrice={solPrice}
            bold
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border py-3 text-sm font-medium text-text-primary hover:bg-surface-3 transition-colors"
            style={{
              background: 'var(--surface-2)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {blocked ? 'Close' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={blocked}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-full py-3 text-sm font-semibold transition-colors',
              blocked
                ? 'text-text-muted cursor-not-allowed'
                : 'bg-accent-primary text-accent-primary-foreground hover:bg-accent-primary-hover',
            )}
            style={blocked ? { background: 'var(--surface-3)' } : {}}
          >
            <Send className="h-3.5 w-3.5" />
            {adjusted ? `Send ${finalSol.toFixed(4)} SOL` : 'Confirm & send'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewFeeRow({
  label,
  lamports,
  solPrice,
  bold,
}: {
  label: string;
  lamports: number;
  solPrice: number;
  bold?: boolean;
}) {
  const sol = lamports / LAMPORTS_PER_SOL;
  return (
    <div className="flex items-center justify-between">
      <span className={cn('text-text-muted', bold && 'text-text-secondary')}>
        {label}
      </span>
      <div className="text-right">
        <span
          className={cn(
            'font-mono',
            bold ? 'text-text-primary font-semibold' : 'text-text-secondary',
          )}
        >
          {sol.toFixed(6)} SOL
        </span>
        {solPrice > 0 && (
          <span className="text-text-muted ml-1.5">
            ≈ ${(sol * solPrice).toFixed(4)}
          </span>
        )}
      </div>
    </div>
  );
}

function FeeRow({
  label,
  value,
  sub,
  accent,
  bold,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-muted text-xs">{label}</span>
      <div className="text-right">
        <div
          className={cn(
            'text-sm font-mono',
            accent && 'text-accent-primary font-medium',
            bold && 'text-text-primary font-semibold',
            !accent && !bold && 'text-text-secondary',
          )}
        >
          {value}
        </div>
        {sub && <div className="text-text-muted text-xs">{sub}</div>}
      </div>
    </div>
  );
}
