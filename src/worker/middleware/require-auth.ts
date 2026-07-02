import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import type { AuthEnv } from '../routes/auth'
import { SESSION_COOKIE } from '../lib/session'

export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const sid = getCookie(c, SESSION_COOKIE)
  if (!sid) return c.json({ error: 'unauthorized' }, 401)
  const store = c.get('store')
  const session = await store.findSessionWithUser(sid)
  if (!session || session.expiresAt <= Math.floor(Date.now() / 1000)) {
    if (session) await store.deleteSession(sid)
    return c.json({ error: 'unauthorized' }, 401)
  }
  c.set('user', { id: session.userId, email: session.email })
  await next()
}
