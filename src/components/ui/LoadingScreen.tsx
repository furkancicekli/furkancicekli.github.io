/**
 * LoadingScreen — full-screen brand overlay shown during initial app load.
 *
 * - Covers `fixed inset-0 z-[100]` so it sits above all content.
 * - Animated Logo pulses via framer-motion (opacity + scale loop).
 * - Respects `prefers-reduced-motion`: static logo, plain fade-out if reduced.
 * - On exit (AnimatePresence in App.tsx when `visible` becomes false) the logo
 *   grows (scales up) while fading, and the overlay fades with it.
 */

import { type Variants, motion, useReducedMotion } from 'framer-motion'
import { Logo } from './Logo'

const pulseVariants: Variants = {
  animate: {
    opacity: [0.6, 1, 0.6],
    scale: [1, 1.05, 1],
    transition: {
      duration: 1.2,
      ease: 'easeInOut',
      repeat: Infinity,
    },
  },
}

export function LoadingScreen() {
  const reduced = useReducedMotion()

  return (
    <motion.div
      key="loading-screen"
      className="fixed inset-0 z-[100] bg-background grid place-items-center"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      aria-hidden="true"
    >
      <motion.div
        animate={reduced ? undefined : 'animate'}
        variants={pulseVariants}
        exit={
          reduced
            ? { opacity: 0 }
            : { scale: 2, opacity: 0, transition: { duration: 0.7, ease: 'easeIn' } }
        }
      >
        <Logo
          decorative
          className="h-24 w-[49px] text-foreground"
        />
      </motion.div>
    </motion.div>
  )
}
