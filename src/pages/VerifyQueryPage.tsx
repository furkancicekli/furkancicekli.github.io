import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '@/components/ui'

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'

/** Strips spaces and dashes from a serial-like input. */
function normalizeSerial(input: string): string {
  return input.replace(/[\s-]/g, '')
}

/** Computes whether a full digit string (including check digit) satisfies the Luhn checksum. */
function luhnIsValid(digits: string): boolean {
  let sum = 0
  let double = false // rightmost digit (the check digit) does not double
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}

/** Validates that the input, once normalized, is a 16-digit Luhn-valid serial number. */
function isValidSerial(input: string): boolean {
  const normalized = normalizeSerial(input)
  if (!/^\d{16}$/.test(normalized)) return false
  return luhnIsValid(normalized)
}

/**
 * Genel sertifika sorgulama sayfası: ziyaretçi karttaki 16 haneli seri
 * numarasını girer, geçerliyse ilgili /verify/:token sayfasına yönlendirilir.
 * Kimlik doğrulama gerektirmez, App.tsx'te PublicShell ve /admin dışında
 * bağımsız bir rota olarak tanımlıdır (VerifyPage ile aynı görsel aile).
 */
export function VerifyQueryPage() {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const normalized = normalizeSerial(value)
    if (!isValidSerial(normalized)) {
      setError('Numara hatalı görünüyor — kontrol et.')
      return
    }

    setBusy(true)
    try {
      const res = await fetch(`/api/verify-serial/${normalized}`)
      const data = (await res.json().catch(() => ({}))) as {
        valid?: boolean
        certificate?: { qrToken: string }
      }
      if (data.valid && data.certificate) {
        navigate(`/verify/${data.certificate.qrToken}`)
        return
      }
      setError('Sertifika bulunamadı.')
    } catch {
      setError('Bağlantı hatası. Tekrar deneyin.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8 text-center">
        <div className="flex justify-center">
          <Logo decorative className="h-16 w-[33px] text-foreground" />
        </div>

        <h1 className="font-serif text-2xl font-bold text-foreground">Sertifika Sorgula</h1>

        <p className="text-sm text-muted-foreground">
          Ürünle birlikte gelen karttaki 16 haneli sertifika numarasını gir.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3 text-left">
          <label className="block space-y-1">
            <span className="sr-only">Sertifika numarası</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0000 0000 0000 0000"
              className={`${inputClass} text-center font-mono tracking-wide`}
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {busy ? 'Sorgulanıyor…' : 'Sorgula'}
          </button>
        </form>
      </div>
    </main>
  )
}
