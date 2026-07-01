import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { productsRoutes, productStepsRoutes, type ProductsEnv } from './products'
import { requireAuth } from '../middleware/require-auth'
import type { AuthEnv } from './auth'
import type { ProductDetail, ProcessStep } from '../db/products'
import { fakeAuthStore } from '../test/fake-auth-store'
import { fakeProductStore } from '../test/fake-product-store'
import { fakeR2Bucket } from '../test/fake-r2-bucket'

async function json<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T
}

type CombinedEnv = { Bindings: AuthEnv['Bindings']; Variables: AuthEnv['Variables'] & ProductsEnv['Variables'] }

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'ring-01',
    status: 'draft',
    translations: { tr: { name: 'Yüzük', description: null, story: null } },
    ...overrides,
  }
}

describe('products routes', () => {
  let productStore: ReturnType<typeof fakeProductStore>
  let authStore: ReturnType<typeof fakeAuthStore>
  let r2Bucket: ReturnType<typeof fakeR2Bucket>
  let app: Hono<CombinedEnv>
  const cookie = 'sid=test-session'

  beforeEach(async () => {
    productStore = fakeProductStore()
    authStore = fakeAuthStore()
    r2Bucket = fakeR2Bucket()
    const user = await authStore.createUser('admin@example.com', 'hash')
    await authStore.createSession('test-session', user.id, Math.floor(Date.now() / 1000) + 3600)

    app = new Hono<CombinedEnv>()
    app.use('*', async (c, next) => {
      c.set('store', authStore)
      c.set('productStore', productStore)
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

  it('creates a product and returns 201 with detail', async () => {
    const res = await post(validInput())
    expect(res.status).toBe(201)
    const body = await json<ProductDetail>(res)
    expect(body).toMatchObject({
      slug: 'ring-01',
      status: 'draft',
      translations: { tr: { name: 'Yüzük' } },
    })
    expect(body.id).toBeTypeOf('number')
  })

  it('rejects invalid slug format', async () => {
    const res = await post(validInput({ slug: 'Not Valid Slug!' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('rejects a duplicate slug with 409', async () => {
    await post(validInput({ slug: 'ring-01' }))
    const res = await post(validInput({ slug: 'ring-01' }))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'slug_taken' })
  })

  it('rejects a duplicate serial number with 409', async () => {
    await post(validInput({ slug: 'ring-01', serialNo: 'SN-1' }))
    const res = await post(validInput({ slug: 'ring-02', serialNo: 'SN-1' }))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'serial_taken' })
  })

  it('allows PUT to keep its own serial number unchanged', async () => {
    const created = await json<ProductDetail>(await post(validInput({ slug: 'ring-01', serialNo: 'SN-1' })))
    const res = await put(created.id, validInput({ slug: 'ring-01', serialNo: 'SN-1' }))
    expect(res.status).toBe(200)
  })

  it('rejects missing tr.name with tr_name_required', async () => {
    const res = await post(validInput({ translations: { tr: { name: '', description: null, story: null } } }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'tr_name_required' })
  })

  it('rejects an invalid status', async () => {
    const res = await post(validInput({ status: 'archived' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_status' })
  })

  it('rejects a negative price', async () => {
    const res = await post(validInput({ price: -5 }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('rejects a non-integer price', async () => {
    const res = await post(validInput({ price: 12.5 }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
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

  it('lists products with tr name and media count', async () => {
    const created = await json<ProductDetail>(await post(validInput({ slug: 'ring-01' })))
    productStore.media.push({ id: 1, productId: created.id, type: 'image', r2Key: 'k1', kind: 'gallery', sort: 0 })
    productStore.media.push({ id: 2, productId: created.id, type: 'image', r2Key: 'k2', kind: 'gallery', sort: 1 })

    const res = await req('/api/admin/products', { headers: { cookie } })
    expect(res.status).toBe(200)
    const body = await json<{ products: unknown[] }>(res)
    expect(body.products).toHaveLength(1)
    expect(body.products[0]).toMatchObject({ slug: 'ring-01', name: 'Yüzük', mediaCount: 2 })
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

  it('replaces translations on PUT (en removed, tr kept)', async () => {
    const created = await json<ProductDetail>(
      await post(
        validInput({
          slug: 'ring-01',
          translations: {
            tr: { name: 'Yüzük', description: null, story: null },
            en: { name: 'Ring', description: null, story: null },
          },
        }),
      ),
    )
    expect(created.translations.en).toBeDefined()

    const res = await put(created.id, validInput({ slug: 'ring-01', translations: { tr: { name: 'Yüzük 2', description: null, story: null } } }))
    expect(res.status).toBe(200)
    const body = await json<ProductDetail>(res)
    expect(body.translations.tr?.name).toBe('Yüzük 2')
    expect(body.translations.en).toBeUndefined()
  })

  it('returns 404 when PUT targets a missing product', async () => {
    const res = await put(999, validInput())
    expect(res.status).toBe(404)
  })

  it('deletes a product; subsequent GET is 404', async () => {
    const created = await json<ProductDetail>(await post(validInput({ slug: 'ring-01' })))
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
    // Create a product with media
    const created = await json<ProductDetail>(await post(validInput({ slug: 'ring-01' })))
    productStore.media.push({ id: 1, productId: created.id, type: 'image', r2Key: 'k1', kind: 'gallery', sort: 0 })

    // Make R2 delete throw an error
    const throwingBucket = {
      ...r2Bucket,
      async delete() {
        throw new Error('R2 transient error')
      },
    }

    // DELETE should still succeed and product should be gone
    const delRes = await app.request(
      `/api/admin/products/${created.id}`,
      { method: 'DELETE', headers: { cookie } },
      { MEDIA: throwingBucket as unknown as R2Bucket }
    )
    expect(delRes.status).toBe(200)
    expect(await delRes.json()).toEqual({ ok: true })

    // Verify product is deleted from store
    const getRes = await req(`/api/admin/products/${created.id}`, { headers: { cookie } })
    expect(getRes.status).toBe(404)
  })
})

describe('product steps routes', () => {
  let productStore: ReturnType<typeof fakeProductStore>
  let authStore: ReturnType<typeof fakeAuthStore>
  let r2Bucket: ReturnType<typeof fakeR2Bucket>
  let app: Hono<CombinedEnv>
  const cookie = 'sid=test-session'

  beforeEach(async () => {
    productStore = fakeProductStore()
    authStore = fakeAuthStore()
    r2Bucket = fakeR2Bucket()
    const user = await authStore.createUser('admin@example.com', 'hash')
    await authStore.createSession('test-session', user.id, Math.floor(Date.now() / 1000) + 3600)

    app = new Hono<CombinedEnv>()
    app.use('*', async (c, next) => {
      c.set('store', authStore)
      c.set('productStore', productStore)
      await next()
    })
    app.use('/api/admin/products/*', requireAuth)
    app.use('/api/admin/steps/*', requireAuth)
    app.route('/api/admin/products', productsRoutes)
    app.route('/api/admin/steps', productStepsRoutes)
  })

  function req(path: string, init: RequestInit = {}) {
    return app.request(path, init, { MEDIA: r2Bucket as unknown as R2Bucket })
  }

  async function createProduct(): Promise<ProductDetail> {
    const res = await req('/api/admin/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(validInput()),
    })
    return json<ProductDetail>(res)
  }

  function addStep(productId: number, body: unknown) {
    return req(`/api/admin/products/${productId}/steps`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    })
  }

  function updateStep(stepId: number | string, body: unknown) {
    return req(`/api/admin/steps/${stepId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    })
  }

  it('blocks unauthenticated access to steps endpoint', async () => {
    const res = await req('/api/admin/steps/1', { method: 'DELETE' })
    expect(res.status).toBe(401)
  })

  it('adds a step with auto-incrementing sort', async () => {
    const product = await createProduct()

    const res1 = await addStep(product.id, { texts: { tr: 'Döküm' } })
    expect(res1.status).toBe(201)
    const step1 = await json<ProcessStep>(res1)
    expect(step1).toMatchObject({ sort: 0, texts: { tr: 'Döküm' } })

    const res2 = await addStep(product.id, { texts: { tr: 'Cilalama' } })
    expect(res2.status).toBe(201)
    const step2 = await json<ProcessStep>(res2)
    expect(step2.sort).toBe(1)
  })

  it('rejects a missing/empty texts.tr with invalid_request', async () => {
    const product = await createProduct()
    const res = await addStep(product.id, { texts: { en: 'Casting' } })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })

    const res2 = await addStep(product.id, { texts: { tr: '   ' } })
    expect(res2.status).toBe(400)
    expect(await res2.json()).toEqual({ error: 'invalid_request' })
  })

  it('returns 404 when adding a step to a missing product', async () => {
    const res = await addStep(999, { texts: { tr: 'Döküm' } })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
  })

  it('respects an explicit sort value on add', async () => {
    const product = await createProduct()
    const res = await addStep(product.id, { texts: { tr: 'Döküm' }, sort: 5 })
    const step = await json<ProcessStep>(res)
    expect(step.sort).toBe(5)
  })

  it('updates a step, replacing texts entirely and changing sort', async () => {
    const product = await createProduct()
    const created = await json<ProcessStep>(await addStep(product.id, { texts: { tr: 'Döküm', en: 'Casting' } }))

    const res = await updateStep(created.id, { texts: { tr: 'Cilalama' }, sort: 3 })
    expect(res.status).toBe(200)
    const updated = await json<ProcessStep>(res)
    expect(updated).toMatchObject({ id: created.id, sort: 3, texts: { tr: 'Cilalama' } })
    expect(updated.texts.en).toBeUndefined()
  })

  it('rejects update with missing tr text', async () => {
    const product = await createProduct()
    const created = await json<ProcessStep>(await addStep(product.id, { texts: { tr: 'Döküm' } }))
    const res = await updateStep(created.id, { texts: { en: 'Casting' }, sort: 0 })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('rejects update with missing sort', async () => {
    const product = await createProduct()
    const created = await json<ProcessStep>(await addStep(product.id, { texts: { tr: 'Döküm' } }))
    const res = await updateStep(created.id, { texts: { tr: 'Cilalama' } })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('returns 404 when updating a missing step', async () => {
    const res = await updateStep(999, { texts: { tr: 'Döküm' }, sort: 0 })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
  })

  it('returns 400 for a non-numeric stepId on update', async () => {
    const res = await updateStep('abc', { texts: { tr: 'Döküm' } })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('deletes a step; subsequent update is 404', async () => {
    const product = await createProduct()
    const created = await json<ProcessStep>(await addStep(product.id, { texts: { tr: 'Döküm' } }))

    const delRes = await req(`/api/admin/steps/${created.id}`, { method: 'DELETE', headers: { cookie } })
    expect(delRes.status).toBe(200)
    expect(await delRes.json()).toEqual({ ok: true })

    const res = await updateStep(created.id, { texts: { tr: 'Döküm' }, sort: 0 })
    expect(res.status).toBe(404)
  })

  it('returns 404 when deleting a missing step', async () => {
    const res = await req('/api/admin/steps/999', { method: 'DELETE', headers: { cookie } })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
  })

  it('returns 400 for a non-numeric stepId on delete', async () => {
    const res = await req('/api/admin/steps/abc', { method: 'DELETE', headers: { cookie } })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })
})
