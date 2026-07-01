import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { AuthStore } from '../db/auth'
import { hashPassword, verifyPassword } from '../lib/password'
import { SESSION_COOKIE, SESSION_TTL_SECONDS, newSessionId, sessionCookieOptions } from '../lib/session'

export type AuthEnv = {
  Bindings: { ADMIN_EMAIL?: string; ADMIN_PASSWORD?: string }
  Variables: { store: AuthStore; user?: { id: number; email: string } }
}

export const authRoutes = new Hono<AuthEnv>()

authRoutes.post('/login', async (c) => {
  let body: { email?: unknown; password?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_request' }, 400)
  }
  if (typeof body.email !== 'string' || typeof body.password !== 'string' || !body.email.trim() || !body.password) {
    return c.json({ error: 'invalid_request' }, 400)
  }
  const email = body.email.trim().toLowerCase()
  const password = body.password
  const store = c.get('store')

  let user = await store.findUserByEmail(email)

  if (!user) {
    // Bootstrap: hiç admin yokken env kimlik bilgileriyle ilk kullanıcı oluşturulur
    const { ADMIN_EMAIL, ADMIN_PASSWORD } = c.env
    const canBootstrap =
      (await store.countUsers()) === 0 &&
      !!ADMIN_EMAIL &&
      !!ADMIN_PASSWORD &&
      email === ADMIN_EMAIL.trim().toLowerCase() &&
      password === ADMIN_PASSWORD
    if (!canBootstrap) return c.json({ error: 'invalid_credentials' }, 401)
    user = await store.createUser(email, await hashPassword(password))
  } else if (!(await verifyPassword(password, user.passwordHash))) {
    return c.json({ error: 'invalid_credentials' }, 401)
  }

  const sid = newSessionId()
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  await store.createSession(sid, user.id, expiresAt)
  setCookie(c, SESSION_COOKIE, sid, sessionCookieOptions(SESSION_TTL_SECONDS))
  return c.json({ email: user.email })
})

authRoutes.get('/me', async (c) => {
  const sid = getCookie(c, SESSION_COOKIE)
  if (!sid) return c.json({ error: 'unauthorized' }, 401)
  const store = c.get('store')
  const session = await store.findSessionWithUser(sid)
  if (!session) return c.json({ error: 'unauthorized' }, 401)
  if (session.expiresAt <= Math.floor(Date.now() / 1000)) {
    await store.deleteSession(sid)
    return c.json({ error: 'unauthorized' }, 401)
  }
  return c.json({ email: session.email })
})

authRoutes.post('/logout', async (c) => {
  const sid = getCookie(c, SESSION_COOKIE)
  if (sid) await c.get('store').deleteSession(sid)
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
  return c.json({ ok: true })
})
