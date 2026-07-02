import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import QRCode from 'qrcode'
import { createProduct, patchCertificate, publishProduct, updateProduct } from './api'
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

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'

const STEPS = [
  { step: 1, label: 'Bilgiler' },
  { step: 2, label: 'Ürün Fotoğrafları' },
  { step: 3, label: 'Yapım Aşamaları' },
  { step: 4, label: 'Sertifika & Yayın' },
] as const

type WizardStep = 1 | 2 | 3 | 4

function verifyUrl(qrToken: string): string {
  return `${window.location.origin}/verify/${qrToken}`
}

function StepIndicator({ current }: { current: WizardStep }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
      {STEPS.map(({ step, label }, index) => {
        const done = step < current
        const active = step === current
        return (
          <li key={step} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                done
                  ? 'bg-primary text-primary-foreground'
                  : active
                    ? 'border-2 border-primary text-primary'
                    : 'border border-border text-muted-foreground'
              }`}
            >
              {done ? <Check aria-hidden="true" className="h-4 w-4" /> : step}
            </span>
            <span className={`text-sm ${active ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
              {label}
            </span>
            {index < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border sm:w-10" aria-hidden="true" />}
          </li>
        )
      })}
    </ol>
  )
}

interface MediaStepProps {
  productId: number
  kind: 'gallery' | 'process'
  helperText: string
  onBack: () => void
  onNext: () => void
}

/** Fotoğraf yükleme adımı — "Ürün Fotoğrafları" ve "Yapım Aşamaları" adımları
 * bu bileşeni sabit bir kind ile kullanır; yükleme işi MediaUploader'da. */
function MediaStep({ productId, kind, helperText, onBack, onNext }: MediaStepProps) {
  return (
    <section className="max-w-2xl space-y-4 rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{helperText}</p>

      <MediaUploader productId={productId} uploadKind={kind} filterKinds={[kind]} />

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          Geri
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
        >
          Devam
        </button>
      </div>
    </section>
  )
}

interface CertificateStepProps {
  productId: number
  certificateId: number
  serialNo: string
  qrToken: string
  onBack: () => void
}

function CertificateStep({ productId, certificateId, serialNo, qrToken, onBack }: CertificateStepProps) {
  const navigate = useNavigate()
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [buyerName, setBuyerName] = useState('')
  const [buyerBusy, setBuyerBusy] = useState(false)
  const [buyerMessage, setBuyerMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [publishBusy, setPublishBusy] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishOnFinish, setPublishOnFinish] = useState(true)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(verifyUrl(qrToken), { margin: 1, width: 220 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [qrToken])

  async function handleSaveBuyer(e: FormEvent) {
    e.preventDefault()
    setBuyerMessage(null)
    setBuyerBusy(true)
    const result = await patchCertificate(certificateId, buyerName.trim() === '' ? null : buyerName.trim())
    setBuyerBusy(false)
    if (!result.ok) {
      setBuyerMessage({ kind: 'error', text: ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.unknown })
      return
    }
    setBuyerMessage({ kind: 'ok', text: 'Kaydedildi.' })
  }

  async function handleFinish() {
    if (!publishOnFinish) {
      navigate('/admin/products')
      return
    }
    setPublishError(null)
    setPublishBusy(true)
    const result = await publishProduct(productId)
    setPublishBusy(false)
    if (!result.ok) {
      setPublishError(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.unknown)
      return
    }
    navigate('/admin/products')
  }

  return (
    <section className="max-w-2xl space-y-6 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col items-center gap-4 rounded-md border border-border p-6 text-center sm:flex-row sm:text-left">
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="Doğrulama QR kodu" className="h-40 w-40 rounded-md border border-border" />
        ) : (
          <div className="h-40 w-40 animate-pulse rounded-md border border-border bg-muted" />
        )}
        <div className="space-y-2">
          <p className="font-mono text-2xl font-semibold tracking-wider">{formatSerial(serialNo)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/verify/${qrToken}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              Doğrulama sayfası
            </a>
            {qrDataUrl && (
              <a
                download={`sertifika-${serialNo}.png`}
                href={qrDataUrl}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                PNG indir
              </a>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSaveBuyer} className="flex flex-wrap items-end gap-3">
        <label className="block flex-1 space-y-1">
          <span className="text-sm text-muted-foreground">Alıcı (opsiyonel)</span>
          <input type="text" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className={inputClass} />
        </label>
        <button
          type="submit"
          disabled={buyerBusy}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {buyerBusy ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </form>

      {buyerMessage && (
        <p
          role={buyerMessage.kind === 'ok' ? 'status' : 'alert'}
          className={`text-sm ${buyerMessage.kind === 'ok' ? 'text-green-600' : 'text-destructive'}`}
        >
          {buyerMessage.text}
        </p>
      )}

      {publishError && (
        <p role="alert" className="text-sm text-destructive">
          {publishError}
        </p>
      )}

      <div className="space-y-1 border-t border-border pt-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={publishOnFinish}
            onChange={(e) => setPublishOnFinish(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span className="text-sm font-medium">Sitede yayınla</span>
        </label>
        <p className="text-xs text-muted-foreground">
          Kapatırsan ürün taslak kalır, dilediğinde ürün sayfasından yayınlarsın.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          Geri
        </button>
        <button
          type="button"
          onClick={handleFinish}
          disabled={publishBusy}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {publishBusy ? 'Yayınlanıyor…' : 'Bitir'}
        </button>
      </div>
    </section>
  )
}

/**
 * Dört adımlı ürün ekleme sihirbazı: Bilgiler → Ürün Fotoğrafları →
 * Yapım Aşamaları → Sertifika & Yayın. Ürün ilk "Devam"da oluşturulur
 * (createProduct), sonraki adımlarda updateProduct ile güncellenir.
 * 2-4. adımlar yalnızca ürün oluşturulduktan sonra erişilebilir.
 */
export function AdminProductWizard() {
  const [step, setStep] = useState<WizardStep>(1)
  const [productId, setProductId] = useState<number | null>(null)
  const [certificate, setCertificate] = useState<{ id: number; serialNo: string; qrToken: string } | null>(null)

  const [nameTr, setNameTr] = useState('')
  const [material, setMaterial] = useState<string | null>(null)
  const [weightGrams, setWeightGrams] = useState('')
  const [size, setSize] = useState('')
  const [descriptionTr, setDescriptionTr] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleInfoSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedName = nameTr.trim()
    if (trimmedName === '') {
      setError(ERROR_MESSAGES.tr_name_required)
      return
    }

    let parsedWeight: number | null = null
    if (weightGrams.trim() !== '') {
      const n = Number(weightGrams)
      if (!Number.isFinite(n) || n < 0) {
        setError(ERROR_MESSAGES.invalid_request)
        return
      }
      parsedWeight = n
    }

    const input = {
      material,
      size: size.trim() === '' ? null : size.trim(),
      weightGrams: parsedWeight,
      translations: {
        tr: {
          name: trimmedName,
          description: descriptionTr.trim() === '' ? null : descriptionTr.trim(),
          story: null,
        },
      },
    }

    setBusy(true)
    if (productId === null) {
      const result = await createProduct(input)
      setBusy(false)
      if (!result.ok) {
        setError(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.unknown)
        return
      }
      setProductId(result.data.id)
      setCertificate(result.data.certificate)
      setStep(2)
    } else {
      const result = await updateProduct(productId, input)
      setBusy(false)
      if (!result.ok) {
        setError(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.unknown)
        return
      }
      setStep(2)
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div>
          <h1 className="font-serif text-2xl font-bold">Yeni ürün</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ürünü adım adım oluştur.</p>
        </div>
        <StepIndicator current={step} />
      </header>

      {step === 1 && (
        <form onSubmit={handleInfoSubmit} className="max-w-xl space-y-4 rounded-lg border border-border bg-card p-4">
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">Ad *</span>
            <input
              type="text"
              required
              value={nameTr}
              onChange={(e) => setNameTr(e.target.value)}
              className={inputClass}
            />
          </label>

          <MaterialSelect value={material} onChange={setMaterial} />

          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">Gram (opsiyonel)</span>
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
            <span className="text-sm text-muted-foreground">Boyut (opsiyonel)</span>
            <input type="text" value={size} onChange={(e) => setSize(e.target.value)} className={inputClass} />
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">Açıklama (opsiyonel)</span>
            <textarea
              rows={3}
              value={descriptionTr}
              onChange={(e) => setDescriptionTr(e.target.value)}
              className={inputClass}
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 border-t border-border pt-4">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {busy ? 'Kaydediliyor…' : 'Devam'}
            </button>
          </div>
        </form>
      )}

      {step === 2 && productId !== null && (
        <MediaStep
          productId={productId}
          kind="gallery"
          helperText="Ürünün galeri fotoğrafları."
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && productId !== null && (
        <MediaStep
          productId={productId}
          kind="process"
          helperText="Malzeme ve yapım süreci fotoğrafları"
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}

      {step === 4 && productId !== null && certificate !== null && (
        <CertificateStep
          productId={productId}
          certificateId={certificate.id}
          serialNo={certificate.serialNo}
          qrToken={certificate.qrToken}
          onBack={() => setStep(3)}
        />
      )}
    </div>
  )
}
