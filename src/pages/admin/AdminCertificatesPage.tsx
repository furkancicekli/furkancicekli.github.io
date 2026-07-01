import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import QRCode from 'qrcode'
import { createCertificate, deleteCertificate, listCertificates, listProducts } from './api'
import type { Certificate, ProductListItem } from './api'

const ERROR_MESSAGES: Record<string, string> = {
  product_not_sold: 'Ürün "Satıldı" durumunda değil.',
  invalid_request: 'Ürünün seri numarası yok. Önce ürün kartına seri no ekle.',
  not_found: 'Ürün bulunamadı.',
  network: 'Bağlantı hatası. Tekrar deneyin.',
  unknown: 'Bir hata oluştu. Tekrar deneyin.',
}

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'

function verifyUrl(qrToken: string): string {
  return `${window.location.origin}/verify/${qrToken}`
}

interface CertificateCardProps {
  certificate: Certificate
  onDelete: (id: number) => Promise<void>
}

function CertificateCard({ certificate, onDelete }: CertificateCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(verifyUrl(certificate.qrToken), { margin: 1, width: 192 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [certificate.qrToken])

  async function handleDelete() {
    if (!window.confirm('Bu sertifika silinecek. Emin misin?')) return
    setError(null)
    setDeleting(true)
    try {
      await onDelete(certificate.id)
    } catch (err) {
      const errCode = err instanceof Error ? err.message : 'unknown'
      setError(ERROR_MESSAGES[errCode] ?? ERROR_MESSAGES.unknown)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <li className="flex flex-col gap-4 rounded-md border border-border p-4 sm:flex-row sm:items-center">
      <div className="flex shrink-0 items-center justify-center">
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="Doğrulama QR kodu" className="h-24 w-24 rounded-md border border-border" />
        ) : (
          <div className="h-24 w-24 animate-pulse rounded-md border border-border bg-muted" />
        )}
      </div>

      <div className="flex-1 space-y-1">
        <p className="font-mono text-sm font-medium">{certificate.serialNo}</p>
        <p className="text-sm text-muted-foreground">
          {certificate.productName ?? certificate.productSlug ?? '—'}
        </p>
        <p className="text-sm text-muted-foreground">{certificate.buyerName ?? '—'}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(certificate.issuedAt * 1000).toLocaleDateString('tr-TR')}
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <a
          href={`/verify/${certificate.qrToken}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          Doğrulama sayfası
        </a>
        {qrDataUrl && (
          <a
            download={`sertifika-${certificate.serialNo}.png`}
            href={qrDataUrl}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            PNG indir
          </a>
        )}
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          Sil
        </button>
      </div>
    </li>
  )
}

/**
 * Sertifika yönetimi: satılan ürünler için seri no + alıcı adıyla sertifika
 * üretir, her sertifika için doğrulama QR'ı gösterir. QR, /verify/:token
 * genel sayfasına işaret eder (bkz. VerifyPage).
 */
export function AdminCertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[] | null>(null)
  const [loadError, setLoadError] = useState(false)

  const [products, setProducts] = useState<ProductListItem[] | null>(null)
  const [productsError, setProductsError] = useState(false)

  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [buyerName, setBuyerName] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  async function refresh() {
    const result = await listCertificates()
    if (result.ok) {
      setCertificates(result.data)
      setLoadError(false)
    } else {
      setLoadError(true)
    }
  }

  useEffect(() => {
    let cancelled = false
    listCertificates().then((result) => {
      if (cancelled) return
      if (result.ok) {
        setCertificates(result.data)
      } else {
        setLoadError(true)
      }
    })
    listProducts().then((result) => {
      if (cancelled) return
      if (result.ok) {
        setProducts(result.data)
      } else {
        setProductsError(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const soldProducts = (products ?? []).filter((p) => p.status === 'sold')

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setAddError(null)
    if (selectedProductId === '') {
      setAddError(ERROR_MESSAGES.not_found)
      return
    }
    setAdding(true)
    const result = await createCertificate(Number(selectedProductId), buyerName.trim() || undefined)
    setAdding(false)
    if (!result.ok) {
      setAddError(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.unknown)
      return
    }
    setSelectedProductId('')
    setBuyerName('')
    await refresh()
  }

  async function handleDeleteCard(id: number) {
    const result = await deleteCertificate(id)
    if (!result.ok) {
      throw new Error(result.error)
    }
    await refresh()
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-serif text-2xl font-bold">Sertifikalar</h1>
        <p className="mt-1 text-sm text-muted-foreground">Satılan ürünler için sertifika ve QR kodu üretimi.</p>
      </header>

      <section className="max-w-2xl space-y-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Sertifika oluştur</h2>

        {productsError && (
          <p role="alert" className="text-sm text-destructive">
            Ürünler yüklenemedi. Tekrar deneyin.
          </p>
        )}

        {!productsError && products !== null && soldProducts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Sertifika için önce bir ürünü &quot;Satıldı&quot; durumuna al.
          </p>
        )}

        {!productsError && products !== null && soldProducts.length > 0 && (
          <form onSubmit={handleAdd} className="space-y-3">
            <label className="block space-y-1">
              <span className="text-sm text-muted-foreground">Ürün *</span>
              <select
                required
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>
                  Ürün seç
                </option>
                {soldProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name ? p.name : p.slug}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-sm text-muted-foreground">Alıcı adı</span>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                className={inputClass}
              />
            </label>

            {addError && (
              <p role="alert" className="text-sm text-destructive">
                {addError}
              </p>
            )}

            <button
              type="submit"
              disabled={adding}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {adding ? 'Oluşturuluyor…' : 'Sertifika oluştur'}
            </button>
          </form>
        )}
      </section>

      <section className="max-w-2xl space-y-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Sertifikalar</h2>

        {loadError && (
          <p role="alert" className="text-sm text-destructive">
            Sertifikalar yüklenemedi. Tekrar deneyin.
          </p>
        )}

        {!loadError && certificates === null && <p className="text-sm text-muted-foreground">Yükleniyor…</p>}

        {!loadError && certificates !== null && certificates.length === 0 && (
          <p className="text-sm text-muted-foreground">Henüz sertifika yok.</p>
        )}

        {!loadError && certificates !== null && certificates.length > 0 && (
          <ul className="space-y-4">
            {certificates.map((cert) => (
              <CertificateCard key={cert.id} certificate={cert} onDelete={handleDeleteCard} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
