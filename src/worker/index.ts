import { Hono } from 'hono'
import { d1AuthStore } from './db/auth'
import type { AuthStore } from './db/auth'
import { authRoutes } from './routes/auth'
import { adminRoutes } from './routes/admin'
import { requireAuth } from './middleware/require-auth'

export type Bindings = {
  ASSETS: Fetcher
  DB: D1Database
  MEDIA: R2Bucket
  ADMIN_EMAIL?: string
  ADMIN_PASSWORD?: string
}

type Env = { Bindings: Bindings; Variables: { store: AuthStore; user?: { id: number; email: string } } }

const app = new Hono<Env>()

app.get('/api/health', (c) => c.json({ status: 'ok' }))

app.use('/api/auth/*', async (c, next) => {
  c.set('store', d1AuthStore(c.env.DB))
  await next()
})
app.use('/api/admin/*', async (c, next) => {
  c.set('store', d1AuthStore(c.env.DB))
  await next()
})
app.route('/api/auth', authRoutes)
app.use('/api/admin/*', requireAuth)
app.route('/api/admin', adminRoutes)

export default app
