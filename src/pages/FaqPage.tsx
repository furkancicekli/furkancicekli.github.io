import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { SEO } from '@/components/SEO'

interface FaqItem {
  id: number
  question: string
  answer: string
}

function normalizeLang(lang: string): string {
  const short = lang.split('-')[0]?.toLowerCase()
  return ['tr', 'en', 'ar'].includes(short) ? short : 'tr'
}

export function FaqPage() {
  const { t, i18n } = useTranslation()
  const lang = normalizeLang(i18n.language)

  const [faqs, setFaqs] = useState<FaqItem[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    fetch(`/api/faqs?lang=${lang}`)
      .then((res) => {
        if (!res.ok) throw new Error('failed')
        return res.json() as Promise<{ faqs: FaqItem[] }>
      })
      .then((data) => {
        if (!cancelled) setFaqs(data.faqs)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })

    return () => {
      cancelled = true
    }
  }, [lang])

  const loading = faqs === null && !error
  const items = faqs ?? []

  // FAQPage şeması — Google'da zengin sonuç (açılır soru-cevap) şansı verir
  const faqSchema =
    items.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: items.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        }
      : null

  return (
    <>
      <SEO
        title={`${t('faq.title')} | ${t('meta.title')}`}
        description={t('faq.subtitle')}
        structuredDataExtra={faqSchema}
      />

      <section className="pt-24 pb-16 bg-base-100">
        <div className="container-custom max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-base-content mb-4">
              {t('faq.title')}
            </h1>
            <p className="text-lg text-base-content/90 max-w-2xl mx-auto">
              {t('faq.subtitle')}
            </p>
          </motion.div>

          {loading && (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-base-200 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && error && (
            <p className="text-center text-base-content/80">{t('common.error')}</p>
          )}

          {!loading && !error && items.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <p className="text-base-content/80">{t('faq.empty')}</p>
            </motion.div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="space-y-4">
              {items.map((faq, index) => (
                <motion.details
                  key={faq.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  className="group rounded-xl border border-base-300 bg-base-200 px-5 py-4 open:bg-base-100"
                >
                  <summary className="cursor-pointer list-none font-medium text-base-content marker:content-none flex items-center justify-between gap-4">
                    {faq.question}
                    <span className="shrink-0 text-base-content/50 transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-base-content/80">{faq.answer}</p>
                </motion.details>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
