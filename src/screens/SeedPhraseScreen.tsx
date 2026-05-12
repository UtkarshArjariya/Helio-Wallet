import React from 'react'
import { useRouter } from '../contexts/RouterContext'
import { RevealFlow } from '../components/wallet/RevealFlow'
import {
  clearOnboardingMode, clearPendingPhrase,
} from '../lib/helio-program'

/**
 * Onboarding step that shows the freshly generated 12-word recovery phrase
 * for the first time. Reuses the same `RevealFlow` component as the Settings
 * → Export flows, so the user has to re-enter their wallet password before
 * the words are revealed. Adds one bit of friction now in exchange for
 * proving the user actually remembers what they just typed — they'll need it
 * every time they unlock from a cold start.
 */
export function SeedPhraseScreen() {
  const { navigate } = useRouter()

  return (
    <RevealFlow
      title="Recovery phrase"
      subtitle="12 words that restore your wallet on any device"
      intro="REVEAL THE MASTER KEY"
      introBody="Confirm your wallet password to view your recovery phrase. You'll see it once — save it somewhere safe before continuing. Anyone with these 12 words can move every asset out."
      extract={s => s.phrase}
      unsupportedHeadline="No phrase available."
      unsupportedBody="The recovery phrase wasn't stored. Please re-run wallet creation."
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
      doneLabel="Open wallet"
      onDone={() => {
        clearPendingPhrase()
        clearOnboardingMode()
        navigate('/')
      }}
      onCancel={() => {
        // From onboarding, cancel still completes the flow — the wallet is
        // already created; the user just declined to view the phrase.
        clearPendingPhrase()
        clearOnboardingMode()
        navigate('/')
      }}
    />
  )
}
