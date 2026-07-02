import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { adminGalleryRoutes, publicGalleryRoutes, type AdminGalleryEnv, type PublicGalleryEnv } from './gallery'
import { requireAuth } from '../middleware/require-auth'
import type { AuthEnv } from './auth'
import type { GalleryItem } from '../db/gallery'
import { fakeAuthStore } from '../test/fake-auth-store'
import { fakeGalleryStore } from '../test/fake-gallery-store'
import { fakeR2Bucket } from '../test/fake-r2-bucket'

async function json<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T
}

type CombinedEnv = {
  Bindings: AuthEnv['Bindings'] & AdminGalleryEnv['Bindings']
  Variables: AuthEnv['Variables'] & AdminGalleryEnv['Variables']
}

describe('admin gallery routes', () => {
  let galleryStore: ReturnType<typeof fakeGalleryStore>
  let authStore: ReturnType<typeof fakeAuthStore>
  let r2: ReturnType<typeof fakeR2Bucket>
  let app: Hono<CombinedEnv>
  const cookie = 'sid=test-session'

  beforeEach(async () => {
    galleryStore = fakeGalleryStore()
    authStore = fakeAuthStore()
    r2 = fakeR2Bucket()
    const user = await authStore.createUser('admin@example.com', 'hash')
    await authStore.createSession('test-session', user.id, Math.floor(Date.now() / 1000) + 3600)

    app = new Hono<CombinedEnv>()
    app.use('*', async (c, next) => {
      c.set('store', authStore)
      c.set('galleryStore', galleryStore)
      await next()
    })
    app.use('/api/admin/gallery/*', requireAuth)
    app.route('/api/admin/gallery', adminGalleryRoutes)
  })

  function req(path: string, init: RequestInit = {}) {
    return app.request(path, init, { MEDIA: r2 as unknown as R2Bucket })
  }

  function uploadForm(file: File) {
    const form = new FormData()
    form.set('file', file)
    return form
  }

  it('blocks unauthenticated access to POST', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'a.jpg', { type: 'image/jpeg' })
    const res = await req('/api/admin/gallery', { method: 'POST', body: uploadForm(file) })
    expect(res.status).toBe(401)
  })

  it('blocks unauthenticated access to PATCH', async () => {
    const res = await req('/api/admin/gallery/1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sort: 1 }),
    })
    expect(res.status).toBe(401)
  })

  it('blocks unauthenticated access to DELETE', async () => {
    const res = await req('/api/admin/gallery/1', { method: 'DELETE' })
    expect(res.status).toBe(401)
  })

  it('uploads an image and returns 201 with correct R2 key scheme', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'a.jpg', { type: 'image/jpeg' })
    const res = await req('/api/admin/gallery', { method: 'POST', headers: { cookie }, body: uploadForm(file) })
    expect(res.status).toBe(201)
    const body = await json<GalleryItem>(res)
    expect(body.r2Key).toMatch(/^gallery\/[0-9a-f-]{36}\.jpg$/)
    expect(body.sort).toBe(0)

    const stored = await r2.get(body.r2Key)
    expect(stored).not.toBeNull()
  })

  it('rejects a video MIME type with 400 invalid_file', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'a.mp4', { type: 'video/mp4' })
    const res = await req('/api/admin/gallery', { method: 'POST', headers: { cookie }, body: uploadForm(file) })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_file' })
  })

  it('rejects an unsupported MIME type with 400 invalid_file', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'a.txt', { type: 'text/plain' })
    const res = await req('/api/admin/gallery', { method: 'POST', headers: { cookie }, body: uploadForm(file) })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_file' })
  })

  it('rejects a file over 15MB with 400 file_too_large', async () => {
    const bigBytes = new Uint8Array(15 * 1024 * 1024 + 1)
    const file = new File([bigBytes], 'a.jpg', { type: 'image/jpeg' })
    const res = await req('/api/admin/gallery', { method: 'POST', headers: { cookie }, body: uploadForm(file) })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'file_too_large' })
  })

  it('rejects a missing file with 400 invalid_request', async () => {
    const form = new FormData()
    const res = await req('/api/admin/gallery', { method: 'POST', headers: { cookie }, body: form })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('defaults sort to max+1 when items already exist', async () => {
    await galleryStore.create('gallery/existing.jpg', 50)
    const file = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' })
    const res = await req('/api/admin/gallery', { method: 'POST', headers: { cookie }, body: uploadForm(file) })
    expect(res.status).toBe(201)
    const body = await json<GalleryItem>(res)
    expect(body.sort).toBe(51)
  })

  it('updates sort via PATCH', async () => {
    const created = await galleryStore.create('gallery/a.jpg', 0)
    const res = await req(`/api/admin/gallery/${created.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ sort: 7 }),
    })
    expect(res.status).toBe(200)
    const body = await json<GalleryItem>(res)
    expect(body.sort).toBe(7)
  })

  it('returns 400 for PATCH with invalid sort', async () => {
    const created = await galleryStore.create('gallery/a.jpg', 0)
    const res = await req(`/api/admin/gallery/${created.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ sort: -1 }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('returns 404 when PATCHing a missing gallery item', async () => {
    const res = await req('/api/admin/gallery/999', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ sort: 1 }),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
  })

  it('DELETE removes the row and the R2 object', async () => {
    const created = await galleryStore.create('gallery/a.jpg', 0)
    await r2.put(created.r2Key, new Uint8Array([1, 2, 3]).buffer, {})
    expect(await r2.get(created.r2Key)).not.toBeNull()

    const res = await req(`/api/admin/gallery/${created.id}`, { method: 'DELETE', headers: { cookie } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(await r2.get(created.r2Key)).toBeNull()
    expect(await galleryStore.list()).toEqual([])
  })

  it('tolerates an R2 delete failure: row is still deleted and 200 is returned', async () => {
    const created = await galleryStore.create('gallery/a.jpg', 0)
    const throwingR2 = {
      ...r2,
      async delete() {
        throw new Error('r2 unavailable')
      },
    }
    const throwApp = new Hono<CombinedEnv>()
    throwApp.use('*', async (c, next) => {
      c.set('store', authStore)
      c.set('galleryStore', galleryStore)
      await next()
    })
    throwApp.use('/api/admin/gallery/*', requireAuth)
    throwApp.route('/api/admin/gallery', adminGalleryRoutes)

    const res = await throwApp.request(
      `/api/admin/gallery/${created.id}`,
      { method: 'DELETE', headers: { cookie } },
      { MEDIA: throwingR2 as unknown as R2Bucket },
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(await galleryStore.list()).toEqual([])
  })

  it('returns 404 when deleting a missing gallery item', async () => {
    const res = await req('/api/admin/gallery/999', { method: 'DELETE', headers: { cookie } })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
  })
})

describe('public gallery route', () => {
  let galleryStore: ReturnType<typeof fakeGalleryStore>
  let app: Hono<PublicGalleryEnv>

  beforeEach(() => {
    galleryStore = fakeGalleryStore()
    app = new Hono<PublicGalleryEnv>()
    app.use('*', async (c, next) => {
      c.set('galleryStore', galleryStore)
      await next()
    })
    app.route('/api/gallery', publicGalleryRoutes)
  })

  it('is accessible without auth and returns items sorted by sort ASC, id ASC', async () => {
    await galleryStore.create('gallery/c.jpg', 5)
    await galleryStore.create('gallery/a.jpg', 1)
    await galleryStore.create('gallery/b.jpg', 1)

    const res = await app.request('/api/gallery')
    expect(res.status).toBe(200)
    const body = await json<{ items: GalleryItem[] }>(res)
    expect(body.items.map((i) => i.r2Key)).toEqual(['gallery/a.jpg', 'gallery/b.jpg', 'gallery/c.jpg'])
  })

  it('returns an empty list when no items exist', async () => {
    const res = await app.request('/api/gallery')
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({ items: [] })
  })
})
