import { Hono } from 'hono'
import type { MaterialStore } from '../db/materials'

export type AdminMaterialsEnv = {
  Bindings: Record<string, unknown>
  Variables: { materialStore: MaterialStore; user?: { id: number; email: string } }
}

export const adminMaterialsRoutes = new Hono<AdminMaterialsEnv>()

adminMaterialsRoutes.get('/', async (c) => {
  const store = c.get('materialStore')
  const materials = await store.list()
  return c.json({ materials })
})

adminMaterialsRoutes.post('/', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_request' }, 400)
  }
  if (typeof body !== 'object' || body === null) return c.json({ error: 'invalid_request' }, 400)

  const raw = (body as Record<string, unknown>).name
  if (typeof raw !== 'string') return c.json({ error: 'invalid_request' }, 400)
  const name = raw.trim()
  if (name === '') return c.json({ error: 'invalid_request' }, 400)

  const store = c.get('materialStore')
  const existing = await store.findByName(name)
  if (existing) return c.json(existing, 200)

  const material = await store.create(name)
  return c.json(material, 201)
})
