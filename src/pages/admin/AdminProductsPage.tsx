import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { listProducts } from './api'
import type { ProductListItem, ProductStatus } from './api'

const STATUS_LABEL: Record<ProductStatus, string> = {
  draft: 'Taslak',
  published: 'Yayında',
  sold: 'Satıldı',
}

const STATUS_CLASS: Record<ProductStatus, string> = {
  draft: 'border border-border text-muted-foreground',
  published: 'bg-primary text-primary-foreground',
  sold: 'border border-border text-muted-foreground',
}

function StatusBadge({ status }: { status: ProductStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

/**
 * Ürün listesi: yönetici tüm ürünleri tablo halinde görür, yeni ürün
 * ekleyebilir veya bir satıra tıklayarak düzenleyebilir.
 */
export function AdminProductsPage() {
  const [products, setProducts] = useState<ProductListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listProducts().then((result) => {
      if (cancelled) return
      if (result.ok) {
        setProducts(result.data)
      } else {
        setError('Ürünler yüklenemedi. Tekrar deneyin.')
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold">Ürünler</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ürün ekleme, fotoğraf ve video yönetimi.</p>
        </div>
        <Link
          to="/admin/products/new"
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Yeni ürün
        </Link>
      </header>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {!error && products === null && <p className="text-sm text-muted-foreground">Yükleniyor…</p>}

      {!error && products !== null && products.length === 0 && (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">Henüz ürün yok.</p>
          <Link
            to="/admin/products/new"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Yeni ürün
          </Link>
        </div>
      )}

      {!error && products !== null && products.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Ad
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Slug
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Durum
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Fiyat
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Medya
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/products/${p.id}`}
                      className="font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {p.name ? p.name : <span className="italic text-muted-foreground">{p.slug}</span>}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.slug}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.price !== null ? `₺${p.price}` : '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.mediaCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
