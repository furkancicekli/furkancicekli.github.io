import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { ProductCard, type ProductListItem } from '@/components/ui/ProductCard'
import { ProductModal } from '@/components/ui/ProductModal'
import { Button } from '@/components/ui/button'

function normalizeLang(lang: string): string {
  const short = lang.split('-')[0]?.toLowerCase()
  return ['tr', 'en', 'ar'].includes(short) ? short : 'tr'
}

/**
 * Landing section showing up to 6 published products. Renders nothing when
 * the API returns zero products so the homepage stays clean before any
 * products are published.
 */
export function FeaturedProducts() {
  const { t, i18n } = useTranslation()
  const lang = normalizeLang(i18n.language)

  const [products, setProducts] = useState<ProductListItem[]>([])
  const [activeSlug, setActiveSlug] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch(`/api/products?lang=${lang}`)
      .then((res) => {
        if (!res.ok) throw new Error('failed')
        return res.json() as Promise<{ products: ProductListItem[] }>
      })
      .then((data) => {
        if (!cancelled) setProducts(data.products.slice(0, 6))
      })
      .catch(() => {
        if (!cancelled) setProducts([])
      })

    return () => {
      cancelled = true
    }
  }, [lang])

  if (products.length === 0) return null

  return (
    <section id="products" className="section-padding bg-base-100">
      <div className="container-custom">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-base-content mb-4">
            {t('featuredProducts.title')}
          </h2>
          <p className="text-lg text-base-content/90 max-w-2xl mx-auto">
            {t('featuredProducts.subtitle')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product, index) => (
            <motion.div
              key={product.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <ProductCard product={product} onOpen={setActiveSlug} />
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center mt-12"
        >
          <Button asChild>
            <Link to="/products">
              {t('featuredProducts.viewAll')}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </motion.div>
      </div>

      {activeSlug && (
        <ProductModal slug={activeSlug} onClose={() => setActiveSlug(null)} />
      )}
    </section>
  )
}
