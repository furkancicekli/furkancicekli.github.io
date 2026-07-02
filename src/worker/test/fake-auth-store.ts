import type { AdminUser, AuthStore, SessionWithUser } from '../db/auth'

export function fakeAuthStore(): AuthStore & { users: AdminUser[]; sessions: Map<string, { userId: number; expiresAt: number }> } {
  const users: AdminUser[] = []
  const sessions = new Map<string, { userId: number; expiresAt: number }>()
  let nextId = 1
  return {
    users,
    sessions,
    async countUsers() {
      return users.length
    },
    async findUserByEmail(email) {
      return users.find((u) => u.email === email) ?? null
    },
    async createUser(email, passwordHash) {
      const user = { id: nextId++, email, passwordHash }
      users.push(user)
      return user
    },
    async updatePassword(userId, passwordHash) {
      const user = users.find((u) => u.id === userId)
      if (user) user.passwordHash = passwordHash
    },
    async createSession(id, userId, expiresAt) {
      sessions.set(id, { userId, expiresAt })
    },
    async findSessionWithUser(id): Promise<SessionWithUser | null> {
      const s = sessions.get(id)
      if (!s) return null
      const user = users.find((u) => u.id === s.userId)
      if (!user) return null
      return { userId: s.userId, email: user.email, expiresAt: s.expiresAt }
    },
    async deleteSession(id) {
      sessions.delete(id)
    },
  }
}
