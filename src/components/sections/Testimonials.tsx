import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Quote, Star } from 'lucide-react'
import { testimonials } from '@/content/testimonials'
import type { Language } from '@/i18n'

export function Testimonials() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Language

  return (
    <section className="section-padding bg-base-100">
      <div className="container-custom">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-base-content mb-4">
            {t('testimonials.title')}
          </h2>
          <p className="text-lg text-base-content max-w-2xl mx-auto">
            {t('testimonials.subtitle')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="card bg-base-200 border border-base-300"
            >
              <div className="card-body">
                <Quote className="w-8 h-8 text-primary/30 mb-4" />

                {testimonial.rating && (
                  <div className="flex gap-1 mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < testimonial.rating!
                            ? 'text-warning fill-current'
                            : 'text-base-content/40'
                        }`}
                      />
                    ))}
                  </div>
                )}

                <p className="text-base-content mb-4 flex-grow">
                  "{testimonial.text[lang] || testimonial.text.tr}"
                </p>

                <div className="pt-2 border-t border-base-300">
                  <span className="font-semibold text-base-content">{testimonial.name}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
