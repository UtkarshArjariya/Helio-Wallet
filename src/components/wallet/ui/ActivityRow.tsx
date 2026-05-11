import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Layers, Sparkles, TrendingUp,
} from 'lucide-react'
import { cn } from '../../../lib/utils'

export type ActivityKind =
  | 'send' | 'receive' | 'swap' | 'stake' | 'unstake'
  | 'vault-roundup' | 'vault-deploy' | 'vault-reward' | 'vault-withdraw'

export type ActivityItem = {
  id: string
  kind: ActivityKind
  date: string          // ISO
  title: string
  subtitle: string
  amount: string
  fiat?: string
  positive?: boolean
}

const ICONS: Record<ActivityKind, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  send:             { icon: ArrowUpRight,    color: 'text-danger bg-danger/10' },
  receive:          { icon: ArrowDownLeft,   color: 'text-success bg-success/10' },
  swap:             { icon: ArrowLeftRight,  color: 'text-info bg-info/10' },
  stake:            { icon: Layers,          color: 'text-accent-secondary bg-accent-secondary/10' },
  unstake:          { icon: Layers,          color: 'text-accent-secondary bg-accent-secondary/10' },
  'vault-roundup':  { icon: Sparkles,        color: 'text-accent-primary bg-accent-primary/10' },
  'vault-deploy':   { icon: TrendingUp,      color: 'text-accent-secondary bg-accent-secondary/10' },
  'vault-reward':   { icon: TrendingUp,      color: 'text-success bg-success/10' },
  'vault-withdraw': { icon: ArrowDownLeft,   color: 'text-warning bg-warning/10' },
}

export function ActivityRow({ item, compact = false }: { item: ActivityItem; compact?: boolean }) {
  const { icon: Icon, color } = ICONS[item.kind]
  const date = new Date(item.date)
  const reduce = useReducedMotion()

  return (
    <motion.div
      whileHover={reduce ? undefined : { x: 2 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-3 transition-colors cursor-pointer"
    >
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', color)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-text-primary text-sm font-medium truncate">{item.title}</div>
        <div className="text-text-muted text-xs truncate">
          {compact
            ? item.subtitle
            : `${item.subtitle}${item.subtitle ? ' · ' : ''}${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div
          className={cn(
            'text-sm font-medium font-mono',
            item.positive === true && 'text-success',
            item.positive === false && 'text-danger',
            item.positive === undefined && 'text-text-primary',
          )}
        >
          {item.amount}
        </div>
        {item.fiat && <div className="text-text-muted text-xs font-mono">{item.fiat}</div>}
      </div>
    </motion.div>
  )
}
