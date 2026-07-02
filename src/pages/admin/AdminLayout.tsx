import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, Menu, X, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui'
import { fetchMe, logout } from './api'
import { allSections } from './sections'

/**
 * Korumalı admin kabuğu: masaüstünde sabit sol sidebar, mobilde üst bar +
 * açılır menü. Aktif bölüm, tesbih tanesine gönderme yapan dolu yuvarlak
 * işaretle gösterilir (pasifler boş halka).
 */
export function AdminLayout() {
  const navigate = useNavigate()
  const [email, setEmail] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

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

  const nav = (
    <nav aria-label="Panel bölümleri" className="flex flex-col gap-1">
      {allSections.map((s) => (
        <NavLink
          key={s.path}
          to={s.path}
          end={s.path === '/admin'}
          onClick={() => setMenuOpen(false)}
          className={({ isActive }) =>
            cn(
              'group flex items-center gap-3 rounded-md px-3 py-2 text-sm outline-none transition-colors',
              'focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? 'bg-muted font-medium text-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )
          }
        >
          {({ isActive }) => (
            <>
              {/* Tesbih tanesi: aktifken dolu, değilken boş halka */}
              <span
                aria-hidden="true"
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full transition-colors',
                  isActive ? 'bg-primary' : 'border border-muted-foreground/40 group-hover:border-muted-foreground',
                )}
              />
              <span className="flex-1">{s.label}</span>
              {!s.ready && (
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Yakında
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )

  const accountFooter = (
    <div className="space-y-3 border-t border-border pt-4">
      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
        Siteyi görüntüle
      </a>
      <div className="px-3">
        <p className="truncate font-mono text-xs text-muted-foreground" title={email ?? undefined}>
          {email}
        </p>
      </div>
      <button
        onClick={handleLogout}
        className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <LogOut aria-hidden="true" className="h-3.5 w-3.5" />
        Çıkış yap
      </button>
    </div>
  )

  const brand = (
    <div className="flex items-center gap-3">
      <Logo decorative className="h-8 w-[17px] text-foreground" />
      <div>
        <p className="font-serif text-sm font-bold leading-tight">Furkan Çiçekli</p>
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Yönetim</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobil üst bar */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
        {brand}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
          className="rounded-md border border-border p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {menuOpen ? <X aria-hidden="true" className="h-4 w-4" /> : <Menu aria-hidden="true" className="h-4 w-4" />}
        </button>
      </header>
      {menuOpen && (
        <div className="space-y-4 border-b border-border px-4 py-4 md:hidden">
          {nav}
          {accountFooter}
        </div>
      )}

      {/* Masaüstü sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col justify-between border-r border-border px-4 py-6 md:flex">
        <div className="space-y-8">
          {brand}
          {nav}
        </div>
        {accountFooter}
      </aside>

      <main className="md:pl-60">
        <div className="mx-auto max-w-4xl px-4 py-8 md:px-8 md:py-12">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
