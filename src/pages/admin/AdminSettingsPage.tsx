import { useState } from 'react'
import type { FormEvent } from 'react'
import { changePassword } from './api'

const PASSWORD_ERRORS: Record<string, string> = {
  invalid_credentials: 'Mevcut şifre hatalı.',
  password_too_short: 'Yeni şifre en az 8 karakter olmalı.',
  network: 'Bağlantı hatası. Tekrar deneyin.',
  unknown: 'Bir hata oluştu. Tekrar deneyin.',
}

export function AdminSettingsPage() {
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
    <div className="space-y-10">
      <header>
        <h1 className="font-serif text-2xl font-bold">Ayarlar</h1>
        <p className="mt-1 text-sm text-muted-foreground">Hesap ve şifre yönetimi.</p>
      </header>

      <section className="max-w-sm">
        <h2 className="mb-4 text-sm font-medium">Şifre değiştir</h2>
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
            <p
              role={message.kind === 'ok' ? 'status' : 'alert'}
              className={`text-sm ${message.kind === 'ok' ? 'text-green-600' : 'text-destructive'}`}
            >
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
