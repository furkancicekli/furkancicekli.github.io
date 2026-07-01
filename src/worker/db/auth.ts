export type AdminUser = { id: number; email: string; passwordHash: string }
export type SessionWithUser = { userId: number; email: string; expiresAt: number }

export interface AuthStore {
  countUsers(): Promise<number>
  findUserByEmail(email: string): Promise<AdminUser | null>
  createUser(email: string, passwordHash: string): Promise<AdminUser>
  updatePassword(userId: number, passwordHash: string): Promise<void>
  createSession(id: string, userId: number, expiresAt: number): Promise<void>
  findSessionWithUser(id: string): Promise<SessionWithUser | null>
  deleteSession(id: string): Promise<void>
}

export function d1AuthStore(db: D1Database): AuthStore {
  return {
    async countUsers() {
      const row = await db.prepare('SELECT COUNT(*) AS n FROM admin_users').first<{ n: number }>()
      return row?.n ?? 0
    },
    async findUserByEmail(email) {
      const row = await db
        .prepare('SELECT id, email, password_hash FROM admin_users WHERE email = ?')
        .bind(email)
        .first<{ id: number; email: string; password_hash: string }>()
      return row ? { id: row.id, email: row.email, passwordHash: row.password_hash } : null
    },
    async createUser(email, passwordHash) {
      const row = await db
        .prepare('INSERT INTO admin_users (email, password_hash) VALUES (?, ?) RETURNING id, email, password_hash')
        .bind(email, passwordHash)
        .first<{ id: number; email: string; password_hash: string }>()
      if (!row) throw new Error('failed to create admin user')
      return { id: row.id, email: row.email, passwordHash: row.password_hash }
    },
    async updatePassword(userId, passwordHash) {
      await db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').bind(passwordHash, userId).run()
    },
    async createSession(id, userId, expiresAt) {
      await db
        .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
        .bind(id, userId, expiresAt)
        .run()
    },
    async findSessionWithUser(id) {
      const row = await db
        .prepare(
          `SELECT s.user_id AS user_id, u.email AS email, s.expires_at AS expires_at
           FROM sessions s JOIN admin_users u ON u.id = s.user_id WHERE s.id = ?`,
        )
        .bind(id)
        .first<{ user_id: number; email: string; expires_at: number }>()
      return row ? { userId: row.user_id, email: row.email, expiresAt: row.expires_at } : null
    },
    async deleteSession(id) {
      await db.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run()
    },
  }
}
