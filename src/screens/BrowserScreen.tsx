import React, { useState, useRef } from 'react'
import { ArrowLeft, ArrowRight, RotateCw, X, Search, ExternalLink, Star } from 'lucide-react'
import { cn } from '../lib/utils'

interface DApp {
  id: string
  name: string
  url: string
  description: string
  category: 'dex' | 'lending' | 'staking' | 'nft' | 'perps'
  featured?: boolean
}

const RECOMMENDED: DApp[] = [
  { id: 'jupiter',   name: 'Jupiter',           url: 'https://jup.ag',                   description: 'Best-price DEX aggregator',           category: 'dex',     featured: true },
  { id: 'kamino',    name: 'Kamino Finance',     url: 'https://app.kamino.finance',        description: 'Lending & yield strategies',          category: 'lending', featured: true },
  { id: 'jito',      name: 'Jito',              url: 'https://www.jito.network',           description: 'Liquid staking with MEV rewards',     category: 'staking', featured: true },
  { id: 'raydium',   name: 'Raydium',           url: 'https://raydium.io',                description: 'AMM + concentrated liquidity',        category: 'dex' },
  { id: 'drift',     name: 'Drift Protocol',    url: 'https://app.drift.trade',            description: 'Perpetual futures & spot trading',    category: 'perps' },
  { id: 'marinade',  name: 'Marinade',          url: 'https://marinade.finance',           description: 'Native & liquid SOL staking',         category: 'staking' },
  { id: 'msolend',   name: 'Solend',            url: 'https://solend.fi',                  description: 'Algorithmic lending & borrowing',     category: 'lending' },
  { id: 'magiceden', name: 'Magic Eden',        url: 'https://magiceden.io',              description: 'Leading NFT marketplace on Solana',   category: 'nft' },
  { id: 'tensor',    name: 'Tensor',            url: 'https://www.tensor.trade',           description: 'Pro NFT trading & analytics',         category: 'nft' },
  { id: 'orca',      name: 'Orca',              url: 'https://www.orca.so',               description: 'User-friendly concentrated AMM',      category: 'dex' },
]

const CATEGORY_LABELS: Record<DApp['category'], string> = {
  dex: 'DEX', lending: 'Lending', staking: 'Staking', nft: 'NFT', perps: 'Perps',
}

const CATEGORY_COLORS: Record<DApp['category'], string> = {
  dex:     'rgba(198,240,0,0.12)',
  lending: 'rgba(26,31,184,0.18)',
  staking: 'rgba(26,31,184,0.14)',
  nft:     'rgba(255,59,63,0.12)',
  perps:   'rgba(255,184,77,0.14)',
}

const CATEGORY_TEXT: Record<DApp['category'], string> = {
  dex:     '#c6f000',
  lending: '#818cf8',
  staking: '#93c5fd',
  nft:     '#ff3b3f',
  perps:   '#ffb84d',
}

const DApp_INITIALS: Record<string, string> = {
  jupiter: 'J', kamino: 'K', jito: 'Ji', raydium: 'R',
  drift: 'D', marinade: 'M', msolend: 'S', magiceden: 'ME', tensor: 'T', orca: 'O',
}

const DApp_COLORS: Record<string, string> = {
  jupiter: '#c6f000', kamino: '#00d1ff', jito: '#00c896', raydium: '#4facfe',
  drift: '#ab8ff9', marinade: '#9af2b4', msolend: '#f7b955', magiceden: '#e42575',
  tensor: '#ff6b35', orca: '#0097fc',
}

function openUrl(url: string) {
  // In extension context use chrome.tabs.create; fall back to window.open
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    chrome.tabs.create({ url })
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

export function BrowserScreen() {
  const [urlInput, setUrlInput] = useState('')
  const [activeFilter, setActiveFilter] = useState<DApp['category'] | 'all'>('all')
  const inputRef = useRef<HTMLInputElement>(null)

  const navigate = (raw: string) => {
    let url = raw.trim()
    if (!url) return
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Treat plain text as a search query if it contains spaces or no dot
      if (url.includes(' ') || !url.includes('.')) {
        url = `https://www.google.com/search?q=${encodeURIComponent(url)}`
      } else {
        url = `https://${url}`
      }
    }
    openUrl(url)
    setUrlInput('')
  }

  const filtered = activeFilter === 'all'
    ? RECOMMENDED
    : RECOMMENDED.filter((d) => d.category === activeFilter)

  const featured = RECOMMENDED.filter((d) => d.featured)
  const categories = Array.from(new Set(RECOMMENDED.map((d) => d.category))) as DApp['category'][]

  return (
    <div className="flex flex-col h-full">
      {/* URL bar */}
      <div className="sticky top-0 z-20 px-3 py-3 border-b"
        style={{ background: 'var(--bg)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2 rounded-2xl border px-3 py-2"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
          <Search className="h-4 w-4 text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="url"
            inputMode="url"
            placeholder="Search or enter URL…"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate(urlInput) }}
            className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-muted"
          />
          {urlInput && (
            <button type="button" onClick={() => { setUrlInput(''); inputRef.current?.focus() }}
              className="text-text-muted hover:text-text-primary transition-colors shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {urlInput && (
            <button type="button" onClick={() => navigate(urlInput)}
              className="rounded-full bg-accent-primary px-3 py-1 text-xs font-semibold text-accent-primary-foreground hover:bg-accent-primary-hover transition-colors shrink-0">
              Go
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto helio-scrollbar">
        <div className="p-4 space-y-5">
          {/* Featured row */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-4 w-4 text-accent-primary" />
              <span className="text-text-primary font-semibold text-sm">Featured</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {featured.map((dapp) => (
                <button key={dapp.id} type="button" onClick={() => openUrl(dapp.url)}
                  className="flex flex-col items-center gap-2 rounded-2xl border p-3 hover:bg-surface-3 transition-colors text-center"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
                  <div className="h-11 w-11 rounded-2xl flex items-center justify-center font-bold text-sm text-black shrink-0"
                    style={{ background: DApp_COLORS[dapp.id] ?? 'var(--accent-primary)' }}>
                    {DApp_INITIALS[dapp.id]}
                  </div>
                  <div>
                    <div className="text-text-primary text-xs font-semibold leading-tight">{dapp.name}</div>
                    <div className="text-text-muted text-[10px] leading-tight mt-0.5">{CATEGORY_LABELS[dapp.category]}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto helio-scrollbar -mx-4 px-4 pb-1">
            {(['all', ...categories] as const).map((cat) => (
              <button key={cat} type="button" onClick={() => setActiveFilter(cat)}
                className={cn('rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors border capitalize',
                  activeFilter === cat ? 'bg-accent-primary text-accent-primary-foreground border-transparent' : 'text-text-secondary hover:text-text-primary')}
                style={{ background: activeFilter === cat ? undefined : 'var(--surface-2)', borderColor: activeFilter === cat ? 'transparent' : 'var(--border-subtle)' }}>
                {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* All dApps list */}
          <div className="rounded-2xl helio-card overflow-hidden">
            {filtered.map((dapp, i) => (
              <button key={dapp.id} type="button" onClick={() => openUrl(dapp.url)}
                className={cn('flex w-full items-center gap-3 px-4 py-3.5 hover:bg-surface-3 transition-colors text-left',
                  i < filtered.length - 1 && 'border-b')}
                style={i < filtered.length - 1 ? { borderColor: 'var(--border-subtle)' } : {}}>
                {/* Icon */}
                <div className="h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm text-black shrink-0"
                  style={{ background: DApp_COLORS[dapp.id] ?? 'var(--accent-primary)' }}>
                  {DApp_INITIALS[dapp.id]}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-text-primary text-sm font-medium">{dapp.name}</span>
                    <span className="text-[10px] font-semibold rounded-full px-1.5 py-0.5 shrink-0"
                      style={{ background: CATEGORY_COLORS[dapp.category], color: CATEGORY_TEXT[dapp.category] }}>
                      {CATEGORY_LABELS[dapp.category]}
                    </span>
                  </div>
                  <div className="text-text-muted text-xs truncate mt-0.5">{dapp.description}</div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-text-muted shrink-0" />
              </button>
            ))}
          </div>

          <p className="text-center text-[10px] text-text-muted pb-2">
            Links open in a new browser tab. Always verify the URL before connecting your wallet.
          </p>
        </div>
      </div>
    </div>
  )
}
