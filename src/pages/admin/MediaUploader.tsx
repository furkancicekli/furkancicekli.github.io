import { useEffect, useRef, useState } from 'react'
import { Star, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { deleteMedia, getProduct, patchMedia, uploadProductMedia } from './api'
import type { ProductMediaItem } from './api'
import { useConfirm } from './ConfirmDialog'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
const MAX_BYTES = 15 * 1024 * 1024

const UPLOAD_ERRORS: Record<string, string> = {
  invalid_file: 'desteklenmeyen dosya türü',
  file_too_large: '15 MB sınırını aşıyor',
  not_found: 'ürün bulunamadı',
  network: 'bağlantı hatası',
  unknown: 'yüklenemedi',
}

interface MediaUploaderProps {
  productId: number
  /** Yüklemede kullanılacak tür. */
  uploadKind: 'gallery' | 'process'
  /** Gösterilecek türler (edit sayfası yapım aşamalarında legacy raw_material da dahil). */
  filterKinds: string[]
  emptyText?: string
}

/**
 * Tek parça medya yöneticisi: tıkla-veya-sürükle alanı, çoklu dosya seçimi,
 * seçilir seçilmez otomatik yükleme (ayrı "Yükle" butonu yok), küçük resim
 * ızgarası ve köşeden silme. Wizard adımları ve edit sayfası ortak kullanır.
 */
/** sort ASC, id ASC ile sırala — sunucu tarafındaki sıralamayla tutarlı (bkz. loadMedia). */
function sortMedia(items: ProductMediaItem[]): ProductMediaItem[] {
  return [...items].sort((a, b) => a.sort - b.sort || a.id - b.id)
}

export function MediaUploader({ productId, uploadKind, filterKinds, emptyText = 'Henüz fotoğraf yok.' }: MediaUploaderProps) {
  const [media, setMedia] = useState<ProductMediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { confirm, confirmDialog } = useConfirm()
  const showCover = uploadKind === 'gallery'

  useEffect(() => {
    let cancelled = false
    getProduct(productId).then((result) => {
      if (cancelled) return
      if (result.ok) setMedia(sortMedia(result.data.media.filter((m) => filterKinds.includes(m.kind))))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
    // filterKinds çağıran tarafta sabit dizi — sadece productId değişimi önemli
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  async function refresh() {
    const result = await getProduct(productId)
    if (result.ok) setMedia(sortMedia(result.data.media.filter((m) => filterKinds.includes(m.kind))))
  }

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files)
    if (list.length === 0 || uploading) return
    setErrors([])
    const failed: string[] = []
    let done = 0
    setUploading({ done: 0, total: list.length })
    for (const file of list) {
      // Sunucu da doğruluyor; burada erken ve dosya-adıyla hata veriyoruz
      if (!ACCEPTED_TYPES.includes(file.type)) {
        failed.push(`${file.name}: desteklenmeyen dosya türü (JPEG/PNG/WebP/MP4)`)
      } else if (file.size > MAX_BYTES) {
        failed.push(`${file.name}: 15 MB sınırını aşıyor`)
      } else {
        const result = await uploadProductMedia(productId, file, uploadKind)
        if (!result.ok) failed.push(`${file.name}: ${UPLOAD_ERRORS[result.error] ?? UPLOAD_ERRORS.unknown}`)
      }
      done += 1
      setUploading({ done, total: list.length })
    }
    setUploading(null)
    setErrors(failed)
    if (inputRef.current) inputRef.current.value = ''
    await refresh()
  }

  async function handleDelete(mediaId: number) {
    if (!(await confirm({ message: 'Bu fotoğraf silinecek. Emin misin?' }))) return
    const result = await deleteMedia(mediaId)
    if (!result.ok) {
      setErrors(['Silinemedi. Tekrar deneyin.'])
      return
    }
    setMedia((prev) => prev.filter((m) => m.id !== mediaId))
  }

  /**
   * Komşu öğeyle sort takası (AdminGalleryPage.handleMove ile aynı desen: iki
   * PATCH, busy flag, try/finally refresh). Legacy verilerde tüm sort'lar 0
   * olabildiği için basit takas komşu sort'lar eşitse hiçbir şey değiştirmez
   * (id kıyaslaması sırayı zaten koruyor gibi görünür ama görsel sıra değişmez).
   * Bu yüzden sort'lar eşitse öğeyi komşunun ±1 ötesine taşıyarak gerçek bir
   * sıra değişikliği garanti ediyoruz.
   */
  async function handleMove(index: number, direction: -1 | 1) {
    const neighborIndex = index + direction
    if (neighborIndex < 0 || neighborIndex >= media.length) return
    const current = media[index]
    const neighbor = media[neighborIndex]
    setBusy(true)
    try {
      let currentSort = neighbor.sort
      let neighborSort = current.sort
      if (current.sort === neighbor.sort) {
        currentSort = direction === 1 ? neighbor.sort + 1 : neighbor.sort - 1
        neighborSort = neighbor.sort
      }
      const [res1, res2] = await Promise.all([
        patchMedia(current.id, { sort: currentSort }),
        patchMedia(neighbor.id, { sort: neighborSort }),
      ])
      if (!res1.ok || !res2.ok) {
        setErrors(['Sıralama güncellenemedi. Tekrar deneyin.'])
      }
    } finally {
      setBusy(false)
      await refresh()
    }
  }

  /** Vitrin yap: kapak fotoğrafı = en düşük sıralı galeri fotoğrafı (public API
   * böyle türetiyor — bkz. public-products cover). Öğeyi en öne almak için
   * mevcut en düşük sort'un bir eksiğine taşıyoruz. */
  async function handleMakeCover(mediaId: number) {
    if (media.length === 0) return
    const minSort = Math.min(...media.map((m) => m.sort))
    setBusy(true)
    try {
      const result = await patchMedia(mediaId, { sort: minSort - 1 })
      if (!result.ok) {
        setErrors(['Vitrin ayarlanamadı. Tekrar deneyin.'])
      }
    } finally {
      setBusy(false)
      await refresh()
    }
  }

  return (
    <div className="space-y-4">
      {confirmDialog}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          void handleFiles(e.dataTransfer.files)
        }}
        disabled={!!uploading}
        className={cn(
          'flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center outline-none transition-colors',
          'focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
          dragOver ? 'border-primary bg-muted/70' : 'border-border hover:border-muted-foreground/60 hover:bg-muted/40',
        )}
      >
        <Upload aria-hidden="true" className="h-6 w-6 text-muted-foreground" />
        <span className="text-sm font-medium">
          {uploading ? `Yükleniyor… ${Math.min(uploading.done + 1, uploading.total)}/${uploading.total}` : 'Fotoğraf eklemek için tıkla ya da sürükleyip bırak'}
        </span>
        <span className="text-xs text-muted-foreground">
          JPEG, PNG, WebP veya MP4 · dosya başına en fazla 15 MB · birden çok dosya seçebilirsin
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files)
        }}
      />

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 text-sm text-destructive">
          {errors.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      ) : media.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {media.map((m, index) => (
            <div key={m.id} className="group relative overflow-hidden rounded-md border border-border">
              {m.type === 'image' ? (
                <img
                  src={`/api/media/${m.r2Key}`}
                  loading="lazy"
                  alt=""
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <video src={`/api/media/${m.r2Key}`} muted className="aspect-square w-full object-cover" />
              )}
              {showCover && index === 0 && (
                <span className="absolute left-1 top-1 rounded bg-primary px-1.5 text-[10px] font-medium text-primary-foreground shadow-sm">
                  Vitrin
                </span>
              )}
              <button
                type="button"
                onClick={() => void handleDelete(m.id)}
                aria-label="Fotoğrafı sil"
                className="absolute right-1 top-1 rounded-full border border-border bg-background/90 p-1 opacity-0 shadow-sm outline-none transition-opacity focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
              <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                {showCover && index !== 0 && (
                  <button
                    type="button"
                    onClick={() => void handleMakeCover(m.id)}
                    disabled={busy}
                    title="Vitrin yap"
                    aria-label="Vitrin yap"
                    className="rounded-full border border-border bg-background/90 p-1 shadow-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
                  >
                    <Star aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleMove(index, -1)}
                  disabled={busy || index === 0}
                  aria-label="Yukarı taşı"
                  className="rounded-full border border-border bg-background/90 px-1.5 py-0.5 text-xs shadow-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => void handleMove(index, 1)}
                  disabled={busy || index === media.length - 1}
                  aria-label="Aşağı taşı"
                  className="rounded-full border border-border bg-background/90 px-1.5 py-0.5 text-xs shadow-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
                >
                  ▼
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
