import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Logo } from '@/components/ui'
import { SEO } from '@/components/SEO'
import { formatSerial } from './admin/serial-format'

interface VerifyCertificate {
  serialNo: string
  buyerName: string | null
  issuedAt: number
  product: {
    name: string | null
    slug: string | null
    material: string | null
    size: string | null
  }
}

type VerifyState =
  | { status: 'loading' }
  | { status: 'valid'; certificate: VerifyCertificate }
  | { status: 'invalid' }

/**
 * Genel doğrulama sayfası: sertifika QR kodundan gelen ziyaretçiye ürünün
 * gerçekliğini gösterir. Kimlik doğrulama gerektirmez, App.tsx'te
 * PublicShell ve /admin dışında bağımsız bir rota olarak tanımlıdır.
 * İçerik statik Türkçe (çok dillilik sonraki iterasyon).
 */
export function VerifyPage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<VerifyState>(() => (token ? { status: 'loading' } : { status: 'invalid' }))

  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetch(`/api/verify/${token}`)
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          setState({ status: 'invalid' })
          return
        }
        const data = (await res.json()) as { valid: boolean; certificate?: VerifyCertificate }
        if (data.valid && data.certificate) {
          setState({ status: 'valid', certificate: data.certificate })
        } else {
          setState({ status: 'invalid' })
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'invalid' })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  // Sertifika sayfaları indekslenmez: token'a özel, ince içerik + alıcı adı taşıyabilir
  const seo = <SEO title="Orijinallik Sertifikası | Furkan Çiçekli" noindex />

  if (state.status === 'loading') {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-background px-4 pt-28 pb-12 text-muted-foreground">
        {seo}
        Yükleniyor…
      </main>
    )
  }

  if (state.status === 'invalid') {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-background px-4 pt-28 pb-12">
        {seo}
        <div className="max-w-md space-y-3 text-center">
          <h1 className="font-serif text-2xl font-bold text-foreground">Sertifika bulunamadı</h1>
          <p className="text-sm text-muted-foreground">
            Bu bağlantıya karşılık gelen bir sertifika bulunamadı. Bağlantının doğru olduğundan emin olun veya
            atölyeyle iletişime geçin.
          </p>
        </div>
      </main>
    )
  }

  const { certificate } = state
  const productName = certificate.product.name ?? certificate.product.slug ?? '—'
  const issuedDate = new Date(certificate.issuedAt * 1000).toLocaleDateString('tr-TR')

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-background px-4 pt-28 pb-12">
      {seo}
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8 text-center print:border-none print:p-0 print:shadow-none">
        <div className="flex justify-center">
          <Logo decorative className="h-16 w-[33px] text-foreground" />
        </div>

        <h1 className="font-serif text-2xl font-bold text-foreground">Orijinallik Sertifikası</h1>

        <p className="font-serif text-xl text-foreground">{productName}</p>

        <p className="font-mono text-lg font-medium tracking-wide text-foreground">
          {formatSerial(certificate.serialNo)}
        </p>

        <dl className="space-y-2 border-t border-border pt-4 text-left text-sm">
          {certificate.product.material && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Malzeme</dt>
              <dd className="text-foreground">{certificate.product.material}</dd>
            </div>
          )}
          {certificate.product.size && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Ebat</dt>
              <dd className="text-foreground">{certificate.product.size}</dd>
            </div>
          )}
          {certificate.buyerName && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Sahibi</dt>
              <dd className="text-foreground">{certificate.buyerName}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Veriliş tarihi</dt>
            <dd className="text-foreground">{issuedDate}</dd>
          </div>
        </dl>

        <p className="border-t border-border pt-4 text-xs text-muted-foreground">
          Bu ürün Furkan Çiçekli atölyesinde el işçiliğiyle üretilmiştir.
        </p>

        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring print:hidden"
        >
          Yazdır
        </button>
      </div>
    </main>
  )
}
