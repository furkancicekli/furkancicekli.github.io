import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { publicProductsRoutes, type PublicProductsEnv } from './public-products'
import type { ProductDetail } from '../db/products'
import { fakeProductStore } from '../test/fake-product-store'

async function json<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T
}

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

describe('public products routes', () => {
  let productStore: ReturnType<typeof fakeProductStore>
  let app: Hono<PublicProductsEnv>

  beforeEach(() => {
    productStore = fakeProductStore()
    app = new Hono<PublicProductsEnv>()
    app.use('*', async (c, next) => {
      c.set('productStore', productStore)
      await next()
    })
    app.route('/api/products', publicProductsRoutes)
  })

  describe('GET /api/products', () => {
    it('lists only published products, excluding drafts', async () => {
      await productStore.create(validInput({ slug: 'draft-1', status: 'draft' }))
      await productStore.create(validInput({ slug: 'pub-1', status: 'published' }))

      const res = await app.request('/api/products')
      expect(res.status).toBe(200)
      const body = await json<{ products: { slug: string }[] }>(res)
      expect(body.products.map((p) => p.slug)).toEqual(['pub-1'])
    })

    it('does not leak draft product data anywhere in the list response', async () => {
      await productStore.create(validInput({ slug: 'secret-draft', status: 'draft' }))
      const res = await app.request('/api/products')
      const text = await res.text()
      expect(text).not.toContain('secret-draft')
    })

    it('orders by createdAt DESC, tiebreak id DESC', async () => {
      const p1 = await productStore.create(validInput({ slug: 'a', status: 'published' }))
      const p2 = await productStore.create(validInput({ slug: 'b', status: 'published' }))
      const p3 = await productStore.create(validInput({ slug: 'c', status: 'published' }))
      // Force identical createdAt to test id DESC tiebreak
      productStore.products.forEach((p) => {
        p.createdAt = 1000
      })
      void p1
      void p2
      void p3

      const res = await app.request('/api/products')
      const body = await json<{ products: { slug: string }[] }>(res)
      expect(body.products.map((p) => p.slug)).toEqual(['c', 'b', 'a'])
    })

    it('returns requested lang text when present', async () => {
      await productStore.create(
        validInput({
          slug: 'multi-lang',
          status: 'published',
          translations: {
            tr: { name: 'Türkçe Ad', description: 'Türkçe açıklama', story: null },
            en: { name: 'English Name', description: 'English description', story: null },
          },
        }),
      )

      const res = await app.request('/api/products?lang=en')
      const body = await json<{ products: { name: string; description: string }[] }>(res)
      expect(body.products[0]).toMatchObject({ name: 'English Name', description: 'English description' })
    })

    it('falls back to tr per-field when en translation field missing', async () => {
      await productStore.create(
        validInput({
          slug: 'partial-en',
          status: 'published',
          translations: {
            tr: { name: 'Türkçe Ad', description: 'Türkçe açıklama', story: null },
            en: { name: 'English Name', description: null, story: null },
          },
        }),
      )

      const res = await app.request('/api/products?lang=en')
      const body = await json<{ products: { name: string; description: string }[] }>(res)
      expect(body.products[0]).toMatchObject({ name: 'English Name', description: 'Türkçe açıklama' })
    })

    it('falls back to tr when lang is invalid or missing', async () => {
      await productStore.create(
        validInput({ slug: 'p', status: 'published', translations: { tr: { name: 'TR Ad', description: null, story: null } } }),
      )

      const resInvalid = await app.request('/api/products?lang=xx')
      const bodyInvalid = await json<{ products: { name: string }[] }>(resInvalid)
      expect(bodyInvalid.products[0].name).toBe('TR Ad')

      const resMissing = await app.request('/api/products')
      const bodyMissing = await json<{ products: { name: string }[] }>(resMissing)
      expect(bodyMissing.products[0].name).toBe('TR Ad')
    })

    it('sets cover to r2Key of first gallery-kind media by sort, tiebreak id, ignoring other kinds', async () => {
      const p = await productStore.create(validInput({ slug: 'with-media', status: 'published' }))
      await productStore.addMedia(p.id, { type: 'image', r2Key: 'raw-1.jpg', kind: 'raw_material', sort: 0 })
      await productStore.addMedia(p.id, { type: 'image', r2Key: 'gallery-2.jpg', kind: 'gallery', sort: 2 })
      await productStore.addMedia(p.id, { type: 'image', r2Key: 'gallery-1.jpg', kind: 'gallery', sort: 1 })
      await productStore.addMedia(p.id, { type: 'image', r2Key: 'process-1.jpg', kind: 'process', sort: 0 })

      const res = await app.request('/api/products')
      const body = await json<{ products: { cover: string | null }[] }>(res)
      expect(body.products[0].cover).toBe('gallery-1.jpg')
    })

    it('sets cover to null when there is no gallery-kind media', async () => {
      const p = await productStore.create(validInput({ slug: 'no-gallery', status: 'published' }))
      await productStore.addMedia(p.id, { type: 'image', r2Key: 'process-1.jpg', kind: 'process', sort: 0 })

      const res = await app.request('/api/products')
      const body = await json<{ products: { cover: string | null }[] }>(res)
      expect(body.products[0].cover).toBeNull()
    })

    it('counts all media kinds in mediaCount', async () => {
      const p = await productStore.create(validInput({ slug: 'counted', status: 'published' }))
      await productStore.addMedia(p.id, { type: 'image', r2Key: 'g.jpg', kind: 'gallery', sort: 0 })
      await productStore.addMedia(p.id, { type: 'image', r2Key: 'r.jpg', kind: 'raw_material', sort: 0 })
      await productStore.addMedia(p.id, { type: 'image', r2Key: 'p.jpg', kind: 'process', sort: 0 })

      const res = await app.request('/api/products')
      const body = await json<{ products: { mediaCount: number }[] }>(res)
      expect(body.products[0].mediaCount).toBe(3)
    })

    it('works without authentication', async () => {
      await productStore.create(validInput({ slug: 'open', status: 'published' }))
      const res = await app.request('/api/products')
      expect(res.status).toBe(200)
    })
  })

  describe('GET /api/products/:slug', () => {
    it('returns full detail for a published product', async () => {
      const p = await productStore.create(
        validInput({
          slug: 'detail-happy',
          status: 'published',
          serialNo: 'SN-001',
          translations: { tr: { name: 'Ad', description: 'Açıklama', story: 'Hikaye' } },
        }),
      )
      await productStore.addMedia(p.id, { type: 'image', r2Key: 'process-1.jpg', kind: 'process', sort: 0 })
      await productStore.addMedia(p.id, { type: 'image', r2Key: 'raw-1.jpg', kind: 'raw_material', sort: 0 })
      await productStore.addMedia(p.id, { type: 'image', r2Key: 'gallery-2.jpg', kind: 'gallery', sort: 2 })
      await productStore.addMedia(p.id, { type: 'image', r2Key: 'gallery-1.jpg', kind: 'gallery', sort: 1 })

      const res = await app.request('/api/products/detail-happy')
      expect(res.status).toBe(200)
      const body = await json<{ product: ProductDetail & { media: { r2Key: string }[] } }>(res)
      expect(body.product).toMatchObject({
        slug: 'detail-happy',
        name: 'Ad',
        description: 'Açıklama',
        story: 'Hikaye',
        material: 'Kuka',
        size: '10mm',
        weightGrams: 25,
      })
      // Güvenlik regresyon guard'ı: seri no public cevapta ASLA yer almaz —
      // sahte ürüne yapıştırılabilir; yalnızca fiziksel kartta yaşar.
      expect(body.product).not.toHaveProperty('serialNo')
      expect(JSON.stringify(body)).not.toContain('SN-001')
      // gallery first (sorted), then process, then raw_material
      expect(body.product.media.map((m) => m.r2Key)).toEqual([
        'gallery-1.jpg',
        'gallery-2.jpg',
        'process-1.jpg',
        'raw-1.jpg',
      ])
    })

    it('applies lang + tr fallback to name/description/story', async () => {
      await productStore.create(
        validInput({
          slug: 'detail-lang',
          status: 'published',
          translations: {
            tr: { name: 'TR Ad', description: 'TR Açıklama', story: 'TR Hikaye' },
            en: { name: 'EN Name', description: null, story: null },
          },
        }),
      )

      const res = await app.request('/api/products/detail-lang?lang=en')
      const body = await json<{ product: { name: string; description: string; story: string } }>(res)
      expect(body.product).toMatchObject({
        name: 'EN Name',
        description: 'TR Açıklama',
        story: 'TR Hikaye',
      })
    })

    it('returns 404 for a draft product', async () => {
      await productStore.create(validInput({ slug: 'draft-detail', status: 'draft' }))
      const res = await app.request('/api/products/draft-detail')
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'not_found' })
    })

    it('returns 404 for an unknown slug', async () => {
      const res = await app.request('/api/products/does-not-exist')
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'not_found' })
    })

    it('works without authentication', async () => {
      await productStore.create(validInput({ slug: 'open-detail', status: 'published' }))
      const res = await app.request('/api/products/open-detail')
      expect(res.status).toBe(200)
    })
  })
})
