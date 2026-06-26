import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { LiquidMetal } from '@paper-design/shaders-react'
import { siteConfig } from '@/content/config'
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
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-base-content mb-4">
              {t('hero.name')}
            </h1>
            <h2 className="text-2xl md:text-3xl text-base-content mb-6">
              {t('hero.title')}
            </h2>
            <p className="text-lg text-base-content/90 mb-8 max-w-lg">
              {t('hero.description')}
            </p>

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
            {/* Brand-mark presentation: the logo silhouette rendered as a
                liquid-metal shader (AI Canvas / paper.design). Under
                reduced-motion we fall back to the static masked logo. */}
            <div className="relative flex items-center justify-center w-full aspect-square max-w-md">
              {prefersReducedMotion ? (
                <Logo
                  decorative
                  className="h-72 w-[148px] text-foreground drop-shadow-sm"
                />
              ) : (
                <LiquidMetal
                  image="/FURKANLOGO.png"
                  colorBack="#00000000"
                  colorTint="#7b8794"
                  repetition={5}
                  softness={0.85}
                  shiftRed={0.8}
                  shiftBlue={-0.8}
                  distortion={0.32}
                  contour={0.45}
                  speed={0.8}
                  scale={0.62}
                  fit="contain"
                  width="100%"
                  height="100%"
                />
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
