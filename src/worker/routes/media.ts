import { Hono } from 'hono'
import type { ProductStore } from '../db/products'

export type MediaEnv = {
  Bindings: { MEDIA: R2Bucket }
  Variables: { productStore: ProductStore; user?: { id: number; email: string } }
}

export type PublicMediaEnv = {
  Bindings: { MEDIA: R2Bucket }
}

export const mediaRoutes = new Hono<MediaEnv>()
export const publicMediaRoutes = new Hono<PublicMediaEnv>()

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

const MIME_TO_EXT: Record<string, { type: 'image' | 'video'; ext: string }> = {
  'image/jpeg': { type: 'image', ext: 'jpg' },
  'image/png': { type: 'image', ext: 'png' },
  'image/webp': { type: 'image', ext: 'webp' },
  'video/mp4': { type: 'video', ext: 'mp4' },
}

const KINDS = ['gallery', 'raw_material', 'process'] as const
type MediaKind = (typeof KINDS)[number]

function isMediaKind(value: unknown): value is MediaKind {
  return typeof value === 'string' && (KINDS as readonly string[]).includes(value)
}

// Admin: upload media for a product
mediaRoutes.post('/products/:id/media', async (c) => {
  const idParam = c.req.param('id')
  const id = Number(idParam)
  if (!Number.isInteger(id)) return c.json({ error: 'invalid_request' }, 400)

  const store = c.get('productStore')
  const product = await store.get(id)
  if (!product) return c.json({ error: 'not_found' }, 404)

  let form: FormData
  try {
    form = await c.req.formData()
  } catch {
    return c.json({ error: 'invalid_request' }, 400)
  }

  const file = form.get('file') as unknown
  if (!(file instanceof File)) return c.json({ error: 'invalid_request' }, 400)

  const kindRaw = form.get('kind')
  const kind: MediaKind = kindRaw === null ? 'gallery' : isMediaKind(kindRaw) ? kindRaw : ('' as never)
  if (kindRaw !== null && !isMediaKind(kindRaw)) return c.json({ error: 'invalid_request' }, 400)

  const mapped = MIME_TO_EXT[file.type]
  if (!mapped) return c.json({ error: 'invalid_file' }, 400)

  if (file.size > MAX_UPLOAD_BYTES) return c.json({ error: 'file_too_large' }, 400)

  const key = `products/${id}/${crypto.randomUUID()}.${mapped.ext}`
  await c.env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } })

  const mediaItem = await store.addMedia(id, { type: mapped.type, r2Key: key, kind, sort: 0 })
  return c.json(mediaItem, 201)
})

// Admin: update media metadata
mediaRoutes.patch('/media/:id', async (c) => {
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

  const patch: { kind?: MediaKind; sort?: number } = {}
  if (src.kind !== undefined) {
    if (!isMediaKind(src.kind)) return c.json({ error: 'invalid_request' }, 400)
    patch.kind = src.kind
  }
  if (src.sort !== undefined) {
    if (typeof src.sort !== 'number' || !Number.isInteger(src.sort)) return c.json({ error: 'invalid_request' }, 400)
    patch.sort = src.sort
  }

  const store = c.get('productStore')
  const updated = await store.updateMedia(id, patch)
  if (!updated) return c.json({ error: 'not_found' }, 404)
  return c.json(updated)
})

// Admin: delete media
mediaRoutes.delete('/media/:id', async (c) => {
  const idParam = c.req.param('id')
  const id = Number(idParam)
  if (!Number.isInteger(id)) return c.json({ error: 'invalid_request' }, 400)

  const store = c.get('productStore')
  const existing = await store.getMedia(id)
  if (!existing) return c.json({ error: 'not_found' }, 404)

  await c.env.MEDIA.delete(existing.r2Key)
  await store.deleteMedia(id)
  return c.json({ ok: true })
})

// Public: serve media by R2 key
publicMediaRoutes.get('*', async (c) => {
  const rawPath = c.req.path.replace('/api/media/', '')
  const key = decodeURIComponent(rawPath)
  if (key.includes('..')) return c.json({ error: 'invalid_request' }, 400)

  const object = await c.env.MEDIA.get(key)
  if (!object) return c.json({ error: 'not_found' }, 404)

  const headers = new Headers()
  headers.set('Content-Type', object.httpMetadata?.contentType ?? 'application/octet-stream')
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  if (object.httpEtag) headers.set('ETag', object.httpEtag)

  return new Response(object.body as unknown as BodyInit, { status: 200, headers })
})
