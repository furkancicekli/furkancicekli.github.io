import { Hono } from 'hono'
import { d1AuthStore } from './db/auth'
import type { AuthStore } from './db/auth'
import { d1ProductStore } from './db/products'
import type { ProductStore } from './db/products'
import { d1FaqStore } from './db/faqs'
import type { FaqStore } from './db/faqs'
import { d1CertStore } from './db/certificates'
import type { CertStore } from './db/certificates'
import { authRoutes } from './routes/auth'
import { adminRoutes } from './routes/admin'
import { productsRoutes, productStepsRoutes } from './routes/products'
import { mediaRoutes, publicMediaRoutes } from './routes/media'
import { adminFaqsRoutes, publicFaqsRoutes } from './routes/faqs'
import { adminCertificatesRoutes, publicVerifyRoutes } from './routes/certificates'
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
  Variables: {
    store: AuthStore
    productStore: ProductStore
    faqStore: FaqStore
    certStore: CertStore
    user?: { id: number; email: string }
  }
}

const app = new Hono<Env>()

app.get('/api/health', (c) => c.json({ status: 'ok' }))

app.use('/api/auth/*', async (c, next) => {
  c.set('store', d1AuthStore(c.env.DB))
  await next()
})
app.route('/api/auth', authRoutes)
// Single combined store middleware for all /api/admin/* routes: constructing
// these store closures is negligible cost (no queries run until a handler
// actually uses them), so setting all of them here avoids the fragility of
// per-prefix middlewares silently missing a store for a newly added route.
app.use('/api/admin/*', async (c, next) => {
  c.set('store', d1AuthStore(c.env.DB))
  c.set('productStore', d1ProductStore(c.env.DB))
  c.set('faqStore', d1FaqStore(c.env.DB))
  c.set('certStore', d1CertStore(c.env.DB))
  await next()
})
app.use('/api/admin/*', requireAuth)
app.use('/api/faqs/*', async (c, next) => {
  c.set('faqStore', d1FaqStore(c.env.DB))
  await next()
})
app.use('/api/verify/*', async (c, next) => {
  c.set('certStore', d1CertStore(c.env.DB))
  await next()
})
app.route('/api/admin', adminRoutes)
app.route('/api/admin/products', productsRoutes)
app.route('/api/admin', mediaRoutes)
app.route('/api/admin/steps', productStepsRoutes)
app.route('/api/admin/faqs', adminFaqsRoutes)
app.route('/api/admin/certificates', adminCertificatesRoutes)
app.route('/api/media', publicMediaRoutes)
app.route('/api/faqs', publicFaqsRoutes)
app.route('/api/verify', publicVerifyRoutes)

export default app
