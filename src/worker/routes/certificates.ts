import { Hono } from 'hono'
import type { CertStore } from '../db/certificates'
import type { ProductStore } from '../db/products'

export type AdminCertificatesEnv = {
  Bindings: Record<string, unknown>
  Variables: { certStore: CertStore; productStore: ProductStore; user?: { id: number; email: string } }
}

export type PublicVerifyEnv = {
  Bindings: Record<string, unknown>
  Variables: { certStore: CertStore }
}

export const adminCertificatesRoutes = new Hono<AdminCertificatesEnv>()
export const publicVerifyRoutes = new Hono<PublicVerifyEnv>()

export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function trimOrNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

adminCertificatesRoutes.get('/', async (c) => {
  const store = c.get('certStore')
  const certificates = await store.list()
  return c.json({ certificates })
})

adminCertificatesRoutes.post('/', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_request' }, 400)
  }
  if (typeof body !== 'object' || body === null) return c.json({ error: 'invalid_request' }, 400)
  const src = body as Record<string, unknown>

  if (typeof src.productId !== 'number' || !Number.isInteger(src.productId)) {
    return c.json({ error: 'invalid_request' }, 400)
  }

  let buyerName: string | null = null
  if (src.buyerName !== undefined && src.buyerName !== null) {
    if (typeof src.buyerName !== 'string') return c.json({ error: 'invalid_request' }, 400)
    buyerName = trimOrNull(src.buyerName)
  }

  const productStore = c.get('productStore')
  const product = await productStore.get(src.productId)
  if (!product) return c.json({ error: 'not_found' }, 404)
  if (product.status !== 'sold') return c.json({ error: 'product_not_sold' }, 400)
  if (!product.serialNo) return c.json({ error: 'invalid_request' }, 400)

  const certStore = c.get('certStore')
  const qrToken = newToken()
  const certificate = await certStore.create(product.id, product.serialNo, qrToken, buyerName)
  return c.json(certificate, 201)
})

adminCertificatesRoutes.delete('/:id', async (c) => {
  const idParam = c.req.param('id')
  const id = Number(idParam)
  if (!Number.isInteger(id)) return c.json({ error: 'invalid_request' }, 400)

  const store = c.get('certStore')
  const deleted = await store.delete(id)
  if (!deleted) return c.json({ error: 'not_found' }, 404)
  return c.json({ ok: true })
})

publicVerifyRoutes.get('/:token', async (c) => {
  const token = c.req.param('token')
  const store = c.get('certStore')
  const cert = await store.findByToken(token)
  if (!cert) return c.json({ valid: false }, 404)

  return c.json({
    valid: true,
    certificate: {
      serialNo: cert.serialNo,
      buyerName: cert.buyerName,
      issuedAt: cert.issuedAt,
      product: {
        name: cert.productName ?? null,
        slug: cert.productSlug ?? null,
        material: cert.material,
        size: cert.size,
      },
    },
  })
})
