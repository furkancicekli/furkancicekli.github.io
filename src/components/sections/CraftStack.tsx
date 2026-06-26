import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion } from 'framer-motion'
import { DancingLetters } from '@/components/ui/DancingLetters'
import InteractiveCardStack, { type Card } from '@/components/aicanvas/interactive-card-stack'

// Five selected craft photos shown in the AI Canvas interactive card stack.
// Photos are the focus (no titles) — pure work-forward polaroids. Orientation
// pattern mirrors the source design so the scatter composition reads well.
const CRAFT_CARDS: Card[] = [
  { id: 0, orientation: 'portrait', image: '/images/gallery/craft-1.jpg' },
  { id: 1, orientation: 'landscape', image: '/images/gallery/craft-2.jpg' },
  { id: 2, orientation: 'portrait', image: '/images/gallery/craft-3.jpg' },
  { id: 3, orientation: 'landscape', image: '/images/gallery/craft-4.jpg' },
  { id: 4, orientation: 'portrait', image: '/images/gallery/craft-5.jpg' },
]

export function CraftStack() {
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()

  return (
    <section className="section-padding overflow-hidden">
      <div className="container-custom">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
            <DancingLetters text={t('craftStack.title')} />
          </h2>
          <p className="text-lg text-foreground/70 max-w-2xl mx-auto">
            {t('craftStack.subtitle')}
          </p>
        </motion.div>

        <InteractiveCardStack cards={CRAFT_CARDS} hint={t('craftStack.hint')} />
      </div>
    </section>
  )
}
