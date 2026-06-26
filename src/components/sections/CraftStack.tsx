import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DancingLetters } from '@/components/ui/DancingLetters'

const CRAFT_IMAGES = [
  { id: 1, src: '/images/gallery/craft-1.jpg' },
  { id: 2, src: '/images/gallery/craft-2.jpg' },
  { id: 3, src: '/images/gallery/craft-3.jpg' },
  { id: 4, src: '/images/gallery/craft-4.jpg' },
  { id: 5, src: '/images/gallery/craft-5.jpg' },
  { id: 6, src: '/images/gallery/craft-6.jpg' },
]

const TOTAL = CRAFT_IMAGES.length

// Per-depth visual offset for the fanned stack (index 0 = front card)
const DEPTH_CONFIG = [
  { rotate: 0, scale: 1, x: 0, y: 0, zIndex: 6 },
  { rotate: 4, scale: 0.95, x: 18, y: 6, zIndex: 5 },
  { rotate: -6, scale: 0.9, x: -22, y: 12, zIndex: 4 },
  { rotate: 8, scale: 0.85, x: 26, y: 18, zIndex: 3 },
  { rotate: -10, scale: 0.8, x: -30, y: 24, zIndex: 2 },
  { rotate: 12, scale: 0.75, x: 32, y: 30, zIndex: 1 },
]

export function CraftStack() {
  const { t, i18n } = useTranslation()
  const prefersReducedMotion = useReducedMotion()
  const [frontIndex, setFrontIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartX = useRef(0)
  const isRTL = i18n.dir() === 'rtl'

  // Advance: move front card to back (index increments)
  const advance = () => {
    setFrontIndex((prev) => (prev + 1) % TOTAL)
  }

  // Retreat: move last card to front (index decrements)
  const retreat = () => {
    setFrontIndex((prev) => (prev - 1 + TOTAL) % TOTAL)
  }

  const handleDragStart = (_: unknown, info: PanInfo) => {
    setIsDragging(true)
    dragStartX.current = info.point.x
  }

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    setIsDragging(false)
    const threshold = 80
    const velocity = info.velocity.x
    const offset = info.offset.x

    // In RTL, swipe directions are logically mirrored for the user
    const effectiveOffset = isRTL ? -offset : offset
    const effectiveVelocity = isRTL ? -velocity : velocity

    if (effectiveOffset < -threshold || effectiveVelocity < -300) {
      // Swiped left (logical "next") → advance
      advance()
    } else if (effectiveOffset > threshold || effectiveVelocity > 300) {
      // Swiped right (logical "prev") → retreat
      retreat()
    }
  }

  // Build ordered card list: front card first, rest in depth order
  const orderedImages = Array.from({ length: TOTAL }, (_, i) => {
    const imageIndex = (frontIndex + i) % TOTAL
    return CRAFT_IMAGES[imageIndex]
  })

  const springConfig = prefersReducedMotion
    ? { type: 'tween' as const, duration: 0 }
    : { type: 'spring' as const, stiffness: 260, damping: 22 }

  return (
    <section className="section-padding overflow-hidden">
      <div className="container-custom">
        {/* Section heading */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
            <DancingLetters text={t('craftStack.title')} />
          </h2>
          <p className="text-lg text-foreground/70 max-w-2xl mx-auto">
            {t('craftStack.subtitle')}
          </p>
        </motion.div>

        {/* Stack + Controls layout */}
        <div className="flex flex-col items-center gap-10">
          {/* Card stack deck */}
          <div
            role="region"
            aria-label={t('craftStack.title')}
            aria-roledescription="card stack"
            className="relative w-[260px] sm:w-[300px] md:w-[340px]"
            style={{ height: '400px' }}
          >
            {/* Render cards back-to-front so front card is on top */}
            {[...orderedImages].reverse().map((image, reversedIdx) => {
              const depthIdx = TOTAL - 1 - reversedIdx
              const config = DEPTH_CONFIG[depthIdx] ?? DEPTH_CONFIG[DEPTH_CONFIG.length - 1]
              const isFront = depthIdx === 0

              return (
                <motion.div
                  key={image.id}
                  aria-hidden={!isFront}
                  className={cn(
                    'absolute inset-0 aspect-[4/5] rounded-2xl border border-border shadow-lg overflow-hidden bg-card cursor-grab active:cursor-grabbing',
                    isFront && 'ring-1 ring-foreground/10',
                    !isFront && 'pointer-events-none'
                  )}
                  style={{ zIndex: config.zIndex }}
                  animate={{
                    rotate: config.rotate,
                    scale: config.scale,
                    x: config.x,
                    y: config.y,
                  }}
                  transition={springConfig}
                  // Only the front card is draggable
                  drag={isFront && !prefersReducedMotion ? 'x' : false}
                  dragConstraints={{ left: -200, right: 200 }}
                  dragElastic={0.15}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  whileDrag={prefersReducedMotion ? {} : { scale: 1.03, cursor: 'grabbing' }}
                >
                  <img
                    src={image.src}
                    alt={
                      isFront
                        ? t('craftStack.imageAlt', {
                            index: ((frontIndex) % TOTAL) + 1,
                            total: TOTAL,
                          })
                        : ''
                    }
                    loading="lazy"
                    draggable={false}
                    className="w-full h-full object-cover select-none"
                  />
                </motion.div>
              )
            })}
          </div>

          {/* Prev / Next controls */}
          <div
            className="flex items-center gap-4"
            // Ensure logical order is preserved regardless of dir
          >
            <button
              onClick={retreat}
              aria-label={t('a11y.prev')}
              className={cn(
                'inline-flex items-center justify-center rounded-full w-10 h-10',
                'border border-border bg-card text-foreground shadow-sm',
                'hover:bg-foreground hover:text-background',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2',
                'transition-colors duration-200',
                isDragging && 'opacity-50 pointer-events-none'
              )}
            >
              {/* Logical "previous" — ChevronLeft in LTR, ChevronRight in RTL due to dir attribute on html */}
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            </button>

            {/* Dot indicators */}
            <div
              className="flex gap-1.5"
              role="tablist"
              aria-label={t('craftStack.title')}
            >
              {CRAFT_IMAGES.map((_, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === frontIndex}
                  aria-label={`${i + 1} / ${TOTAL}`}
                  onClick={() => setFrontIndex(i)}
                  className={cn(
                    'rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground',
                    i === frontIndex
                      ? 'w-5 h-2 bg-foreground'
                      : 'w-2 h-2 bg-foreground/30 hover:bg-foreground/60'
                  )}
                />
              ))}
            </div>

            <button
              onClick={advance}
              aria-label={t('a11y.next')}
              className={cn(
                'inline-flex items-center justify-center rounded-full w-10 h-10',
                'border border-border bg-card text-foreground shadow-sm',
                'hover:bg-foreground hover:text-background',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2',
                'transition-colors duration-200',
                isDragging && 'opacity-50 pointer-events-none'
              )}
            >
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
