import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { stats, siteConfig } from '@/content/config'

export function Hero() {
  const { t } = useTranslation()

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
            <h2 className="text-2xl md:text-3xl text-base-content/90 mb-6">
              {t('hero.title')}
            </h2>
            <p className="text-lg text-base-content/80 mb-8 max-w-lg">
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
              <Link to="/gallery" className="btn btn-primary">
                {t('hero.cta')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
              <a
                href={siteConfig.social.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-primary"
              >
                {t('hero.contact')}
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="order-1 lg:order-2"
          >
            <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-xl bg-base-200">
              <img
                src="/images/hero/1.jpeg"
                alt={t('hero.name')}
                className="w-full h-full object-cover"
                loading="eager"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
