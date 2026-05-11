import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * Reveal a block with a 8 px slide-up + fade. Designed for short staggered
 * entrances on screen mount. Respects prefers-reduced-motion (drops the
 * transform, keeps the opacity fade trimmed).
 */
export function FadeUp({
  children,
  delay = 0,
  y = 8,
  duration = 0.36,
  className,
  as: As = 'div',
}: {
  children: React.ReactNode
  delay?: number
  y?: number
  duration?: number
  className?: string
  as?: 'div' | 'section' | 'header' | 'article'
}) {
  const reduce = useReducedMotion()
  const M = motion[As] as typeof motion.div

  return (
    <M
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0.18 : duration, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </M>
  )
}
