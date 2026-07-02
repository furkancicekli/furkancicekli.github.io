import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ProductMedia {
  type: 'image' | 'video'
  r2Key: string
  kind: 'gallery' | 'process' | 'raw_material'
}

interface ProductDetail {
  slug: string
  name: string | null
  description: string | null
  story: string | null
  material: string | null
  size: string | null
  weightGrams: number | null
  serialNo: string | null
  media: ProductMedia[]
}

interface ProductModalProps {
  slug: string
  onClose: () => void
}

function normalizeLang(lang: string): string {
  const short = lang.split('-')[0]?.toLowerCase()
  return ['tr', 'en', 'ar'].includes(short) ? short : 'tr'
}

function mediaUrl(r2Key: string): string {
  return `/api/media/${r2Key}`
}

/**
 * Content modal for a single product's detail view — distinct from
 * ConfirmDialog (alertdialog). Fetches its own data from
 * GET /api/products/:slug so callers stay thin (card just passes a slug).
 * Follows the existing lightbox pattern (fixed overlay, X, Escape, backdrop
 * click) seen in ProjectCard, plus body scroll lock while open.
 */
export function ProductModal({ slug, onClose }: ProductModalProps) {
  const { t, i18n } = useTranslation()
  const lang = normalizeLang(i18n.language)

  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [error, setError] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    let cancelled = false

    fetch(`/api/products/${slug}?lang=${lang}`)
      .then((res) => {
        if (!res.ok) throw new Error('not_found')
        return res.json() as Promise<{ product: ProductDetail }>
      })
      .then((data) => {
        if (!cancelled) {
          setProduct(data.product)
          setActiveIndex(0)
        }
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })

    return () => {
      cancelled = true
    }
  }, [slug, lang])

  const loading = product === null && !error

  // Escape kapatır; açıkken body scroll kilitlenir (kapanışta geri yüklenir)
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const activeMedia = product?.media[activeIndex]

  const weightLabel =
    product?.weightGrams != null
      ? `${product.weightGrams.toLocaleString(lang === 'ar' ? 'ar' : lang === 'en' ? 'en-US' : 'tr-TR')} g`
      : null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-base-100 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label={t('a11y.close')}
            className={cn(
              buttonVariants({ size: 'icon' }),
              'absolute top-4 right-4 z-10 rounded-full bg-base-100/90 text-foreground hover:bg-base-100 hover:text-foreground shadow-md',
            )}
          >
            <X className="w-5 h-5" />
          </button>

          {loading && (
            <div className="p-8">
              <div className="aspect-square w-full max-w-md mx-auto rounded-lg bg-base-200 animate-pulse" />
              <div className="mt-6 h-6 w-1/2 rounded bg-base-200 animate-pulse" />
              <div className="mt-3 h-4 w-full rounded bg-base-200 animate-pulse" />
              <div className="mt-2 h-4 w-2/3 rounded bg-base-200 animate-pulse" />
            </div>
          )}

          {!loading && (error || !product) && (
            <div className="p-8 text-center">
              <p className="text-base-content/80">{t('common.error')}</p>
            </div>
          )}

          {!loading && product && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 md:p-8">
              <div>
                <div className="aspect-square w-full overflow-hidden rounded-lg bg-base-200">
                  {activeMedia ? (
                    activeMedia.type === 'video' ? (
                      <video
                        src={mediaUrl(activeMedia.r2Key)}
                        muted
                        controls
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <img
                        src={mediaUrl(activeMedia.r2Key)}
                        alt={product.name ?? ''}
                        className="h-full w-full object-cover"
                      />
                    )
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-base-content/40">
                      —
                    </div>
                  )}
                </div>

                {product.media.length > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto">
                    {product.media.map((m, index) => (
                      <button
                        key={`${m.r2Key}-${index}`}
                        type="button"
                        onClick={() => setActiveIndex(index)}
                        className={cn(
                          'h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors',
                          index === activeIndex ? 'border-primary' : 'border-transparent',
                        )}
                        aria-label={`${index + 1}`}
                      >
                        {m.type === 'video' ? (
                          <video src={mediaUrl(m.r2Key)} muted className="h-full w-full object-cover" />
                        ) : (
                          <img
                            src={mediaUrl(m.r2Key)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h2 className="font-serif text-2xl font-bold text-base-content">{product.name}</h2>

                <dl className="mt-4 space-y-1 text-sm">
                  {product.material && (
                    <div className="flex gap-2">
                      <dt className="text-base-content/60">{t('product.material')}:</dt>
                      <dd className="text-base-content">{product.material}</dd>
                    </div>
                  )}
                  {product.size && (
                    <div className="flex gap-2">
                      <dt className="text-base-content/60">{t('product.size')}:</dt>
                      <dd className="text-base-content">{product.size}</dd>
                    </div>
                  )}
                  {weightLabel && (
                    <div className="flex gap-2">
                      <dt className="text-base-content/60">{t('product.weight')}:</dt>
                      <dd className="text-base-content">{weightLabel}</dd>
                    </div>
                  )}
                </dl>

                {product.description && (
                  <p className="mt-4 text-base-content/90">{product.description}</p>
                )}
                {product.story && (
                  <p className="mt-3 text-base-content/90">{product.story}</p>
                )}

                {product.serialNo && (
                  <p className="mt-6 font-mono text-xs text-base-content/50">
                    {t('product.serial')}: {product.serialNo}
                  </p>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
