import React from 'react'
import { RevealFlow } from '../../components/wallet/RevealFlow'

export function ExportRecoveryPhraseScreen() {
  return (
    <RevealFlow
      title="Export recovery phrase"
      subtitle="12 words that restore your wallet on any device"
      intro="REVEAL THE MASTER KEY"
      introBody="Your recovery phrase is the master key to this wallet. Anyone who sees it can move every asset out — no chargebacks, no support recovery. Confirm your password to continue."
      extract={s => s.phrase}
      unsupportedHeadline="No phrase stored for this wallet."
      unsupportedBody="This wallet was imported via private key, or was created in an earlier version that didn't persist the phrase. To enable phrase export, re-import the wallet using its 12-word recovery phrase from the welcome screen."
      downloadFilename={`helio-recovery-${new Date().toISOString().slice(0, 10)}.txt`}
      downloadBody={(phrase) => [
        'Helio Wallet — Recovery phrase',
        '',
        `Date: ${new Date().toISOString().slice(0, 10)}`,
        '',
        'KEEP THIS PHRASE SECRET.',
        'Anyone with these 12 words can drain this wallet.',
        'Helio cannot recover lost phrases.',
        '',
        ...phrase.split(/\s+/).map((w, i) => `${String(i + 1).padStart(2, '0')}  ${w}`),
        '',
      ].join('\n')}
      render={(phrase, revealed) => {
        const words = phrase.split(/\s+/)
        return (
          <div className="rounded-2xl border p-3 grid grid-cols-3 gap-2"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
            {words.map((w, i) => (
              <div key={i}
                className="flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-sm font-mono"
                style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}>
                <span className="text-text-muted text-[10px] w-4 shrink-0 select-none">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-text-primary truncate">
                  {revealed ? w : '••••••'}
                </span>
              </div>
            ))}
          </div>
        )
      }}
    />
  )
}
