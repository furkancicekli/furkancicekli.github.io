import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { ZoomIn, X } from 'lucide-react'
import { SEO } from '@/components/SEO'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface GalleryItem {
  id: number
  r2Key: string
  sort: number
}

function mediaUrl(r2Key: string): string {
  return `/api/media/${r2Key}`
}

/**
 * Lightbox tile for a single gallery photo — overlay/zoom/close pattern,
 * with no title/description since the managed gallery API carries no
 * captions (just r2Key + sort).
 */
function GalleryTile({ item, index }: { item: GalleryItem; index: number }) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer bg-base-200"
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <img
          src={mediaUrl(item.r2Key)}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="bg-base-100/90 rounded-full p-2">
            <ZoomIn className="w-5 h-5 text-base-content" />
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-[92vw] md:max-w-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={mediaUrl(item.r2Key)}
                alt=""
                className="block w-auto max-w-full max-h-[85vh] object-contain rounded-lg mx-auto"
              />
              <button
                onClick={() => setIsOpen(false)}
                className={cn(
                  buttonVariants({ size: 'icon' }),
                  'absolute top-4 right-4 rounded-full bg-base-100/90 text-foreground hover:bg-base-100 hover:text-foreground shadow-md',
                )}
                aria-label={t('a11y.close')}
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export function GalleryPage() {
  const { t } = useTranslation()
  const [items, setItems] = useState<GalleryItem[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    fetch('/api/gallery')
      .then((res) => {
        if (!res.ok) throw new Error('failed')
        return res.json() as Promise<{ items: GalleryItem[] }>
      })
      .then((data) => {
        if (!cancelled) setItems(data.items)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const loading = items === null && !error
  const list = items ?? []

  return (
    <>
      <SEO
        title={`${t('gallery.title')} | ${t('meta.title')}`}
        description={t('gallery.subtitle')}
      />

      <section className="pt-24 pb-16 bg-base-100">
        <div className="container-custom">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-base-content mb-4">
              {t('gallery.title')}
            </h1>
            <p className="text-lg text-base-content/90 max-w-2xl mx-auto">
              {t('gallery.subtitle')}
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

          {!loading && !error && list.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <p className="text-base-content/80">{t('gallery.empty')}</p>
            </motion.div>
          )}

          {!loading && !error && list.length > 0 && (
            <motion.div
              layout
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {list.map((item, index) => (
                <GalleryTile key={item.id} item={item} index={index} />
              ))}
            </motion.div>
          )}
        </div>
      </section>
    </>
  )
}
