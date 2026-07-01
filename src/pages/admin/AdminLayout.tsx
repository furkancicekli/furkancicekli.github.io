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
