import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  AlertTriangle,
  Check,
  CheckCircle,
  ChevronDown,
  ExternalLink,
  Layers,
  Loader2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ScreenHeader } from '../components/wallet/ui/ScreenHeader';
import { useWallet } from '../contexts/WalletContext';
import type { StakeAccountInfo, ValidatorInfo } from '../lib/staking';
import { cn } from '../lib/utils';

/** Reserve held back from a "MAX" stake for the stake-account rent (~0.00228
 *  SOL) plus the transaction fee, so the delegate actually fits. */
const STAKE_RESERVE_SOL = 0.0025;

const STATUS_STYLE: Record<
  StakeAccountInfo['status'],
  { label: string; color: string }
> = {
  active: { label: 'Active', color: 'var(--success)' },
  activating: { label: 'Activating', color: 'var(--warning)' },
  deactivating: { label: 'Deactivating', color: 'var(--warning)' },
  inactive: { label: 'Inactive', color: 'var(--text-muted)' },
};

function short(addr: string): string {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function StakingScreen() {
  const {
    tokens,
    hasKeypair,
    stakeAccounts,
    validators,
    stakeSol,
    deactivateStake,
    withdrawStake,
  } = useWallet();

  const sol = tokens.find((t) => t.id === 'sol');
  const balance = sol?.balance ?? 0;

  const [amount, setAmount] = useState('');
  const [vals, setVals] = useState<ValidatorInfo[]>([]);
  const [selected, setSelected] = useState<ValidatorInfo | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [positions, setPositions] = useState<StakeAccountInfo[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // op id in flight
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sig: string; url: string } | null>(
    null,
  );

  const refreshPositions = useCallback(async () => {
    setLoadingPositions(true);
    try {
      setPositions(await stakeAccounts());
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? `Could not load stake accounts: ${e.message}`
          : 'Could not load stake accounts.',
      );
    } finally {
      setLoadingPositions(false);
    }
  }, [stakeAccounts]);

  useEffect(() => {
    void refreshPositions();
  }, [refreshPositions]);

  useEffect(() => {
    let cancelled = false;
    void validators()
      .then((rows) => {
        if (cancelled) return;
        setVals(rows);
        setSelected((prev) => prev ?? rows[0] ?? null);
      })
      .catch(() => {
        /* leave empty */
      });
    return () => {
      cancelled = true;
    };
  }, [validators]);

  const numeric = parseFloat(amount) || 0;
  const canStake =
    hasKeypair &&
    numeric > 0 &&
    numeric <= balance &&
    selected !== null &&
    busy === null;

  const handleStake = async () => {
    if (!canStake || !selected) return;
    setBusy('stake');
    setError(null);
    setResult(null);
    try {
      const lamports = Math.floor(numeric * LAMPORTS_PER_SOL);
      const r = await stakeSol(lamports, selected.votePubkey);
      setResult({ sig: r.signature, url: r.explorerUrl });
      setAmount('');
      await refreshPositions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Staking failed.');
    } finally {
      setBusy(null);
    }
  };

  const runOp = async (
    id: string,
    op: () => Promise<{ signature: string; explorerUrl: string }>,
  ) => {
    setBusy(id);
    setError(null);
    setResult(null);
    try {
      const r = await op();
      setResult({ sig: r.signature, url: r.explorerUrl });
      await refreshPositions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transaction failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Stake SOL" subtitle="Native validator delegation" />

      <div className="relative p-4 space-y-4" style={{ isolation: 'isolate' }}>
        <div
          className="pointer-events-none absolute -left-12 top-20 h-60 w-60 rounded-full"
          style={{
            background: 'rgba(26,31,184,0.16)',
            filter: 'blur(80px)',
            zIndex: -1,
          }}
        />

        {!hasKeypair && (
          <div
            className="flex items-start gap-2 rounded-2xl border p-3 text-xs text-warning"
            style={{
              background: 'rgba(255,184,77,0.06)',
              borderColor: 'rgba(255,184,77,0.2)',
            }}
          >
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Wallet is locked. Unlock it to stake.</span>
          </div>
        )}

        {/* Stake form */}
        <div className="rounded-3xl helio-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-eyebrow text-text-muted text-[10px]">
              Amount to stake
            </span>
            <button
              type="button"
              onClick={() =>
                setAmount(String(Math.max(0, balance - STAKE_RESERVE_SOL)))
              }
              className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-accent-primary hover:opacity-80"
              style={{ background: 'rgba(198,240,0,0.12)' }}
            >
              MAX
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-text-primary text-sm font-medium">SOL</span>
            <input
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-transparent text-right font-figure text-3xl font-bold text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>
          <div className="text-xs text-text-muted font-mono text-right">
            Balance: {balance.toFixed(4)} SOL
          </div>

          {/* Validator picker */}
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors hover:bg-surface-3"
            style={{
              background: 'var(--surface-2)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div className="min-w-0">
              <div className="font-eyebrow text-text-muted text-[10px]">
                Validator
              </div>
              <div className="text-text-primary text-sm font-mono truncate">
                {selected ? short(selected.votePubkey) : 'Loading validators…'}
              </div>
            </div>
            {selected && (
              <div className="text-right shrink-0 ml-2">
                <div className="text-text-secondary text-xs">
                  {selected.commission}% fee
                </div>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-text-muted inline transition-transform',
                    pickerOpen && 'rotate-180',
                  )}
                />
              </div>
            )}
          </button>

          {pickerOpen && (
            <div
              className="max-h-56 overflow-y-auto helio-scrollbar rounded-2xl border divide-y"
              style={{
                borderColor: 'var(--border-subtle)',
                background: 'var(--surface-2)',
              }}
            >
              {vals.length === 0 && (
                <div className="px-4 py-3 text-text-muted text-xs">
                  No validators available on this cluster.
                </div>
              )}
              {vals.map((v) => (
                <button
                  key={v.votePubkey}
                  type="button"
                  onClick={() => {
                    setSelected(v);
                    setPickerOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-surface-3 transition-colors"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <span className="text-text-primary text-sm font-mono">
                    {short(v.votePubkey)}
                  </span>
                  <span className="text-text-muted text-xs">
                    {v.commission}% ·{' '}
                    {v.activatedStakeSol.toLocaleString('en-US', {
                      maximumFractionDigits: 0,
                    })}{' '}
                    SOL
                  </span>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleStake}
            disabled={!canStake}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold transition-colors',
              canStake
                ? 'bg-accent-primary text-accent-primary-foreground hover:bg-accent-primary-hover'
                : 'text-text-muted cursor-not-allowed',
            )}
            style={!canStake ? { background: 'var(--surface-3)' } : {}}
          >
            {busy === 'stake' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Layers className="h-4 w-4" />
            )}
            {busy === 'stake'
              ? 'Delegating…'
              : numeric > balance
                ? 'Insufficient balance'
                : numeric <= 0
                  ? 'Enter an amount'
                  : 'Stake & delegate'}
          </button>
        </div>

        {result && (
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-2xl border p-3 text-xs text-success"
            style={{
              background: 'rgba(16,185,129,0.08)',
              borderColor: 'rgba(16,185,129,0.25)',
            }}
          >
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              Transaction confirmed · {result.sig.slice(0, 16)}…
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </a>
        )}
        {error && (
          <div
            className="flex items-start gap-2 rounded-2xl border p-3 text-xs text-danger"
            style={{
              background: 'rgba(255,59,63,0.08)',
              borderColor: 'rgba(255,59,63,0.25)',
            }}
          >
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        )}

        {/* Positions */}
        <div>
          <div className="font-eyebrow text-text-muted text-[10px] px-1 mb-2">
            Your stake accounts
          </div>
          {loadingPositions ? (
            <div className="flex items-center justify-center gap-2 py-6 text-text-muted text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : positions.length === 0 ? (
            <div className="rounded-2xl helio-card p-4 text-text-muted text-xs text-center">
              No stake accounts yet. Delegate above to start earning epoch
              rewards.
            </div>
          ) : (
            <div className="space-y-2">
              {positions.map((p) => {
                const st = STATUS_STYLE[p.status];
                const opId = `op-${p.address}`;
                const inFlight = busy === opId;
                return (
                  <div key={p.address} className="rounded-2xl helio-card p-4">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-text-primary text-sm font-mono">
                          {short(p.address)}
                        </div>
                        <div className="text-text-muted text-xs">
                          {p.voter ? `→ ${short(p.voter)}` : 'Undelegated'}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className="text-text-primary text-sm font-mono font-semibold">
                          {(p.lamports / LAMPORTS_PER_SOL).toFixed(4)} SOL
                        </div>
                        <span
                          className="font-eyebrow text-[10px]"
                          style={{ color: st.color }}
                        >
                          {st.label}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      {(p.status === 'active' || p.status === 'activating') && (
                        <button
                          type="button"
                          disabled={inFlight}
                          onClick={() =>
                            runOp(opId, () => deactivateStake(p.address))
                          }
                          className="flex-1 rounded-full border py-2 text-xs font-medium text-text-primary hover:bg-surface-3 transition-colors disabled:opacity-50"
                          style={{
                            background: 'var(--surface-2)',
                            borderColor: 'var(--border-subtle)',
                          }}
                        >
                          {inFlight ? 'Working…' : 'Deactivate'}
                        </button>
                      )}
                      {p.status === 'inactive' && (
                        <button
                          type="button"
                          disabled={inFlight}
                          onClick={() =>
                            runOp(opId, () =>
                              withdrawStake(p.address, p.lamports),
                            )
                          }
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-accent-primary py-2 text-xs font-semibold text-accent-primary-foreground hover:bg-accent-primary-hover transition-colors disabled:opacity-50"
                        >
                          {inFlight ? (
                            'Working…'
                          ) : (
                            <>
                              <Check className="h-3 w-3" /> Withdraw all
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-text-muted text-[11px] leading-relaxed px-1">
          Native staking earns epoch rewards (~2–3 days/epoch). Deactivation
          takes one full epoch before funds become withdrawable. Stake accounts
          keep a small rent reserve.
        </p>
      </div>
    </div>
  );
}
