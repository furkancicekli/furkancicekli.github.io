import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { productsRoutes, type ProductsEnv } from './products'
import { requireAuth } from '../middleware/require-auth'
import type { AuthEnv } from './auth'
import type { ProductDetail } from '../db/products'
import { isValidSerial } from '../lib/serial'
import { fakeAuthStore } from '../test/fake-auth-store'
import { fakeProductStore } from '../test/fake-product-store'
import { fakeCertStore } from '../test/fake-cert-store'
import { fakeR2Bucket } from '../test/fake-r2-bucket'

async function json<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T
}

type CombinedEnv = { Bindings: AuthEnv['Bindings']; Variables: AuthEnv['Variables'] & ProductsEnv['Variables'] }

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    translations: { tr: { name: 'Kuka Tesbih', description: null, story: null } },
    ...overrides,
  }
}

describe('products routes', () => {
  let productStore: ReturnType<typeof fakeProductStore>
  let certStore: ReturnType<typeof fakeCertStore>
  let authStore: ReturnType<typeof fakeAuthStore>
  let r2Bucket: ReturnType<typeof fakeR2Bucket>
  let app: Hono<CombinedEnv>
  const cookie = 'sid=test-session'

  beforeEach(async () => {
    productStore = fakeProductStore()
    certStore = fakeCertStore(productStore)
    authStore = fakeAuthStore()
    r2Bucket = fakeR2Bucket()
    const user = await authStore.createUser('admin@example.com', 'hash')
    await authStore.createSession('test-session', user.id, Math.floor(Date.now() / 1000) + 3600)

    app = new Hono<CombinedEnv>()
    app.use('*', async (c, next) => {
      c.set('store', authStore)
      c.set('productStore', productStore)
      c.set('certStore', certStore)
      await next()
    })
    app.use('/api/admin/products/*', requireAuth)
    app.route('/api/admin/products', productsRoutes)
  })

  function req(path: string, init: RequestInit = {}) {
    return app.request(path, init, { MEDIA: r2Bucket as unknown as R2Bucket })
  }

  function post(body: unknown) {
    return req('/api/admin/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    })
  }

  function put(id: number | string, body: unknown) {
    return req(`/api/admin/products/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    })
  }

  it('blocks unauthenticated access', async () => {
    const res = await req('/api/admin/products')
    expect(res.status).toBe(401)
  })

  it('creates a product with auto-generated slug, serial, status=draft, and a certificate', async () => {
    const res = await post(validInput())
    expect(res.status).toBe(201)
    const body = await json<ProductDetail & { certificate: { serialNo: string; qrToken: string } }>(res)

    expect(body.slug.startsWith('kuka-tesbih')).toBe(true)
    expect(body.status).toBe('draft')
    expect(body.serialNo).not.toBeNull()
    expect(isValidSerial(body.serialNo as string)).toBe(true)
    expect(body.translations.tr?.name).toBe('Kuka Tesbih')

    expect(body.certificate).toBeDefined()
    expect(body.certificate.serialNo).toBe(body.serialNo)
    expect(body.certificate.qrToken).toBeTypeOf('string')
    expect(body.certificate.qrToken.length).toBeGreaterThan(0)

    // Certificate row actually created in the store
    expect(certStore.certificates).toHaveLength(1)
    expect(certStore.certificates[0].productId).toBe(body.id)
    expect(certStore.certificates[0].serialNo).toBe(body.serialNo)
  })

  it('appends a random suffix to the slug on collision', async () => {
    // Seed an existing product with the slug that would be derived
    await productStore.create({
      slug: 'kuka-tesbih',
      serialNo: '1111111111111119',
      status: 'draft',
      translations: { tr: { name: 'Kuka Tesbih', description: null, story: null } },
    })

    const res = await post(validInput())
    expect(res.status).toBe(201)
    const body = await json<ProductDetail>(res)
    expect(body.slug).not.toBe('kuka-tesbih')
    expect(body.slug.startsWith('kuka-tesbih-')).toBe(true)
    expect(body.slug.length).toBe('kuka-tesbih-'.length + 4)
  })

  it('rejects missing tr.name with tr_name_required', async () => {
    const res = await post(validInput({ translations: { tr: { name: '', description: null, story: null } } }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'tr_name_required' })
  })

  it('rejects a non-object JSON body', async () => {
    const res = await req('/api/admin/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: 'null',
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('accepts a fractional weightGrams and round-trips it in the detail', async () => {
    const res = await post(validInput({ weightGrams: 33.6 }))
    expect(res.status).toBe(201)
    const body = await json<ProductDetail>(res)
    expect(body.weightGrams).toBe(33.6)
  })

  it('rejects a negative weightGrams with invalid_request', async () => {
    const res = await post(validInput({ weightGrams: -1 }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('rejects an Infinity weightGrams with invalid_request', async () => {
    // JSON has no NaN/Infinity literal; JSON.stringify coerces both to null,
    // which the validator correctly treats as "not provided". Exercise the
    // finiteness check by sending a value that survives JSON round-tripping
    // but still fails Number.isFinite in a way requests can actually trigger:
    // a wire-format `1e400` overflows to Infinity on parse.
    const res = await req('/api/admin/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: '{"weightGrams":1e400,"translations":{"tr":{"name":"Kuka Tesbih","description":null,"story":null}}}',
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('rejects a string weightGrams with invalid_request', async () => {
    const res = await post(validInput({ weightGrams: '33.6' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('trims material/size, empty string becomes null', async () => {
    const res = await post(validInput({ material: '  Gümüş  ', size: '   ' }))
    expect(res.status).toBe(201)
    const body = await json<ProductDetail>(res)
    expect(body.material).toBe('Gümüş')
    expect(body.size).toBeNull()
  })

  it('lists products with tr name, media count, and weightGrams', async () => {
    const created = await json<ProductDetail>(await post(validInput({ weightGrams: 12 })))
    productStore.media.push({ id: 1, productId: created.id, type: 'image', r2Key: 'k1', kind: 'gallery', sort: 0 })
    productStore.media.push({ id: 2, productId: created.id, type: 'image', r2Key: 'k2', kind: 'gallery', sort: 1 })

    const res = await req('/api/admin/products', { headers: { cookie } })
    expect(res.status).toBe(200)
    const body = await json<{ products: { weightGrams: number | null }[] }>(res)
    expect(body.products).toHaveLength(1)
    expect(body.products[0]).toMatchObject({ name: 'Kuka Tesbih', mediaCount: 2, weightGrams: 12 })
  })

  it('returns 404 for a missing product', async () => {
    const res = await req('/api/admin/products/999', { headers: { cookie } })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
  })

  it('returns 400 for a non-numeric id', async () => {
    const res = await req('/api/admin/products/abc', { headers: { cookie } })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('PUT updates material/weight/translations, leaving slug/serial/status unchanged', async () => {
    const created = await json<ProductDetail>(await post(validInput({ material: 'Gümüş', weightGrams: 10 })))

    const res = await put(created.id, validInput({ material: 'Altın', weightGrams: 20, translations: { tr: { name: 'Yeni İsim', description: null, story: null } } }))
    expect(res.status).toBe(200)
    const body = await json<ProductDetail>(res)
    expect(body.material).toBe('Altın')
    expect(body.weightGrams).toBe(20)
    expect(body.translations.tr?.name).toBe('Yeni İsim')
    expect(body.slug).toBe(created.slug)
    expect(body.serialNo).toBe(created.serialNo)
    expect(body.status).toBe(created.status)
  })

  it('replaces translations on PUT (en removed, tr kept)', async () => {
    const created = await json<ProductDetail>(
      await post(
        validInput({
          translations: {
            tr: { name: 'Yüzük', description: null, story: null },
            en: { name: 'Ring', description: null, story: null },
          },
        }),
      ),
    )
    expect(created.translations.en).toBeDefined()

    const res = await put(created.id, validInput({ translations: { tr: { name: 'Yüzük 2', description: null, story: null } } }))
    expect(res.status).toBe(200)
    const body = await json<ProductDetail>(res)
    expect(body.translations.tr?.name).toBe('Yüzük 2')
    expect(body.translations.en).toBeUndefined()
  })

  it('returns 404 when PUT targets a missing product', async () => {
    const res = await put(999, validInput())
    expect(res.status).toBe(404)
  })

  it('PUT rejects a negative weightGrams', async () => {
    const created = await json<ProductDetail>(await post(validInput()))
    const res = await put(created.id, validInput({ weightGrams: -5 }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('publishes a draft product', async () => {
    const created = await json<ProductDetail>(await post(validInput()))
    expect(created.status).toBe('draft')

    const res = await req(`/api/admin/products/${created.id}/publish`, { method: 'POST', headers: { cookie } })
    expect(res.status).toBe(200)
    const body = await json<ProductDetail>(res)
    expect(body.status).toBe('published')
  })

  it('unpublishes a published product back to draft', async () => {
    const created = await json<ProductDetail>(await post(validInput()))
    await req(`/api/admin/products/${created.id}/publish`, { method: 'POST', headers: { cookie } })

    const res = await req(`/api/admin/products/${created.id}/unpublish`, { method: 'POST', headers: { cookie } })
    expect(res.status).toBe(200)
    const body = await json<ProductDetail>(res)
    expect(body.status).toBe('draft')
  })

  it('returns 404 when publishing a missing product', async () => {
    const res = await req('/api/admin/products/999/publish', { method: 'POST', headers: { cookie } })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
  })

  it('returns 404 when unpublishing a missing product', async () => {
    const res = await req('/api/admin/products/999/unpublish', { method: 'POST', headers: { cookie } })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
  })

  it('deletes a product; subsequent GET is 404', async () => {
    const created = await json<ProductDetail>(await post(validInput()))
    const delRes = await req(`/api/admin/products/${created.id}`, { method: 'DELETE', headers: { cookie } })
    expect(delRes.status).toBe(200)
    expect(await delRes.json()).toEqual({ ok: true })

    const getRes = await req(`/api/admin/products/${created.id}`, { headers: { cookie } })
    expect(getRes.status).toBe(404)
  })

  it('returns 404 when deleting a missing product', async () => {
    const res = await req('/api/admin/products/999', { method: 'DELETE', headers: { cookie } })
    expect(res.status).toBe(404)
  })

  it('deletes product even when R2 delete fails', async () => {
    const created = await json<ProductDetail>(await post(validInput()))
    productStore.media.push({ id: 1, productId: created.id, type: 'image', r2Key: 'k1', kind: 'gallery', sort: 0 })

    const throwingBucket = {
      ...r2Bucket,
      async delete() {
        throw new Error('R2 transient error')
      },
    }

    const delRes = await app.request(
      `/api/admin/products/${created.id}`,
      { method: 'DELETE', headers: { cookie } },
      { MEDIA: throwingBucket as unknown as R2Bucket }
    )
    expect(delRes.status).toBe(200)
    expect(await delRes.json()).toEqual({ ok: true })

    const getRes = await req(`/api/admin/products/${created.id}`, { headers: { cookie } })
    expect(getRes.status).toBe(404)
  })

  it('returns 404 for removed steps endpoints', async () => {
    const created = await json<ProductDetail>(await post(validInput()))
    const res = await req(`/api/admin/products/${created.id}/steps`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ texts: { tr: 'Döküm' } }),
    })
    expect(res.status).toBe(404)
  })

  it('GET detail returns steps as an empty array', async () => {
    const created = await json<ProductDetail>(await post(validInput()))
    const res = await req(`/api/admin/products/${created.id}`, { headers: { cookie } })
    const body = await json<ProductDetail>(res)
    expect(body.steps).toEqual([])
  })
})
