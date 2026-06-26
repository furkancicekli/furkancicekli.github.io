import { Hono } from 'hono'

export type Bindings = {
  ASSETS: Fetcher
  DB: D1Database
  // MEDIA: R2Bucket (added in Task 7)
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/api/health', (c) => c.json({ status: 'ok' }))

export default app
