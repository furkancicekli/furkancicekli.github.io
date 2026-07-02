import { useEffect, useRef, useState } from 'react'
import { createMaterial, listMaterials } from './api'
import type { Material } from './api'

const ERROR_MESSAGES: Record<string, string> = {
  invalid_request: 'Malzeme adı geçersiz.',
  network: 'Bağlantı hatası. Tekrar deneyin.',
  unknown: 'Bir hata oluştu. Tekrar deneyin.',
}

const NEW_MATERIAL_VALUE = '__new__'

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'

interface MaterialSelectProps {
  value: string | null
  onChange: (value: string | null) => void
}

/**
 * Malzeme seçici: mevcut malzemeleri listeler, "+ Yeni malzeme…" seçilirse
 * inline bir isim girişi ve ekleme butonu açar. Yeni malzeme oluşturulunca
 * yerel listeye eklenir ve otomatik seçilir.
 */
export function MaterialSelect({ value, onChange }: MaterialSelectProps) {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loadError, setLoadError] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const newInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    listMaterials().then((result) => {
      if (cancelled) return
      if (result.ok) {
        setMaterials(result.data)
      } else {
        setLoadError(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (creating) newInputRef.current?.focus()
  }, [creating])

  function handleSelectChange(raw: string) {
    if (raw === NEW_MATERIAL_VALUE) {
      setError(null)
      setCreating(true)
      return
    }
    onChange(raw === '' ? null : raw)
  }

  async function handleCreate() {
    const name = newName.trim()
    if (name === '') return
    setError(null)
    setBusy(true)
    const result = await createMaterial(name)
    setBusy(false)
    if (!result.ok) {
      setError(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.unknown)
      return
    }
    setMaterials((prev) => {
      if (prev.some((m) => m.id === result.data.id)) return prev
      return [...prev, result.data].sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    })
    onChange(result.data.name)
    setNewName('')
    setCreating(false)
  }

  function handleCancelCreate() {
    setCreating(false)
    setNewName('')
    setError(null)
  }

  return (
    <div className="space-y-2">
      <label className="block space-y-1">
        <span className="text-sm text-muted-foreground">Malzeme</span>
        <select value={value ?? ''} onChange={(e) => handleSelectChange(e.target.value)} className={inputClass}>
          <option value="">— Seçiniz —</option>
          {materials.map((m) => (
            <option key={m.id} value={m.name}>
              {m.name}
            </option>
          ))}
          <option value={NEW_MATERIAL_VALUE}>+ Yeni malzeme…</option>
        </select>
      </label>

      {loadError && (
        <p role="alert" className="text-sm text-destructive">
          Malzemeler yüklenemedi. Tekrar deneyin.
        </p>
      )}

      {/* DİKKAT: aşağıda <form> KULLANILMAZ — bu bileşen üst formların (wizard
          adım 1, edit sayfası) içinde render edilir; iç içe form HTML'de
          geçersizdir ve "Ekle" butonu dış formu submit eder. */}
      {creating && (
        <div className="flex items-end gap-2">
          <label className="block flex-1 space-y-1">
            <span className="text-sm text-muted-foreground">Yeni malzeme adı</span>
            <input
              ref={newInputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault() // Enter dış formu göndermesin — malzemeyi ekle
                  void handleCreate()
                }
              }}
              className={inputClass}
            />
          </label>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={busy || newName.trim() === ''}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {busy ? 'Ekleniyor…' : 'Ekle'}
          </button>
          <button
            type="button"
            onClick={handleCancelCreate}
            disabled={busy}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            Vazgeç
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
