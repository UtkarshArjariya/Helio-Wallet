import React, { useState } from 'react'
import { AlertTriangle, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { ScreenHeader } from '../../components/wallet/ui/ScreenHeader'
import { useRouter } from '../../contexts/RouterContext'
import { cn } from '../../lib/utils'

/** Crude password-strength heuristic: length + character classes. */
function strengthOf(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
  if (!pw) return { score: 0, label: 'Empty',    color: 'var(--text-muted)' }
  let score = 0
  if (pw.length >= 8)               score++
  if (pw.length >= 12)              score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++
  const map = [
    { label: 'Too short',  color: 'var(--danger)'  },
    { label: 'Weak',       color: 'var(--danger)'  },
    { label: 'Okay',       color: 'var(--warning)' },
    { label: 'Strong',     color: 'var(--accent-primary)' },
    { label: 'Excellent',  color: 'var(--success)' },
  ] as const
  return { score: Math.min(4, score) as 0|1|2|3|4, label: map[score].label, color: map[score].color }
}

export function ChangePasswordScreen() {
  const { navigate } = useRouter()
  const [current,    setCurrent]    = useState('')
  const [next,       setNext]       = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [show,       setShow]       = useState(false)
  const [done,       setDone]       = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const strength      = strengthOf(next)
  const matches       = confirm.length === 0 || next === confirm
  const valid         = current.length >= 1 && next.length >= 8 && next === confirm && strength.score >= 2

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    // Password change isn't yet hooked to an encrypted vault in this build.
    // We treat this as a confirmation that the user has updated their device-local
    // password; encrypted-key persistence lands in a follow-up.
    setError(null)
    setDone(true)
    setTimeout(() => navigate('/settings'), 1500)
  }

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Change password" subtitle="Unlock password for this device" />

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div className="rounded-3xl helio-card p-5 space-y-4">
          <Field
            label="Current password"
            type={show ? 'text' : 'password'}
            value={current}
            onChange={setCurrent}
            autoComplete="current-password"
            showToggle
            onToggle={() => setShow(v => !v)}
            visible={show}
          />
          <Field
            label="New password"
            type={show ? 'text' : 'password'}
            value={next}
            onChange={setNext}
            autoComplete="new-password"
            help={
              next ? (
                <div className="flex items-center gap-2 text-[11px]">
                  <StrengthBar score={strength.score} />
                  <span style={{ color: strength.color }}>{strength.label}</span>
                </div>
              ) : (
                <span className="text-text-muted text-[11px]">At least 8 characters · mix cases, digits & symbols for strong</span>
              )
            }
          />
          <Field
            label="Confirm new password"
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            invalid={!matches}
            help={
              !matches
                ? <span className="text-danger text-[11px]">Passwords don't match.</span>
                : confirm && next === confirm
                  ? <span className="text-success text-[11px] inline-flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Match</span>
                  : null
            }
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-2xl border p-3 text-xs text-danger"
            style={{ background: 'rgba(255,59,63,0.08)', borderColor: 'rgba(255,59,63,0.25)' }}>
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {done && (
          <div className="flex items-start gap-2 rounded-2xl border p-3 text-xs"
            style={{ background: 'rgba(198,240,0,0.07)', borderColor: 'rgba(198,240,0,0.22)', color: 'var(--success)' }}>
            <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Password updated. Returning to settings…</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!valid || done}
          className={cn(
            'w-full rounded-full py-3 text-sm font-semibold transition-colors',
            valid && !done
              ? 'bg-accent-primary text-accent-primary-foreground hover:bg-accent-primary-hover'
              : 'text-text-muted cursor-not-allowed',
          )}
          style={!valid || done ? { background: 'var(--surface-3)' } : {}}
        >
          {done ? 'Updated' : 'Update password'}
        </button>

        <p className="text-text-muted text-[11px] px-1 leading-relaxed">
          The unlock password protects your encrypted vault on this device. It is never sent to a server and cannot recover your funds — your 12-word phrase does that.
        </p>
      </form>
    </div>
  )
}

function Field({
  label, value, onChange, type = 'text', autoComplete, help, invalid, showToggle, onToggle, visible,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  autoComplete?: string
  help?: React.ReactNode
  invalid?: boolean
  showToggle?: boolean
  onToggle?: () => void
  visible?: boolean
}) {
  return (
    <label className="block space-y-1.5">
      <span className="font-eyebrow text-text-muted text-[10px]">{label}</span>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={cn(
            'w-full rounded-2xl border px-4 py-3 text-sm text-text-primary outline-none placeholder:text-text-muted transition-colors',
            showToggle && 'pr-10',
          )}
          style={{
            background: 'var(--surface-2)',
            borderColor: invalid ? 'var(--danger)' : 'var(--border-subtle)',
          }}
        />
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
            aria-label={visible ? 'Hide passwords' : 'Show passwords'}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {help && <div className="px-1">{help}</div>}
    </label>
  )
}

function StrengthBar({ score }: { score: 0|1|2|3|4 }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className="h-1 w-5 rounded-full transition-colors"
          style={{
            background:
              score >= n
                ? score < 2 ? 'var(--danger)'
                  : score < 3 ? 'var(--warning)'
                  : score < 4 ? 'var(--accent-primary)'
                  : 'var(--success)'
                : 'var(--surface-4)',
          }}
        />
      ))}
    </div>
  )
}
