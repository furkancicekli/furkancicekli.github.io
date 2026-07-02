import { Hono } from 'hono'
import type { ProductStore } from '../db/products'

export type SitemapEnv = {
  Bindings: Record<string, unknown>
  Variables: { productStore: ProductStore }
}

export const sitemapRoutes = new Hono<SitemapEnv>()

const SITE_ORIGIN = 'https://furkancicekli.com'

const STATIC_PATHS = ['/', '/products', '/gallery', '/faq', '/contact', '/verify']

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toIsoDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString().slice(0, 10)
}

function urlEntry(loc: string, lastmod?: string): string {
  const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''
  return `  <url>\n    <loc>${xmlEscape(loc)}</loc>${lastmodTag}\n  </url>`
}

sitemapRoutes.get('/sitemap.xml', async (c) => {
  const store = c.get('productStore')
  const products = await store.listPublished()

  const staticEntries = STATIC_PATHS.map((path) => urlEntry(`${SITE_ORIGIN}${path}`))
  const productEntries = products.map((p) =>
    urlEntry(`${SITE_ORIGIN}/products/${p.slug}`, toIsoDate(p.updatedAt)),
  )

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...staticEntries, ...productEntries].join('\n')}\n</urlset>`

  return c.body(body, 200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  })
})
