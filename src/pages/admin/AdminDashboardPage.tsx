import { Link } from 'react-router-dom'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { contentSections, settingsSection } from './sections'

/**
 * Genel Bakış: içerik bölümlerine tıklanabilir kartlar. Henüz açılmamış
 * bölümler "Yakında" rozetiyle işaretlidir ama rotaları gerçektir.
 */
export function AdminDashboardPage() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-serif text-2xl font-bold">Genel Bakış</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sitenin içeriğini buradan yöneteceksin. İçerik bölümleri bir sonraki güncellemeyle açılacak.
        </p>
      </header>

      <section aria-label="İçerik bölümleri">
        <div className="grid gap-4 sm:grid-cols-2">
          {contentSections.map((s) => (
            <Link
              key={s.path}
              to={s.path}
              className="group rounded-lg border border-border bg-card p-5 outline-none transition-colors hover:border-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between">
                <s.icon aria-hidden="true" className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
                {s.ready ? (
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  />
                ) : (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Yakında
                  </span>
                )}
              </div>
              <h2 className="mt-4 font-serif text-lg font-bold">{s.label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section aria-label="Kısayollar" className="grid gap-4 sm:grid-cols-2">
        <Link
          to={settingsSection.path}
          className="group flex items-center justify-between rounded-lg border border-border p-4 outline-none transition-colors hover:border-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div>
            <h2 className="text-sm font-medium">Ayarlar</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Şifreni buradan değiştirebilirsin.</p>
          </div>
          <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
        </Link>
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="group flex items-center justify-between rounded-lg border border-border p-4 outline-none transition-colors hover:border-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div>
            <h2 className="text-sm font-medium">Siteyi görüntüle</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Yayındaki site yeni sekmede açılır.</p>
          </div>
          <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
        </a>
      </section>
    </div>
  )
}
