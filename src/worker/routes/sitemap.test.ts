import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { sitemapRoutes, type SitemapEnv } from './sitemap'
import { fakeProductStore } from '../test/fake-product-store'

const STATIC_PATHS = ['/', '/products', '/gallery', '/faq', '/contact', '/verify']

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'kuka-tesbih',
    status: 'draft' as const,
    material: 'Kuka',
    size: '10mm',
    weightGrams: 25,
    translations: { tr: { name: 'Kuka Tesbih', description: 'Açıklama', story: 'Hikaye' } },
    ...overrides,
  }
}

describe('sitemap route', () => {
  let productStore: ReturnType<typeof fakeProductStore>
  let app: Hono<SitemapEnv>

  beforeEach(() => {
    productStore = fakeProductStore()
    app = new Hono<SitemapEnv>()
    app.use('*', async (c, next) => {
      c.set('productStore', productStore)
      await next()
    })
    app.route('/', sitemapRoutes)
  })

  it('returns 200 with xml content-type and cache-control headers', async () => {
    const res = await app.request('/sitemap.xml')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/xml; charset=utf-8')
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600')
  })

  it('includes all static routes', async () => {
    const res = await app.request('/sitemap.xml')
    const text = await res.text()
    for (const path of STATIC_PATHS) {
      expect(text).toContain(`<loc>https://furkancicekli.com${path}</loc>`)
    }
  })

  it('includes published product URL with lastmod date and excludes drafts', async () => {
    const published = await productStore.create(validInput({ slug: 'published-item', status: 'published' }))
    productStore.products.find((p) => p.id === published.id)!.updatedAt = Date.parse('2026-03-15T00:00:00Z') / 1000
    await productStore.create(validInput({ slug: 'secret-draft', status: 'draft' }))

    const res = await app.request('/sitemap.xml')
    const text = await res.text()

    expect(text).toContain('<loc>https://furkancicekli.com/products/published-item</loc>')
    expect(text).toContain('<lastmod>2026-03-15</lastmod>')
    expect(text).not.toContain('secret-draft')
  })

  it('produces well-formed XML with correct url count (static + published)', async () => {
    await productStore.create(validInput({ slug: 'pub-1', status: 'published' }))
    await productStore.create(validInput({ slug: 'pub-2', status: 'published' }))
    await productStore.create(validInput({ slug: 'draft-1', status: 'draft' }))

    const res = await app.request('/sitemap.xml')
    const text = await res.text()

    expect(text.startsWith('<?xml')).toBe(true)
    const urlsetOpen = (text.match(/<urlset[ >]/g) ?? []).length
    const urlsetClose = (text.match(/<\/urlset>/g) ?? []).length
    expect(urlsetOpen).toBe(1)
    expect(urlsetClose).toBe(1)

    const urlOpenCount = (text.match(/<url>/g) ?? []).length
    const urlCloseCount = (text.match(/<\/url>/g) ?? []).length
    expect(urlOpenCount).toBe(urlCloseCount)
    expect(urlOpenCount).toBe(STATIC_PATHS.length + 2)
  })

  it('returns only static URLs when catalog is empty', async () => {
    const res = await app.request('/sitemap.xml')
    const text = await res.text()
    const urlOpenCount = (text.match(/<url>/g) ?? []).length
    expect(urlOpenCount).toBe(STATIC_PATHS.length)
  })
})
