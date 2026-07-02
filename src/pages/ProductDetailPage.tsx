import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { SEO } from '@/components/SEO'
import { Lightbox, type LightboxItem } from '@/components/ui/Lightbox'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { siteConfig } from '@/content/config'

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
  media: ProductMedia[]
}

function normalizeLang(lang: string): string {
  const short = lang.split('-')[0]?.toLowerCase()
  return ['tr', 'en', 'ar'].includes(short) ? short : 'tr'
}

function mediaUrl(r2Key: string): string {
  return `/api/media/${r2Key}`
}

const NUMBER_LOCALE: Record<string, string> = { tr: 'tr-TR', en: 'en-US', ar: 'ar' }

/**
 * Product detail page — replaces the former ProductModal. Mobile-first
 * layout: gallery on top (main image + snap-scroll thumbnail strip +
 * lightbox), info section below. On md+ screens the gallery and info
 * sit side by side with the info column sticky.
 */
export function ProductDetailPage() {
  const { t, i18n } = useTranslation()
  const { slug } = useParams<{ slug: string }>()
  const lang = normalizeLang(i18n.language)

  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxItems, setLightboxItems] = useState<LightboxItem[] | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // React "adjust state during render" pattern (useState form, ref access
  // during render is disallowed) — clears a stale 404 the instant slug/lang
  // changes, without a setState-in-effect render waterfall.
  const requestKey = `${slug ?? ''}:${lang}`
  const [lastRequestKey, setLastRequestKey] = useState(requestKey)
  if (lastRequestKey !== requestKey) {
    setLastRequestKey(requestKey)
    if (notFound) setNotFound(false)
  }

  useEffect(() => {
    if (!slug) return

    let cancelled = false

    fetch(`/api/products/${slug}?lang=${lang}`)
      .then((res) => {
        if (!res.ok) throw new Error('not_found')
        return res.json() as Promise<{ product: ProductDetail }>
      })
      .then((data) => {
        if (cancelled) return
        setProduct(data.product)
        setNotFound(false)
        setActiveIndex(0)
      })
      .catch(() => {
        if (!cancelled) setNotFound(true)
      })

    return () => {
      cancelled = true
    }
  }, [slug, lang])

  const missingSlug = !slug
  // Guards against a stale product briefly rendering when navigating directly
  // from one product's detail page to another (slug changes, fetch pending).
  const isStaleProduct = product !== null && product.slug !== slug
  const loading = (product === null || isStaleProduct) && !notFound && !missingSlug

  const galleryMedia = useMemo(
    () => product?.media.filter((m) => m.kind === 'gallery') ?? [],
    [product],
  )
  const processMedia = useMemo(
    () => product?.media.filter((m) => m.kind === 'process' || m.kind === 'raw_material') ?? [],
    [product],
  )

  const galleryLightboxItems: LightboxItem[] = useMemo(
    () =>
      galleryMedia.map((m) => ({
        type: m.type,
        src: mediaUrl(m.r2Key),
        alt: product?.name ?? '',
      })),
    [galleryMedia, product?.name],
  )
  const processLightboxItems: LightboxItem[] = useMemo(
    () =>
      processMedia.map((m) => ({
        type: m.type,
        src: mediaUrl(m.r2Key),
        alt: product?.name ?? '',
      })),
    [processMedia, product?.name],
  )

  const activeMedia = galleryMedia[activeIndex]

  const weightLabel =
    product?.weightGrams != null
      ? `${product.weightGrams.toLocaleString(NUMBER_LOCALE[lang] ?? 'tr-TR')} g`
      : null

  const pageUrl = typeof window !== 'undefined' ? window.location.href : `${siteConfig.url}/products/${slug}`
  const whatsappHref = product
    ? `https://wa.me/${siteConfig.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`${product.name ?? ''} — ${pageUrl}`)}`
    : '#'

  // 404: arama motorlarına indekslenmesin.
  if (notFound || missingSlug) {
    return (
      <>
        <SEO title={`${t('product.notFound')} | ${t('meta.title')}`} noindex />
        <section className="flex min-h-[70vh] items-center justify-center bg-background px-4 py-24">
          <div className="max-w-md space-y-4 text-center">
            <h1 className="font-serif text-3xl font-bold text-foreground">{t('product.notFound')}</h1>
            <p className="text-muted-foreground">{t('product.notFoundBody')}</p>
            <Button asChild>
              <Link to="/products">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('product.backToAll')}
              </Link>
            </Button>
          </div>
        </section>
      </>
    )
  }

  const structuredData = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name ?? product.slug,
        image: galleryMedia.map((m) => `${siteConfig.url}${mediaUrl(m.r2Key)}`),
        description: product.description ?? undefined,
        material: product.material ?? undefined,
        brand: { '@type': 'Person', name: siteConfig.name },
      }
    : null

  return (
    <>
      <SEO
        title={product?.name ? `${product.name} | ${t('meta.title')}` : t('meta.title')}
        description={product?.description ? product.description.slice(0, 150) : undefined}
        image={galleryMedia[0] ? mediaUrl(galleryMedia[0].r2Key) : undefined}
        structuredDataExtra={structuredData}
      />

      <section className="pt-24 pb-16 bg-background">
        <div className="container-custom">
          <Link
            to="/products"
            className="mb-6 inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('product.backToAll')}
          </Link>

          {loading && (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-5">
              <div className="md:col-span-3">
                <div className="aspect-square w-full rounded-xl bg-muted animate-pulse" />
                <div className="mt-3 flex gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-16 w-16 shrink-0 rounded-md bg-muted animate-pulse" />
                  ))}
                </div>
              </div>
              <div className="md:col-span-2 space-y-3">
                <div className="h-8 w-2/3 rounded bg-muted animate-pulse" />
                <div className="h-4 w-full rounded bg-muted animate-pulse" />
                <div className="h-4 w-full rounded bg-muted animate-pulse" />
                <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
                <div className="h-10 w-full rounded bg-muted animate-pulse" />
              </div>
            </div>
          )}

          {!loading && product && (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-5 md:items-start">
              {/* Galeri */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="md:col-span-3"
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
                  {activeMedia ? (
                    <button
                      type="button"
                      className="block h-full w-full cursor-zoom-in"
                      onClick={() => {
                        setLightboxItems(galleryLightboxItems)
                        setLightboxIndex(activeIndex)
                      }}
                    >
                      <img
                        src={mediaUrl(activeMedia.r2Key)}
                        alt={product.name ?? ''}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Logo decorative className="h-20 w-[42px] text-muted-foreground/30" />
                    </div>
                  )}

                  {galleryMedia.length > 1 && (
                    <div
                      aria-live="polite"
                      className="absolute bottom-3 right-3 rounded-full bg-background/80 px-2 py-1 text-xs font-medium text-foreground backdrop-blur"
                    >
                      {activeIndex + 1}/{galleryMedia.length}
                    </div>
                  )}
                </div>

                {galleryMedia.length > 1 && (
                  <div
                    className="mt-3 flex gap-2 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {galleryMedia.map((m, index) => (
                      <button
                        key={`${m.r2Key}-${index}`}
                        type="button"
                        onClick={() => setActiveIndex(index)}
                        className={cn(
                          'h-16 w-16 shrink-0 snap-start overflow-hidden rounded-md border-2 transition-colors',
                          index === activeIndex ? 'border-primary ring-2 ring-primary' : 'border-transparent',
                        )}
                        aria-label={`${index + 1}`}
                      >
                        {m.type === 'video' ? (
                          <video src={mediaUrl(m.r2Key)} muted playsInline className="h-full w-full object-cover" />
                        ) : (
                          <img src={mediaUrl(m.r2Key)} alt="" className="h-full w-full object-cover" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>

              {/* Bilgi */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="md:col-span-2 md:sticky md:top-24 md:self-start"
              >
                <h1 className="font-serif text-3xl font-bold text-foreground">{product.name}</h1>

                {(product.material || product.size || weightLabel) && (
                  <div className="mt-4">
                    <h2 className="text-sm font-semibold text-foreground">{t('product.specs')}</h2>
                    <dl className="mt-2 divide-y divide-border border-t border-border text-sm">
                      {product.material && (
                        <div className="flex items-center justify-between gap-4 py-3">
                          <dt className="text-muted-foreground">{t('product.material')}</dt>
                          <dd className="text-foreground">{product.material}</dd>
                        </div>
                      )}
                      {product.size && (
                        <div className="flex items-center justify-between gap-4 py-3">
                          <dt className="text-muted-foreground">{t('product.size')}</dt>
                          <dd className="text-foreground">{product.size}</dd>
                        </div>
                      )}
                      {weightLabel && (
                        <div className="flex items-center justify-between gap-4 py-3">
                          <dt className="text-muted-foreground">{t('product.weight')}</dt>
                          <dd className="text-foreground">{weightLabel}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )}

                {product.description && (
                  <p className="mt-4 text-foreground/90">{product.description}</p>
                )}

                {product.story && (
                  <div className="mt-4">
                    <h2 className="text-sm font-semibold text-foreground">{t('product.story')}</h2>
                    <p className="mt-2 text-foreground/90">{product.story}</p>
                  </div>
                )}

                {/* Seri numarası BİLEREK gösterilmiyor: public sayfadaki numara
                    sahte bir ürüne yapıştırılıp "doğrulanabilir" hale getirilebilir.
                    Numara yalnızca ürünle gönderilen fiziksel kartta yer alır. */}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Button asChild className="w-full sm:w-auto">
                    <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="w-4 h-4 mr-2" />
                      {t('product.whatsappCta')}
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="w-full sm:w-auto">
                    <Link to="/products">{t('product.backToAll')}</Link>
                  </Button>
                </div>
              </motion.div>
            </div>
          )}

          {!loading && product && processMedia.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="mt-16"
            >
              <h2 className="font-serif text-2xl font-bold text-foreground">{t('product.processTitle')}</h2>
              <div className="mt-4 flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-4">
                {processMedia.map((m, index) => (
                  <button
                    key={`${m.r2Key}-${index}`}
                    type="button"
                    onClick={() => {
                      setLightboxItems(processLightboxItems)
                      setLightboxIndex(index)
                    }}
                    className="aspect-square w-40 shrink-0 overflow-hidden rounded-lg bg-muted md:w-full"
                  >
                    {m.type === 'video' ? (
                      <video src={mediaUrl(m.r2Key)} muted playsInline className="h-full w-full object-cover" />
                    ) : (
                      <img src={mediaUrl(m.r2Key)} alt="" className="h-full w-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {lightboxItems && (
        <Lightbox
          items={lightboxItems}
          index={lightboxIndex}
          onClose={() => setLightboxItems(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </>
  )
}
