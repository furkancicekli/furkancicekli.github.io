import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface GalleryItem {
  id: number
  r2Key: string
  sort: number
}

function mediaUrl(r2Key: string): string {
  return `/api/media/${r2Key}`
}

export function GalleryPreview() {
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
  const featured = (items ?? []).slice(0, 6)

  if (!loading && !error && featured.length === 0) return null

  return (
    <section id="gallery" className="section-padding bg-base-100">
      <div className="container-custom">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-base-content mb-4">
            {t('gallery.title')}
          </h2>
          <p className="text-lg text-base-content/90 max-w-2xl mx-auto">
            {t('gallery.subtitle')}
          </p>
        </motion.div>

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-base-200 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && error && (
          <p className="text-center text-base-content/80">{t('common.error')}</p>
        )}

        {!loading && !error && featured.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="aspect-square rounded-xl overflow-hidden bg-base-200"
              >
                <img
                  src={mediaUrl(item.r2Key)}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </motion.div>
            ))}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center mt-12"
        >
          <Button asChild>
            <Link to="/gallery">
              {t('gallery.viewAll')}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  )
}
