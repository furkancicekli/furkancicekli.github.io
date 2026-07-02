import type { Lang } from './products'

export interface FaqTranslation {
  question: string | null
  answer: string | null
}

export interface Faq {
  id: number
  sort: number
  translations: Partial<Record<Lang, FaqTranslation>>
}

export interface FaqStore {
  list(): Promise<Faq[]> // sort ASC, id ASC
  create(sort: number, tr: Partial<Record<Lang, FaqTranslation>>): Promise<Faq>
  update(id: number, sort: number, tr: Partial<Record<Lang, FaqTranslation>>): Promise<Faq | null> // translations REPLACE
  delete(id: number): Promise<boolean>
}

const LANGS: Lang[] = ['tr', 'en', 'ar']

export function d1FaqStore(db: D1Database): FaqStore {
  async function loadTranslations(faqId: number): Promise<Partial<Record<Lang, FaqTranslation>>> {
    const { results } = await db
      .prepare('SELECT lang, question, answer FROM faq_translations WHERE faq_id = ?')
      .bind(faqId)
      .all<{ lang: Lang; question: string | null; answer: string | null }>()
    const translations: Partial<Record<Lang, FaqTranslation>> = {}
    for (const row of results) {
      translations[row.lang] = { question: row.question, answer: row.answer }
    }
    return translations
  }

  async function insertTranslations(faqId: number, translations: Partial<Record<Lang, FaqTranslation>>) {
    for (const lang of LANGS) {
      const t = translations[lang]
      if (!t) continue
      await db
        .prepare('INSERT INTO faq_translations (faq_id, lang, question, answer) VALUES (?, ?, ?, ?)')
        .bind(faqId, lang, t.question ?? null, t.answer ?? null)
        .run()
    }
  }

  async function get(id: number): Promise<Faq | null> {
    const row = await db.prepare('SELECT id, sort FROM faqs WHERE id = ?').bind(id).first<{ id: number; sort: number }>()
    if (!row) return null
    const translations = await loadTranslations(id)
    return { id: row.id, sort: row.sort, translations }
  }

  return {
    async list() {
      const { results } = await db.prepare('SELECT id, sort FROM faqs ORDER BY sort ASC, id ASC').all<{ id: number; sort: number }>()
      const faqs: Faq[] = []
      for (const row of results) {
        const translations = await loadTranslations(row.id)
        faqs.push({ id: row.id, sort: row.sort, translations })
      }
      return faqs
    },

    async create(sort, tr) {
      const row = await db.prepare('INSERT INTO faqs (sort) VALUES (?) RETURNING id').bind(sort).first<{ id: number }>()
      if (!row) throw new Error('failed to create faq')
      await insertTranslations(row.id, tr)
      const faq = await get(row.id)
      if (!faq) throw new Error('failed to load created faq')
      return faq
    },

    async update(id, sort, tr) {
      const existing = await db.prepare('SELECT id FROM faqs WHERE id = ?').bind(id).first<{ id: number }>()
      if (!existing) return null
      await db.prepare('UPDATE faqs SET sort = ? WHERE id = ?').bind(sort, id).run()
      await db.prepare('DELETE FROM faq_translations WHERE faq_id = ?').bind(id).run()
      await insertTranslations(id, tr)
      return get(id)
    },

    async delete(id) {
      const res = await db.prepare('DELETE FROM faqs WHERE id = ?').bind(id).run()
      return res.meta.changes > 0
    },
  }
}
