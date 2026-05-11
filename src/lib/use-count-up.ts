import { useEffect, useRef, useState } from 'react'

/**
 * Animate a numeric value toward `target` with an ease-out cubic curve.
 *
 * Returns a number that the caller formats. Reacts to target changes by
 * resuming from the current displayed value rather than jumping back to zero,
 * so successive updates feel like ticker increments instead of full restarts.
 *
 * Respects `prefers-reduced-motion` — snaps directly to the target.
 */
export function useCountUp(target: number, durationMs = 800): number {
  const [value, setValue] = useState(target)
  const fromRef    = useRef(target)
  const startedRef = useRef<number | null>(null)
  const rafRef     = useRef<number | null>(null)

  useEffect(() => {
    // Respect reduced motion
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setValue(target); return }

    if (!Number.isFinite(target)) { setValue(0); return }

    fromRef.current    = value
    startedRef.current = null

    const tick = (now: number) => {
      if (startedRef.current === null) startedRef.current = now
      const elapsed = now - startedRef.current
      const t = Math.min(1, elapsed / durationMs)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(fromRef.current + (target - fromRef.current) * eased)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs])

  return value
}
