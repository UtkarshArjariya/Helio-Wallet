import React from 'react'

/**
 * Editorial section label. Renders a small numbered eyebrow followed by a
 * title and an optional trailing action — meant to break the "stack of
 * identical cards" rhythm with typography rather than another card.
 */
export function SectionEyebrow({
  index, title, count, action,
}: {
  index?: string
  title: string
  count?: string | number
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-end justify-between gap-3 px-1 pt-1">
      <div className="flex items-baseline gap-2 min-w-0">
        {index && (
          <span className="font-mono text-[10px] text-text-muted tracking-widest">
            {index} //
          </span>
        )}
        <span className="font-heading text-text-primary text-[13px] font-semibold uppercase tracking-[0.12em]">
          {title}
        </span>
        {count !== undefined && (
          <span className="font-mono text-[10px] text-text-muted">
            {count}
          </span>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
