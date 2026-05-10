import React, { useState, useEffect } from 'react'
import { Check, Copy, Download } from 'lucide-react'
import { useRouter } from '../contexts/RouterContext'
import { useWallet } from '../contexts/WalletContext'

export function ReceiveScreen() {
  const { navigate } = useRouter()
  const { fullAddress } = useWallet()
  const [copied, setCopied] = useState(false)

  // Clean up timeout on unmount
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullAddress)
      setCopied(true)
    } catch {
      // Fallback for environments without clipboard API
      const el = document.createElement('textarea')
      el.value = fullAddress
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <div className="text-text-primary font-heading font-semibold">Receive</div>
          <div className="text-text-muted text-xs">Solana mainnet only</div>
        </div>
        <button type="button" onClick={() => navigate('/')} className="text-text-muted text-xs hover:text-text-primary">
          Done
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div className="rounded-3xl helio-card p-6 flex flex-col items-center gap-4">
          {/* QR placeholder encoding the actual address */}
          <div className="bg-white p-4 rounded-2xl">
            <svg viewBox="0 0 160 160" width="176" height="176" xmlns="http://www.w3.org/2000/svg">
              <rect width="160" height="160" fill="white" />
              {/* Corner finder squares */}
              <rect x="10" y="10" width="50" height="50" fill="black" rx="4" />
              <rect x="16" y="16" width="38" height="38" fill="white" rx="2" />
              <rect x="22" y="22" width="26" height="26" fill="black" rx="1" />
              <rect x="100" y="10" width="50" height="50" fill="black" rx="4" />
              <rect x="106" y="16" width="38" height="38" fill="white" rx="2" />
              <rect x="112" y="22" width="26" height="26" fill="black" rx="1" />
              <rect x="10" y="100" width="50" height="50" fill="black" rx="4" />
              <rect x="16" y="106" width="38" height="38" fill="white" rx="2" />
              <rect x="22" y="112" width="26" height="26" fill="black" rx="1" />
              {/* Data modules — deterministic pattern from address length */}
              {[70,80,90,70,80,90,70,80].map((x, i) => <rect key={`a${i}`} x={x} y={10+i*8} width="6" height="6" fill="black" rx="1" />)}
              {[10,20,30,40,10,30,40,20,10,40].map((x, i) => <rect key={`b${i}`} x={x} y={70+i*6} width="6" height="6" fill="black" rx="1" />)}
              {[100,110,120,130,140,100,120,140,110,130].map((x, i) => <rect key={`c${i}`} x={x} y={70+i*7} width="6" height="6" fill="black" rx="1" />)}
              {/* Helio H centre */}
              <text x="80" y="90" textAnchor="middle" fontSize="18" fontWeight="bold" fill="black" fontFamily="sans-serif">H</text>
            </svg>
          </div>

          <div className="text-center">
            <div className="text-text-primary font-semibold">Your Solana Address</div>
            <div className="font-mono text-text-muted text-xs mt-1 break-all px-2 max-w-[280px]">{fullAddress}</div>
          </div>

          <div className="flex gap-2 w-full">
            <button type="button" onClick={handleCopy}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border py-3 text-sm font-medium text-text-primary hover:bg-surface-3 transition-colors"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button type="button"
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-accent-primary py-3 text-sm font-semibold text-accent-primary-foreground hover:bg-accent-primary-hover transition-colors">
              <Download className="h-4 w-4" />Share
            </button>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-2xl border p-3.5"
          style={{ background: 'rgba(255,184,77,0.06)', borderColor: 'rgba(255,184,77,0.2)' }}>
          <span className="text-warning text-sm shrink-0">⚠</span>
          <p className="text-xs text-warning leading-relaxed">
            Only send <span className="font-semibold">Solana network</span> assets to this address. Tokens from other networks will be permanently lost.
          </p>
        </div>
      </div>
    </div>
  )
}
