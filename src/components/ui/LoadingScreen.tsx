/**
 * LoadingScreen — full-screen brand intro shown during initial app load.
 *
 * - Covers `fixed inset-0 z-[100]` so it sits above all content.
 * - From the moment it appears, the logo grows continuously (zoom toward the
 *   viewer) until it fills the page, then the whole overlay fades to transparent,
 *   revealing the content underneath.
 * - Calls `onComplete` when the animation finishes so App can unmount it.
 * - Respects `prefers-reduced-motion`: no zoom, just a short static fade-out.
 */

import { motion, useReducedMotion } from 'framer-motion'
import { Logo } from './Logo'

const GROW_DURATION = 2.2 // seconds — the full intro length

export function LoadingScreen({ onComplete }: { onComplete?: () => void }) {
  const reduced = useReducedMotion()

  if (reduced) {
    return (
      <motion.div
        key="loading-screen"
        className="fixed inset-0 z-[100] bg-background grid place-items-center overflow-hidden"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.4 }}
        onAnimationComplete={onComplete}
        aria-hidden="true"
      >
        <Logo decorative className="h-24 w-[49px] text-foreground" />
      </motion.div>
    )
  }

  return (
    <motion.div
      key="loading-screen"
      className="fixed inset-0 z-[100] bg-background grid place-items-center overflow-hidden"
      initial={{ opacity: 1 }}
      // Stay opaque while the logo grows, then dissolve to transparent at the end.
      animate={{ opacity: [1, 1, 0] }}
      transition={{ duration: GROW_DURATION, times: [0, 0.72, 1], ease: 'easeInOut' }}
      onAnimationComplete={onComplete}
      aria-hidden="true"
    >
      <motion.div
        // Grows from the first frame and accelerates until it covers the page.
        initial={{ scale: 0.85 }}
        animate={{ scale: 34 }}
        transition={{ duration: GROW_DURATION, ease: 'easeIn' }}
      >
        <Logo decorative className="h-24 w-[49px] text-foreground" />
      </motion.div>
    </motion.div>
  )
}
