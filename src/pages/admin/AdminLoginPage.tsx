import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from './api'

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-posta veya şifre hatalı.',
  invalid_request: 'E-posta ve şifre gerekli.',
  network: 'Bağlantı hatası. Tekrar deneyin.',
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
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
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
