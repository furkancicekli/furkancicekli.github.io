import { Hono } from 'hono'
import type { Lang } from '../db/products'
import type { FaqStore, FaqTranslation } from '../db/faqs'

export type AdminFaqsEnv = {
  Bindings: Record<string, unknown>
  Variables: { faqStore: FaqStore; user?: { id: number; email: string } }
}

export type PublicFaqsEnv = {
  Bindings: Record<string, unknown>
  Variables: { faqStore: FaqStore }
}

export const adminFaqsRoutes = new Hono<AdminFaqsEnv>()
export const publicFaqsRoutes = new Hono<PublicFaqsEnv>()

const LANGS: Lang[] = ['tr', 'en', 'ar']

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function parseTranslations(raw: unknown): Partial<Record<Lang, FaqTranslation>> | null {
  if (typeof raw !== 'object' || raw === null) return null
  const translations: Partial<Record<Lang, FaqTranslation>> = {}
  const src = raw as Record<string, unknown>
  for (const lang of LANGS) {
    const t = src[lang]
    if (t === undefined || t === null) continue
    if (typeof t !== 'object') return null
    const tObj = t as Record<string, unknown>
    translations[lang] = {
      question: typeof tObj.question === 'string' ? tObj.question : null,
      answer: typeof tObj.answer === 'string' ? tObj.answer : null,
    }
  }
  return translations
}

type ValidatedInput =
  | { ok: true; translations: Partial<Record<Lang, FaqTranslation>>; sort?: number }
  | { ok: false; error: string }

function validateInput(body: Record<string, unknown>, opts: { requireSort: boolean }): ValidatedInput {
  const translations = parseTranslations(body.translations)
  if (translations === null) return { ok: false, error: 'invalid_request' }
  if (!translations.tr?.question?.trim() || !translations.tr?.answer?.trim()) {
    return { ok: false, error: 'tr_qa_required' }
  }

  if (body.sort === undefined) {
    if (opts.requireSort) return { ok: false, error: 'invalid_request' }
    return { ok: true, translations, sort: undefined }
  }
  if (typeof body.sort !== 'number' || !Number.isInteger(body.sort) || body.sort < 0) {
    return { ok: false, error: 'invalid_request' }
  }
  return { ok: true, translations, sort: body.sort }
}

adminFaqsRoutes.get('/', async (c) => {
  const store = c.get('faqStore')
  const faqs = await store.list()
  return c.json({ faqs })
})

adminFaqsRoutes.post('/', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_request' }, 400)
  }
  if (typeof body !== 'object' || body === null) return c.json({ error: 'invalid_request' }, 400)

  const validated = validateInput(body as Record<string, unknown>, { requireSort: false })
  if (!validated.ok) return c.json({ error: validated.error }, 400)

  const store = c.get('faqStore')
  if (validated.sort !== undefined) {
    const faq = await store.create(validated.sort, validated.translations)
    return c.json(faq, 201)
  }

  const list = await store.list()
  const sort = list.length === 0 ? 0 : Math.max(...list.map((f) => f.sort)) + 1
  const faq = await store.create(sort, validated.translations)
  return c.json(faq, 201)
})

adminFaqsRoutes.put('/:id', async (c) => {
  const idParam = c.req.param('id')
  const id = Number(idParam)
  if (!Number.isInteger(id)) return c.json({ error: 'invalid_request' }, 400)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_request' }, 400)
  }
  if (typeof body !== 'object' || body === null) return c.json({ error: 'invalid_request' }, 400)

  const validated = validateInput(body as Record<string, unknown>, { requireSort: true })
  if (!validated.ok) return c.json({ error: validated.error }, 400)

  const store = c.get('faqStore')
  const faq = await store.update(id, validated.sort as number, validated.translations)
  if (!faq) return c.json({ error: 'not_found' }, 404)
  return c.json(faq)
})

adminFaqsRoutes.delete('/:id', async (c) => {
  const idParam = c.req.param('id')
  const id = Number(idParam)
  if (!Number.isInteger(id)) return c.json({ error: 'invalid_request' }, 400)

  const store = c.get('faqStore')
  const deleted = await store.delete(id)
  if (!deleted) return c.json({ error: 'not_found' }, 404)
  return c.json({ ok: true })
})

publicFaqsRoutes.get('/', async (c) => {
  const langParam = c.req.query('lang')
  const lang: Lang = LANGS.includes(langParam as Lang) ? (langParam as Lang) : 'tr'

  const store = c.get('faqStore')
  const faqs = await store.list()

  const result = faqs
    .map((f) => {
      const primary = f.translations[lang]
      const fallback = f.translations.tr
      const question = trimOrNull(primary?.question) ?? trimOrNull(fallback?.question)
      const answer = trimOrNull(primary?.answer) ?? trimOrNull(fallback?.answer)
      return { id: f.id, question, answer }
    })
    .filter((f): f is { id: number; question: string; answer: string } => !!f.question && !!f.answer)

  return c.json({ faqs: result })
})
