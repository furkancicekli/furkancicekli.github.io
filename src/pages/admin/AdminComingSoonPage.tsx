import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import type { AdminSection } from './sections'

/**
 * Henüz açılmamış içerik bölümleri için dürüst boş durum: bölümün ne
 * yapacağını söyler, geri dönüş yolu verir.
 */
export function AdminComingSoonPage({ section }: { section: AdminSection }) {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-serif text-2xl font-bold">{section.label}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
      </header>

      <div className="flex flex-col items-center rounded-lg border border-dashed border-border px-6 py-16 text-center">
        <section.icon aria-hidden="true" className="h-8 w-8 text-muted-foreground" />
        <h2 className="mt-4 font-serif text-lg font-bold">Bu bölüm henüz açık değil</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          İçerik yönetimi bir sonraki güncellemeyle eklenecek. Bölüm açıldığında buradan{' '}
          {section.description.toLowerCase().replace(/\.$/, '')} yapabileceksin.
        </p>
        <Link
          to="/admin"
          className="mt-6 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Genel Bakış'a dön
        </Link>
      </div>
    </div>
  )
}
