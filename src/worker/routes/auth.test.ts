import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { authRoutes, type AuthEnv } from './auth'
import { fakeAuthStore } from '../test/fake-auth-store'
import { hashPassword } from '../lib/password'

const ENV = { ADMIN_EMAIL: 'admin@example.com', ADMIN_PASSWORD: 'boot-pass-123' }

function makeApp(store: ReturnType<typeof fakeAuthStore>) {
  const app = new Hono<AuthEnv>()
  app.use('*', async (c, next) => {
    c.set('store', store)
    await next()
  })
  app.route('/api/auth', authRoutes)
  return app
}

function login(app: Hono<AuthEnv>, body: unknown) {
  return app.request(
    '/api/auth/login',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    ENV,
  )
}

describe('auth routes', () => {
  let store: ReturnType<typeof fakeAuthStore>
  let app: Hono<AuthEnv>

  beforeEach(() => {
    store = fakeAuthStore()
    app = makeApp(store)
  })

  it('rejects missing fields with 400', async () => {
    const res = await login(app, { email: 'a@b.c' })
    expect(res.status).toBe(400)
  })

  it('bootstraps first admin from env credentials and sets session cookie', async () => {
    const res = await login(app, { email: 'Admin@Example.com ', password: 'boot-pass-123' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ email: 'admin@example.com' })
    expect(res.headers.get('set-cookie')).toMatch(/sid=.+HttpOnly/i)
    expect(store.users).toHaveLength(1)
  })

  it('rejects bootstrap with wrong env password', async () => {
    const res = await login(app, { email: 'admin@example.com', password: 'nope' })
    expect(res.status).toBe(401)
    expect(store.users).toHaveLength(0)
  })

  it('does not bootstrap when a user already exists', async () => {
    await store.createUser('other@example.com', await hashPassword('pw'))
    const res = await login(app, { email: 'admin@example.com', password: 'boot-pass-123' })
    expect(res.status).toBe(401)
  })

  it('logs in an existing user with hashed password', async () => {
    await store.createUser('admin@example.com', await hashPassword('real-pass'))
    const res = await login(app, { email: 'admin@example.com', password: 'real-pass' })
    expect(res.status).toBe(200)
  })

  it('rejects wrong password for existing user', async () => {
    await store.createUser('admin@example.com', await hashPassword('real-pass'))
    const res = await login(app, { email: 'admin@example.com', password: 'wrong' })
    expect(res.status).toBe(401)
  })

  it('GET /me returns 401 without a session and 200 with one', async () => {
    expect((await app.request('/api/auth/me', {}, ENV)).status).toBe(401)

    const loginRes = await login(app, { email: 'admin@example.com', password: 'boot-pass-123' })
    const cookie = loginRes.headers.get('set-cookie')!.split(';')[0]
    const meRes = await app.request('/api/auth/me', { headers: { cookie } }, ENV)
    expect(meRes.status).toBe(200)
    expect(await meRes.json()).toEqual({ email: 'admin@example.com' })
  })

  it('GET /me rejects and deletes an expired session', async () => {
    const loginRes = await login(app, { email: 'admin@example.com', password: 'boot-pass-123' })
    const cookie = loginRes.headers.get('set-cookie')!.split(';')[0]
    const sid = cookie.split('=')[1]
    store.sessions.set(sid, { userId: 1, expiresAt: Math.floor(Date.now() / 1000) - 10 })
    const meRes = await app.request('/api/auth/me', { headers: { cookie } }, ENV)
    expect(meRes.status).toBe(401)
    expect(store.sessions.has(sid)).toBe(false)
  })

  it('POST /logout deletes the session', async () => {
    const loginRes = await login(app, { email: 'admin@example.com', password: 'boot-pass-123' })
    const cookie = loginRes.headers.get('set-cookie')!.split(';')[0]
    const res = await app.request('/api/auth/logout', { method: 'POST', headers: { cookie } }, ENV)
    expect(res.status).toBe(200)
    expect(store.sessions.size).toBe(0)
    const meRes = await app.request('/api/auth/me', { headers: { cookie } }, ENV)
    expect(meRes.status).toBe(401)
  })
})
