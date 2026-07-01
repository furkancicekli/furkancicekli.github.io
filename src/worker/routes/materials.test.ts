import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { adminMaterialsRoutes, type AdminMaterialsEnv } from './materials'
import { requireAuth } from '../middleware/require-auth'
import type { AuthEnv } from './auth'
import type { Material } from '../db/materials'
import { fakeAuthStore } from '../test/fake-auth-store'
import { fakeMaterialStore } from '../test/fake-material-store'

async function json<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T
}

type CombinedEnv = { Bindings: AuthEnv['Bindings']; Variables: AuthEnv['Variables'] & AdminMaterialsEnv['Variables'] }

describe('admin materials routes', () => {
  let materialStore: ReturnType<typeof fakeMaterialStore>
  let authStore: ReturnType<typeof fakeAuthStore>
  let app: Hono<CombinedEnv>
  const cookie = 'sid=test-session'

  beforeEach(async () => {
    materialStore = fakeMaterialStore()
    authStore = fakeAuthStore()
    const user = await authStore.createUser('admin@example.com', 'hash')
    await authStore.createSession('test-session', user.id, Math.floor(Date.now() / 1000) + 3600)

    app = new Hono<CombinedEnv>()
    app.use('*', async (c, next) => {
      c.set('store', authStore)
      c.set('materialStore', materialStore)
      await next()
    })
    app.use('/api/admin/materials/*', requireAuth)
    app.route('/api/admin/materials', adminMaterialsRoutes)
  })

  function req(path: string, init: RequestInit = {}) {
    return app.request(path, init)
  }

  function post(body: unknown) {
    return req('/api/admin/materials', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    })
  }

  it('blocks unauthenticated access', async () => {
    const res = await req('/api/admin/materials')
    expect(res.status).toBe(401)
  })

  it('lists materials sorted alphabetically, case-insensitive', async () => {
    await post({ name: 'Şimşir' })
    await post({ name: 'abanoz' })
    await post({ name: 'Kuka' })

    const res = await req('/api/admin/materials', { headers: { cookie } })
    expect(res.status).toBe(200)
    const body = await json<{ materials: Material[] }>(res)
    expect(body.materials.map((m) => m.name)).toEqual(['abanoz', 'Kuka', 'Şimşir'])
  })

  it('creates a material and returns 201', async () => {
    const res = await post({ name: 'Ceviz' })
    expect(res.status).toBe(201)
    const body = await json<Material>(res)
    expect(body.name).toBe('Ceviz')
    expect(body.id).toBeTypeOf('number')
  })

  it('is idempotent: creating an existing name (case-insensitive) returns 200 with existing record', async () => {
    const created = await json<Material>(await post({ name: 'Kuka' }))
    expect(created).toMatchObject({ name: 'Kuka' })

    const res = await post({ name: 'kuka' })
    expect(res.status).toBe(200)
    const body = await json<Material>(res)
    expect(body.id).toBe(created.id)
    expect(body.name).toBe(created.name)
  })

  it('rejects an empty name with invalid_request', async () => {
    const res = await post({ name: '' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('rejects a whitespace-only name with invalid_request', async () => {
    const res = await post({ name: '   ' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('rejects a non-object JSON body', async () => {
    const res = await req('/api/admin/materials', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: 'null',
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('rejects a non-string name with invalid_request', async () => {
    const res = await post({ name: 123 })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })
})
