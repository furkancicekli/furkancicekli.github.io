import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { adminRoutes } from './admin'
import { requireAuth } from '../middleware/require-auth'
import type { AuthEnv } from './auth'
import { fakeAuthStore } from '../test/fake-auth-store'
import { hashPassword, verifyPassword } from '../lib/password'

describe('admin routes', () => {
  let store: ReturnType<typeof fakeAuthStore>
  let app: Hono<AuthEnv>
  const cookie = 'sid=test-session'

  beforeEach(async () => {
    store = fakeAuthStore()
    const user = await store.createUser('admin@example.com', await hashPassword('old-pass-123'))
    await store.createSession('test-session', user.id, Math.floor(Date.now() / 1000) + 3600)
    app = new Hono<AuthEnv>()
    app.use('*', async (c, next) => {
      c.set('store', store)
      await next()
    })
    app.use('/api/admin/*', requireAuth)
    app.route('/api/admin', adminRoutes)
  })

  it('blocks unauthenticated access to /api/admin/*', async () => {
    const res = await app.request('/api/admin/password', { method: 'POST' })
    expect(res.status).toBe(401)
  })

  it('changes password with correct current password', async () => {
    const res = await app.request('/api/admin/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ currentPassword: 'old-pass-123', newPassword: 'new-pass-456' }),
    })
    expect(res.status).toBe(200)
    expect(await verifyPassword('new-pass-456', store.users[0].passwordHash)).toBe(true)
  })

  it('rejects wrong current password', async () => {
    const res = await app.request('/api/admin/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ currentPassword: 'wrong', newPassword: 'new-pass-456' }),
    })
    expect(res.status).toBe(401)
    expect(await verifyPassword('old-pass-123', store.users[0].passwordHash)).toBe(true)
  })

  it('rejects too-short new password', async () => {
    const res = await app.request('/api/admin/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ currentPassword: 'old-pass-123', newPassword: 'short' }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects an expired session', async () => {
    store.sessions.set('test-session', { userId: 1, expiresAt: Math.floor(Date.now() / 1000) - 10 })
    const res = await app.request('/api/admin/password', { method: 'POST', headers: { cookie } })
    expect(res.status).toBe(401)
  })
})
