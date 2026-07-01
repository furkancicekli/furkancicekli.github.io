import { Hono } from 'hono'
import type { AuthEnv } from './auth'
import { hashPassword, verifyPassword } from '../lib/password'

export const adminRoutes = new Hono<AuthEnv>()

adminRoutes.post('/password', async (c) => {
  let body: { currentPassword?: unknown; newPassword?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_request' }, 400)
  }
  // JSON `null`/primitif gövdede property erişimi patlamasın — 400 dön
  if (typeof body !== 'object' || body === null) return c.json({ error: 'invalid_request' }, 400)
  if (typeof body.currentPassword !== 'string' || typeof body.newPassword !== 'string') {
    return c.json({ error: 'invalid_request' }, 400)
  }
  if (body.newPassword.length < 8) return c.json({ error: 'password_too_short' }, 400)

  const store = c.get('store')
  const user = c.get('user')! // requireAuth garantiler
  const dbUser = await store.findUserByEmail(user.email)
  if (!dbUser || !(await verifyPassword(body.currentPassword, dbUser.passwordHash))) {
    return c.json({ error: 'invalid_credentials' }, 401)
  }
  await store.updatePassword(dbUser.id, await hashPassword(body.newPassword))
  return c.json({ ok: true })
})
