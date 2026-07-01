# Faz 2 — Admin Auth + Panel Kabuğu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** E-posta/şifre ile admin girişi, D1-tabanlı oturum (session cookie), korunan `/api/admin/*` API alanı ve React tarafında korumalı `/admin` panel kabuğu (login sayfası + dashboard + şifre değiştirme).

**Architecture:** Worker tarafında Hono sub-app'leri (`/api/auth/*` açık, `/api/admin/*` middleware-korumalı). Parola PBKDF2-SHA256 (WebCrypto) ile hash'lenir; oturumlar D1 `sessions` tablosunda opak rastgele ID ile tutulur, tarayıcıya HttpOnly cookie olarak verilir. İlk giriş "bootstrap" akışıyla çalışır: `admin_users` boşken `ADMIN_EMAIL`/`ADMIN_PASSWORD` env değerleriyle eşleşen giriş, kullanıcıyı oluşturur. DB erişimi ince bir `AuthStore` arayüzü arkasındadır; testler in-memory fake ile çalışır, üretim implementasyonu D1 SQL'dir.

**Tech Stack:** Hono 4 (`hono/cookie`), Cloudflare D1, WebCrypto (PBKDF2), Vitest (node env, mevcut düzen), React 19 + react-router-dom 7, Tailwind (mevcut shadcn token'ları), Playwright e2e.

## Global Constraints

- Migration'lar additive: `migrations/0001_init.sql` DEĞİŞTİRİLMEZ (şema zaten yeterli — yeni migration gerekmiyor).
- API yalnız `/api/*` altında; SPA fallback bozulmamalı (`wrangler.jsonc`'a dokunma).
- Rezerve secret isimleri aynen kullanılır: `ADMIN_EMAIL`, `ADMIN_PASSWORD`. (`SESSION_SECRET` bu tasarımda GEREKMEZ — oturumlar sunucu tarafında saklandığı için imzalı cookie yok; spec'e not düşülür, secret oluşturulmaz. YAGNI.)
- Worker testleri mevcut düzeni izler: vitest `environment: 'node'`, `src/**/*.test.ts`, `app.request()` ile; `@cloudflare/vitest-pool-workers` EKLENMEZ.
- Yeni npm bağımlılığı EKLENMEZ (her şey Hono + WebCrypto + mevcut paketlerle).
- Admin UI dili Türkçe, statik etiketler (i18n'e bağlanmaz — admin tek kişi, Faz 3'te gerekirse genişler).
- Admin UI mevcut tasarım token'larını kullanır (`bg-background`, `text-foreground`, `border-border`, `bg-primary` vb.); public `Layout` bileşeni admin sayfalarını SARMAZ.
- Commit mesajları mevcut stille uyumlu: `feat(auth): ...`, `feat(admin): ...`, `test(auth): ...`.
- Her task sonunda `npm run test` ve `npm run build` yeşil olmalı.

## Dosya Haritası

```
src/worker/
  lib/password.ts          # PBKDF2 hash + verify (yeni)
  lib/password.test.ts     # (yeni)
  lib/session.ts           # session id üretimi + cookie sabitleri (yeni)
  db/auth.ts               # AuthStore arayüzü + d1AuthStore implementasyonu (yeni)
  test/fake-auth-store.ts  # in-memory AuthStore (yeni, sadece test)
  routes/auth.ts           # POST /login, POST /logout, GET /me (yeni)
  routes/auth.test.ts      # (yeni)
  routes/admin.ts          # GET /me yok; POST /password + requireAuth'lu alan (yeni)
  routes/admin.test.ts     # (yeni)
  middleware/require-auth.ts # oturum doğrulama middleware (yeni)
  index.ts                 # store middleware + route montajı (değişir)
src/pages/admin/
  api.ts                   # fetch sarmalayıcıları (yeni)
  AdminLoginPage.tsx       # (yeni)
  AdminLayout.tsx          # auth guard + kabuk (yeni)
  AdminDashboardPage.tsx   # placeholder + şifre değiştirme kartı (yeni)
  index.ts                 # barrel (yeni)
src/App.tsx                # /admin route'ları (değişir)
tests/e2e/admin-auth.spec.ts # login sayfası smoke (yeni)
.dev.vars.example          # lokal env şablonu (yeni)
.gitignore                 # .dev.vars eklenir (değişir)
```

---

### Task 1: Parola hash/verify kütüphanesi (PBKDF2)

**Files:**
- Create: `src/worker/lib/password.ts`
- Test: `src/worker/lib/password.test.ts`

**Interfaces:**
- Produces: `hashPassword(password: string): Promise<string>` — `pbkdf2$<iterations>$<saltB64>$<hashB64>` formatında string döner. `verifyPassword(password: string, stored: string): Promise<boolean>`.

- [ ] **Step 1: Failing test yaz**

```ts
// src/worker/lib/password.test.ts
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password', () => {
  it('hashes and verifies a correct password', async () => {
    const stored = await hashPassword('s3cret-pass')
    expect(stored.startsWith('pbkdf2$')).toBe(true)
    expect(await verifyPassword('s3cret-pass', stored)).toBe(true)
  })

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('s3cret-pass')
    expect(await verifyPassword('wrong', stored)).toBe(false)
  })

  it('produces unique salts per hash', async () => {
    const a = await hashPassword('same')
    const b = await hashPassword('same')
    expect(a).not.toBe(b)
  })

  it('rejects malformed stored values without throwing', async () => {
    expect(await verifyPassword('x', 'garbage')).toBe(false)
    expect(await verifyPassword('x', 'pbkdf2$abc$!!$!!')).toBe(false)
  })
})
```

- [ ] **Step 2: Testin FAIL ettiğini doğrula**

Çalıştır: `npx vitest run src/worker/lib/password.test.ts`
Beklenen: FAIL — "Cannot find module './password'" benzeri hata.

- [ ] **Step 3: Implementasyonu yaz**

```ts
// src/worker/lib/password.ts
const ITERATIONS = 100_000

function toB64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0))
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  )
  return new Uint8Array(bits)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(password, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  if (!Number.isInteger(iterations) || iterations < 1) return false
  let salt: Uint8Array, expected: Uint8Array
  try {
    salt = fromB64(parts[2])
    expected = fromB64(parts[3])
  } catch {
    return false
  }
  const actual = await derive(password, salt, iterations)
  if (actual.length !== expected.length) return false
  // sabit-zamanlı karşılaştırma
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i]
  return diff === 0
}
```

- [ ] **Step 4: Testin PASS ettiğini doğrula**

Çalıştır: `npx vitest run src/worker/lib/password.test.ts`
Beklenen: 4 test PASS.

- [ ] **Step 5: Commit**

```bash
git add src/worker/lib/password.ts src/worker/lib/password.test.ts
git commit -m "feat(auth): PBKDF2 password hashing for Workers (WebCrypto)"
```

---

### Task 2: AuthStore arayüzü, D1 implementasyonu ve test fake'i

**Files:**
- Create: `src/worker/db/auth.ts`
- Create: `src/worker/test/fake-auth-store.ts`

**Interfaces:**
- Produces (sonraki task'lar bunlara güvenir):

```ts
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

export function d1AuthStore(db: D1Database): AuthStore
```

- `FakeAuthStore` aynı arayüzü in-memory implemente eder; testlerde kullanılacak. Not: D1 implementasyonu ince SQL olduğundan birim testi fake üzerinden yapılır; D1 SQL'i lokal dev + e2e'de doğrulanır (mevcut projede vitest-pool-workers yok — Global Constraints).

- [ ] **Step 1: `src/worker/db/auth.ts` yaz** (test yok — davranış Task 3'te route testleriyle kapsanır; arayüz + ince SQL)

```ts
// src/worker/db/auth.ts
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
```

- [ ] **Step 2: `src/worker/test/fake-auth-store.ts` yaz**

```ts
// src/worker/test/fake-auth-store.ts
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
```

- [ ] **Step 3: Derlemenin geçtiğini doğrula**

Çalıştır: `npx tsc -b`
Beklenen: hatasız çıkış. (`src/worker/test/` yalnız `tsconfig.worker.json` kapsamındadır — `include: ["src/worker"]` bunu zaten kapsar.)

- [ ] **Step 4: Commit**

```bash
git add src/worker/db/auth.ts src/worker/test/fake-auth-store.ts
git commit -m "feat(auth): AuthStore interface with D1 implementation and test fake"
```

---

### Task 3: Auth route'ları — login (bootstrap'lı), logout, me

**Files:**
- Create: `src/worker/lib/session.ts`
- Create: `src/worker/routes/auth.ts`
- Test: `src/worker/routes/auth.test.ts`

**Interfaces:**
- Consumes: `AuthStore` (Task 2), `hashPassword`/`verifyPassword` (Task 1).
- Produces:
  - `src/worker/lib/session.ts`: `newSessionId(): string` (32-byte base64url), `SESSION_COOKIE = 'sid'`, `SESSION_TTL_SECONDS = 60 * 60 * 24 * 7`, `sessionCookieOptions(maxAge: number)` → `{ httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge }`.
  - `src/worker/routes/auth.ts`: `authRoutes` — `Hono<AuthEnv>` sub-app. Route'lar (mount edilince `/api/auth/*`): `POST /login`, `POST /logout`, `GET /me`.
  - `AuthEnv` tipi (admin routes da kullanır — buradan export edilir):

```ts
export type AuthEnv = {
  Bindings: { ADMIN_EMAIL?: string; ADMIN_PASSWORD?: string }
  Variables: { store: AuthStore; user?: { id: number; email: string } }
}
```

**Davranış sözleşmesi:**
- `POST /login` gövde `{ email, password }`. Eksik/boş alan → 400 `{ error: 'invalid_request' }`. E-posta `trim().toLowerCase()` normalize edilir.
- Kullanıcı yoksa VE `countUsers() === 0` VE env `ADMIN_EMAIL`/`ADMIN_PASSWORD` tanımlı VE normalize e-posta `ADMIN_EMAIL.trim().toLowerCase()` ile, şifre `ADMIN_PASSWORD` ile birebir eşleşiyorsa → kullanıcı oluşturulur (bootstrap) ve giriş devam eder.
- Geçersiz kimlik → 401 `{ error: 'invalid_credentials' }` (kullanıcı-yok ile şifre-yanlış ayırt edilmez).
- Başarı → session yaratılır (`expiresAt = nowSeconds + SESSION_TTL_SECONDS`), `sid` cookie set edilir, 200 `{ email }`.
- `GET /me`: cookie yok/oturum yok → 401. Süresi dolmuşsa oturum silinir → 401. Geçerliyse 200 `{ email }`.
- `POST /logout`: oturum silinir, cookie temizlenir, 200 `{ ok: true }`.

- [ ] **Step 1: Failing testleri yaz**

```ts
// src/worker/routes/auth.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { authRoutes, type AuthEnv } from './auth'
import { fakeAuthStore } from '../test/fake-auth-store'
import { hashPassword } from '../lib/password'

const ENV = { ADMIN_EMAIL: 'admin@example.com', ADMIN_PASSWORD: 'boot-pass-123' }

function makeApp(store: ReturnType<typeof fakeAuthStore>) {
  const app = new Hono<AuthEnv>()
  app.use('*', async (c, next) => {
    c.set('store', store)
    await next()
  })
  app.route('/api/auth', authRoutes)
  return app
}

function login(app: Hono<AuthEnv>, body: unknown) {
  return app.request(
    '/api/auth/login',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    ENV,
  )
}

describe('auth routes', () => {
  let store: ReturnType<typeof fakeAuthStore>
  let app: Hono<AuthEnv>

  beforeEach(() => {
    store = fakeAuthStore()
    app = makeApp(store)
  })

  it('rejects missing fields with 400', async () => {
    const res = await login(app, { email: 'a@b.c' })
    expect(res.status).toBe(400)
  })

  it('bootstraps first admin from env credentials and sets session cookie', async () => {
    const res = await login(app, { email: 'Admin@Example.com ', password: 'boot-pass-123' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ email: 'admin@example.com' })
    expect(res.headers.get('set-cookie')).toMatch(/sid=.+HttpOnly/i)
    expect(store.users).toHaveLength(1)
  })

  it('rejects bootstrap with wrong env password', async () => {
    const res = await login(app, { email: 'admin@example.com', password: 'nope' })
    expect(res.status).toBe(401)
    expect(store.users).toHaveLength(0)
  })

  it('does not bootstrap when a user already exists', async () => {
    await store.createUser('other@example.com', await hashPassword('pw'))
    const res = await login(app, { email: 'admin@example.com', password: 'boot-pass-123' })
    expect(res.status).toBe(401)
  })

  it('logs in an existing user with hashed password', async () => {
    await store.createUser('admin@example.com', await hashPassword('real-pass'))
    const res = await login(app, { email: 'admin@example.com', password: 'real-pass' })
    expect(res.status).toBe(200)
  })

  it('rejects wrong password for existing user', async () => {
    await store.createUser('admin@example.com', await hashPassword('real-pass'))
    const res = await login(app, { email: 'admin@example.com', password: 'wrong' })
    expect(res.status).toBe(401)
  })

  it('GET /me returns 401 without a session and 200 with one', async () => {
    expect((await app.request('/api/auth/me', {}, ENV)).status).toBe(401)

    const loginRes = await login(app, { email: 'admin@example.com', password: 'boot-pass-123' })
    const cookie = loginRes.headers.get('set-cookie')!.split(';')[0]
    const meRes = await app.request('/api/auth/me', { headers: { cookie } }, ENV)
    expect(meRes.status).toBe(200)
    expect(await meRes.json()).toEqual({ email: 'admin@example.com' })
  })

  it('GET /me rejects and deletes an expired session', async () => {
    const loginRes = await login(app, { email: 'admin@example.com', password: 'boot-pass-123' })
    const cookie = loginRes.headers.get('set-cookie')!.split(';')[0]
    const sid = cookie.split('=')[1]
    store.sessions.set(sid, { userId: 1, expiresAt: Math.floor(Date.now() / 1000) - 10 })
    const meRes = await app.request('/api/auth/me', { headers: { cookie } }, ENV)
    expect(meRes.status).toBe(401)
    expect(store.sessions.has(sid)).toBe(false)
  })

  it('POST /logout deletes the session', async () => {
    const loginRes = await login(app, { email: 'admin@example.com', password: 'boot-pass-123' })
    const cookie = loginRes.headers.get('set-cookie')!.split(';')[0]
    const res = await app.request('/api/auth/logout', { method: 'POST', headers: { cookie } }, ENV)
    expect(res.status).toBe(200)
    expect(store.sessions.size).toBe(0)
    const meRes = await app.request('/api/auth/me', { headers: { cookie } }, ENV)
    expect(meRes.status).toBe(401)
  })
})
```

- [ ] **Step 2: Testlerin FAIL ettiğini doğrula**

Çalıştır: `npx vitest run src/worker/routes/auth.test.ts`
Beklenen: FAIL — `./auth` modülü yok.

- [ ] **Step 3: `src/worker/lib/session.ts` yaz**

```ts
// src/worker/lib/session.ts
export const SESSION_COOKIE = 'sid'
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 gün

export function newSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export function sessionCookieOptions(maxAge: number) {
  return { httpOnly: true, secure: true, sameSite: 'Lax' as const, path: '/', maxAge }
}
```

- [ ] **Step 4: `src/worker/routes/auth.ts` yaz**

```ts
// src/worker/routes/auth.ts
import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { AuthStore } from '../db/auth'
import { hashPassword, verifyPassword } from '../lib/password'
import { SESSION_COOKIE, SESSION_TTL_SECONDS, newSessionId, sessionCookieOptions } from '../lib/session'

export type AuthEnv = {
  Bindings: { ADMIN_EMAIL?: string; ADMIN_PASSWORD?: string }
  Variables: { store: AuthStore; user?: { id: number; email: string } }
}

export const authRoutes = new Hono<AuthEnv>()

authRoutes.post('/login', async (c) => {
  let body: { email?: unknown; password?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_request' }, 400)
  }
  if (typeof body.email !== 'string' || typeof body.password !== 'string' || !body.email.trim() || !body.password) {
    return c.json({ error: 'invalid_request' }, 400)
  }
  const email = body.email.trim().toLowerCase()
  const password = body.password
  const store = c.get('store')

  let user = await store.findUserByEmail(email)

  if (!user) {
    // Bootstrap: hiç admin yokken env kimlik bilgileriyle ilk kullanıcı oluşturulur
    const { ADMIN_EMAIL, ADMIN_PASSWORD } = c.env
    const canBootstrap =
      (await store.countUsers()) === 0 &&
      !!ADMIN_EMAIL &&
      !!ADMIN_PASSWORD &&
      email === ADMIN_EMAIL.trim().toLowerCase() &&
      password === ADMIN_PASSWORD
    if (!canBootstrap) return c.json({ error: 'invalid_credentials' }, 401)
    user = await store.createUser(email, await hashPassword(password))
  } else if (!(await verifyPassword(password, user.passwordHash))) {
    return c.json({ error: 'invalid_credentials' }, 401)
  }

  const sid = newSessionId()
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  await store.createSession(sid, user.id, expiresAt)
  setCookie(c, SESSION_COOKIE, sid, sessionCookieOptions(SESSION_TTL_SECONDS))
  return c.json({ email: user.email })
})

authRoutes.get('/me', async (c) => {
  const sid = getCookie(c, SESSION_COOKIE)
  if (!sid) return c.json({ error: 'unauthorized' }, 401)
  const store = c.get('store')
  const session = await store.findSessionWithUser(sid)
  if (!session) return c.json({ error: 'unauthorized' }, 401)
  if (session.expiresAt <= Math.floor(Date.now() / 1000)) {
    await store.deleteSession(sid)
    return c.json({ error: 'unauthorized' }, 401)
  }
  return c.json({ email: session.email })
})

authRoutes.post('/logout', async (c) => {
  const sid = getCookie(c, SESSION_COOKIE)
  if (sid) await c.get('store').deleteSession(sid)
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
  return c.json({ ok: true })
})
```

- [ ] **Step 5: Testlerin PASS ettiğini doğrula**

Çalıştır: `npx vitest run src/worker/routes/auth.test.ts`
Beklenen: 9 test PASS.

- [ ] **Step 6: Commit**

```bash
git add src/worker/lib/session.ts src/worker/routes/auth.ts src/worker/routes/auth.test.ts
git commit -m "feat(auth): login with env bootstrap, session cookie, me/logout endpoints"
```

---

### Task 4: requireAuth middleware + korumalı /api/admin alanı + şifre değiştirme

**Files:**
- Create: `src/worker/middleware/require-auth.ts`
- Create: `src/worker/routes/admin.ts`
- Test: `src/worker/routes/admin.test.ts`

**Interfaces:**
- Consumes: `AuthEnv` (Task 3), `AuthStore` (Task 2), `hashPassword`/`verifyPassword` (Task 1), `SESSION_COOKIE` (Task 3).
- Produces:
  - `requireAuth`: `MiddlewareHandler<AuthEnv>` — geçerli oturum yoksa 401 döner; varsa `c.set('user', { id, email })` yapar.
  - `adminRoutes`: `Hono<AuthEnv>` — mount edilince `/api/admin/*`. `POST /password` gövde `{ currentPassword, newPassword }`: mevcut şifre yanlış → 401 `{ error: 'invalid_credentials' }`; `newPassword` 8 karakterden kısa → 400 `{ error: 'password_too_short' }`; başarı → 200 `{ ok: true }`.

- [ ] **Step 1: Failing testleri yaz**

```ts
// src/worker/routes/admin.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { adminRoutes } from './admin'
import { requireAuth } from '../middleware/require-auth'
import type { AuthEnv } from './auth'
import { fakeAuthStore } from '../test/fake-auth-store'
import { hashPassword, verifyPassword } from '../lib/password'

describe('admin routes', () => {
  let store: ReturnType<typeof fakeAuthStore>
  let app: Hono<AuthEnv>
  const cookie = 'sid=test-session'

  beforeEach(async () => {
    store = fakeAuthStore()
    const user = await store.createUser('admin@example.com', await hashPassword('old-pass-123'))
    await store.createSession('test-session', user.id, Math.floor(Date.now() / 1000) + 3600)
    app = new Hono<AuthEnv>()
    app.use('*', async (c, next) => {
      c.set('store', store)
      await next()
    })
    app.use('/api/admin/*', requireAuth)
    app.route('/api/admin', adminRoutes)
  })

  it('blocks unauthenticated access to /api/admin/*', async () => {
    const res = await app.request('/api/admin/password', { method: 'POST' })
    expect(res.status).toBe(401)
  })

  it('changes password with correct current password', async () => {
    const res = await app.request('/api/admin/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ currentPassword: 'old-pass-123', newPassword: 'new-pass-456' }),
    })
    expect(res.status).toBe(200)
    expect(await verifyPassword('new-pass-456', store.users[0].passwordHash)).toBe(true)
  })

  it('rejects wrong current password', async () => {
    const res = await app.request('/api/admin/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ currentPassword: 'wrong', newPassword: 'new-pass-456' }),
    })
    expect(res.status).toBe(401)
    expect(await verifyPassword('old-pass-123', store.users[0].passwordHash)).toBe(true)
  })

  it('rejects too-short new password', async () => {
    const res = await app.request('/api/admin/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ currentPassword: 'old-pass-123', newPassword: 'short' }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects an expired session', async () => {
    store.sessions.set('test-session', { userId: 1, expiresAt: Math.floor(Date.now() / 1000) - 10 })
    const res = await app.request('/api/admin/password', { method: 'POST', headers: { cookie } })
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Testlerin FAIL ettiğini doğrula**

Çalıştır: `npx vitest run src/worker/routes/admin.test.ts`
Beklenen: FAIL — modüller yok.

- [ ] **Step 3: `src/worker/middleware/require-auth.ts` yaz**

```ts
// src/worker/middleware/require-auth.ts
import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import type { AuthEnv } from '../routes/auth'
import { SESSION_COOKIE } from '../lib/session'

export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const sid = getCookie(c, SESSION_COOKIE)
  if (!sid) return c.json({ error: 'unauthorized' }, 401)
  const store = c.get('store')
  const session = await store.findSessionWithUser(sid)
  if (!session || session.expiresAt <= Math.floor(Date.now() / 1000)) {
    if (session) await store.deleteSession(sid)
    return c.json({ error: 'unauthorized' }, 401)
  }
  c.set('user', { id: session.userId, email: session.email })
  await next()
}
```

- [ ] **Step 4: `src/worker/routes/admin.ts` yaz**

```ts
// src/worker/routes/admin.ts
import { Hono } from 'hono'
import type { AuthEnv } from './auth'
import { hashPassword, verifyPassword } from '../lib/password'

export const adminRoutes = new Hono<AuthEnv>()

adminRoutes.post('/password', async (c) => {
  let body: { currentPassword?: unknown; newPassword?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_request' }, 400)
  }
  if (typeof body.currentPassword !== 'string' || typeof body.newPassword !== 'string') {
    return c.json({ error: 'invalid_request' }, 400)
  }
  if (body.newPassword.length < 8) return c.json({ error: 'password_too_short' }, 400)

  const store = c.get('store')
  const user = c.get('user')! // requireAuth garantiler
  const dbUser = await store.findUserByEmail(user.email)
  if (!dbUser || !(await verifyPassword(body.currentPassword, dbUser.passwordHash))) {
    return c.json({ error: 'invalid_credentials' }, 401)
  }
  await store.updatePassword(dbUser.id, await hashPassword(body.newPassword))
  return c.json({ ok: true })
})
```

- [ ] **Step 5: Testlerin PASS ettiğini doğrula**

Çalıştır: `npx vitest run src/worker/routes/admin.test.ts`
Beklenen: 5 test PASS.

- [ ] **Step 6: Commit**

```bash
git add src/worker/middleware/require-auth.ts src/worker/routes/admin.ts src/worker/routes/admin.test.ts
git commit -m "feat(auth): requireAuth middleware and protected admin password change"
```

---

### Task 5: Worker index montajı + lokal env dosyaları

**Files:**
- Modify: `src/worker/index.ts` (tamamı aşağıda)
- Create: `.dev.vars.example`
- Modify: `.gitignore` (`.dev.vars` satırı eklenir)
- Test: mevcut `src/worker/index.test.ts` genişletilir

**Interfaces:**
- Consumes: `authRoutes`, `adminRoutes`, `requireAuth`, `d1AuthStore`.
- Produces: canlı endpoint'ler — `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, `POST /api/admin/password`. `Bindings` tipi `ADMIN_EMAIL?/ADMIN_PASSWORD?` içerir.

- [ ] **Step 1: index.test.ts'e failing test ekle** (dosyanın tam yeni hali)

```ts
// src/worker/index.test.ts
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
```

> Not: İki yeni test bilinçli olarak DB'ye dokunmayan kod yollarını kullanır (400 gövde doğrulaması, cookie'siz 401) — böylece node ortamında gerçek D1 gerekmez.

- [ ] **Step 2: Testin FAIL ettiğini doğrula**

Çalıştır: `npx vitest run src/worker/index.test.ts`
Beklenen: yeni 2 test FAIL (404 dönüyor), health PASS.

- [ ] **Step 3: `src/worker/index.ts`'i güncelle** (dosyanın tam yeni hali)

```ts
// src/worker/index.ts
import { Hono } from 'hono'
import { d1AuthStore } from './db/auth'
import type { AuthStore } from './db/auth'
import { authRoutes } from './routes/auth'
import { adminRoutes } from './routes/admin'
import { requireAuth } from './middleware/require-auth'

export type Bindings = {
  ASSETS: Fetcher
  DB: D1Database
  MEDIA: R2Bucket
  ADMIN_EMAIL?: string
  ADMIN_PASSWORD?: string
}

type Env = { Bindings: Bindings; Variables: { store: AuthStore; user?: { id: number; email: string } } }

const app = new Hono<Env>()

app.get('/api/health', (c) => c.json({ status: 'ok' }))

app.use('/api/auth/*', async (c, next) => {
  c.set('store', d1AuthStore(c.env.DB))
  await next()
})
app.use('/api/admin/*', async (c, next) => {
  c.set('store', d1AuthStore(c.env.DB))
  await next()
})
app.route('/api/auth', authRoutes)
app.use('/api/admin/*', requireAuth)
app.route('/api/admin', adminRoutes)

export default app
```

> Dikkat: `app.request('/api/admin/password', ...)` testinde `c.env.DB` undefined olur ama store middleware'i sadece `d1AuthStore(undefined)` nesnesi kurar, sorgu çalıştırmaz; `requireAuth` cookie yokken store'a dokunmadan 401 döner. `login` 400 yolu da `c.req.json()` doğrulamasında döner.

- [ ] **Step 4: `.dev.vars.example` oluştur**

```
# Lokal geliştirme için kopyala: cp .dev.vars.example .dev.vars
# İlk girişte admin_users boşsa bu kimlikle admin kullanıcısı otomatik oluşturulur (bootstrap).
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-locally
```

- [ ] **Step 5: `.gitignore`'a ekle**

`.gitignore` dosyasına şu satırı ekle (dosya sonuna):

```
.dev.vars
```

- [ ] **Step 6: Tüm testler + build doğrula**

Çalıştır: `npm run test && npm run build`
Beklenen: tüm vitest testleri PASS; `tsc -b` + vite build hatasız.

- [ ] **Step 7: Commit**

```bash
git add src/worker/index.ts src/worker/index.test.ts .dev.vars.example .gitignore
git commit -m "feat(auth): mount auth/admin routes in worker; add .dev.vars example"
```

---

### Task 6: Admin API istemcisi + login sayfası (React)

**Files:**
- Create: `src/pages/admin/api.ts`
- Create: `src/pages/admin/AdminLoginPage.tsx`
- Create: `src/pages/admin/index.ts` (barrel — Task 7'de genişler)

**Interfaces:**
- Produces (`src/pages/admin/api.ts`):

```ts
export async function login(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }>
export async function logout(): Promise<void>
export async function fetchMe(): Promise<{ email: string } | null>
export async function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: true } | { ok: false; error: string }>
```

- `AdminLoginPage`: `/admin/login` — form, hata mesajı, başarıda `navigate('/admin')`.

- [ ] **Step 1: `src/pages/admin/api.ts` yaz**

```ts
// src/pages/admin/api.ts
async function post(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  })
}

export async function login(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await post('/api/auth/login', { email, password })
  if (res.ok) return { ok: true }
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  return { ok: false, error: data.error ?? 'unknown' }
}

export async function logout(): Promise<void> {
  await post('/api/auth/logout', {})
}

export async function fetchMe(): Promise<{ email: string } | null> {
  const res = await fetch('/api/auth/me', { credentials: 'same-origin' })
  if (!res.ok) return null
  return (await res.json()) as { email: string }
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await post('/api/admin/password', { currentPassword, newPassword })
  if (res.ok) return { ok: true }
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  return { ok: false, error: data.error ?? 'unknown' }
}
```

- [ ] **Step 2: `src/pages/admin/AdminLoginPage.tsx` yaz**

```tsx
// src/pages/admin/AdminLoginPage.tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from './api'

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-posta veya şifre hatalı.',
  invalid_request: 'E-posta ve şifre gerekli.',
  unknown: 'Bir hata oluştu. Tekrar deneyin.',
}

export function AdminLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await login(email, password)
    setBusy(false)
    if (result.ok) {
      navigate('/admin', { replace: true })
    } else {
      setError(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.unknown)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">Yönetici Girişi</h1>
        <label className="block space-y-1">
          <span className="text-sm text-muted-foreground">E-posta</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-muted-foreground">Şifre</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? 'Giriş yapılıyor…' : 'Giriş Yap'}
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: `src/pages/admin/index.ts` barrel oluştur**

```ts
// src/pages/admin/index.ts
export { AdminLoginPage } from './AdminLoginPage'
```

- [ ] **Step 4: Build doğrula**

Çalıştır: `npm run build`
Beklenen: hatasız. (Sayfa henüz route'a bağlı değil — Task 7'de bağlanır; build yine de derlemeli.)

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/api.ts src/pages/admin/AdminLoginPage.tsx src/pages/admin/index.ts
git commit -m "feat(admin): auth API client and admin login page"
```

---

### Task 7: AdminLayout (guard) + dashboard kabuğu + route montajı

**Files:**
- Create: `src/pages/admin/AdminLayout.tsx`
- Create: `src/pages/admin/AdminDashboardPage.tsx`
- Modify: `src/pages/admin/index.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `fetchMe`, `logout`, `changePassword` (Task 6).
- Produces: `/admin/login` (açık), `/admin` (korumalı — `AdminLayout` `fetchMe()` null dönerse `/admin/login`'e yönlendirir). Public sayfalar mevcut `Layout` içinde kalır; admin sayfaları `Layout`/`LoadingScreen` dışındadır (LoadingScreen yalnız public deneyim için — admin'de gösterilmez, bkz. App.tsx'te path kontrolü).

- [ ] **Step 1: `src/pages/admin/AdminLayout.tsx` yaz**

```tsx
// src/pages/admin/AdminLayout.tsx
import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { fetchMe, logout } from './api'

export function AdminLayout() {
  const navigate = useNavigate()
  const [email, setEmail] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchMe().then((me) => {
      if (cancelled) return
      if (!me) {
        navigate('/admin/login', { replace: true })
      } else {
        setEmail(me.email)
        setChecking(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [navigate])

  async function handleLogout() {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Yükleniyor…
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <h1 className="text-sm font-semibold tracking-wide">Yönetim Paneli</h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{email}</span>
            <button onClick={handleLogout} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
              Çıkış
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: `src/pages/admin/AdminDashboardPage.tsx` yaz**

```tsx
// src/pages/admin/AdminDashboardPage.tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import { changePassword } from './api'

const PASSWORD_ERRORS: Record<string, string> = {
  invalid_credentials: 'Mevcut şifre hatalı.',
  password_too_short: 'Yeni şifre en az 8 karakter olmalı.',
  unknown: 'Bir hata oluştu. Tekrar deneyin.',
}

const UPCOMING = [
  { title: 'Ürünler', note: 'Faz 3 — ürün, foto/video, hammadde yönetimi' },
  { title: 'Süreç & Hikaye', note: 'Faz 3 — yapım süreci adımları' },
  { title: 'SSS', note: 'Faz 3 — soru/cevap yönetimi' },
  { title: 'Sertifikalar', note: 'Faz 5 — sertifika + QR üretimi' },
]

export function AdminDashboardPage() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const result = await changePassword(current, next)
    setBusy(false)
    if (result.ok) {
      setMessage({ kind: 'ok', text: 'Şifre güncellendi.' })
      setCurrent('')
      setNext('')
    } else {
      setMessage({ kind: 'error', text: PASSWORD_ERRORS[result.error] ?? PASSWORD_ERRORS.unknown })
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-lg font-semibold">Genel Bakış</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {UPCOMING.map((item) => (
            <div key={item.title} className="rounded-lg border border-dashed border-border p-4">
              <h3 className="font-medium">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-sm">
        <h2 className="mb-4 text-lg font-semibold">Şifre Değiştir</h2>
        <form onSubmit={handlePasswordChange} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">Mevcut şifre</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">Yeni şifre (en az 8 karakter)</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          {message && (
            <p role="alert" className={`text-sm ${message.kind === 'ok' ? 'text-green-600' : 'text-red-500'}`}>
              {message.text}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? 'Kaydediliyor…' : 'Güncelle'}
          </button>
        </form>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Barrel'ı güncelle**

```ts
// src/pages/admin/index.ts
export { AdminLoginPage } from './AdminLoginPage'
export { AdminLayout } from './AdminLayout'
export { AdminDashboardPage } from './AdminDashboardPage'
```

- [ ] **Step 4: `src/App.tsx`'i güncelle** (dosyanın tam yeni hali)

```tsx
import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import { Layout } from '@/components/layout'
import { HomePage, GalleryPage } from '@/pages'
import { AdminLoginPage, AdminLayout, AdminDashboardPage } from '@/pages/admin'
import { LoadingScreen } from '@/components/ui'
import '@/i18n'

// Public sayfalar mevcut site kabuğu (nav + footer) içinde render edilir
function PublicShell() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

function App() {
  // Admin rotalarında intro animasyonu gösterilmez — panel doğrudan açılır
  const isAdminRoute = window.location.pathname.startsWith('/admin')
  const [visible, setVisible] = useState(!isAdminRoute)

  useEffect(() => {
    // Remove the inline #app-loader after React's first commit so the React
    // <LoadingScreen> (fixed inset-0 z-[100]) is guaranteed painted before the
    // inline twin disappears, eliminating any one-frame content flash.
    document.getElementById('app-loader')?.remove()
  }, [])

  return (
    <>
      <AnimatePresence>
        {/* The loading screen's grow+fade animation drives its own removal via onComplete. */}
        {visible && <LoadingScreen key="loading" onComplete={() => setVisible(false)} />}
      </AnimatePresence>

      {/* Router mounts immediately underneath — content is ready when overlay fades */}
      <BrowserRouter>
        <Routes>
          <Route element={<PublicShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/gallery" element={<GalleryPage />} />
          </Route>
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
```

- [ ] **Step 5: Build + testler doğrula**

Çalıştır: `npm run test && npm run build`
Beklenen: hepsi PASS, build hatasız.

- [ ] **Step 6: Lokal smoke (manuel, hızlı)**

```bash
cp .dev.vars.example .dev.vars   # yoksa
npm run db:migrate:local          # migration lokal D1'e uygulanmadıysa
npm run dev
```

Tarayıcıda `http://localhost:5173/admin` → login'e yönlenmeli; `.dev.vars`'taki kimlikle giriş → dashboard açılmalı; Çıkış → login'e dönmeli. Doğrulanınca dev server'ı kapat.

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/ src/App.tsx
git commit -m "feat(admin): protected admin shell with dashboard and password change"
```

---

### Task 8: E2E smoke testi + son doğrulama

**Files:**
- Create: `tests/e2e/admin-auth.spec.ts`

**Interfaces:**
- Consumes: `/admin/login` sayfası, `/api/auth/login` endpoint'i (yanlış kimlikte 401).
- Not: Playwright `webServer: npm run dev` (Vite + Miniflare) kullanır — Worker ve lokal D1 canlıdır. Test bilinçli olarak yalnız *yanlış kimlik* akışını doğrular; gerçek giriş `.dev.vars` içeriğine bağımlı olurdu (CI'da yok — kırılgan olur).

- [ ] **Step 1: E2E testi yaz**

```ts
// tests/e2e/admin-auth.spec.ts
import { test, expect } from '@playwright/test'

test.describe('admin auth', () => {
  test('unauthenticated /admin redirects to login', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login$/)
    await expect(page.getByRole('heading', { name: 'Yönetici Girişi' })).toBeVisible()
  })

  test('wrong credentials show an error message', async ({ page }) => {
    await page.goto('/admin/login')
    await page.getByLabel('E-posta').fill('nobody@example.com')
    await page.getByLabel('Şifre').fill('wrong-password')
    await page.getByRole('button', { name: 'Giriş Yap' }).click()
    await expect(page.getByRole('alert')).toHaveText('E-posta veya şifre hatalı.')
    await expect(page).toHaveURL(/\/admin\/login$/)
  })
})
```

> `getByLabel` çalışır çünkü login formunda input'lar `<label>` içine sarılıdır.
> Ön koşul: lokal D1'e migration uygulanmış olmalı (`npm run db:migrate:local`) — yoksa login sorgusu 500 döner.

- [ ] **Step 2: E2E çalıştır**

Çalıştır: `npm run db:migrate:local && npx playwright test tests/e2e/admin-auth.spec.ts`
Beklenen: 2 test PASS.

- [ ] **Step 3: Tam doğrulama**

Çalıştır: `npm run test && npm run build && npm run lint`
Beklenen: hepsi temiz.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/admin-auth.spec.ts
git commit -m "test(admin): e2e smoke for login redirect and invalid credentials"
```

---

## Deploy Sonrası (kod dışı, tek seferlik — kullanıcıya hatırlatılır)

Üretimde bootstrap'ın çalışması için secret'lar bir kez tanımlanmalı:

```bash
npx wrangler secret put ADMIN_EMAIL     # gerçek admin e-postası
npx wrangler secret put ADMIN_PASSWORD  # güçlü geçici şifre; ilk girişten sonra panelden değiştirilir
```

Secret'lar deploy'lar arasında kalıcıdır; CI'da ekstra adım gerekmez. İlk üretim girişi kullanıcıyı `admin_users`'a yazar; sonrasında `ADMIN_PASSWORD` secret'ı isteğe bağlı olarak boşaltılabilir (bootstrap yalnız tablo boşken çalışır — tablo doluyken env kimliği geçersizdir).
