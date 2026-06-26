import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { stats, siteConfig } from '@/content/config'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/Logo'

export function Hero() {
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()

  return (
    <section className="min-h-screen flex items-center pt-20 bg-base-100">
      <div className="container-custom">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="order-2 lg:order-1"
          >
            <p className="text-primary font-medium mb-4">
              {t('hero.greeting')}
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-base-content mb-4">
              {t('hero.name')}
            </h1>
            <h2 className="text-2xl md:text-3xl text-base-content mb-6">
              {t('hero.title')}
            </h2>
            <p className="text-lg text-base-content/90 mb-8 max-w-lg">
              {t('hero.description')}
            </p>

            <div className="flex flex-wrap gap-8 mb-8">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
                  className="text-center"
                >
                  <div className="text-3xl md:text-4xl font-bold text-base-content">
                    {stat.value}
                    {stat.suffix || ''}
                  </div>
                  <div className="text-sm text-base-content/80">
                    {t(`stats.${stat.key}`)}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="flex flex-wrap gap-4">
              <Button asChild>
                <Link to="/gallery">
                  {t('hero.cta')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <a
                  href={siteConfig.social.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('hero.contact')}
                </a>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="order-1 lg:order-2 flex items-center justify-center"
          >
            {/* Brand-mark presentation: logo over mono radial-gradient backdrop */}
            <div className="relative flex items-center justify-center w-full aspect-[4/5] max-w-sm">
              {/* Outer glow ring */}
              <div
                className="absolute inset-0 rounded-3xl"
                style={{
                  background:
                    'radial-gradient(ellipse 70% 60% at 50% 50%, hsl(var(--muted)) 0%, transparent 70%)',
                }}
              />
              {/* Inner accent ring — very subtle concentric */}
              <div
                className="absolute inset-[15%] rounded-2xl"
                style={{
                  background:
                    'radial-gradient(ellipse 60% 50% at 50% 50%, hsl(var(--accent)) 0%, transparent 65%)',
                  opacity: 0.6,
                }}
              />
              {/* Animated shimmer ring (skipped when reduced-motion) */}
              {!prefersReducedMotion && (
                <motion.div
                  className="absolute inset-[20%] rounded-2xl"
                  style={{
                    background:
                      'radial-gradient(ellipse 50% 40% at 50% 50%, hsl(var(--foreground) / 0.06) 0%, transparent 70%)',
                  }}
                  animate={{ opacity: [0.4, 0.9, 0.4], scale: [0.97, 1.03, 0.97] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              {/* Floating logo */}
              <motion.div
                animate={prefersReducedMotion ? {} : { y: [0, -10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                className="relative z-10 flex items-center justify-center"
              >
                <Logo
                  decorative
                  className="h-72 w-[148px] text-foreground drop-shadow-sm"
                />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
