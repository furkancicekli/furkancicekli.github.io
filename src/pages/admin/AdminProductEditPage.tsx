import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createProduct, deleteMedia, deleteProduct, getProduct, updateProduct, uploadProductMedia } from './api'
import type { Lang, ProductMediaItem, ProductTranslation } from './api'

const ERROR_MESSAGES: Record<string, string> = {
  tr_name_required: 'Türkçe ürün adı zorunlu.',
  invalid_request: 'Form bilgilerini kontrol et.',
  invalid_file: 'Desteklenmeyen dosya türü (JPEG/PNG/WebP/MP4).',
  file_too_large: 'Dosya 15 MB sınırını aşıyor.',
  not_found: 'Kayıt bulunamadı.',
  network: 'Bağlantı hatası. Tekrar deneyin.',
  unknown: 'Bir hata oluştu. Tekrar deneyin.',
}

const MEDIA_KIND_OPTIONS: { value: ProductMediaItem['kind']; label: string }[] = [
  { value: 'gallery', label: 'Galeri' },
  { value: 'raw_material', label: 'Hammadde' },
  { value: 'process', label: 'Süreç' },
]

const MEDIA_KIND_LABEL: Record<ProductMediaItem['kind'], string> = {
  gallery: 'Galeri',
  raw_material: 'Hammadde',
  process: 'Süreç',
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

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'

/**
 * Ürün oluşturma/düzenleme formu. :id yoksa oluşturma modu, varsa düzenleme.
 * Medya ve süreç adımları bölümleri yalnızca düzenleme modunda render edilir
 * (yeni ürün henüz kaydedilmeden medya/adım eklenemez).
 */
export function AdminProductEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = id !== undefined
  const productId = isEdit ? Number(id) : null

  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState(false)

  const [media, setMedia] = useState<ProductMediaItem[]>([])
  const [mediaKind, setMediaKind] = useState<ProductMediaItem['kind']>('gallery')
  const [mediaBusy, setMediaBusy] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const mediaFileInputRef = useRef<HTMLInputElement>(null)

  const [material, setMaterial] = useState('')
  const [size, setSize] = useState('')
  const [weightGrams, setWeightGrams] = useState('')
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
      setMaterial(p.material ?? '')
      setSize(p.size ?? '')
      setWeightGrams(p.weightGrams !== null ? String(p.weightGrams) : '')
      const next = emptyTranslations()
      for (const lang of ['tr', 'en', 'ar'] as Lang[]) {
        const t = p.translations[lang]
        if (t) next[lang] = t
      }
      setTranslations(next)
      setMedia(p.media)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [isEdit, productId])

  function updateTranslation(lang: Lang, field: keyof ProductTranslation, value: string) {
    setTranslations((prev) => ({ ...prev, [lang]: { ...prev[lang], [field]: value === '' ? null : value } }))
  }

  // Medya mutasyonlarından sonra sadece medya listesini tazeler — form
  // alanlarındaki kaydedilmemiş değişiklikleri ezmez.
  async function refreshMedia() {
    if (productId === null) return
    const result = await getProduct(productId)
    if (result.ok) {
      setMedia(result.data.media)
    }
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
      material: material.trim() === '' ? null : material.trim(),
      size: size.trim() === '' ? null : size.trim(),
      weightGrams: parsedWeight,
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

  async function handleUploadMedia(e: FormEvent) {
    e.preventDefault()
    if (productId === null) return
    const file = mediaFileInputRef.current?.files?.[0]
    if (!file) return
    setMediaError(null)
    setMediaBusy(true)
    const result = await uploadProductMedia(productId, file, mediaKind)
    setMediaBusy(false)
    if (!result.ok) {
      setMediaError(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.unknown)
      return
    }
    if (mediaFileInputRef.current) mediaFileInputRef.current.value = ''
    await refreshMedia()
  }

  async function handleDeleteMedia(mediaId: number) {
    if (!window.confirm('Bu medya silinecek. Emin misin?')) return
    setMediaError(null)
    setMediaBusy(true)
    const result = await deleteMedia(mediaId)
    setMediaBusy(false)
    if (!result.ok) {
      setMediaError(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.unknown)
      return
    }
    await refreshMedia()
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
            <span className="text-sm text-muted-foreground">Malzeme</span>
            <input type="text" value={material} onChange={(e) => setMaterial(e.target.value)} className={inputClass} />
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">Boyut</span>
            <input type="text" value={size} onChange={(e) => setSize(e.target.value)} className={inputClass} />
          </label>

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

      {isEdit && (
        <section className="max-w-2xl space-y-4 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Medya</h2>

          <form onSubmit={handleUploadMedia} className="flex flex-wrap items-end gap-3">
            <label className="block space-y-1">
              <span className="text-sm text-muted-foreground">Dosya</span>
              <input
                ref={mediaFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4"
                className="block text-sm"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm text-muted-foreground">Tür</span>
              <select
                value={mediaKind}
                onChange={(e) => setMediaKind(e.target.value as ProductMediaItem['kind'])}
                className={inputClass}
              >
                {MEDIA_KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={mediaBusy}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {mediaBusy ? 'Yükleniyor…' : 'Yükle'}
            </button>
          </form>

          {mediaError && (
            <p role="alert" className="text-sm text-destructive">
              {mediaError}
            </p>
          )}

          {media.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz medya yok.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {media.map((m) => (
                <div key={m.id} className="space-y-2 rounded-md border border-border p-2">
                  {m.type === 'image' ? (
                    <img
                      src={`/api/media/${m.r2Key}`}
                      loading="lazy"
                      alt=""
                      className="aspect-square w-full rounded-sm object-cover"
                    />
                  ) : (
                    <video src={`/api/media/${m.r2Key}`} muted className="aspect-square w-full rounded-sm object-cover" />
                  )}
                  <p className="text-xs text-muted-foreground">{MEDIA_KIND_LABEL[m.kind]}</p>
                  <button
                    type="button"
                    onClick={() => handleDeleteMedia(m.id)}
                    disabled={mediaBusy}
                    className="w-full rounded-md px-2 py-1 text-xs font-medium text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    Sil
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
