import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Copy } from 'lucide-react'
import {
  deleteProduct,
  getProduct,
  listCertificates,
  publishProduct,
  unpublishProduct,
  updateProduct,
} from './api'
import type { Lang, ProductDetail, ProductStatus, ProductTranslation } from './api'
import { useConfirm } from './ConfirmDialog'
import { MaterialSelect } from './MaterialSelect'
import { MediaUploader } from './MediaUploader'
import { formatSerial } from './serial-format'

const ERROR_MESSAGES: Record<string, string> = {
  tr_name_required: 'Türkçe ürün adı zorunlu.',
  invalid_request: 'Form bilgilerini kontrol et.',
  invalid_file: 'Desteklenmeyen dosya türü (JPEG/PNG/WebP/MP4).',
  file_too_large: 'Dosya 15 MB sınırını aşıyor.',
  not_found: 'Kayıt bulunamadı.',
  network: 'Bağlantı hatası. Tekrar deneyin.',
  unknown: 'Bir hata oluştu. Tekrar deneyin.',
}

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

const LANGS: { value: Lang; label: string }[] = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
]

const EMPTY_TRANSLATION: ProductTranslation = { name: null, description: null, story: null }

function emptyTranslations(): Record<Lang, ProductTranslation> {
  return { tr: { ...EMPTY_TRANSLATION }, en: { ...EMPTY_TRANSLATION }, ar: { ...EMPTY_TRANSLATION } }
}

function verifyUrl(qrToken: string): string {
  return `${window.location.origin}/verify/${qrToken}`
}

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'

interface MediaSectionProps {
  productId: number
  kind: 'gallery' | 'process'
  title: string
  /** Gösterilecek türler (process bölümü legacy raw_material'ı da içerir). */
  filterKinds: string[]
}

/** Medya bölümü — yükleme/silme/grid işleri ortak MediaUploader bileşeninde. */
function MediaSection({ productId, kind, title, filterKinds }: MediaSectionProps) {
  return (
    <section className="max-w-2xl space-y-4 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      <MediaUploader productId={productId} uploadKind={kind} filterKinds={filterKinds} />
    </section>
  )
}

/**
 * Ürün düzenleme sayfası (yalnızca mevcut ürünler — oluşturma AdminProductWizard'da).
 * Üstte durum rozeti + yayınla/kaldır aksiyonu, sertifika kutusu, detaylar formu
 * ve ikiye ayrılmış medya bölümleri (Ürün Fotoğrafları / Yapım Aşamaları) yer alır.
 */
export function AdminProductEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const productId = Number(id)

  const [loading, setLoading] = useState(!Number.isNaN(productId))
  const [loadError, setLoadError] = useState(Number.isNaN(productId))
  const [product, setProduct] = useState<ProductDetail | null>(null)

  const [qrToken, setQrToken] = useState<string | null>(null)
  const [certLoading, setCertLoading] = useState(!Number.isNaN(productId))
  const [copied, setCopied] = useState(false)

  const [material, setMaterial] = useState<string | null>(null)
  const [size, setSize] = useState('')
  const [weightGrams, setWeightGrams] = useState('')
  const [translations, setTranslations] = useState<Record<Lang, ProductTranslation>>(emptyTranslations())
  const [activeLang, setActiveLang] = useState<Lang>('tr')

  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const [publishBusy, setPublishBusy] = useState(false)
  const [publishMessage, setPublishMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const { confirm, confirmDialog } = useConfirm()

  function applyProduct(p: ProductDetail) {
    setProduct(p)
    setMaterial(p.material)
    setSize(p.size ?? '')
    setWeightGrams(p.weightGrams !== null ? String(p.weightGrams) : '')
    const next = emptyTranslations()
    for (const lang of ['tr', 'en', 'ar'] as Lang[]) {
      const t = p.translations[lang]
      if (t) next[lang] = t
    }
    setTranslations(next)
  }

  useEffect(() => {
    if (Number.isNaN(productId)) return
    let cancelled = false
    getProduct(productId).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setLoadError(true)
        setLoading(false)
        return
      }
      applyProduct(result.data)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [productId])

  // POST /api/admin/products yalnızca ürün oluşturulduğunda sertifika döner;
  // düzenleme sayfası açılışta qrToken'ı listeden productId eşleşmesiyle bulur.
  // Otomatik sertifika üretimi öncesi oluşturulmuş legacy ürünlerde eşleşme
  // bulunmayabilir — bu durumda uyarı gösterilir.
  useEffect(() => {
    if (Number.isNaN(productId)) return
    let cancelled = false
    listCertificates().then((result) => {
      if (cancelled) return
      if (result.ok) {
        const match = result.data.find((c) => c.productId === productId)
        setQrToken(match ? match.qrToken : null)
      }
      setCertLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [productId])

  function updateTranslation(lang: Lang, field: keyof ProductTranslation, value: string) {
    setTranslations((prev) => ({ ...prev, [lang]: { ...prev[lang], [field]: value === '' ? null : value } }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)

    let parsedWeight: number | null = null
    if (weightGrams.trim() !== '') {
      const n = Number(weightGrams)
      if (!Number.isFinite(n) || n < 0) {
        setMessage({ kind: 'error', text: ERROR_MESSAGES.invalid_request })
        return
      }
      parsedWeight = n
    }

    const input = {
      material,
      size: size.trim() === '' ? null : size.trim(),
      weightGrams: parsedWeight,
      translations,
    }

    setBusy(true)
    const result = await updateProduct(productId, input)
    setBusy(false)

    if (!result.ok) {
      setMessage({ kind: 'error', text: ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.unknown })
      return
    }

    applyProduct(result.data)
    setMessage({ kind: 'ok', text: 'Kaydedildi.' })
  }

  async function handleDelete() {
    if (
      !(await confirm({
        title: 'Ürünü sil',
        message: 'Bu ürün, medyası ve sertifikası silinecek. Emin misin?',
      }))
    )
      return
    setBusy(true)
    const result = await deleteProduct(productId)
    setBusy(false)
    if (result.ok) {
      navigate('/admin/products')
    } else {
      setMessage({ kind: 'error', text: ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.unknown })
    }
  }

  async function handleTogglePublish() {
    if (!product) return
    setPublishMessage(null)
    setPublishBusy(true)
    const result = product.status === 'published' ? await unpublishProduct(productId) : await publishProduct(productId)
    setPublishBusy(false)
    if (!result.ok) {
      setPublishMessage({ kind: 'error', text: ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.unknown })
      return
    }
    applyProduct(result.data)
    setPublishMessage({
      kind: 'ok',
      text: result.data.status === 'published' ? 'Ürün yayınlandı.' : 'Ürün yayından kaldırıldı.',
    })
  }

  async function handleCopySerial() {
    if (!product?.serialNo) return
    try {
      await navigator.clipboard.writeText(product.serialNo)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // pano erişimi reddedildi — sessizce yok say, kullanıcı manuel seçip kopyalayabilir
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Yükleniyor…</p>
  }

  if (loadError || !product) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Ürün yüklenemedi. Tekrar deneyin.
      </p>
    )
  }


  return (
    <div className="space-y-10">
      {confirmDialog}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-2xl font-bold">
              {translations.tr.name ?? <span className="italic text-muted-foreground">{product.slug}</span>}
            </h1>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[product.status]}`}>
              {STATUS_LABEL[product.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Ürün bilgilerini ve çevirilerini güncelle.</p>
        </div>

        {product.status !== 'sold' && (
          <button
            type="button"
            onClick={handleTogglePublish}
            disabled={publishBusy}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {publishBusy ? 'İşleniyor…' : product.status === 'published' ? 'Yayından kaldır' : 'Yayınla'}
          </button>
        )}
      </header>

      {publishMessage && (
        <p
          role="status"
          className={`text-sm ${publishMessage.kind === 'ok' ? 'text-green-600' : 'text-destructive'}`}
        >
          {publishMessage.text}
        </p>
      )}

      <section className="max-w-2xl space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Sertifika</h2>

        {product.serialNo ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-lg font-semibold tracking-wider">{formatSerial(product.serialNo)}</p>
            <button
              type="button"
              onClick={handleCopySerial}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Copy aria-hidden="true" className="h-3.5 w-3.5" />
              {copied ? 'Kopyalandı' : 'Kopyala'}
            </button>
            {!certLoading && qrToken && (
              <a
                href={verifyUrl(qrToken)}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                Doğrulama sayfası
              </a>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Bu üründe seri numarası yok.</p>
        )}

        {/* Otomatik sertifika üretiminden önce oluşturulmuş legacy ürünlerde
            sertifika kaydı bulunmayabilir. */}
        {!certLoading && !qrToken && (
          <p role="alert" className="text-sm text-destructive">
            Sertifika bulunamadı. (Otomatik sertifika üretiminden önce oluşturulmuş ürünlerde bu beklenen bir durumdur.)
          </p>
        )}
      </section>

      <form onSubmit={handleSubmit} className="space-y-10">
        <section className="max-w-xl space-y-4 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Detaylar</h2>

          <div role="tablist" aria-label="Dil seçimi" className="flex gap-2">
            {LANGS.map((l) => (
              <button
                key={l.value}
                type="button"
                role="tab"
                aria-selected={activeLang === l.value}
                onClick={() => setActiveLang(l.value)}
                className={`rounded-md px-3 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                  activeLang === l.value
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {l.label}
                {l.value === 'tr' && <span className="ml-1 text-[10px] uppercase">zorunlu</span>}
              </button>
            ))}
          </div>

          <div role="tabpanel" className="space-y-4">
            <label className="block space-y-1">
              <span className="text-sm text-muted-foreground">
                Ad{activeLang === 'tr' && ' *'}
              </span>
              <input
                type="text"
                required={activeLang === 'tr'}
                value={translations[activeLang].name ?? ''}
                onChange={(e) => updateTranslation(activeLang, 'name', e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm text-muted-foreground">Açıklama</span>
              <textarea
                rows={3}
                value={translations[activeLang].description ?? ''}
                onChange={(e) => updateTranslation(activeLang, 'description', e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm text-muted-foreground">Hikaye</span>
              <textarea
                rows={4}
                value={translations[activeLang].story ?? ''}
                onChange={(e) => updateTranslation(activeLang, 'story', e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <MaterialSelect value={material} onChange={setMaterial} />

          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">Gram</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={weightGrams}
              onChange={(e) => setWeightGrams(e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">Boyut</span>
            <input type="text" value={size} onChange={(e) => setSize(e.target.value)} className={inputClass} />
          </label>

          <p className="text-xs text-muted-foreground">Slug: {product.slug}</p>
        </section>

        {message && (
          <p role={message.kind === 'ok' ? 'status' : 'alert'} className={`text-sm ${message.kind === 'ok' ? 'text-green-600' : 'text-destructive'}`}>
            {message.text}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="rounded-md px-4 py-2 text-sm font-medium text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            Ürünü sil
          </button>
        </div>
      </form>

      <div className="space-y-6">
        <h2 className="font-serif text-lg font-bold">Medya</h2>
        <MediaSection productId={productId} kind="gallery" title="Ürün Fotoğrafları" filterKinds={['gallery']} />
        <MediaSection
          productId={productId}
          kind="process"
          title="Yapım Aşamaları"
          filterKinds={['process', 'raw_material']}
        />
      </div>
    </div>
  )
}
