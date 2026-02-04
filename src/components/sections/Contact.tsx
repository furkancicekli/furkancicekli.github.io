import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { MessageCircle, Phone, Mail, Instagram } from 'lucide-react'
import { siteConfig } from '@/content/config'

export function Contact() {
  const { t } = useTranslation()

  const contactMethods = [
    {
      key: 'whatsapp',
      href: siteConfig.social.whatsapp,
      icon: MessageCircle,
    },
    {
      key: 'phone',
      href: `tel:${siteConfig.phone}`,
      icon: Phone,
    },
    {
      key: 'email',
      href: `mailto:${siteConfig.email}`,
      icon: Mail,
    },
    {
      key: 'instagram',
      href: siteConfig.social.instagram,
      icon: Instagram,
    },
  ]

  return (
    <section id="contact" className="section-padding bg-base-100 border-y border-base-300">
      <div className="container-custom">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto"
        >
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-base-content mb-4">
            {t('contact.title')}
          </h2>
          <p className="text-lg text-base-content mb-12">
            {t('contact.subtitle')}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {contactMethods.map((method, index) => {
              const Icon = method.icon
              return (
                <motion.a
                  key={method.key}
                  href={method.href}
                  target={method.href?.startsWith('http') ? '_blank' : undefined}
                  rel={method.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl bg-base-200 border border-base-300 hover:border-primary hover:shadow-lg transition-all duration-300"
                >
                  <Icon className="w-6 h-6 text-primary" />
                  <span className="font-medium text-base-content">{t(`contact.${method.key}`)}</span>
                </motion.a>
              )
            })}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
