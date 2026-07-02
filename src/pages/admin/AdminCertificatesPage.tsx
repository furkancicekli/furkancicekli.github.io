import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import QRCode from 'qrcode'
import { listCertificates, patchCertificate } from './api'
import type { Certificate } from './api'
import { formatSerial } from './serial-format'

const ERROR_MESSAGES: Record<string, string> = {
  not_found: 'Sertifika bulunamadı.',
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
  onSaveBuyerName: (id: number, buyerName: string | null) => Promise<{ ok: true } | { ok: false; error: string }>
}

function CertificateCard({ certificate, onSaveBuyerName }: CertificateCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [buyerNameInput, setBuyerNameInput] = useState(certificate.buyerName ?? '')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

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

  async function handleCopySerial() {
    try {
      await navigator.clipboard.writeText(certificate.serialNo)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // pano erişimi reddedildi — sessizce yok say, kullanıcı manuel seçip kopyalayabilir
    }
  }

  async function handleSaveBuyerName() {
    setSaveMessage(null)
    setSaving(true)
    const trimmed = buyerNameInput.trim()
    const result = await onSaveBuyerName(certificate.id, trimmed.length > 0 ? trimmed : null)
    setSaving(false)
    if (result.ok) {
      setSaveMessage({ kind: 'ok', text: 'Kaydedildi.' })
    } else {
      setSaveMessage({ kind: 'error', text: ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.unknown })
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

      <div className="flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-sm font-medium">{formatSerial(certificate.serialNo)}</p>
          <button
            type="button"
            onClick={handleCopySerial}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Copy aria-hidden="true" className="h-3 w-3" />
            {copied ? 'Kopyalandı' : 'Kopyala'}
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          {certificate.productName ?? certificate.productSlug ?? '—'}
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date(certificate.issuedAt * 1000).toLocaleDateString('tr-TR')}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input
            type="text"
            value={buyerNameInput}
            onChange={(e) => setBuyerNameInput(e.target.value)}
            placeholder="Alıcı adı"
            className={`${inputClass} max-w-[200px]`}
          />
          <button
            type="button"
            onClick={handleSaveBuyerName}
            disabled={saving}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
        {saveMessage && (
          <p
            role={saveMessage.kind === 'ok' ? 'status' : 'alert'}
            className={`text-sm ${saveMessage.kind === 'ok' ? 'text-green-600' : 'text-destructive'}`}
          >
            {saveMessage.text}
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
      </div>
    </li>
  )
}

/**
 * Sertifika yönetimi: sertifikalar artık ürün oluşturulduğunda otomatik
 * üretilir (bkz. createProduct / api.ts). Bu sayfa mevcut sertifikaları
 * listeler, alıcı adını düzenlemeye ve doğrulama QR'ını yönetmeye izin verir.
 * QR, /verify/:token genel sayfasına işaret eder (bkz. VerifyPage).
 */
export function AdminCertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[] | null>(null)
  const [loadError, setLoadError] = useState(false)

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
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSaveBuyerName(id: number, buyerName: string | null) {
    const result = await patchCertificate(id, buyerName)
    if (result.ok) {
      setCertificates((prev) => (prev ? prev.map((c) => (c.id === id ? { ...c, buyerName } : c)) : prev))
    }
    return result
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-serif text-2xl font-bold">Sertifikalar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sertifikalar ürün eklenince otomatik oluşturulur. Numarayı ürünle gönderilen karta yaz.
        </p>
      </header>

      <section className="max-w-2xl space-y-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Sertifikalar</h2>

        {loadError && (
          <p role="alert" className="text-sm text-destructive">
            Sertifikalar yüklenemedi. Tekrar deneyin.
          </p>
        )}

        {!loadError && certificates === null && <p className="text-sm text-muted-foreground">Yükleniyor…</p>}

        {!loadError && certificates !== null && certificates.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Henüz sertifika yok. İlk ürünü eklediğinde sertifikası otomatik oluşturulur.
          </p>
        )}

        {!loadError && certificates !== null && certificates.length > 0 && (
          <ul className="space-y-4">
            {certificates.map((cert) => (
              <CertificateCard key={cert.id} certificate={cert} onSaveBuyerName={handleSaveBuyerName} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
