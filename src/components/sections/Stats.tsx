import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { stats } from '@/content/config'

function useCountUp(target: number, duration: number, enabled: boolean) {
  const [count, setCount] = useState(enabled ? 0 : target)

  useEffect(() => {
    if (!enabled) {
      setCount(target)
      return
    }

    setCount(0)
    const startTime = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / (duration * 1000), 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * target))

      if (progress < 1) {
        requestAnimationFrame(tick)
      }
    }

    const raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, enabled])

  return count
}

interface StatCardProps {
  value: number
  suffix?: string
  labelKey: string
  index: number
  animate: boolean
}

function StatCard({ value, suffix, labelKey, index, animate }: StatCardProps) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const shouldAnimate = animate && inView

  const count = useCountUp(value, 1.2, shouldAnimate)

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay: index * 0.12 }}
      className="bg-card border rounded-xl p-8 flex flex-col items-center justify-center text-center"
    >
      <span className="text-5xl md:text-6xl font-bold font-mono tracking-tight text-foreground tabular-nums">
        {animate ? count : value}
        {suffix ?? ''}
      </span>
      <span className="mt-3 text-sm font-medium text-muted-foreground uppercase tracking-widest">
        {t(`stats.${labelKey}`)}
      </span>
    </motion.div>
  )
}

export function Stats() {
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()
  const sectionRef = useRef<HTMLDivElement>(null)
  const sectionInView = useInView(sectionRef, { once: true, margin: '-60px' })

  const shouldAnimate = !prefersReducedMotion && sectionInView

  return (
    <section className="section-padding" aria-label={t('stats.sectionTitle')}>
      <div className="container-custom" ref={sectionRef}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-3">
            {t('stats.sectionTitle')}
          </h2>
          <p className="text-muted-foreground text-base max-w-md mx-auto">
            {t('stats.sectionSubtitle')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, index) => (
            <StatCard
              key={stat.key}
              value={stat.value}
              suffix={stat.suffix}
              labelKey={stat.key}
              index={index}
              animate={shouldAnimate}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
