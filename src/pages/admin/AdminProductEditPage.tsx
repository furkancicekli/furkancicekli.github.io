import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createProduct, deleteProduct, getProduct, updateProduct } from './api'
import type { Lang, ProductStatus, ProductTranslation } from './api'

const ERROR_MESSAGES: Record<string, string> = {
  slug_taken: 'Bu slug başka bir üründe kullanılıyor.',
  serial_taken: 'Bu seri numarası başka bir üründe.',
  tr_name_required: 'Türkçe ürün adı zorunlu.',
  invalid_status: 'Form bilgilerini kontrol et.',
  invalid_request: 'Form bilgilerini kontrol et.',
  network: 'Bağlantı hatası. Tekrar deneyin.',
  unknown: 'Bir hata oluştu. Tekrar deneyin.',
}

const STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
  { value: 'draft', label: 'Taslak' },
  { value: 'published', label: 'Yayında' },
  { value: 'sold', label: 'Satıldı' },
]

const LANGS: { value: Lang; label: string }[] = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
]

const EMPTY_TRANSLATION: ProductTranslation = { name: null, description: null, story: null }

function emptyTranslations(): Record<Lang, ProductTranslation> {
  return { tr: { ...EMPTY_TRANSLATION }, en: { ...EMPTY_TRANSLATION }, ar: { ...EMPTY_TRANSLATION } }
}

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'

/**
 * Ürün oluşturma/düzenleme formu. :id yoksa oluşturma modu, varsa düzenleme.
 * Medya ve süreç adımları bölümleri Task 7'de eklenecek — burada render edilmez.
 */
export function AdminProductEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = id !== undefined
  const productId = isEdit ? Number(id) : null

  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState(false)

  const [slug, setSlug] = useState('')
  const [serialNo, setSerialNo] = useState('')
  const [status, setStatus] = useState<ProductStatus>('draft')
  const [material, setMaterial] = useState('')
  const [size, setSize] = useState('')
  const [price, setPrice] = useState('')
  const [translations, setTranslations] = useState<Record<Lang, ProductTranslation>>(emptyTranslations())
  const [activeLang, setActiveLang] = useState<Lang>('tr')

  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isEdit || productId === null) return
    let cancelled = false
    getProduct(productId).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setLoadError(true)
        setLoading(false)
        return
      }
      const p = result.data
      setSlug(p.slug)
      setSerialNo(p.serialNo ?? '')
      setStatus(p.status)
      setMaterial(p.material ?? '')
      setSize(p.size ?? '')
      setPrice(p.price !== null ? String(p.price) : '')
      const next = emptyTranslations()
      for (const lang of ['tr', 'en', 'ar'] as Lang[]) {
        const t = p.translations[lang]
        if (t) next[lang] = t
      }
      setTranslations(next)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [isEdit, productId])

  function updateTranslation(lang: Lang, field: keyof ProductTranslation, value: string) {
    setTranslations((prev) => ({ ...prev, [lang]: { ...prev[lang], [field]: value === '' ? null : value } }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)

    let parsedPrice: number | null = null
    if (price.trim() !== '') {
      const n = Number(price)
      if (!Number.isInteger(n) || n < 0) {
        setMessage({ kind: 'error', text: ERROR_MESSAGES.invalid_request })
        return
      }
      parsedPrice = n
    }

    const input = {
      slug,
      serialNo: serialNo.trim() === '' ? null : serialNo.trim(),
      status,
      material: material.trim() === '' ? null : material.trim(),
      size: size.trim() === '' ? null : size.trim(),
      price: parsedPrice,
      translations,
    }

    setBusy(true)
    const result = isEdit && productId !== null ? await updateProduct(productId, input) : await createProduct(input)
    setBusy(false)

    if (!result.ok) {
      setMessage({ kind: 'error', text: ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.unknown })
      return
    }

    if (isEdit) {
      setMessage({ kind: 'ok', text: 'Kaydedildi.' })
    } else {
      navigate(`/admin/products/${result.data.id}`)
    }
  }

  async function handleDelete() {
    if (productId === null) return
    if (!window.confirm('Bu ürün ve tüm medyası silinecek. Emin misin?')) return
    setBusy(true)
    const result = await deleteProduct(productId)
    setBusy(false)
    if (result.ok) {
      navigate('/admin/products')
    } else {
      setMessage({ kind: 'error', text: ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.unknown })
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Yükleniyor…</p>
  }

  if (loadError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Ürün yüklenemedi. Tekrar deneyin.
      </p>
    )
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-serif text-2xl font-bold">{isEdit ? 'Ürünü düzenle' : 'Yeni ürün'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEdit ? 'Ürün bilgilerini ve çevirilerini güncelle.' : 'Yeni bir ürün oluştur.'}
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-10">
        <section className="max-w-xl space-y-4 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Detaylar</h2>

          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">Slug</span>
            <input
              type="text"
              required
              pattern="[a-z0-9-]+"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className={inputClass}
            />
            <span className="block text-xs text-muted-foreground">küçük harf, rakam ve tire</span>
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">Seri no</span>
            <input type="text" value={serialNo} onChange={(e) => setSerialNo(e.target.value)} className={inputClass} />
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">Durum</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)} className={inputClass}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">Malzeme</span>
            <input type="text" value={material} onChange={(e) => setMaterial(e.target.value)} className={inputClass} />
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">Boyut</span>
            <input type="text" value={size} onChange={(e) => setSize(e.target.value)} className={inputClass} />
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">Fiyat (₺)</span>
            <input
              type="number"
              min={0}
              step={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={inputClass}
            />
          </label>
        </section>

        <section className="max-w-xl space-y-4 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Çeviriler</h2>

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

          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="rounded-md px-4 py-2 text-sm font-medium text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              Ürünü sil
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
