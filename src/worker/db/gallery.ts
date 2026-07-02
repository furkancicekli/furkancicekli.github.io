export interface GalleryItem {
  id: number
  r2Key: string
  sort: number
}

export interface GalleryStore {
  list(): Promise<GalleryItem[]> // sort ASC, id ASC
  create(r2Key: string, sort: number): Promise<GalleryItem>
  updateSort(id: number, sort: number): Promise<GalleryItem | null>
  delete(id: number): Promise<{ r2Key: string } | null> // deleted row's key, for R2 cleanup
}

export function d1GalleryStore(db: D1Database): GalleryStore {
  return {
    async list() {
      const { results } = await db
        .prepare('SELECT id, r2_key, sort FROM gallery_items ORDER BY sort ASC, id ASC')
        .all<{ id: number; r2_key: string; sort: number }>()
      return results.map((row) => ({ id: row.id, r2Key: row.r2_key, sort: row.sort }))
    },

    async create(r2Key, sort) {
      const row = await db
        .prepare('INSERT INTO gallery_items (r2_key, sort) VALUES (?, ?) RETURNING id, r2_key, sort')
        .bind(r2Key, sort)
        .first<{ id: number; r2_key: string; sort: number }>()
      if (!row) throw new Error('failed to create gallery item')
      return { id: row.id, r2Key: row.r2_key, sort: row.sort }
    },

    async updateSort(id, sort) {
      const row = await db
        .prepare('UPDATE gallery_items SET sort = ? WHERE id = ? RETURNING id, r2_key, sort')
        .bind(sort, id)
        .first<{ id: number; r2_key: string; sort: number }>()
      if (!row) return null
      return { id: row.id, r2Key: row.r2_key, sort: row.sort }
    },

    async delete(id) {
      const row = await db
        .prepare('DELETE FROM gallery_items WHERE id = ? RETURNING r2_key')
        .bind(id)
        .first<{ r2_key: string }>()
      if (!row) return null
      return { r2Key: row.r2_key }
    },
  }
}
