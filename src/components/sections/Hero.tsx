import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { stats, siteConfig } from '@/content/config'

export function Hero() {
  const { t } = useTranslation()

  return (
    <section className="min-h-screen flex items-center pt-20 bg-gradient-to-br from-base-100 to-base-200">
      <div className="container-custom">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
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
            <h2 className="text-2xl md:text-3xl text-base-content/70 mb-6">
              {t('hero.title')}
            </h2>
            <p className="text-lg text-base-content/60 mb-8 max-w-lg">
              {t('hero.description')}
            </p>

            {/* Stats */}
            <div className="flex flex-wrap gap-8 mb-8">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
                  className="text-center"
                >
                  <div className="text-3xl md:text-4xl font-bold text-primary">
                    {stat.value}
                    {stat.suffix || ''}
                  </div>
                  <div className="text-sm text-base-content/60">
                    {t(`stats.${stat.key}`)}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4">
              <Link to="/gallery" className="btn btn-primary btn-lg">
                {t('hero.cta')}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 ml-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </Link>
              <a
                href={siteConfig.social.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-lg"
              >
                {t('hero.contact')}
              </a>
            </div>
          </motion.div>

          {/* Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="order-1 lg:order-2"
          >
            <div className="relative">
              <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src="/images/hero/1.jpeg"
                  alt={t('hero.name')}
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              </div>
              {/* Decorative elements */}
              <div className="absolute -z-10 top-4 right-4 w-full h-full rounded-2xl border-2 border-primary/20" />
              <div className="absolute -z-10 top-8 right-8 w-full h-full rounded-2xl bg-primary/10" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
