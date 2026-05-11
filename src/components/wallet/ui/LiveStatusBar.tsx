import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * Thin 1.5 px hairline status bar designed to live at the very top of the
 * app shell. Two states:
 *
 *  - idle (default): a 30%-opacity lime line with a slow ambient pulse —
 *    just enough to read as "instrument is on".
 *  - live (loading=true): a brighter lime stripe that travels left→right
 *    in a tight loop, like a packet indicator on a network device.
 *
 * Respects prefers-reduced-motion (drops the traveling stripe in favour of a
 * static brighter line when loading).
 */
export function LiveStatusBar({
  loading = false,
  healthy = true,
  className,
}: {
  loading?: boolean
  healthy?: boolean
  className?: string
}) {
  const reduce = useReducedMotion()

  // Unhealthy network turns the strip red, regardless of loading.
  const color = healthy ? 'var(--accent-primary)' : 'var(--danger)'

  return (
    <div
      aria-hidden
      className={`relative h-[1.5px] w-full overflow-hidden ${className ?? ''}`}
      style={{ background: healthy ? 'rgba(198,240,0,0.10)' : 'rgba(255,59,63,0.14)' }}
    >
      {/* Idle ambient pulse */}
      {!loading && (
        <motion.span
          className="absolute inset-0"
          style={{ background: color }}
          initial={{ opacity: 0.25 }}
          animate={reduce ? { opacity: 0.4 } : { opacity: [0.18, 0.55, 0.18] }}
          transition={reduce
            ? { duration: 0 }
            : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Live traveling stripe */}
      {loading && !reduce && (
        <motion.span
          className="absolute top-0 bottom-0 w-1/3"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${color} 50%, transparent 100%)`,
            boxShadow: `0 0 8px ${color}`,
          }}
          initial={{ x: '-100%' }}
          animate={{ x: '300%' }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {/* Loading + reduced-motion → static brighter line */}
      {loading && reduce && (
        <span className="absolute inset-0" style={{ background: color, opacity: 0.65 }} />
      )}
    </div>
  )
}
