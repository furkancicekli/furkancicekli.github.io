import { Hono } from 'hono'
import type { GalleryStore } from '../db/gallery'

export type AdminGalleryEnv = {
  Bindings: { MEDIA: R2Bucket }
  Variables: { galleryStore: GalleryStore; user?: { id: number; email: string } }
}

export type PublicGalleryEnv = {
  Bindings: Record<string, unknown>
  Variables: { galleryStore: GalleryStore }
}

export const adminGalleryRoutes = new Hono<AdminGalleryEnv>()
export const publicGalleryRoutes = new Hono<PublicGalleryEnv>()

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

// Gallery is photos only — unlike product media, video is not accepted here.
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

adminGalleryRoutes.post('/', async (c) => {
  let form: FormData
  try {
    form = await c.req.formData()
  } catch {
    return c.json({ error: 'invalid_request' }, 400)
  }

  const file = form.get('file') as unknown
  if (!(file instanceof File)) return c.json({ error: 'invalid_request' }, 400)

  const ext = MIME_TO_EXT[file.type]
  if (!ext) return c.json({ error: 'invalid_file' }, 400)

  if (file.size > MAX_UPLOAD_BYTES) return c.json({ error: 'file_too_large' }, 400)

  const store = c.get('galleryStore')
  const existing = await store.list()
  const sort = existing.length === 0 ? 0 : Math.max(...existing.map((i) => i.sort)) + 1

  const key = `gallery/${crypto.randomUUID()}.${ext}`
  await c.env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } })

  const item = await store.create(key, sort)
  return c.json(item, 201)
})

adminGalleryRoutes.patch('/:id', async (c) => {
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

  if (typeof src.sort !== 'number' || !Number.isInteger(src.sort) || src.sort < 0) {
    return c.json({ error: 'invalid_request' }, 400)
  }

  const store = c.get('galleryStore')
  const updated = await store.updateSort(id, src.sort)
  if (!updated) return c.json({ error: 'not_found' }, 404)
  return c.json(updated)
})

adminGalleryRoutes.delete('/:id', async (c) => {
  const idParam = c.req.param('id')
  const id = Number(idParam)
  if (!Number.isInteger(id)) return c.json({ error: 'invalid_request' }, 400)

  const store = c.get('galleryStore')
  const deleted = await store.delete(id)
  if (!deleted) return c.json({ error: 'not_found' }, 404)

  // R2 cleanup is best-effort: a failure here must not block row deletion
  // (matches the tolerance pattern used elsewhere for media cleanup).
  try {
    await c.env.MEDIA.delete(deleted.r2Key)
  } catch {
    // ignore — orphaned R2 object is an acceptable trade-off vs. blocking deletion
  }

  return c.json({ ok: true })
})

publicGalleryRoutes.get('/', async (c) => {
  const store = c.get('galleryStore')
  const items = await store.list()
  return c.json({ items })
})
