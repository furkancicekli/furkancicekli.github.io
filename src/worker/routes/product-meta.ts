import { Hono } from 'hono'
import type { ProductDetail, ProductMediaItem, ProductStore } from '../db/products'

export type ProductMetaEnv = {
  Bindings: { ASSETS: Fetcher }
  Variables: { productStore: ProductStore }
}

export const productMetaRoutes = new Hono<ProductMetaEnv>()

const SITE_ORIGIN = 'https://furkancicekli.com'
const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-default.jpg`
const DESCRIPTION_MAX_LENGTH = 200

/** Escapes text for safe interpolation into an HTML attribute value or text
 * node. Product names/descriptions are admin-authored free text and may
 * contain quotes or angle brackets, so every interpolated value must be
 * escaped before insertion to avoid breaking out of a `content="..."`
 * attribute or injecting markup into the document. */
export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function firstGalleryCover(media: ProductMediaItem[]): string | null {
  const galleryMedia = media
    .filter((m) => m.kind === 'gallery')
    .sort((a, b) => a.sort - b.sort || a.id - b.id)
  return galleryMedia[0]?.r2Key ?? null
}

function truncateDescription(text: string): string {
  if (text.length <= DESCRIPTION_MAX_LENGTH) return text
  const hardCut = text.slice(0, DESCRIPTION_MAX_LENGTH)
  const lastSpace = hardCut.lastIndexOf(' ')
  const truncated = lastSpace > 0 ? hardCut.slice(0, lastSpace) : hardCut
  return `${truncated}...`
}

function replaceTitle(html: string, title: string): string {
  return html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
}

/** Replaces the `content="..."` value of a `<meta>` tag identified by its
 * `name` or `property` attribute (e.g. `og:title`, `description`). Matches
 * the exact attribute ordering used in index.html (`name`/`property` first,
 * then `content`), so this is a targeted replacement rather than a generic
 * HTML parse. */
function replaceMetaContent(html: string, attr: 'name' | 'property', key: string, value: string): string {
  const pattern = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*("\\s*/>)`)
  return html.replace(pattern, `$1${value}$2`)
}

productMetaRoutes.get('/products/:slug', async (c) => {
  const slug = c.req.param('slug')
  const assetsResponse = await c.env.ASSETS.fetch(c.req.raw)

  const contentType = assetsResponse.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) {
    return assetsResponse
  }

  const store = c.get('productStore')
  const product: ProductDetail | null = await store.getBySlugPublished(slug)
  if (!product) {
    return assetsResponse
  }

  const name = product.translations.tr?.name || product.translations.en?.name || slug
  const rawDescription = product.translations.tr?.description || product.translations.en?.description || ''
  const description = truncateDescription(rawDescription)
  const cover = firstGalleryCover(product.media)
  const coverUrl = cover ? `${SITE_ORIGIN}/api/media/${cover}` : DEFAULT_OG_IMAGE
  const url = `${SITE_ORIGIN}/products/${slug}`
  const pageTitle = `${name} | Furkan Çiçekli | Tesbih Ustası`

  const escapedName = escapeHtmlAttr(name)
  const escapedTitle = escapeHtmlAttr(pageTitle)
  const escapedDescription = escapeHtmlAttr(description)
  const escapedUrl = escapeHtmlAttr(url)
  const escapedCoverUrl = escapeHtmlAttr(coverUrl)

  let html = await assetsResponse.text()
  html = replaceTitle(html, escapedTitle)
  html = replaceMetaContent(html, 'name', 'description', escapedDescription)
  html = replaceMetaContent(html, 'property', 'og:title', escapedName)
  html = replaceMetaContent(html, 'property', 'og:description', escapedDescription)
  html = replaceMetaContent(html, 'property', 'og:image', escapedCoverUrl)
  html = replaceMetaContent(html, 'property', 'og:url', escapedUrl)
  html = replaceMetaContent(html, 'property', 'twitter:title', escapedName)
  html = replaceMetaContent(html, 'property', 'twitter:description', escapedDescription)
  html = replaceMetaContent(html, 'property', 'twitter:image', escapedCoverUrl)
  html = replaceMetaContent(html, 'property', 'twitter:url', escapedUrl)

  return c.body(html, 200, {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=300',
  })
})
