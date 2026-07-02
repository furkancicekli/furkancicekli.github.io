import type { Lang } from '../db/products'
import type { Faq, FaqStore, FaqTranslation } from '../db/faqs'

export function fakeFaqStore(): FaqStore & { faqs: Faq[] } {
  const faqs: Faq[] = []
  let nextId = 1

  function sortedFaqs(): Faq[] {
    return [...faqs].sort((a, b) => (a.sort - b.sort) || (a.id - b.id))
  }

  return {
    faqs,
    async list(): Promise<Faq[]> {
      return sortedFaqs().map((f) => ({ ...f, translations: { ...f.translations } }))
    },
    async create(sort: number, tr: Partial<Record<Lang, FaqTranslation>>): Promise<Faq> {
      const faq: Faq = { id: nextId++, sort, translations: { ...tr } }
      faqs.push(faq)
      return { ...faq, translations: { ...faq.translations } }
    },
    async update(id: number, sort: number, tr: Partial<Record<Lang, FaqTranslation>>): Promise<Faq | null> {
      const faq = faqs.find((f) => f.id === id)
      if (!faq) return null
      faq.sort = sort
      faq.translations = { ...tr }
      return { ...faq, translations: { ...faq.translations } }
    },
    async delete(id: number): Promise<boolean> {
      const idx = faqs.findIndex((f) => f.id === id)
      if (idx === -1) return false
      faqs.splice(idx, 1)
      return true
    },
  }
}
