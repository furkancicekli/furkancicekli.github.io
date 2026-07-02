import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { adminCertificatesRoutes, publicVerifyRoutes, publicVerifySerialRoutes, type AdminCertificatesEnv, type PublicVerifyEnv } from './certificates'
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

  function patch(id: number, body: unknown, withAuth = true) {
    return req(`/api/admin/certificates/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...(withAuth ? { cookie } : {}) },
      body: JSON.stringify(body),
    })
  }

  it('blocks unauthenticated access to list', async () => {
    const res = await req('/api/admin/certificates')
    expect(res.status).toBe(401)
  })

  it('lists certificates with joined productName/productSlug, ordered issuedAt DESC', async () => {
    const product1 = await productStore.create(soldProductInput({ slug: 'urun-1', translations: { tr: { name: 'Ürün 1', description: null, story: null } } }))
    const product2 = await productStore.create(soldProductInput({ slug: 'urun-2', serialNo: 'SN-002', translations: { tr: { name: 'Ürün 2', description: null, story: null } } }))

    await certStore.create(product1.id, product1.serialNo as string, 'tok-1', null)
    await certStore.create(product2.id, product2.serialNo as string, 'tok-2', null)

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

  it('orders certificates by issuedAt DESC, then id DESC for same-second creates', async () => {
    const product = await productStore.create(soldProductInput())

    const cert1 = await certStore.create(product.id, product.serialNo as string, 'tok-1', null)
    const cert2 = await certStore.create(product.id, product.serialNo as string, 'tok-2', null)

    const listRes = await req('/api/admin/certificates', { headers: { cookie } })
    expect(listRes.status).toBe(200)
    const body = await json<{ certificates: Certificate[] }>(listRes)
    expect(body.certificates).toHaveLength(2)
    // Both have same issuedAt (same epoch second), so id DESC tiebreak applies
    expect(body.certificates[0].id).toBe(cert2.id)
    expect(body.certificates[1].id).toBe(cert1.id)
  })

  it('has no DELETE route mounted — certificate lifecycle is bound to the product', async () => {
    const product = await productStore.create(soldProductInput())
    const created = await certStore.create(product.id, product.serialNo as string, 'tok-1', null)

    const delRes = await req(`/api/admin/certificates/${created.id}`, { method: 'DELETE', headers: { cookie } })
    expect(delRes.status).toBe(404)
  })

  it('updates buyerName on happy path and persists in the store', async () => {
    const product = await productStore.create(soldProductInput())
    const created = await certStore.create(product.id, product.serialNo as string, 'tok-1', null)

    const res = await patch(created.id, { buyerName: 'Ayşe' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    const updated = certStore.certificates.find((c) => c.id === created.id)
    expect(updated?.buyerName).toBe('Ayşe')
  })

  it('trims surrounding whitespace from buyerName before storing', async () => {
    const product = await productStore.create(soldProductInput())
    const created = await certStore.create(product.id, product.serialNo as string, 'tok-1', null)

    const res = await patch(created.id, { buyerName: '  Mehmet  ' })
    expect(res.status).toBe(200)

    const updated = certStore.certificates.find((c) => c.id === created.id)
    expect(updated?.buyerName).toBe('Mehmet')
  })

  it('stores null when buyerName is an empty or all-whitespace string', async () => {
    const product = await productStore.create(soldProductInput())
    const created = await certStore.create(product.id, product.serialNo as string, 'tok-1', 'Old Name')

    const res = await patch(created.id, { buyerName: '   ' })
    expect(res.status).toBe(200)

    const updated = certStore.certificates.find((c) => c.id === created.id)
    expect(updated?.buyerName).toBeNull()
  })

  it('rejects a wrong-type buyerName (number) with invalid_request', async () => {
    const product = await productStore.create(soldProductInput())
    const created = await certStore.create(product.id, product.serialNo as string, 'tok-1', null)

    const res = await patch(created.id, { buyerName: 42 })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('rejects a wrong-type buyerName (array) with invalid_request', async () => {
    const product = await productStore.create(soldProductInput())
    const created = await certStore.create(product.id, product.serialNo as string, 'tok-1', null)

    const res = await patch(created.id, { buyerName: ['Ayşe'] })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('rejects a non-object body with invalid_request', async () => {
    const product = await productStore.create(soldProductInput())
    const created = await certStore.create(product.id, product.serialNo as string, 'tok-1', null)

    const res = await req(`/api/admin/certificates/${created.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: 'null',
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('returns 404 when patching a nonexistent certificate id', async () => {
    const res = await patch(999, { buyerName: 'Ayşe' })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
  })

  it('blocks unauthenticated access to PATCH', async () => {
    const product = await productStore.create(soldProductInput())
    const created = await certStore.create(product.id, product.serialNo as string, 'tok-1', null)

    const res = await patch(created.id, { buyerName: 'Ayşe' }, false)
    expect(res.status).toBe(401)
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
      certificate: {
        serialNo: string
        buyerName: string | null
        issuedAt: number
        qrToken: string
        product: { name: string | null; slug: string | null; material: string | null; size: string | null }
      }
    }>(res)
    expect(body.valid).toBe(true)
    expect(body.certificate.serialNo).toBe('SN-001')
    expect(body.certificate.buyerName).toBe('Mehmet')
    expect(body.certificate.issuedAt).toBeTypeOf('number')
    expect(body.certificate.qrToken).toBe('tok-abc')
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

describe('public verify-serial route', () => {
  let certStore: ReturnType<typeof fakeCertStore>
  let productStore: ReturnType<typeof fakeProductStore>
  let app: Hono<PublicVerifyEnv>

  // 16-digit serial, valid per lib/serial.ts (year 2026 + random digits + Luhn check digit)
  const VALID_SERIAL = '2026000000000006'

  beforeEach(() => {
    productStore = fakeProductStore()
    certStore = fakeCertStore(productStore)
    app = new Hono<PublicVerifyEnv>()
    app.use('*', async (c, next) => {
      c.set('certStore', certStore)
      await next()
    })
    app.route('/api/verify-serial', publicVerifySerialRoutes)
  })

  it('returns valid:true with qrToken for a known serial, accepting spaced/formatted input', async () => {
    const product = await productStore.create(soldProductInput())
    const cert = await certStore.create(product.id, VALID_SERIAL, 'tok-xyz', 'Mehmet')

    const spaced = VALID_SERIAL.match(/.{1,4}/g)!.join(' ')
    const res = await app.request(`/api/verify-serial/${encodeURIComponent(spaced)}`)
    expect(res.status).toBe(200)
    const body = await json<{
      valid: boolean
      certificate: { serialNo: string; qrToken: string }
    }>(res)
    expect(body.valid).toBe(true)
    expect(body.certificate.qrToken).toBe(cert.qrToken)
  })

  it('returns 404 valid:false for a serial that fails isValidSerial (wrong length)', async () => {
    const res = await app.request('/api/verify-serial/12345')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ valid: false })
  })

  it('returns 404 valid:false for a valid-format but unknown serial', async () => {
    const res = await app.request(`/api/verify-serial/${VALID_SERIAL}`)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ valid: false })
  })

  it('works without any auth header, confirming it is public', async () => {
    const res = await app.request(`/api/verify-serial/${VALID_SERIAL}`)
    expect(res.status).not.toBe(401)
  })
})
