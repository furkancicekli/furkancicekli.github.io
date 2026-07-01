export type ProductStatus = 'draft' | 'published' | 'sold'
export type Lang = 'tr' | 'en' | 'ar'

export interface ProductListItem {
  id: number
  slug: string
  serialNo: string | null
  status: ProductStatus
  name: string | null
  weightGrams: number | null
  mediaCount: number
  createdAt: number
}

export interface ProductTranslation {
  name: string | null
  description: string | null
  story: string | null
}

export interface ProductMediaItem {
  id: number
  type: 'image' | 'video'
  r2Key: string
  kind: 'gallery' | 'raw_material' | 'process'
  sort: number
}

export interface ProcessStep {
  id: number
  sort: number
  texts: Partial<Record<Lang, string>>
}

export interface ProductDetail {
  id: number
  slug: string
  serialNo: string | null
  status: ProductStatus
  material: string | null
  size: string | null
  weightGrams: number | null
  createdAt: number
  updatedAt: number
  translations: Partial<Record<Lang, ProductTranslation>>
  media: ProductMediaItem[]
  steps: ProcessStep[]
}

/** Full input accepted by the store's create(): includes server-managed fields
 * (slug/serialNo/status) because the route layer computes those before calling
 * the store. HTTP-level input validation (routes/products.ts) exposes a
 * narrower shape that omits slug/serialNo/status/price entirely. */
export interface ProductInput {
  slug: string
  serialNo?: string | null
  status: ProductStatus
  material?: string | null
  size?: string | null
  weightGrams?: number | null
  translations: Partial<Record<Lang, ProductTranslation>>
}

/** Fields an admin can change via PUT: never slug/serial/status/price. */
export interface ProductUpdateInput {
  material?: string | null
  size?: string | null
  weightGrams?: number | null
  translations: Partial<Record<Lang, ProductTranslation>>
}

export interface ProductStore {
  list(): Promise<ProductListItem[]>
  get(id: number): Promise<ProductDetail | null>
  findBySlug(slug: string): Promise<{ id: number } | null>
  findBySerial(serialNo: string): Promise<{ id: number } | null>
  create(input: ProductInput): Promise<ProductDetail>
  update(id: number, input: ProductUpdateInput): Promise<ProductDetail | null>
  setStatus(id: number, status: ProductStatus): Promise<ProductDetail | null>
  delete(id: number): Promise<boolean>
  addStep(productId: number, texts: Partial<Record<Lang, string>>, sort: number): Promise<ProcessStep>
  updateStep(stepId: number, texts: Partial<Record<Lang, string>>, sort: number): Promise<ProcessStep | null>
  deleteStep(stepId: number): Promise<boolean>
  addMedia(
    productId: number,
    m: { type: 'image' | 'video'; r2Key: string; kind: string; sort: number },
  ): Promise<ProductMediaItem>
  getMedia(mediaId: number): Promise<(ProductMediaItem & { productId: number }) | null>
  updateMedia(mediaId: number, patch: { kind?: string; sort?: number }): Promise<ProductMediaItem | null>
  deleteMedia(mediaId: number): Promise<boolean>
}

const LANGS: Lang[] = ['tr', 'en', 'ar']

export function d1ProductStore(db: D1Database): ProductStore {
  async function loadTranslations(productId: number): Promise<Partial<Record<Lang, ProductTranslation>>> {
    const { results } = await db
      .prepare('SELECT lang, name, description, story FROM product_translations WHERE product_id = ?')
      .bind(productId)
      .all<{ lang: Lang; name: string | null; description: string | null; story: string | null }>()
    const translations: Partial<Record<Lang, ProductTranslation>> = {}
    for (const row of results) {
      translations[row.lang] = { name: row.name, description: row.description, story: row.story }
    }
    return translations
  }

  async function loadMedia(productId: number): Promise<ProductMediaItem[]> {
    const { results } = await db
      .prepare('SELECT id, type, r2_key, kind, sort FROM product_media WHERE product_id = ? ORDER BY sort ASC, id ASC')
      .bind(productId)
      .all<{ id: number; type: 'image' | 'video'; r2_key: string; kind: ProductMediaItem['kind']; sort: number }>()
    return results.map((row) => ({ id: row.id, type: row.type, r2Key: row.r2_key, kind: row.kind, sort: row.sort }))
  }

  async function loadSteps(productId: number): Promise<ProcessStep[]> {
    const { results: stepRows } = await db
      .prepare('SELECT id, sort FROM process_steps WHERE product_id = ? ORDER BY sort ASC, id ASC')
      .bind(productId)
      .all<{ id: number; sort: number }>()
    if (stepRows.length === 0) return []
    const stepIds = stepRows.map((s) => s.id)
    const placeholders = stepIds.map(() => '?').join(',')
    const { results: textRows } = await db
      .prepare(`SELECT step_id, lang, text FROM process_step_translations WHERE step_id IN (${placeholders})`)
      .bind(...stepIds)
      .all<{ step_id: number; lang: Lang; text: string | null }>()
    const textsByStep = new Map<number, Partial<Record<Lang, string>>>()
    for (const row of textRows) {
      if (row.text === null) continue
      const texts = textsByStep.get(row.step_id) ?? {}
      texts[row.lang] = row.text
      textsByStep.set(row.step_id, texts)
    }
    return stepRows.map((s) => ({ id: s.id, sort: s.sort, texts: textsByStep.get(s.id) ?? {} }))
  }

  async function insertTranslations(productId: number, translations: Partial<Record<Lang, ProductTranslation>>) {
    for (const lang of LANGS) {
      const t = translations[lang]
      if (!t) continue
      await db
        .prepare('INSERT INTO product_translations (product_id, lang, name, description, story) VALUES (?, ?, ?, ?, ?)')
        .bind(productId, lang, t.name ?? null, t.description ?? null, t.story ?? null)
        .run()
    }
  }

  return {
    async list() {
      const { results } = await db
        .prepare(
          `SELECT p.id AS id, p.slug AS slug, p.serial_no AS serial_no, p.status AS status,
                  p.weight_grams AS weight_grams, p.created_at AS created_at,
                  t.name AS name, COALESCE(m.cnt, 0) AS media_count
           FROM products p
           LEFT JOIN product_translations t ON t.product_id = p.id AND t.lang = 'tr'
           LEFT JOIN (SELECT product_id, COUNT(*) AS cnt FROM product_media GROUP BY product_id) m
             ON m.product_id = p.id
           ORDER BY p.id DESC`,
        )
        .all<{
          id: number
          slug: string
          serial_no: string | null
          status: ProductStatus
          weight_grams: number | null
          created_at: number
          name: string | null
          media_count: number
        }>()
      return results.map((row) => ({
        id: row.id,
        slug: row.slug,
        serialNo: row.serial_no,
        status: row.status,
        name: row.name,
        weightGrams: row.weight_grams,
        mediaCount: row.media_count,
        createdAt: row.created_at,
      }))
    },

    async get(id) {
      const row = await db
        .prepare(
          `SELECT id, slug, serial_no, status, material, size, weight_grams, created_at, updated_at
           FROM products WHERE id = ?`,
        )
        .bind(id)
        .first<{
          id: number
          slug: string
          serial_no: string | null
          status: ProductStatus
          material: string | null
          size: string | null
          weight_grams: number | null
          created_at: number
          updated_at: number
        }>()
      if (!row) return null
      const [translations, media, steps] = await Promise.all([loadTranslations(id), loadMedia(id), loadSteps(id)])
      return {
        id: row.id,
        slug: row.slug,
        serialNo: row.serial_no,
        status: row.status,
        material: row.material,
        size: row.size,
        weightGrams: row.weight_grams,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        translations,
        media,
        steps,
      }
    },

    async findBySlug(slug) {
      const row = await db.prepare('SELECT id FROM products WHERE slug = ?').bind(slug).first<{ id: number }>()
      return row ? { id: row.id } : null
    },

    async findBySerial(serialNo) {
      const row = await db.prepare('SELECT id FROM products WHERE serial_no = ?').bind(serialNo).first<{ id: number }>()
      return row ? { id: row.id } : null
    },

    async create(input) {
      const row = await db
        .prepare(
          `INSERT INTO products (slug, serial_no, status, material, size, weight_grams)
           VALUES (?, ?, ?, ?, ?, ?)
           RETURNING id`,
        )
        .bind(
          input.slug,
          input.serialNo ?? null,
          input.status,
          input.material ?? null,
          input.size ?? null,
          input.weightGrams ?? null,
        )
        .first<{ id: number }>()
      if (!row) throw new Error('failed to create product')
      await insertTranslations(row.id, input.translations)
      const detail = await this.get(row.id)
      if (!detail) throw new Error('failed to load created product')
      return detail
    },

    async update(id, input) {
      const existing = await db.prepare('SELECT id FROM products WHERE id = ?').bind(id).first<{ id: number }>()
      if (!existing) return null
      await db
        .prepare(
          `UPDATE products SET material = ?, size = ?, weight_grams = ?, updated_at = unixepoch()
           WHERE id = ?`,
        )
        .bind(input.material ?? null, input.size ?? null, input.weightGrams ?? null, id)
        .run()
      await db.prepare('DELETE FROM product_translations WHERE product_id = ?').bind(id).run()
      await insertTranslations(id, input.translations)
      return this.get(id)
    },

    async setStatus(id, status) {
      const existing = await db.prepare('SELECT id FROM products WHERE id = ?').bind(id).first<{ id: number }>()
      if (!existing) return null
      await db
        .prepare('UPDATE products SET status = ?, updated_at = unixepoch() WHERE id = ?')
        .bind(status, id)
        .run()
      return this.get(id)
    },

    async delete(id) {
      const res = await db.prepare('DELETE FROM products WHERE id = ?').bind(id).run()
      return res.meta.changes > 0
    },

    async addStep(productId, texts, sort) {
      const row = await db
        .prepare('INSERT INTO process_steps (product_id, sort) VALUES (?, ?) RETURNING id')
        .bind(productId, sort)
        .first<{ id: number }>()
      if (!row) throw new Error('failed to create step')
      for (const lang of LANGS) {
        const text = texts[lang]
        if (text === undefined) continue
        await db
          .prepare('INSERT INTO process_step_translations (step_id, lang, text) VALUES (?, ?, ?)')
          .bind(row.id, lang, text)
          .run()
      }
      return { id: row.id, sort, texts: { ...texts } }
    },

    async updateStep(stepId, texts, sort) {
      const existing = await db.prepare('SELECT id FROM process_steps WHERE id = ?').bind(stepId).first<{ id: number }>()
      if (!existing) return null
      await db.prepare('UPDATE process_steps SET sort = ? WHERE id = ?').bind(sort, stepId).run()
      await db.prepare('DELETE FROM process_step_translations WHERE step_id = ?').bind(stepId).run()
      for (const lang of LANGS) {
        const text = texts[lang]
        if (text === undefined) continue
        await db
          .prepare('INSERT INTO process_step_translations (step_id, lang, text) VALUES (?, ?, ?)')
          .bind(stepId, lang, text)
          .run()
      }
      return { id: stepId, sort, texts: { ...texts } }
    },

    async deleteStep(stepId) {
      const res = await db.prepare('DELETE FROM process_steps WHERE id = ?').bind(stepId).run()
      return res.meta.changes > 0
    },

    async addMedia(productId, m) {
      const row = await db
        .prepare('INSERT INTO product_media (product_id, type, r2_key, kind, sort) VALUES (?, ?, ?, ?, ?) RETURNING id')
        .bind(productId, m.type, m.r2Key, m.kind, m.sort)
        .first<{ id: number }>()
      if (!row) throw new Error('failed to create media')
      return { id: row.id, type: m.type, r2Key: m.r2Key, kind: m.kind as ProductMediaItem['kind'], sort: m.sort }
    },

    async getMedia(mediaId) {
      const row = await db
        .prepare('SELECT id, product_id, type, r2_key, kind, sort FROM product_media WHERE id = ?')
        .bind(mediaId)
        .first<{ id: number; product_id: number; type: 'image' | 'video'; r2_key: string; kind: ProductMediaItem['kind']; sort: number }>()
      if (!row) return null
      return { id: row.id, productId: row.product_id, type: row.type, r2Key: row.r2_key, kind: row.kind, sort: row.sort }
    },

    async updateMedia(mediaId, patch) {
      const existing = await db
        .prepare('SELECT id, type, r2_key, kind, sort FROM product_media WHERE id = ?')
        .bind(mediaId)
        .first<{ id: number; type: 'image' | 'video'; r2_key: string; kind: ProductMediaItem['kind']; sort: number }>()
      if (!existing) return null
      const kind = patch.kind ?? existing.kind
      const sort = patch.sort ?? existing.sort
      await db.prepare('UPDATE product_media SET kind = ?, sort = ? WHERE id = ?').bind(kind, sort, mediaId).run()
      return { id: existing.id, type: existing.type, r2Key: existing.r2_key, kind: kind as ProductMediaItem['kind'], sort }
    },

    async deleteMedia(mediaId) {
      const res = await db.prepare('DELETE FROM product_media WHERE id = ?').bind(mediaId).run()
      return res.meta.changes > 0
    },
  }
}
