import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/ui/Logo'

export interface ProductListItem {
  slug: string
  name: string | null
  description: string | null
  material: string | null
  size: string | null
  weightGrams: number | null
  cover: string | null
  coverType: 'image' | 'video' | null
  mediaCount: number
}

interface ProductCardProps {
  product: ProductListItem
}

/** Public product grid card — links to the product's detail page. */
export function ProductCard({ product }: ProductCardProps) {
  const { t } = useTranslation()

  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
      <Link
        to={`/products/${product.slug}`}
        className="group block text-left rounded-xl overflow-hidden bg-base-200 border border-base-300 hover:shadow-md transition-shadow"
      >
        <div className="aspect-square w-full overflow-hidden bg-base-300">
          {product.cover && product.coverType === 'video' ? (
            <video
              src={`/api/media/${product.cover}`}
              muted
              autoPlay
              loop
              playsInline
              preload="metadata"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : product.cover ? (
            <img
              src={`/api/media/${product.cover}`}
              alt={product.name ?? ''}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Logo decorative className="h-16 w-[33px] text-base-content/20" />
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-serif text-lg font-semibold text-base-content truncate">
            {product.name}
          </h3>
          {product.material && (
            <p className="mt-1 text-sm text-base-content/70">
              {t('product.material')}: {product.material}
            </p>
          )}
        </div>
      </Link>
    </motion.div>
  )
}
