import React from 'react'
import { ChevronLeft, X } from 'lucide-react'
import { useRouter } from '../../../contexts/RouterContext'
import { cn } from '../../../lib/utils'

export function ScreenHeader({
  title, subtitle, onBack, showBack = true, rightSlot, className,
}: {
  title: string
  subtitle?: string
  onBack?: () => void
  showBack?: boolean
  rightSlot?: React.ReactNode
  className?: string
}) {
  const { back } = useRouter()
  const handleBack = onBack ?? back

  return (
    <div
      className={cn(
        'sticky top-0 z-20 flex items-center gap-3 px-4 py-3 backdrop-blur-md border-b',
        className,
      )}
      style={{
        background: 'color-mix(in oklab, var(--bg) 80%, transparent)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {showBack && (
        <button
          type="button"
          onClick={handleBack}
          aria-label="Go back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:text-text-primary transition-colors"
          style={{ background: 'var(--surface-2)' }}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-heading text-text-primary font-semibold leading-tight truncate">
          {title}
        </div>
        {subtitle && <div className="text-text-muted text-xs truncate">{subtitle}</div>}
      </div>
      {rightSlot}
    </div>
  )
}

export function CloseButton({ onClose }: { onClose?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:text-text-primary transition-colors"
      style={{ background: 'var(--surface-2)' }}
    >
      <X className="h-4 w-4" />
    </button>
  )
}
