import { useReducedMotion, motion } from 'framer-motion'

interface DancingLettersProps {
  text: string
  className?: string
}

/**
 * Animates a string letter-by-letter on scroll-into-view.
 *
 * Accessibility:
 *   - The wrapper <span> carries aria-label={text} so screen readers
 *     announce the whole word, not individual letters.
 *   - Each per-letter <motion.span> is aria-hidden="true".
 *
 * Reduced-motion:
 *   - When prefers-reduced-motion is active, renders a plain <span>
 *     (no per-letter animation) while keeping the aria-label wrapper.
 *
 * Unicode safety:
 *   - Uses Array.from(text) to correctly split multi-byte / Arabic
 *     graphemes. Does NOT reverse for RTL — CSS/dir handles direction.
 *
 * Color:
 *   - Inherits currentColor from the parent heading — works with both
 *     light and dark themes and any Tailwind text-* class.
 */
export function DancingLetters({ text, className }: DancingLettersProps) {
  const prefersReducedMotion = useReducedMotion()

  // Always render the accessible outer wrapper
  if (prefersReducedMotion) {
    return (
      <span aria-label={text} className={className}>
        {/* Single static text node — SR reads the aria-label once */}
        <span aria-hidden="true">{text}</span>
      </span>
    )
  }

  const chars = Array.from(text) // Unicode-safe split

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.045,
      },
    },
  }

  const letterVariants = {
    hidden: { opacity: 0, y: 18, rotate: -6 },
    visible: {
      opacity: 1,
      y: 0,
      rotate: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 320,
        damping: 18,
      },
    },
  }

  return (
    <motion.span
      aria-label={text}
      className={className}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.5 }}
      // inline-flex keeps the wrapper from breaking line flow
      style={{ display: 'inline-flex', flexWrap: 'wrap' }}
    >
      {chars.map((char, i) =>
        char === ' ' ? (
          // Non-animated space — preserved width, not announced
          <span key={i} aria-hidden="true" style={{ display: 'inline-block', width: '0.35em' }} />
        ) : (
          <motion.span
            key={i}
            aria-hidden="true"
            variants={letterVariants}
            style={{ display: 'inline-block' }}
          >
            {char}
          </motion.span>
        )
      )}
    </motion.span>
  )
}
