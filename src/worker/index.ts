import { Hono } from 'hono'

export type Bindings = {
  ASSETS: Fetcher
  // DB and MEDIA are added in later tasks:
  // DB: D1Database
  // MEDIA: R2Bucket
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/api/health', (c) => c.json({ status: 'ok' }))

export default app
