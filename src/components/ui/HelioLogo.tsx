import React from 'react'
// Vite resolves this relative to the project root — Assets/ sits next to src/
import fullLogoTransparent from '../../../Assets/full-logo-transparent.png'
import illustrationLogoSvg from '../../../Assets/illustration-logo-transparent.svg'

type Tone = 'light' | 'dark' | 'lime'
type Size = 'xs' | 'sm' | 'md' | 'lg'

const heights: Record<Size, number> = { xs: 20, sm: 26, md: 32, lg: 44 }

/**
 * Full wordmark logo (mascot blob + "helio" text).
 * Source PNG is jet-black on transparent — use the `tone` prop to recolor:
 *  - 'light' → inverts to pure white (for dark backgrounds)
 *  - 'dark'  → keeps original black (for light backgrounds)
 *  - 'lime'  → recolors to Electric Lime #C6F000
 */
export function HelioWordmark({
  size = 'sm',
  tone = 'light',
  className = '',
}: {
  size?: Size
  tone?: Tone
  className?: string
}) {
  const h = heights[size]
  const filter =
    tone === 'light'
      ? 'brightness(0) saturate(100%) invert(100%)'
      : tone === 'lime'
      ? 'brightness(0) saturate(100%) invert(86%) sepia(64%) saturate(2089%) hue-rotate(25deg) brightness(105%) contrast(105%)'
      : 'none'

  return (
    <img
      src={fullLogoTransparent}
      alt="Helio"
      height={h}
      style={{ height: h, width: 'auto', display: 'block', filter }}
      className={className}
      draggable={false}
    />
  )
}

/**
 * Illustration-only mark (mascot on lime square background) — good for
 * favicon-style uses and the onboarding screen logo mark.
 */
export function HelioMark({
  size = 32,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <img
      src={illustrationLogoSvg}
      alt="Helio"
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: 8, display: 'block' }}
      className={className}
      draggable={false}
    />
  )
}
