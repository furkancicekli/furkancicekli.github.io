import { Hono } from 'hono'
import type { Lang, ProductDetail, ProductMediaItem, ProductStore } from '../db/products'

export type PublicProductsEnv = {
  Bindings: Record<string, unknown>
  Variables: { productStore: ProductStore }
}

export const publicProductsRoutes = new Hono<PublicProductsEnv>()

const LANGS: Lang[] = ['tr', 'en', 'ar']

function resolveLang(langParam: string | undefined): Lang {
  return LANGS.includes(langParam as Lang) ? (langParam as Lang) : 'tr'
}

function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function fieldWithFallback(
  product: ProductDetail,
  lang: Lang,
  field: 'name' | 'description' | 'story',
): string | null {
  const primary = product.translations[lang]?.[field]
  const fallback = product.translations.tr?.[field]
  return trimOrNull(primary) ?? trimOrNull(fallback)
}

const MEDIA_KIND_ORDER: Record<ProductMediaItem['kind'], number> = {
  gallery: 0,
  process: 1,
  raw_material: 2,
}

function sortMedia(media: ProductMediaItem[]): ProductMediaItem[] {
  return [...media].sort((a, b) => {
    const kindDiff = MEDIA_KIND_ORDER[a.kind] - MEDIA_KIND_ORDER[b.kind]
    if (kindDiff !== 0) return kindDiff
    const sortDiff = a.sort - b.sort
    if (sortDiff !== 0) return sortDiff
    return a.id - b.id
  })
}

function firstGalleryCover(media: ProductMediaItem[]): string | null {
  const galleryMedia = media
    .filter((m) => m.kind === 'gallery')
    .sort((a, b) => a.sort - b.sort || a.id - b.id)
  return galleryMedia[0]?.r2Key ?? null
}

publicProductsRoutes.get('/', async (c) => {
  const lang = resolveLang(c.req.query('lang'))
  const store = c.get('productStore')
  const products = await store.listPublished()

  const result = products.map((p) => ({
    slug: p.slug,
    name: fieldWithFallback(p, lang, 'name'),
    description: fieldWithFallback(p, lang, 'description'),
    material: p.material,
    size: p.size,
    weightGrams: p.weightGrams,
    cover: firstGalleryCover(p.media),
    mediaCount: p.media.length,
  }))

  return c.json({ products: result })
})

publicProductsRoutes.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const lang = resolveLang(c.req.query('lang'))
  const store = c.get('productStore')
  const product = await store.getBySlugPublished(slug)
  if (!product) return c.json({ error: 'not_found' }, 404)

  return c.json({
    product: {
      slug: product.slug,
      name: fieldWithFallback(product, lang, 'name'),
      description: fieldWithFallback(product, lang, 'description'),
      story: fieldWithFallback(product, lang, 'story'),
      material: product.material,
      size: product.size,
      weightGrams: product.weightGrams,
      // serialNo bilinçli olarak public cevapta YOK — sahte ürüne yapıştırılabilir;
      // numara yalnızca fiziksel sertifika kartında yaşar.
      media: sortMedia(product.media).map((m) => ({ type: m.type, r2Key: m.r2Key, kind: m.kind })),
    },
  })
})
