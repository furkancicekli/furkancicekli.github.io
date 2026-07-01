import { describe, it, expect } from 'vitest'
import app from './index'

describe('worker', () => {
  it('GET /api/health returns ok', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('mounts auth routes (login validates request body)', async () => {
    // Üçüncü argüman ({} env) zorunlu: verilmezse c.env undefined olur ve
    // store middleware'i c.env.DB okurken 500 fırlatır.
    const res = await app.request(
      '/api/auth/login',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) },
      {},
    )
    expect(res.status).toBe(400) // 404 değil → route mount edilmiş; store'a dokunmadan döner
  })

  it('protects /api/admin/* without a session', async () => {
    const res = await app.request('/api/admin/password', { method: 'POST' }, {})
    expect(res.status).toBe(401) // 404 değil → guard aktif; cookie yokken store'a dokunmaz
  })
})
