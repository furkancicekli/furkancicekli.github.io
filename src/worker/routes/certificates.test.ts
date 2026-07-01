import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { adminCertificatesRoutes, publicVerifyRoutes, type AdminCertificatesEnv, type PublicVerifyEnv } from './certificates'
import { requireAuth } from '../middleware/require-auth'
import type { AuthEnv } from './auth'
import type { Certificate } from '../db/certificates'
import type { ProductInput } from '../db/products'
import { fakeAuthStore } from '../test/fake-auth-store'
import { fakeProductStore } from '../test/fake-product-store'
import { fakeCertStore } from '../test/fake-cert-store'

async function json<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T
}

type CombinedEnv = { Bindings: AuthEnv['Bindings']; Variables: AuthEnv['Variables'] & AdminCertificatesEnv['Variables'] }

function soldProductInput(overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    slug: 'urun-1',
    serialNo: 'SN-001',
    status: 'sold',
    material: 'Gümüş',
    size: 'M',
    price: 1000,
    translations: { tr: { name: 'Ürün 1', description: null, story: null } },
    ...overrides,
  }
}

describe('admin certificates routes', () => {
  let certStore: ReturnType<typeof fakeCertStore>
  let productStore: ReturnType<typeof fakeProductStore>
  let authStore: ReturnType<typeof fakeAuthStore>
  let app: Hono<CombinedEnv>
  const cookie = 'sid=test-session'

  beforeEach(async () => {
    productStore = fakeProductStore()
    certStore = fakeCertStore(productStore)
    authStore = fakeAuthStore()
    const user = await authStore.createUser('admin@example.com', 'hash')
    await authStore.createSession('test-session', user.id, Math.floor(Date.now() / 1000) + 3600)

    app = new Hono<CombinedEnv>()
    app.use('*', async (c, next) => {
      c.set('store', authStore)
      c.set('certStore', certStore)
      c.set('productStore', productStore)
      await next()
    })
    app.use('/api/admin/certificates/*', requireAuth)
    app.route('/api/admin/certificates', adminCertificatesRoutes)
  })

  function req(path: string, init: RequestInit = {}) {
    return app.request(path, init)
  }

  function post(body: unknown, withAuth = true) {
    return req('/api/admin/certificates', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(withAuth ? { cookie } : {}) },
      body: JSON.stringify(body),
    })
  }

  it('blocks unauthenticated access to list', async () => {
    const res = await req('/api/admin/certificates')
    expect(res.status).toBe(401)
  })

  it('blocks unauthenticated access to create', async () => {
    const res = await post({ productId: 1 }, false)
    expect(res.status).toBe(401)
  })

  it('creates a certificate for a sold product with serial, returns 201 with copied serialNo', async () => {
    const product = await productStore.create(soldProductInput())

    const res = await post({ productId: product.id, buyerName: 'Ayşe' })
    expect(res.status).toBe(201)
    const body = await json<Certificate>(res)
    expect(body.serialNo).toBe('SN-001')
    expect(body.buyerName).toBe('Ayşe')
    expect(body.qrToken).toBeTypeOf('string')
    expect(body.qrToken.length).toBeGreaterThan(0)
  })

  it('generates two distinct unique tokens for two certificates', async () => {
    const product = await productStore.create(soldProductInput())

    const res1 = await post({ productId: product.id })
    const res2 = await post({ productId: product.id })
    const body1 = await json<Certificate>(res1)
    const body2 = await json<Certificate>(res2)

    expect(body1.qrToken).not.toBe(body2.qrToken)
  })

  it('rejects creating a certificate for a product that is not sold with product_not_sold', async () => {
    const product = await productStore.create(soldProductInput({ status: 'published' }))

    const res = await post({ productId: product.id })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'product_not_sold' })
  })

  it('rejects creating a certificate for a sold product with no serialNo with invalid_request', async () => {
    const product = await productStore.create(soldProductInput({ serialNo: null }))

    const res = await post({ productId: product.id })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('rejects creating a certificate for a sold product with empty serialNo with invalid_request', async () => {
    const product = await productStore.create(soldProductInput({ serialNo: '' }))

    const res = await post({ productId: product.id })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('returns 404 not_found for a missing productId', async () => {
    const res = await post({ productId: 999 })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
  })

  it('rejects a non-integer productId with invalid_request', async () => {
    const res = await post({ productId: 'abc' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('rejects a non-object JSON body with invalid_request', async () => {
    const res = await req('/api/admin/certificates', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: 'null',
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('lists certificates with joined productName/productSlug, ordered issuedAt DESC', async () => {
    const product1 = await productStore.create(soldProductInput({ slug: 'urun-1', translations: { tr: { name: 'Ürün 1', description: null, story: null } } }))
    const product2 = await productStore.create(soldProductInput({ slug: 'urun-2', serialNo: 'SN-002', translations: { tr: { name: 'Ürün 2', description: null, story: null } } }))

    await post({ productId: product1.id })
    await post({ productId: product2.id })

    const res = await req('/api/admin/certificates', { headers: { cookie } })
    expect(res.status).toBe(200)
    const body = await json<{ certificates: Certificate[] }>(res)
    expect(body.certificates).toHaveLength(2)
    // issuedAt DESC -> most recently created (product2's cert) first
    expect(body.certificates[0].productName).toBe('Ürün 2')
    expect(body.certificates[0].productSlug).toBe('urun-2')
    expect(body.certificates[1].productName).toBe('Ürün 1')
    expect(body.certificates[1].productSlug).toBe('urun-1')
  })

  it('deletes a certificate; second delete returns 404', async () => {
    const product = await productStore.create(soldProductInput())
    const created = await json<Certificate>(await post({ productId: product.id }))

    const delRes = await req(`/api/admin/certificates/${created.id}`, { method: 'DELETE', headers: { cookie } })
    expect(delRes.status).toBe(200)
    expect(await delRes.json()).toEqual({ ok: true })

    const delRes2 = await req(`/api/admin/certificates/${created.id}`, { method: 'DELETE', headers: { cookie } })
    expect(delRes2.status).toBe(404)
    expect(await delRes2.json()).toEqual({ error: 'not_found' })
  })
})

describe('public verify route', () => {
  let certStore: ReturnType<typeof fakeCertStore>
  let productStore: ReturnType<typeof fakeProductStore>
  let app: Hono<PublicVerifyEnv>

  beforeEach(() => {
    productStore = fakeProductStore()
    certStore = fakeCertStore(productStore)
    app = new Hono<PublicVerifyEnv>()
    app.use('*', async (c, next) => {
      c.set('certStore', certStore)
      await next()
    })
    app.route('/api/verify', publicVerifyRoutes)
  })

  it('returns valid:true with product fields for an existing token, no auth required', async () => {
    const product = await productStore.create(soldProductInput())
    const cert = await certStore.create(product.id, 'SN-001', 'tok-abc', 'Mehmet')

    const res = await app.request(`/api/verify/${cert.qrToken}`)
    expect(res.status).toBe(200)
    const body = await json<{
      valid: boolean
      certificate: { serialNo: string; buyerName: string | null; issuedAt: number; product: { name: string | null; slug: string | null; material: string | null; size: string | null } }
    }>(res)
    expect(body.valid).toBe(true)
    expect(body.certificate.serialNo).toBe('SN-001')
    expect(body.certificate.buyerName).toBe('Mehmet')
    expect(body.certificate.issuedAt).toBeTypeOf('number')
    expect(body.certificate.product).toEqual({
      name: 'Ürün 1',
      slug: 'urun-1',
      material: 'Gümüş',
      size: 'M',
    })
  })

  it('returns 404 valid:false for an unknown token', async () => {
    const res = await app.request('/api/verify/does-not-exist')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ valid: false })
  })

  it('never returns 401, even without any auth cookie', async () => {
    const res = await app.request('/api/verify/anything')
    expect(res.status).not.toBe(401)
  })
})
