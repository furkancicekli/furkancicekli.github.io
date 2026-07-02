import { Hono } from 'hono'
import type { CertStore } from '../db/certificates'
import type { ProductStore } from '../db/products'
import { normalizeSerial, isValidSerial } from '../lib/serial'

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
export const publicVerifySerialRoutes = new Hono<PublicVerifyEnv>()

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

adminCertificatesRoutes.patch('/:id', async (c) => {
  const idParam = c.req.param('id')
  const id = Number(idParam)
  if (!Number.isInteger(id)) return c.json({ error: 'invalid_request' }, 400)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_request' }, 400)
  }
  if (typeof body !== 'object' || body === null) return c.json({ error: 'invalid_request' }, 400)
  const src = body as Record<string, unknown>

  if (typeof src.buyerName !== 'string' && src.buyerName !== null) {
    return c.json({ error: 'invalid_request' }, 400)
  }
  const buyerName = src.buyerName === null ? null : trimOrNull(src.buyerName)

  const store = c.get('certStore')
  const updated = await store.updateBuyer(id, buyerName)
  if (!updated) return c.json({ error: 'not_found' }, 404)
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
      qrToken: cert.qrToken,
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

publicVerifySerialRoutes.get('/:serial', async (c) => {
  const serialParam = c.req.param('serial')
  const normalized = normalizeSerial(serialParam)
  if (!isValidSerial(normalized)) return c.json({ valid: false }, 404)

  const store = c.get('certStore')
  const cert = await store.findBySerial(normalized)
  if (!cert) return c.json({ valid: false }, 404)

  return c.json({
    valid: true,
    certificate: {
      serialNo: cert.serialNo,
      qrToken: cert.qrToken,
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
