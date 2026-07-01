import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { mediaRoutes, publicMediaRoutes, type MediaEnv, type PublicMediaEnv } from './media'
import { productsRoutes, type ProductsEnv } from './products'
import { requireAuth } from '../middleware/require-auth'
import type { AuthEnv } from './auth'
import type { ProductDetail } from '../db/products'
import { fakeAuthStore } from '../test/fake-auth-store'
import { fakeProductStore } from '../test/fake-product-store'
import { fakeCertStore } from '../test/fake-cert-store'
import { fakeR2Bucket } from '../test/fake-r2-bucket'

async function json<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T
}

type CombinedEnv = {
  Bindings: AuthEnv['Bindings'] & MediaEnv['Bindings']
  Variables: AuthEnv['Variables'] & ProductsEnv['Variables']
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    translations: { tr: { name: 'Yüzük', description: null, story: null } },
    ...overrides,
  }
}

describe('media routes (admin)', () => {
  let productStore: ReturnType<typeof fakeProductStore>
  let authStore: ReturnType<typeof fakeAuthStore>
  let r2: ReturnType<typeof fakeR2Bucket>
  let app: Hono<CombinedEnv>
  const cookie = 'sid=test-session'

  beforeEach(async () => {
    productStore = fakeProductStore()
    authStore = fakeAuthStore()
    r2 = fakeR2Bucket()
    const user = await authStore.createUser('admin@example.com', 'hash')
    await authStore.createSession('test-session', user.id, Math.floor(Date.now() / 1000) + 3600)

    app = new Hono<CombinedEnv>()
    app.use('*', async (c, next) => {
      c.set('store', authStore)
      c.set('productStore', productStore)
      c.set('certStore', fakeCertStore(productStore))
      await next()
    })
    app.use('/api/admin/products/*', requireAuth)
    app.use('/api/admin/media/*', requireAuth)
    app.route('/api/admin/products', productsRoutes)
    app.route('/api/admin', mediaRoutes)
  })

  function req(path: string, init: RequestInit = {}) {
    return app.request(path, init, { MEDIA: r2 as unknown as R2Bucket })
  }

  async function createProduct(): Promise<ProductDetail> {
    const res = await req('/api/admin/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(validInput()),
    })
    return json<ProductDetail>(res)
  }

  function uploadForm(file: File, kind?: string) {
    const form = new FormData()
    form.set('file', file)
    if (kind !== undefined) form.set('kind', kind)
    return form
  }

  it('uploads a media file and returns 201 with correct R2 key scheme', async () => {
    const product = await createProduct()
    const file = new File([new Uint8Array([1, 2, 3])], 'a.jpg', { type: 'image/jpeg' })
    const res = await req(`/api/admin/products/${product.id}/media`, {
      method: 'POST',
      headers: { cookie },
      body: uploadForm(file, 'gallery'),
    })
    expect(res.status).toBe(201)
    const body = await json<{ id: number; type: string; r2Key: string; kind: string; sort: number }>(res)
    expect(body.type).toBe('image')
    expect(body.kind).toBe('gallery')
    expect(body.r2Key).toMatch(new RegExp(`^products/${product.id}/[0-9a-f-]{36}\\.jpg$`))

    const stored = await r2.get(body.r2Key)
    expect(stored).not.toBeNull()
  })

  it('defaults kind to gallery when not provided', async () => {
    const product = await createProduct()
    const file = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' })
    const res = await req(`/api/admin/products/${product.id}/media`, {
      method: 'POST',
      headers: { cookie },
      body: uploadForm(file),
    })
    expect(res.status).toBe(201)
    const body = await json<{ kind: string }>(res)
    expect(body.kind).toBe('gallery')
  })

  it('rejects an unsupported MIME type with 400 invalid_file', async () => {
    const product = await createProduct()
    const file = new File([new Uint8Array([1, 2, 3])], 'a.txt', { type: 'text/plain' })
    const res = await req(`/api/admin/products/${product.id}/media`, {
      method: 'POST',
      headers: { cookie },
      body: uploadForm(file),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_file' })
  })

  it('rejects a file over 15MB with 400 file_too_large', async () => {
    const product = await createProduct()
    const bigBytes = new Uint8Array(15 * 1024 * 1024 + 1)
    const file = new File([bigBytes], 'a.jpg', { type: 'image/jpeg' })
    const res = await req(`/api/admin/products/${product.id}/media`, {
      method: 'POST',
      headers: { cookie },
      body: uploadForm(file),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'file_too_large' })
  })

  it('returns 404 when the product does not exist', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'a.jpg', { type: 'image/jpeg' })
    const res = await req('/api/admin/products/999/media', {
      method: 'POST',
      headers: { cookie },
      body: uploadForm(file),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
  })

  it('rejects a missing file with 400 invalid_request', async () => {
    const product = await createProduct()
    const form = new FormData()
    form.set('kind', 'gallery')
    const res = await req(`/api/admin/products/${product.id}/media`, {
      method: 'POST',
      headers: { cookie },
      body: form,
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('accepts video/mp4 and maps type to video with .mp4 extension', async () => {
    const product = await createProduct()
    const file = new File([new Uint8Array([1, 2, 3])], 'a.mp4', { type: 'video/mp4' })
    const res = await req(`/api/admin/products/${product.id}/media`, {
      method: 'POST',
      headers: { cookie },
      body: uploadForm(file),
    })
    expect(res.status).toBe(201)
    const body = await json<{ type: string; r2Key: string }>(res)
    expect(body.type).toBe('video')
    expect(body.r2Key).toMatch(/\.mp4$/)
  })

  it('updates media kind/sort via PATCH', async () => {
    const product = await createProduct()
    const file = new File([new Uint8Array([1, 2, 3])], 'a.jpg', { type: 'image/jpeg' })
    const created = await json<{ id: number }>(
      await req(`/api/admin/products/${product.id}/media`, {
        method: 'POST',
        headers: { cookie },
        body: uploadForm(file),
      }),
    )

    const res = await req(`/api/admin/media/${created.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ kind: 'process', sort: 3 }),
    })
    expect(res.status).toBe(200)
    const body = await json<{ kind: string; sort: number }>(res)
    expect(body.kind).toBe('process')
    expect(body.sort).toBe(3)
  })

  it('returns 404 when PATCHing a missing media item', async () => {
    const res = await req('/api/admin/media/999', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ kind: 'process' }),
    })
    expect(res.status).toBe(404)
  })

  it('DELETE removes the media row and the R2 object', async () => {
    const product = await createProduct()
    const file = new File([new Uint8Array([1, 2, 3])], 'a.jpg', { type: 'image/jpeg' })
    const created = await json<{ id: number; r2Key: string }>(
      await req(`/api/admin/products/${product.id}/media`, {
        method: 'POST',
        headers: { cookie },
        body: uploadForm(file),
      }),
    )

    expect(await r2.get(created.r2Key)).not.toBeNull()

    const res = await req(`/api/admin/media/${created.id}`, { method: 'DELETE', headers: { cookie } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(await r2.get(created.r2Key)).toBeNull()
  })

  it('returns 404 when deleting a missing media item', async () => {
    const res = await req('/api/admin/media/999', { method: 'DELETE', headers: { cookie } })
    expect(res.status).toBe(404)
  })
})

describe('public media serving', () => {
  let r2: ReturnType<typeof fakeR2Bucket>
  let app: Hono<PublicMediaEnv>

  beforeEach(() => {
    r2 = fakeR2Bucket()
    app = new Hono<PublicMediaEnv>()
    app.route('/api/media', publicMediaRoutes)
  })

  function req(path: string) {
    return app.request(path, {}, { MEDIA: r2 as unknown as R2Bucket })
  }

  it('serves a stored object with content-type and cache headers', async () => {
    await r2.put('products/1/abc.jpg', new Uint8Array([1, 2, 3]).buffer, { httpMetadata: { contentType: 'image/jpeg' } })
    const res = await req('/api/media/products/1/abc.jpg')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    const buf = await res.arrayBuffer()
    expect(new Uint8Array(buf)).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('returns 404 for an unknown key', async () => {
    const res = await req('/api/media/products/1/missing.jpg')
    expect(res.status).toBe(404)
  })

  it('rejects a path containing .. with 400', async () => {
    // A literal `../` is collapsed by URL parsing before it reaches the handler,
    // so the traversal attempt must be percent-encoded to survive to the route.
    const res = await req('/api/media/products/..%2Fsecret.jpg')
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })
})

describe('product DELETE removes all R2 objects', () => {
  it('deletes every media r2Key from R2 when the product is deleted', async () => {
    const productStore = fakeProductStore()
    const authStore = fakeAuthStore()
    const r2 = fakeR2Bucket()
    const user = await authStore.createUser('admin@example.com', 'hash')
    await authStore.createSession('test-session', user.id, Math.floor(Date.now() / 1000) + 3600)
    const cookie = 'sid=test-session'

    const app = new Hono<CombinedEnv>()
    app.use('*', async (c, next) => {
      c.set('store', authStore)
      c.set('productStore', productStore)
      c.set('certStore', fakeCertStore(productStore))
      await next()
    })
    app.use('/api/admin/products/*', requireAuth)
    app.route('/api/admin/products', productsRoutes)

    function req(path: string, init: RequestInit = {}) {
      return app.request(path, init, { MEDIA: r2 as unknown as R2Bucket })
    }

    const created = await json<ProductDetail>(
      await req('/api/admin/products', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify(validInput()),
      }),
    )

    await r2.put('products/1/one.jpg', new Uint8Array([1]).buffer, {})
    await r2.put('products/1/two.jpg', new Uint8Array([2]).buffer, {})
    productStore.media.push({ id: 1, productId: created.id, type: 'image', r2Key: 'products/1/one.jpg', kind: 'gallery', sort: 0 })
    productStore.media.push({ id: 2, productId: created.id, type: 'image', r2Key: 'products/1/two.jpg', kind: 'gallery', sort: 1 })

    const res = await req(`/api/admin/products/${created.id}`, { method: 'DELETE', headers: { cookie } })
    expect(res.status).toBe(200)

    expect(await r2.get('products/1/one.jpg')).toBeNull()
    expect(await r2.get('products/1/two.jpg')).toBeNull()
  })
})
