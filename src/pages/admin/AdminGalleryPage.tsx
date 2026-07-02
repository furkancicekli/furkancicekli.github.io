import { useEffect, useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { deleteGalleryItem, listGallery, patchGallerySort, uploadGalleryImage } from './api'
import type { GalleryItem } from './api'
import { useConfirm } from './ConfirmDialog'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 15 * 1024 * 1024

const UPLOAD_ERRORS: Record<string, string> = {
  invalid_file: 'desteklenmeyen dosya türü',
  file_too_large: '15 MB sınırını aşıyor',
  invalid_request: 'geçersiz istek',
  network: 'bağlantı hatası',
  unknown: 'yüklenemedi',
}

/**
 * Galeri yöneticisi: MediaUploader'a benzer tıkla-veya-sürükle yükleme alanı,
 * ancak bağımsız galeri API'si üzerinden çalışır (ürün medyasından farklı uç
 * noktalar ve veri şekli). ▲/▼ butonları komşu öğeyle sort takası yapar —
 * SSS sayfasındaki desenle aynı: iki PATCH, busy flag, try/finally refresh.
 */
export function AdminGalleryPage() {
  const [items, setItems] = useState<GalleryItem[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { confirm, confirmDialog } = useConfirm()

  async function refresh() {
    const result = await listGallery()
    if (result.ok) {
      setItems(result.data)
      setLoadError(false)
    } else {
      setLoadError(true)
    }
  }

  useEffect(() => {
    let cancelled = false
    listGallery().then((result) => {
      if (cancelled) return
      if (result.ok) {
        setItems(result.data)
      } else {
        setLoadError(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files)
    if (list.length === 0 || uploading) return
    setUploadErrors([])
    const failed: string[] = []
    let done = 0
    setUploading({ done: 0, total: list.length })
    for (const file of list) {
      // Sunucu da doğruluyor; burada erken ve dosya-adıyla hata veriyoruz
      if (!ACCEPTED_TYPES.includes(file.type)) {
        failed.push(`${file.name}: desteklenmeyen dosya türü (JPEG/PNG/WebP)`)
      } else if (file.size > MAX_BYTES) {
        failed.push(`${file.name}: 15 MB sınırını aşıyor`)
      } else {
        const result = await uploadGalleryImage(file)
        if (!result.ok) failed.push(`${file.name}: ${UPLOAD_ERRORS[result.error] ?? UPLOAD_ERRORS.unknown}`)
      }
      done += 1
      setUploading({ done, total: list.length })
    }
    setUploading(null)
    setUploadErrors(failed)
    if (inputRef.current) inputRef.current.value = ''
    await refresh()
  }

  async function handleMove(index: number, direction: -1 | 1) {
    if (!items) return
    const neighborIndex = index + direction
    if (neighborIndex < 0 || neighborIndex >= items.length) return
    const current = items[index]
    const neighbor = items[neighborIndex]
    setListError(null)
    setBusy(true)
    try {
      const [res1, res2] = await Promise.all([
        patchGallerySort(current.id, neighbor.sort),
        patchGallerySort(neighbor.id, current.sort),
      ])
      if (!res1.ok || !res2.ok) {
        setListError(UPLOAD_ERRORS.unknown)
      }
    } finally {
      setBusy(false)
      await refresh()
    }
  }

  async function handleDelete(id: number) {
    if (!(await confirm({ title: 'Fotoğrafı sil', message: 'Bu fotoğraf silinecek. Emin misin?' }))) return
    setListError(null)
    setBusy(true)
    try {
      const result = await deleteGalleryItem(id)
      if (!result.ok) {
        setListError(UPLOAD_ERRORS[result.error] ?? UPLOAD_ERRORS.unknown)
      }
    } finally {
      setBusy(false)
      await refresh()
    }
  }

  return (
    <div className="space-y-10">
      {confirmDialog}
      <header>
        <h1 className="font-serif text-2xl font-bold">Galeri</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sitedeki galeri fotoğraflarını buradan yönetirsin. Sıralama sitede aynı şekilde görünür.
        </p>
      </header>

      <section className="space-y-4">
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
            {uploading
              ? `Yükleniyor… ${Math.min(uploading.done + 1, uploading.total)}/${uploading.total}`
              : 'Fotoğraf eklemek için tıkla ya da sürükleyip bırak'}
          </span>
          <span className="text-xs text-muted-foreground">
            JPEG, PNG veya WebP · dosya başına en fazla 15 MB · birden çok dosya seçebilirsin
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

        {uploadErrors.length > 0 && (
          <ul role="alert" className="space-y-1 text-sm text-destructive">
            {uploadErrors.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        {listError && (
          <p role="alert" className="text-sm text-destructive">
            {listError}
          </p>
        )}

        {loadError && (
          <p role="alert" className="text-sm text-destructive">
            Galeri yüklenemedi. Tekrar deneyin.
          </p>
        )}

        {!loadError && items === null && <p className="text-sm text-muted-foreground">Yükleniyor…</p>}

        {!loadError && items !== null && items.length === 0 && (
          <p className="text-sm text-muted-foreground">Galeri boş. İlk fotoğrafı yükle.</p>
        )}

        {!loadError && items !== null && items.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {items.map((item, index) => (
              <div key={item.id} className="group relative overflow-hidden rounded-md border border-border">
                <img
                  src={`/api/media/${item.r2Key}`}
                  loading="lazy"
                  alt=""
                  className="aspect-square w-full object-cover"
                />
                <span className="absolute left-1 top-1 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium shadow-sm">
                  {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => void handleDelete(item.id)}
                  disabled={busy}
                  aria-label="Fotoğrafı sil"
                  className="absolute right-1 top-1 rounded-full border border-border bg-background/90 p-1 opacity-0 shadow-sm outline-none transition-opacity focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 disabled:opacity-60"
                >
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
                <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
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
                    disabled={busy || index === items.length - 1}
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
      </section>
    </div>
  )
}
