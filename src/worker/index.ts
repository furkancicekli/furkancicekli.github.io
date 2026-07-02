import { Hono } from 'hono'
import { d1AuthStore } from './db/auth'
import type { AuthStore } from './db/auth'
import { d1ProductStore } from './db/products'
import type { ProductStore } from './db/products'
import { d1FaqStore } from './db/faqs'
import type { FaqStore } from './db/faqs'
import { d1CertStore } from './db/certificates'
import type { CertStore } from './db/certificates'
import { d1MaterialStore } from './db/materials'
import type { MaterialStore } from './db/materials'
import { d1GalleryStore } from './db/gallery'
import type { GalleryStore } from './db/gallery'
import { authRoutes } from './routes/auth'
import { adminRoutes } from './routes/admin'
import { productsRoutes } from './routes/products'
import { mediaRoutes, publicMediaRoutes } from './routes/media'
import { adminFaqsRoutes, publicFaqsRoutes } from './routes/faqs'
import { adminCertificatesRoutes, publicVerifyRoutes, publicVerifySerialRoutes } from './routes/certificates'
import { adminMaterialsRoutes } from './routes/materials'
import { adminGalleryRoutes, publicGalleryRoutes } from './routes/gallery'
import { publicProductsRoutes } from './routes/public-products'
import { sitemapRoutes } from './routes/sitemap'
import { productMetaRoutes } from './routes/product-meta'
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
    materialStore: MaterialStore
    galleryStore: GalleryStore
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
  c.set('materialStore', d1MaterialStore(c.env.DB))
  c.set('galleryStore', d1GalleryStore(c.env.DB))
  await next()
})
app.use('/api/admin/*', requireAuth)
app.use('/api/faqs/*', async (c, next) => {
  c.set('faqStore', d1FaqStore(c.env.DB))
  await next()
})
app.use('/api/gallery/*', async (c, next) => {
  c.set('galleryStore', d1GalleryStore(c.env.DB))
  await next()
})
app.use('/api/products/*', async (c, next) => {
  c.set('productStore', d1ProductStore(c.env.DB))
  await next()
})
app.use('/api/verify/*', async (c, next) => {
  c.set('certStore', d1CertStore(c.env.DB))
  await next()
})
app.use('/api/verify-serial/*', async (c, next) => {
  c.set('certStore', d1CertStore(c.env.DB))
  await next()
})
app.use('/sitemap.xml', async (c, next) => {
  c.set('productStore', d1ProductStore(c.env.DB))
  await next()
})
app.use('/products/*', async (c, next) => {
  c.set('productStore', d1ProductStore(c.env.DB))
  await next()
})
app.route('/api/admin', adminRoutes)
app.route('/api/admin/products', productsRoutes)
app.route('/api/admin', mediaRoutes)
app.route('/api/admin/faqs', adminFaqsRoutes)
app.route('/api/admin/certificates', adminCertificatesRoutes)
app.route('/api/admin/materials', adminMaterialsRoutes)
app.route('/api/admin/gallery', adminGalleryRoutes)
app.route('/api/media', publicMediaRoutes)
app.route('/api/faqs', publicFaqsRoutes)
app.route('/api/gallery', publicGalleryRoutes)
app.route('/api/products', publicProductsRoutes)
app.route('/api/verify', publicVerifyRoutes)
app.route('/api/verify-serial', publicVerifySerialRoutes)
app.route('/', sitemapRoutes)
// Explicit passthrough for the bare listing page: Cloudflare's run_worker_first
// glob for `/products/*` may also route requests with no trailing slug to the
// worker, and productMetaRoutes only defines `/products/:slug`. Without this,
// a matched-but-unhandled `/products` request would fall through to a 404
// instead of serving the SPA shell.
app.get('/products', (c) => c.env.ASSETS.fetch(c.req.raw))
app.route('/', productMetaRoutes)

export default app
