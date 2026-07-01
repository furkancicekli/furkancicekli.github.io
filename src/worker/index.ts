import { Hono } from 'hono'
import { d1AuthStore } from './db/auth'
import type { AuthStore } from './db/auth'
import { d1ProductStore } from './db/products'
import type { ProductStore } from './db/products'
import { d1FaqStore } from './db/faqs'
import type { FaqStore } from './db/faqs'
import { authRoutes } from './routes/auth'
import { adminRoutes } from './routes/admin'
import { productsRoutes, productStepsRoutes } from './routes/products'
import { mediaRoutes, publicMediaRoutes } from './routes/media'
import { adminFaqsRoutes, publicFaqsRoutes } from './routes/faqs'
import { requireAuth } from './middleware/require-auth'

export type Bindings = {
  ASSETS: Fetcher
  DB: D1Database
  MEDIA: R2Bucket
  ADMIN_EMAIL?: string
  ADMIN_PASSWORD?: string
}

type Env = {
  Bindings: Bindings
  Variables: { store: AuthStore; productStore: ProductStore; faqStore: FaqStore; user?: { id: number; email: string } }
}

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
app.use('/api/admin/products/*', async (c, next) => {
  c.set('productStore', d1ProductStore(c.env.DB))
  await next()
})
app.use('/api/admin/media/*', async (c, next) => {
  c.set('productStore', d1ProductStore(c.env.DB))
  await next()
})
app.use('/api/admin/steps/*', async (c, next) => {
  c.set('productStore', d1ProductStore(c.env.DB))
  await next()
})
app.use('/api/admin/faqs/*', async (c, next) => {
  c.set('faqStore', d1FaqStore(c.env.DB))
  await next()
})
app.use('/api/faqs/*', async (c, next) => {
  c.set('faqStore', d1FaqStore(c.env.DB))
  await next()
})
app.route('/api/admin', adminRoutes)
app.route('/api/admin/products', productsRoutes)
app.route('/api/admin', mediaRoutes)
app.route('/api/admin/steps', productStepsRoutes)
app.route('/api/admin/faqs', adminFaqsRoutes)
app.route('/api/media', publicMediaRoutes)
app.route('/api/faqs', publicFaqsRoutes)

export default app
