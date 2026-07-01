import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listProducts } from './api'
import type { ProductListItem } from './api'

/**
 * Süreç adımları ürüne bağlı olduğundan bu sayfa yalnızca ürün listesine
 * yönlendirir — asıl düzenleme AdminProductEditPage'in "Süreç & Hikaye"
 * bölümünde yapılır.
 */
export function AdminProcessPage() {
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
      <header>
        <h1 className="font-serif text-2xl font-bold">Süreç &amp; Hikaye</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Süreç adımları ürüne bağlıdır — düzenlemek için ürünü aç.
        </p>
      </header>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {!error && products === null && <p className="text-sm text-muted-foreground">Yükleniyor…</p>}

      {!error && products !== null && products.length === 0 && (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">Henüz ürün yok. Önce bir ürün oluştur.</p>
          <Link
            to="/admin/products/new"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          >
            Yeni ürün
          </Link>
        </div>
      )}

      {!error && products !== null && products.length > 0 && (
        <ul className="max-w-xl divide-y divide-border rounded-lg border border-border">
          {products.map((p) => (
            <li key={p.id}>
              <Link
                to={`/admin/products/${p.id}`}
                className="block px-4 py-3 text-sm outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {p.name ? p.name : <span className="italic text-muted-foreground">{p.slug}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
