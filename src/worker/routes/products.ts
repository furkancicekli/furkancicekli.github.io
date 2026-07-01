import { Hono } from 'hono'
import type { ProductStore, ProductTranslation, Lang } from '../db/products'
import type { CertStore } from '../db/certificates'
import { slugify, generateSerial } from '../lib/serial'
import { newToken } from './certificates'

export type ProductsEnv = {
  Bindings: { DB: D1Database; MEDIA: R2Bucket }
  Variables: { productStore: ProductStore; certStore: CertStore; user?: { id: number; email: string } }
}

export const productsRoutes = new Hono<ProductsEnv>()

const LANGS: Lang[] = ['tr', 'en', 'ar']
const MAX_SLUG_RETRIES = 5
const MAX_SERIAL_RETRIES = 5
const SLUG_SUFFIX_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

type ProductFormInput = {
  material: string | null
  size: string | null
  weightGrams: number | null
  translations: Partial<Record<Lang, ProductTranslation>>
}

type ValidatedInput = { ok: true; input: ProductFormInput } | { ok: false; error: string }

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function randomSlugSuffix(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  let suffix = ''
  for (let i = 0; i < 4; i++) {
    suffix += SLUG_SUFFIX_CHARS[bytes[i] % SLUG_SUFFIX_CHARS.length]
  }
  return suffix
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
  let weightGrams: number | null = null
  if (body.weightGrams !== undefined && body.weightGrams !== null) {
    if (typeof body.weightGrams !== 'number' || !Number.isFinite(body.weightGrams) || body.weightGrams < 0) {
      return { ok: false, error: 'invalid_request' }
    }
    weightGrams = body.weightGrams
  }

  const translations = parseTranslations(body.translations)
  if (translations === null) return { ok: false, error: 'invalid_request' }
  if (!translations.tr?.name || !translations.tr.name.trim()) return { ok: false, error: 'tr_name_required' }

  const material = body.material !== undefined ? trimOrNull(body.material) : null
  const size = body.size !== undefined ? trimOrNull(body.size) : null

  return {
    ok: true,
    input: {
      material,
      size,
      weightGrams,
      translations,
    },
  }
}

async function generateUniqueSlug(store: ProductStore, name: string): Promise<string | null> {
  const base = slugify(name)
  const existing = await store.findBySlug(base)
  if (!existing) return base

  for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
    const candidate = `${base}-${randomSlugSuffix()}`
    const hit = await store.findBySlug(candidate)
    if (!hit) return candidate
  }
  return null
}

async function generateUniqueSerial(store: ProductStore): Promise<string | null> {
  const year = new Date().getFullYear()
  for (let attempt = 0; attempt < MAX_SERIAL_RETRIES; attempt++) {
    const candidate = generateSerial(year)
    const hit = await store.findBySerial(candidate)
    if (!hit) return candidate
  }
  return null
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
  const name = validated.input.translations.tr?.name as string

  const slug = await generateUniqueSlug(store, name)
  if (!slug) return c.json({ error: 'slug_generation_failed' }, 500)

  const serialNo = await generateUniqueSerial(store)
  if (!serialNo) return c.json({ error: 'serial_generation_failed' }, 500)

  const detail = await store.create({
    slug,
    serialNo,
    status: 'draft',
    material: validated.input.material,
    size: validated.input.size,
    weightGrams: validated.input.weightGrams,
    translations: validated.input.translations,
  })

  const certStore = c.get('certStore')
  try {
    const certificate = await certStore.create(detail.id, serialNo, newToken(), null)
    return c.json({ ...detail, certificate: { serialNo: certificate.serialNo, qrToken: certificate.qrToken } }, 201)
  } catch {
    // sertifika oluşmazsa ürünü geri al — sertifikasız ürün kalmasın
    try {
      await store.delete(detail.id)
    } catch {
      // Rollback başarısız olsa bile, certificate hatası daha önemli
    }
    return c.json({ error: 'certificate_failed' }, 500)
  }
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
  const detail = await store.update(id, validated.input)
  if (!detail) return c.json({ error: 'not_found' }, 404)
  return c.json(detail)
})

productsRoutes.post('/:id/publish', async (c) => {
  const idParam = c.req.param('id')
  const id = Number(idParam)
  if (!Number.isInteger(id)) return c.json({ error: 'invalid_request' }, 400)

  const store = c.get('productStore')
  const detail = await store.setStatus(id, 'published')
  if (!detail) return c.json({ error: 'not_found' }, 404)
  return c.json(detail)
})

productsRoutes.post('/:id/unpublish', async (c) => {
  const idParam = c.req.param('id')
  const id = Number(idParam)
  if (!Number.isInteger(id)) return c.json({ error: 'invalid_request' }, 400)

  const store = c.get('productStore')
  const detail = await store.setStatus(id, 'draft')
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
