import React, { useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert, AlertTriangle, Globe, Loader2, Lock } from 'lucide-react'
import type { PendingDappRequest, DappTrustLevel } from '@helio/types'
import { hasSecret } from '../../lib/secret-store'
import { useRouter } from '../../contexts/RouterContext'

/** Send an envelope to the background worker. Resolves to the response envelope,
 *  or null when not running inside the extension (e.g. the Vercel SPA). */
function callBackground(
  type: string,
  payload: unknown,
): Promise<{ ok: boolean; data?: unknown; error?: { message?: string } } | null> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) { resolve(null); return }
    try {
      chrome.runtime.sendMessage({ type, payload }, (res: any) => {
        if (chrome.runtime.lastError) { resolve(null); return }
        resolve(res ?? null)
      })
    } catch { resolve(null) }
  })
}

const TRUST: Record<DappTrustLevel, { label: string; color: string; Icon: typeof ShieldCheck }> = {
  verified: { label: 'Verified', color: 'var(--success)', Icon: ShieldCheck },
  unknown:  { label: 'Unverified', color: 'var(--text-muted)', Icon: Globe },
  flagged:  { label: 'Flagged', color: 'var(--danger)', Icon: ShieldAlert },
}

function actionText(req: PendingDappRequest): { title: string; body: string } {
  switch (req.kind) {
    case 'connect':
      return { title: 'wants to connect', body: 'It will be able to see your wallet address and request transactions and signatures.' }
    case 'sign-transaction':
      return { title: 'wants you to approve a transaction', body: 'Review the request carefully — approving will sign a transaction with your wallet.' }
    case 'sign-message':
      return { title: 'wants you to sign a message', body: req.messagePreview }
  }
}

/**
 * Global dApp-approval surface for the shipped popup. Polls the background for a
 * pending Wallet-Standard request and lets the user approve/reject it. Signing
 * happens in the background worker — this UI only sends the decision.
 *
 * Renders nothing outside the extension (no `chrome.runtime`).
 */
export function DappApprovalOverlay() {
  const { navigate } = useRouter()
  const [pending, setPending] = useState<PendingDappRequest | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      const res = await callBackground('helio/get-pending-dapp-request', undefined)
      if (cancelled) return
      setPending((res?.ok ? (res.data as PendingDappRequest | null) : null) ?? null)
      timer = setTimeout(poll, 600)
    }
    void poll()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [])

  if (!pending) return null

  const locked = !hasSecret()
  const trust = TRUST[pending.dapp.trustLevel]
  const { title, body } = actionText(pending)
  const warnings = 'warnings' in pending ? pending.warnings : []
  // Only render page-supplied icons over https (avoid http tracking pixels).
  const safeIcon =
    pending.dapp.iconUrl && /^https:\/\//i.test(pending.dapp.iconUrl) ? pending.dapp.iconUrl : null

  const decide = async (approve: boolean) => {
    setBusy(true); setError(null)
    const res = await callBackground(
      approve ? 'helio/approve-dapp-request' : 'helio/reject-dapp-request',
      { requestId: pending.id },
    )
    setBusy(false)
    if (approve && (res === null || !res.ok)) {
      setError(res?.error?.message ?? 'Could not complete the request.')
      return // leave the request up; the next poll re-syncs
    }
    setPending(null) // optimistic; the next poll confirms the worker cleared it
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl helio-card p-5 space-y-4">
        {/* dApp identity */}
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl overflow-hidden shrink-0"
            style={{ background: 'var(--surface-3)' }}>
            {safeIcon
              ? <img src={safeIcon} alt="" className="h-full w-full object-cover" />
              : <Globe className="h-5 w-5 text-text-muted" />}
          </span>
          <div className="min-w-0">
            <div className="text-text-primary font-heading font-semibold text-base truncate">{pending.dapp.name}</div>
            <div className="text-text-muted text-xs font-mono truncate">{pending.dapp.origin}</div>
          </div>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-eyebrow shrink-0"
            style={{ background: 'color-mix(in srgb, ' + trust.color + ' 14%, transparent)', color: trust.color }}>
            <trust.Icon className="h-3 w-3" />{trust.label}
          </span>
        </div>

        <div>
          <div className="text-text-primary text-sm">
            <span className="font-semibold">{pending.dapp.name}</span> {title}
          </div>
          <p className="text-text-muted text-xs mt-1 leading-relaxed break-words">{body}</p>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((w, i) => (
              <div key={`${w.code}-${i}`} className="flex items-start gap-2 rounded-xl border p-3 text-xs"
                style={{
                  background: w.severity === 'critical' ? 'rgba(255,59,63,0.08)' : 'rgba(255,184,77,0.06)',
                  borderColor: w.severity === 'critical' ? 'rgba(255,59,63,0.25)' : 'rgba(255,184,77,0.2)',
                  color: w.severity === 'critical' ? 'var(--danger)' : 'var(--warning)',
                }}>
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div><div className="font-medium">{w.title}</div><div className="opacity-90">{w.message}</div></div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border p-3 text-xs text-danger"
            style={{ background: 'rgba(255,59,63,0.08)', borderColor: 'rgba(255,59,63,0.25)' }}>
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        )}

        {locked ? (
          <button type="button" onClick={() => navigate('/unlock')}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-accent-primary py-3 text-sm font-semibold text-accent-primary-foreground hover:bg-accent-primary-hover transition-colors">
            <Lock className="h-4 w-4" /> Unlock Helio to continue
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => decide(false)}
              className="rounded-full border py-3 text-sm font-medium text-text-primary hover:bg-surface-3 transition-colors disabled:opacity-50"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
              Reject
            </button>
            <button type="button" disabled={busy} onClick={() => decide(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-accent-primary py-3 text-sm font-semibold text-accent-primary-foreground hover:bg-accent-primary-hover transition-colors disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {pending.kind === 'connect' ? 'Connect' : 'Approve'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
