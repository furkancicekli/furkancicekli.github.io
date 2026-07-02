import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { SEO } from '@/components/SEO'
import { ProductCard, type ProductListItem } from '@/components/ui/ProductCard'
import { ProductModal } from '@/components/ui/ProductModal'

function normalizeLang(lang: string): string {
  const short = lang.split('-')[0]?.toLowerCase()
  return ['tr', 'en', 'ar'].includes(short) ? short : 'tr'
}

export function ProductsPage() {
  const { t, i18n } = useTranslation()
  const lang = normalizeLang(i18n.language)

  const [products, setProducts] = useState<ProductListItem[] | null>(null)
  const [error, setError] = useState(false)
  const [activeSlug, setActiveSlug] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch(`/api/products?lang=${lang}`)
      .then((res) => {
        if (!res.ok) throw new Error('failed')
        return res.json() as Promise<{ products: ProductListItem[] }>
      })
      .then((data) => {
        if (!cancelled) setProducts(data.products)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })

    return () => {
      cancelled = true
    }
  }, [lang])

  const loading = products === null && !error
  const items = products ?? []

  return (
    <>
      <SEO
        title={`${t('products.title')} | ${t('meta.title')}`}
        description={t('products.subtitle')}
      />

      <section className="pt-24 pb-16 bg-base-100">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-base-content mb-4">
              {t('products.title')}
            </h1>
            <p className="text-lg text-base-content/90 max-w-2xl mx-auto">
              {t('products.subtitle')}
            </p>
          </motion.div>

          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-base-200 animate-pulse" />
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
              <p className="text-base-content/80">{t('products.empty')}</p>
            </motion.div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {items.map((product, index) => (
                <motion.div
                  key={product.slug}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                >
                  <ProductCard product={product} onOpen={setActiveSlug} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {activeSlug && (
        <ProductModal slug={activeSlug} onClose={() => setActiveSlug(null)} />
      )}
    </>
  )
}
