import React, { useEffect, useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { Connection } from '@solana/web3.js'
import { ScreenHeader } from '../../components/wallet/ui/ScreenHeader'
import { SettingsSection } from '../../components/wallet/settings/SettingsPrimitives'
import { NETWORKS, useNetwork, type NetworkCode } from '../../lib/preferences'
import { useWallet } from '../../contexts/WalletContext'
import { getExtensionProviderConfig } from '../../extension-runtime/provider-config'
import { cn } from '../../lib/utils'

type LatencyState = number | 'probing' | 'unreachable'

const PROBE_TIMEOUT_MS = 5_000

function clusterUrls(): Record<NetworkCode, string> {
  const cfg = getExtensionProviderConfig()
  return {
    mainnet: cfg.rpcEndpointPool['mainnet-beta'][0]?.url ?? 'https://api.mainnet-beta.solana.com',
    testnet: 'https://api.testnet.solana.com',
    devnet:  cfg.rpcEndpointPool.devnet[0]?.url ?? 'https://api.devnet.solana.com',
  }
}

/** Probe each cluster's RPC with getSlot() and record round-trip time. */
function useClusterLatencies(): Record<NetworkCode, LatencyState> {
  const [latencies, setLatencies] = useState<Record<NetworkCode, LatencyState>>({
    mainnet: 'probing', testnet: 'probing', devnet: 'probing',
  })

  useEffect(() => {
    let cancelled = false
    const urls = clusterUrls()

    for (const [code, url] of Object.entries(urls) as [NetworkCode, string][]) {
      const start = performance.now()
      const conn  = new Connection(url, 'confirmed')
      const timeoutId = setTimeout(() => {
        if (cancelled) return
        setLatencies(prev => prev[code] === 'probing' ? { ...prev, [code]: 'unreachable' } : prev)
      }, PROBE_TIMEOUT_MS)

      conn.getSlot()
        .then(() => {
          if (cancelled) return
          clearTimeout(timeoutId)
          setLatencies(prev => ({ ...prev, [code]: Math.round(performance.now() - start) }))
        })
        .catch(() => {
          if (cancelled) return
          clearTimeout(timeoutId)
          setLatencies(prev => ({ ...prev, [code]: 'unreachable' }))
        })
    }

    return () => { cancelled = true }
  }, [])

  return latencies
}

function latencyLabel(state: LatencyState): { text: string; tone: 'good' | 'warn' | 'bad' | 'muted' } {
  if (state === 'probing')      return { text: 'Probing…',      tone: 'muted' }
  if (state === 'unreachable')  return { text: 'Unreachable',   tone: 'bad'   }
  if (state < 300)              return { text: `${state}ms`,    tone: 'good'  }
  if (state < 1000)             return { text: `${state}ms`,    tone: 'warn'  }
  return                                   { text: `${state}ms`,    tone: 'warn'  }
}

export function NetworkSettingsScreen() {
  const [current, setCurrent] = useNetwork()
  const { network } = useWallet()
  const latencies = useClusterLatencies()

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Network" subtitle="Solana cluster" />

      <div className="p-4 space-y-4">
        {/* Current connection status */}
        <div className="rounded-3xl helio-card p-4 flex items-center gap-3">
          <span className={`h-2 w-2 rounded-full ${network.isHealthy ? 'bg-accent-primary helio-pulse-ring' : 'bg-danger'}`} />
          <div className="flex-1 min-w-0">
            <div className="text-text-primary text-sm font-medium">{network.label}</div>
            <div className="text-text-muted text-xs font-mono">
              {network.latencyMs != null ? `${network.latencyMs}ms latency` : 'Connecting…'}
            </div>
          </div>
          <span className="font-eyebrow text-[10px] text-text-muted">
            {network.isHealthy ? 'HEALTHY' : 'DEGRADED'}
          </span>
        </div>

        <SettingsSection label="Cluster">
          {NETWORKS.map((n) => {
            const active = n.code === current
            const lbl    = latencyLabel(latencies[n.code])
            const toneClass =
              lbl.tone === 'good' ? 'text-success'
              : lbl.tone === 'warn' ? 'text-warning'
              : lbl.tone === 'bad'  ? 'text-danger'
              : 'text-text-muted'
            return (
              <button
                key={n.code}
                type="button"
                onClick={() => setCurrent(n.code)}
                className="flex w-full items-center gap-3 px-4 py-3 hover:bg-surface-3 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className={cn('text-sm font-medium', active ? 'text-text-primary' : 'text-text-secondary')}>
                    {n.label}
                  </div>
                  <div className="text-text-muted text-xs mt-0.5">{n.subtitle}</div>
                </div>
                <div className={cn('font-mono text-[11px] shrink-0', toneClass)}>{lbl.text}</div>
                {active && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-primary text-accent-primary-foreground shrink-0">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
              </button>
            )
          })}
        </SettingsSection>

        {current !== 'mainnet' && (
          <div className="flex items-start gap-2 rounded-2xl border p-3 text-xs"
            style={{ background: 'rgba(255,184,77,0.06)', borderColor: 'rgba(255,184,77,0.2)', color: 'var(--warning)' }}>
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="leading-relaxed">
              Testnet and devnet balances are not real. Tokens received here have no monetary value and may be reset.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
