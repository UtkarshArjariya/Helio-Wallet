import React from 'react'
import bs58 from 'bs58'
import { RevealFlow } from '../../components/wallet/RevealFlow'

/** Encode the 64-byte ed25519 secret key as base58 — the format Phantom and
 *  every other Solana wallet accepts on import. */
function secretKeyToBase58(secret: Uint8Array): string {
  return bs58.encode(secret)
}

export function ExportPrivateKeyScreen() {
  return (
    <RevealFlow
      title="Export private key"
      subtitle="Base58-encoded ed25519 secret key"
      intro="REVEAL THE PRIVATE KEY"
      introBody="The private key fully controls this wallet. Anyone holding it can sign any transaction. Confirm your password to continue."
      extract={s => secretKeyToBase58(s.secretKey)}
      unsupportedHeadline="Private key unavailable."
      unsupportedBody="The encrypted vault on this device could not be unsealed. Restore your wallet via the recovery phrase to enable export."
      downloadFilename={`helio-private-key-${new Date().toISOString().slice(0, 10)}.txt`}
      downloadBody={(key) => [
        'Helio Wallet — Private key (base58)',
        '',
        `Date: ${new Date().toISOString().slice(0, 10)}`,
        '',
        'KEEP THIS KEY SECRET.',
        'Anyone with this key can drain this wallet.',
        'Phantom, Solflare and Backpack accept this format on import.',
        '',
        key,
        '',
      ].join('\n')}
      render={(key, revealed) => (
        <div className="rounded-2xl border p-4"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
          <div className="font-eyebrow text-text-muted text-[10px] mb-2">Base58</div>
          <div className="font-mono text-xs text-text-primary break-all leading-relaxed select-text"
            style={{ filter: revealed ? 'none' : 'blur(6px)' }}>
            {revealed ? key : key /* placeholder still keeps layout — blur masks it */}
          </div>
        </div>
      )}
    />
  )
}
