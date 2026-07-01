import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { adminFaqsRoutes, publicFaqsRoutes, type AdminFaqsEnv, type PublicFaqsEnv } from './faqs'
import { requireAuth } from '../middleware/require-auth'
import type { AuthEnv } from './auth'
import type { Faq } from '../db/faqs'
import { fakeAuthStore } from '../test/fake-auth-store'
import { fakeFaqStore } from '../test/fake-faq-store'

async function json<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T
}

type CombinedEnv = { Bindings: AuthEnv['Bindings']; Variables: AuthEnv['Variables'] & AdminFaqsEnv['Variables'] }

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    translations: { tr: { question: 'Soru?', answer: 'Cevap.' } },
    ...overrides,
  }
}

describe('admin faqs routes', () => {
  let faqStore: ReturnType<typeof fakeFaqStore>
  let authStore: ReturnType<typeof fakeAuthStore>
  let app: Hono<CombinedEnv>
  const cookie = 'sid=test-session'

  beforeEach(async () => {
    faqStore = fakeFaqStore()
    authStore = fakeAuthStore()
    const user = await authStore.createUser('admin@example.com', 'hash')
    await authStore.createSession('test-session', user.id, Math.floor(Date.now() / 1000) + 3600)

    app = new Hono<CombinedEnv>()
    app.use('*', async (c, next) => {
      c.set('store', authStore)
      c.set('faqStore', faqStore)
      await next()
    })
    app.use('/api/admin/faqs/*', requireAuth)
    app.route('/api/admin/faqs', adminFaqsRoutes)
  })

  function req(path: string, init: RequestInit = {}) {
    return app.request(path, init)
  }

  function post(body: unknown) {
    return req('/api/admin/faqs', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    })
  }

  function put(id: number | string, body: unknown) {
    return req(`/api/admin/faqs/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    })
  }

  it('blocks unauthenticated access', async () => {
    const res = await req('/api/admin/faqs')
    expect(res.status).toBe(401)
  })

  it('creates a faq and returns 201 appended to end', async () => {
    const res = await post(validInput())
    expect(res.status).toBe(201)
    const body = await json<Faq>(res)
    expect(body).toMatchObject({
      sort: 0,
      translations: { tr: { question: 'Soru?', answer: 'Cevap.' } },
    })
    expect(body.id).toBeTypeOf('number')
  })

  it('rejects missing tr.question with tr_qa_required', async () => {
    const res = await post(
      validInput({ translations: { tr: { question: '', answer: 'Cevap.' } } }),
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'tr_qa_required' })
  })

  it('rejects present tr.question but missing tr.answer with tr_qa_required', async () => {
    const res = await post(
      validInput({ translations: { tr: { question: 'Soru?', answer: '' } } }),
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'tr_qa_required' })
  })

  it('rejects a non-object JSON body', async () => {
    const res = await req('/api/admin/faqs', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: 'null',
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('rejects a non-integer sort', async () => {
    const res = await post(validInput({ sort: 1.5 }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('lists faqs ordered by sort ASC, id ASC', async () => {
    await post(validInput({ translations: { tr: { question: 'S1', answer: 'C1' } }, sort: 5 }))
    await post(validInput({ translations: { tr: { question: 'S2', answer: 'C2' } }, sort: 1 }))
    await post(validInput({ translations: { tr: { question: 'S3', answer: 'C3' } }, sort: 1 }))

    const res = await req('/api/admin/faqs', { headers: { cookie } })
    expect(res.status).toBe(200)
    const body = await json<{ faqs: Faq[] }>(res)
    expect(body.faqs.map((f) => f.translations.tr?.question)).toEqual(['S2', 'S3', 'S1'])
  })

  it('returns 400 for a non-numeric id', async () => {
    const res = await req('/api/admin/faqs/abc', { method: 'DELETE', headers: { cookie } })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('updates a faq, replacing translations and sort', async () => {
    const created = await json<Faq>(
      await post(
        validInput({
          translations: {
            tr: { question: 'Soru?', answer: 'Cevap.' },
            en: { question: 'Question?', answer: 'Answer.' },
          },
        }),
      ),
    )
    expect(created.translations.en).toBeDefined()

    const res = await put(created.id, {
      translations: { tr: { question: 'Soru2?', answer: 'Cevap2.' } },
      sort: 3,
    })
    expect(res.status).toBe(200)
    const body = await json<Faq>(res)
    expect(body).toMatchObject({ id: created.id, sort: 3, translations: { tr: { question: 'Soru2?', answer: 'Cevap2.' } } })
    expect(body.translations.en).toBeUndefined()
  })

  it('rejects update missing sort with invalid_request', async () => {
    const created = await json<Faq>(await post(validInput()))
    const res = await put(created.id, { translations: { tr: { question: 'Q', answer: 'A' } } })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
  })

  it('returns 404 when PUT targets a missing faq', async () => {
    const res = await put(999, { translations: { tr: { question: 'Q', answer: 'A' } }, sort: 0 })
    expect(res.status).toBe(404)
  })

  it('rejects update with tr_qa_required', async () => {
    const created = await json<Faq>(await post(validInput()))
    const res = await put(created.id, { translations: { tr: { question: 'Q', answer: '' } }, sort: 0 })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'tr_qa_required' })
  })

  it('deletes a faq; subsequent GET list no longer includes it', async () => {
    const created = await json<Faq>(await post(validInput()))
    const delRes = await req(`/api/admin/faqs/${created.id}`, { method: 'DELETE', headers: { cookie } })
    expect(delRes.status).toBe(200)
    expect(await delRes.json()).toEqual({ ok: true })

    const listRes = await req('/api/admin/faqs', { headers: { cookie } })
    const body = await json<{ faqs: Faq[] }>(listRes)
    expect(body.faqs.find((f) => f.id === created.id)).toBeUndefined()
  })

  it('returns 404 when deleting a missing faq', async () => {
    const res = await req('/api/admin/faqs/999', { method: 'DELETE', headers: { cookie } })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
  })
})

describe('public faqs route', () => {
  let faqStore: ReturnType<typeof fakeFaqStore>
  let app: Hono<PublicFaqsEnv>

  beforeEach(() => {
    faqStore = fakeFaqStore()
    app = new Hono<PublicFaqsEnv>()
    app.use('*', async (c, next) => {
      c.set('faqStore', faqStore)
      await next()
    })
    app.route('/api/faqs', publicFaqsRoutes)
  })

  it('falls back to tr when requested lang missing', async () => {
    await faqStore.create(0, { tr: { question: 'Soru?', answer: 'Cevap.' } })

    const res = await app.request('/api/faqs?lang=en')
    expect(res.status).toBe(200)
    const body = await res.json<{ faqs: { id: number; question: string; answer: string }[] }>()
    expect(body.faqs).toEqual([{ id: 1, question: 'Soru?', answer: 'Cevap.' }])
  })

  it('falls back to tr when lang is invalid/missing', async () => {
    await faqStore.create(0, { tr: { question: 'Soru?', answer: 'Cevap.' } })

    const res = await app.request('/api/faqs?lang=xx')
    expect(res.status).toBe(200)
    const body = await res.json<{ faqs: { id: number; question: string; answer: string }[] }>()
    expect(body.faqs).toEqual([{ id: 1, question: 'Soru?', answer: 'Cevap.' }])

    const res2 = await app.request('/api/faqs')
    expect(res2.status).toBe(200)
    const body2 = await res2.json<{ faqs: { id: number; question: string; answer: string }[] }>()
    expect(body2.faqs).toEqual([{ id: 1, question: 'Soru?', answer: 'Cevap.' }])
  })

  it('returns requested lang text when present', async () => {
    await faqStore.create(0, {
      tr: { question: 'Soru?', answer: 'Cevap.' },
      en: { question: 'Question?', answer: 'Answer.' },
    })

    const res = await app.request('/api/faqs?lang=en')
    const body = await res.json<{ faqs: { id: number; question: string; answer: string }[] }>()
    expect(body.faqs).toEqual([{ id: 1, question: 'Question?', answer: 'Answer.' }])
  })

  it('excludes faqs with empty question/answer in both requested lang and tr fallback', async () => {
    await faqStore.create(0, { en: { question: 'Question?', answer: 'Answer.' } })

    const res = await app.request('/api/faqs?lang=tr')
    const body = await res.json<{ faqs: unknown[] }>()
    expect(body.faqs).toEqual([])
  })

  it('sorts by sort ASC, id ASC', async () => {
    await faqStore.create(5, { tr: { question: 'S1', answer: 'C1' } })
    await faqStore.create(1, { tr: { question: 'S2', answer: 'C2' } })
    await faqStore.create(1, { tr: { question: 'S3', answer: 'C3' } })

    const res = await app.request('/api/faqs?lang=tr')
    const body = await res.json<{ faqs: { question: string }[] }>()
    expect(body.faqs.map((f) => f.question)).toEqual(['S2', 'S3', 'S1'])
  })
})
