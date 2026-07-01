import { Hono } from 'hono'
import type { ProductInput, ProductStatus, ProductStore, ProductTranslation, Lang } from '../db/products'

export type ProductsEnv = {
  Bindings: { DB: D1Database; MEDIA: R2Bucket }
  Variables: { productStore: ProductStore; user?: { id: number; email: string } }
}

export const productsRoutes = new Hono<ProductsEnv>()

const SLUG_RE = /^[a-z0-9-]{1,64}$/
const STATUSES: ProductStatus[] = ['draft', 'published', 'sold']
const LANGS: Lang[] = ['tr', 'en', 'ar']

type ValidatedInput = { ok: true; input: ProductInput } | { ok: false; error: string }

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function parseTranslations(raw: unknown): Partial<Record<Lang, ProductTranslation>> | null {
  if (typeof raw !== 'object' || raw === null) return null
  const translations: Partial<Record<Lang, ProductTranslation>> = {}
  const src = raw as Record<string, unknown>
  for (const lang of LANGS) {
    const t = src[lang]
    if (t === undefined || t === null) continue
    if (typeof t !== 'object') return null
    const tObj = t as Record<string, unknown>
    translations[lang] = {
      name: typeof tObj.name === 'string' ? tObj.name : null,
      description: typeof tObj.description === 'string' ? tObj.description : null,
      story: typeof tObj.story === 'string' ? tObj.story : null,
    }
  }
  return translations
}

function validateInput(body: Record<string, unknown>): ValidatedInput {
  const slug = body.slug
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) return { ok: false, error: 'invalid_request' }

  const status = body.status
  if (typeof status !== 'string' || !STATUSES.includes(status as ProductStatus)) {
    return { ok: false, error: 'invalid_status' }
  }

  let serialNo: string | null = null
  if (body.serialNo !== undefined && body.serialNo !== null) {
    if (typeof body.serialNo !== 'string') return { ok: false, error: 'invalid_request' }
    serialNo = trimOrNull(body.serialNo)
  }

  let price: number | null = null
  if (body.price !== undefined && body.price !== null) {
    if (typeof body.price !== 'number' || !Number.isInteger(body.price) || body.price < 0) {
      return { ok: false, error: 'invalid_request' }
    }
    price = body.price
  }

  const translations = parseTranslations(body.translations)
  if (translations === null) return { ok: false, error: 'invalid_request' }
  if (!translations.tr?.name || !translations.tr.name.trim()) return { ok: false, error: 'tr_name_required' }

  const material = body.material !== undefined ? trimOrNull(body.material) : null
  const size = body.size !== undefined ? trimOrNull(body.size) : null

  return {
    ok: true,
    input: {
      slug,
      serialNo,
      status: status as ProductStatus,
      material,
      size,
      price,
      translations,
    },
  }
}

productsRoutes.get('/', async (c) => {
  const store = c.get('productStore')
  const products = await store.list()
  return c.json({ products })
})

productsRoutes.post('/', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_request' }, 400)
  }
  if (typeof body !== 'object' || body === null) return c.json({ error: 'invalid_request' }, 400)

  const validated = validateInput(body as Record<string, unknown>)
  if (!validated.ok) return c.json({ error: validated.error }, 400)

  const store = c.get('productStore')
  const bySlug = await store.findBySlug(validated.input.slug)
  if (bySlug) return c.json({ error: 'slug_taken' }, 409)

  if (validated.input.serialNo) {
    const bySerial = await store.findBySerial(validated.input.serialNo)
    if (bySerial) return c.json({ error: 'serial_taken' }, 409)
  }

  const detail = await store.create(validated.input)
  return c.json(detail, 201)
})

productsRoutes.get('/:id', async (c) => {
  const idParam = c.req.param('id')
  const id = Number(idParam)
  if (!Number.isInteger(id)) return c.json({ error: 'invalid_request' }, 400)

  const store = c.get('productStore')
  const detail = await store.get(id)
  if (!detail) return c.json({ error: 'not_found' }, 404)
  return c.json(detail)
})

productsRoutes.put('/:id', async (c) => {
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

  const validated = validateInput(body as Record<string, unknown>)
  if (!validated.ok) return c.json({ error: validated.error }, 400)

  const store = c.get('productStore')
  const bySlug = await store.findBySlug(validated.input.slug)
  if (bySlug && bySlug.id !== id) return c.json({ error: 'slug_taken' }, 409)

  if (validated.input.serialNo) {
    const bySerial = await store.findBySerial(validated.input.serialNo)
    if (bySerial && bySerial.id !== id) return c.json({ error: 'serial_taken' }, 409)
  }

  const detail = await store.update(id, validated.input)
  if (!detail) return c.json({ error: 'not_found' }, 404)
  return c.json(detail)
})

productsRoutes.delete('/:id', async (c) => {
  const idParam = c.req.param('id')
  const id = Number(idParam)
  if (!Number.isInteger(id)) return c.json({ error: 'invalid_request' }, 400)

  const store = c.get('productStore')
  const existing = await store.get(id)
  if (!existing) return c.json({ error: 'not_found' }, 404)

  const r2Keys = existing.media.map((m) => m.r2Key)
  if (r2Keys.length > 0) {
    try {
      await c.env.MEDIA.delete(r2Keys)
    } catch {
      // R2 silme hatası ürün silmeyi engellemesin — yetim nesne kabul edilebilir
    }
  }

  const deleted = await store.delete(id)
  if (!deleted) return c.json({ error: 'not_found' }, 404)
  return c.json({ ok: true })
})
