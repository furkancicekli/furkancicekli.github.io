export interface Material {
  id: number
  name: string
}

export interface MaterialStore {
  list(): Promise<Material[]> // name ASC, case-insensitive
  create(name: string): Promise<Material>
  findByName(name: string): Promise<Material | null> // case-insensitive
}

export function d1MaterialStore(db: D1Database): MaterialStore {
  return {
    async list() {
      const { results } = await db
        .prepare('SELECT id, name FROM materials ORDER BY name COLLATE NOCASE ASC')
        .all<{ id: number; name: string }>()
      return results.map((row) => ({ id: row.id, name: row.name }))
    },

    async create(name) {
      const row = await db
        .prepare('INSERT INTO materials (name) VALUES (?) RETURNING id, name')
        .bind(name)
        .first<{ id: number; name: string }>()
      if (!row) throw new Error('failed to create material')
      return { id: row.id, name: row.name }
    },

    async findByName(name) {
      const row = await db
        .prepare('SELECT id, name FROM materials WHERE name = ? COLLATE NOCASE')
        .bind(name)
        .first<{ id: number; name: string }>()
      if (!row) return null
      return { id: row.id, name: row.name }
    },
  }
}
