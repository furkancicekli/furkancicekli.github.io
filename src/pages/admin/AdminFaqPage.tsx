import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createFaq, deleteFaq, listFaqs, updateFaq } from './api'
import { useConfirm } from './ConfirmDialog'
import type { Faq, FaqTranslation, Lang } from './api'

const ERROR_MESSAGES: Record<string, string> = {
  tr_qa_required: 'Türkçe soru ve cevap zorunlu.',
  invalid_request: 'Form bilgilerini kontrol et.',
  not_found: 'Kayıt bulunamadı.',
  network: 'Bağlantı hatası. Tekrar deneyin.',
  unknown: 'Bir hata oluştu. Tekrar deneyin.',
}

const LANGS: { value: Lang; label: string }[] = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
]

const EMPTY_TRANSLATION: FaqTranslation = { question: '', answer: '' }

function emptyTranslations(): Record<Lang, FaqTranslation> {
  return { tr: { ...EMPTY_TRANSLATION }, en: { ...EMPTY_TRANSLATION }, ar: { ...EMPTY_TRANSLATION } }
}

function draftFromFaq(faq: Faq): Record<Lang, FaqTranslation> {
  const next = emptyTranslations()
  for (const lang of ['tr', 'en', 'ar'] as Lang[]) {
    const t = faq.translations[lang]
    if (t) next[lang] = t
  }
  return next
}

// translations objesini API'ye giderken temizler: boş dilleri (hem soru hem
// cevap boşsa) atar, tr her zaman gönderilir.
function toApiTranslations(drafts: Record<Lang, FaqTranslation>): Partial<Record<Lang, FaqTranslation>> {
  const result: Partial<Record<Lang, FaqTranslation>> = { tr: drafts.tr }
  for (const lang of ['en', 'ar'] as Lang[]) {
    const t = drafts[lang]
    if (t.question.trim() !== '' || t.answer.trim() !== '') {
      result[lang] = t
    }
  }
  return result
}

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'

interface FaqCardProps {
  faq: Faq
  index: number
  count: number
  busy: boolean
  onMove: (index: number, direction: -1 | 1) => void
  onSave: (faq: Faq, drafts: Record<Lang, FaqTranslation>) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

function FaqCard({ faq, index, count, busy, onMove, onSave, onDelete }: FaqCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [drafts, setDrafts] = useState<Record<Lang, FaqTranslation>>(() => draftFromFaq(faq))
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const { confirm, confirmDialog } = useConfirm()

  function updateDraft(lang: Lang, field: keyof FaqTranslation, value: string) {
    setDrafts((prev) => ({ ...prev, [lang]: { ...prev[lang], [field]: value } }))
  }

  async function handleSave() {
    setMessage(null)
    if (drafts.tr.question.trim() === '' || drafts.tr.answer.trim() === '') {
      setMessage({ kind: 'error', text: ERROR_MESSAGES.tr_qa_required })
      return
    }
    setSaving(true)
    try {
      await onSave(faq, drafts)
      setMessage({ kind: 'ok', text: 'Kaydedildi.' })
    } catch (err) {
      const errCode = err instanceof Error ? err.message : 'unknown'
      setMessage({ kind: 'error', text: ERROR_MESSAGES[errCode] ?? ERROR_MESSAGES.unknown })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!(await confirm({ title: 'Soruyu sil', message: 'Bu soru silinecek. Emin misin?' }))) return
    setMessage(null)
    setSaving(true)
    try {
      await onDelete(faq.id)
    } catch (err) {
      const errCode = err instanceof Error ? err.message : 'unknown'
      setMessage({ kind: 'error', text: ERROR_MESSAGES[errCode] ?? ERROR_MESSAGES.unknown })
    } finally {
      setSaving(false)
    }
  }

  const trQuestion = faq.translations.tr?.question

  return (
    <li className="space-y-3 rounded-md border border-border p-3">
      {confirmDialog}
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => onMove(index, -1)}
            disabled={busy || index === 0}
            aria-label="Yukarı taşı"
            className="rounded-md border border-border px-2 py-1 text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => onMove(index, 1)}
            disabled={busy || index === count - 1}
            aria-label="Aşağı taşı"
            className="rounded-md border border-border px-2 py-1 text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
          >
            ▼
          </button>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex-1 rounded-md px-2 py-1 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          {trQuestion ? trQuestion : <span className="italic text-muted-foreground">(soru yok)</span>}
        </button>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-border pt-3">
          {LANGS.map((l) => (
            <div key={l.value} className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {l.label}
                {l.value === 'tr' ? (
                  <span className="ml-1 uppercase">zorunlu</span>
                ) : (
                  <span className="ml-1 text-muted-foreground">(opsiyonel)</span>
                )}
              </p>
              <label className="block space-y-1">
                <span className="text-sm text-muted-foreground">
                  Soru{l.value === 'tr' ? ' *' : ' (opsiyonel)'}
                </span>
                <input
                  type="text"
                  required={l.value === 'tr'}
                  value={drafts[l.value].question}
                  onChange={(e) => updateDraft(l.value, 'question', e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm text-muted-foreground">
                  Cevap{l.value === 'tr' ? ' *' : ' (opsiyonel)'}
                </span>
                <textarea
                  rows={3}
                  required={l.value === 'tr'}
                  value={drafts[l.value].answer}
                  onChange={(e) => updateDraft(l.value, 'answer', e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
          ))}

          {message && (
            <p
              role={message.kind === 'ok' ? 'status' : 'alert'}
              className={`text-sm ${message.kind === 'ok' ? 'text-green-600' : 'text-destructive'}`}
            >
              {message.text}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || busy}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              Kaydet
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving || busy}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              Sil
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

/**
 * SSS (sıkça sorulan sorular) yönetimi. Ürün süreç adımlarındaki desene
 * benzer: sort swap ile sıralama, her kart kendi taslağını tutar, kaydet/sil
 * bağımsız çalışır.
 */
export function AdminFaqPage() {
  const [faqs, setFaqs] = useState<Faq[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const [newTrQuestion, setNewTrQuestion] = useState('')
  const [newTrAnswer, setNewTrAnswer] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  async function refresh() {
    const result = await listFaqs()
    if (result.ok) {
      setFaqs(result.data)
      setLoadError(false)
    } else {
      setLoadError(true)
    }
  }

  useEffect(() => {
    let cancelled = false
    listFaqs().then((result) => {
      if (cancelled) return
      if (result.ok) {
        setFaqs(result.data)
      } else {
        setLoadError(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleMove(index: number, direction: -1 | 1) {
    if (!faqs) return
    const neighborIndex = index + direction
    if (neighborIndex < 0 || neighborIndex >= faqs.length) return
    const current = faqs[index]
    const neighbor = faqs[neighborIndex]
    setListError(null)
    setBusy(true)
    try {
      const [res1, res2] = await Promise.all([
        updateFaq(current.id, { translations: current.translations, sort: neighbor.sort }),
        updateFaq(neighbor.id, { translations: neighbor.translations, sort: current.sort }),
      ])
      if (!res1.ok || !res2.ok) {
        setListError(ERROR_MESSAGES.unknown)
      }
    } finally {
      setBusy(false)
      await refresh()
    }
  }

  async function handleSaveCard(faq: Faq, drafts: Record<Lang, FaqTranslation>) {
    const result = await updateFaq(faq.id, { translations: toApiTranslations(drafts), sort: faq.sort })
    if (!result.ok) {
      throw new Error(result.error)
    }
    await refresh()
  }

  async function handleDeleteCard(id: number) {
    const result = await deleteFaq(id)
    if (!result.ok) {
      throw new Error(result.error)
    }
    await refresh()
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setAddError(null)
    const tr = { question: newTrQuestion.trim(), answer: newTrAnswer.trim() }
    if (tr.question === '' || tr.answer === '') {
      setAddError(ERROR_MESSAGES.tr_qa_required)
      return
    }
    setAdding(true)
    const result = await createFaq({ translations: { tr } })
    setAdding(false)
    if (!result.ok) {
      setAddError(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.unknown)
      return
    }
    setNewTrQuestion('')
    setNewTrAnswer('')
    await refresh()
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-serif text-2xl font-bold">SSS</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sıkça sorulan soruları ve çevirilerini yönet.</p>
      </header>

      <section className="max-w-2xl space-y-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Soru ekle</h2>

        <form onSubmit={handleAdd} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">Soru (Türkçe) *</span>
            <input
              type="text"
              required
              value={newTrQuestion}
              onChange={(e) => setNewTrQuestion(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">Cevap (Türkçe) *</span>
            <textarea
              rows={3}
              required
              value={newTrAnswer}
              onChange={(e) => setNewTrAnswer(e.target.value)}
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
            {adding ? 'Ekleniyor…' : 'Soru ekle'}
          </button>
        </form>
      </section>

      <section className="max-w-2xl space-y-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Sorular</h2>

        {listError && (
          <p role="alert" className="text-sm text-destructive">
            {listError}
          </p>
        )}

        {loadError && (
          <p role="alert" className="text-sm text-destructive">
            Sorular yüklenemedi. Tekrar deneyin.
          </p>
        )}

        {!loadError && faqs === null && <p className="text-sm text-muted-foreground">Yükleniyor…</p>}

        {!loadError && faqs !== null && faqs.length === 0 && (
          <p className="text-sm text-muted-foreground">Henüz soru yok.</p>
        )}

        {!loadError && faqs !== null && faqs.length > 0 && (
          <ol className="space-y-4">
            {faqs.map((faq, index) => (
              <FaqCard
                key={faq.id}
                faq={faq}
                index={index}
                count={faqs.length}
                busy={busy}
                onMove={handleMove}
                onSave={handleSaveCard}
                onDelete={handleDeleteCard}
              />
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
