const RANDOM_DIGITS = 11

/** Computes the Luhn check digit for a string of digits (without the check digit). */
function luhnCheckDigit(digits: string): number {
  let sum = 0
  let double = true // rightmost of the existing digits doubles first
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return (10 - (sum % 10)) % 10
}

/** Validates a full digit string (including check digit) against the Luhn algorithm. */
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

/**
 * Generates a 16-digit serial number: 4-digit year + 11 random digits + 1 Luhn check digit.
 * `year` must be supplied by the caller (route layer), never derived from Date.now here.
 */
export function generateSerial(year: number): string {
  const yearStr = String(year).padStart(4, '0').slice(-4)
  const randomBytes = crypto.getRandomValues(new Uint8Array(RANDOM_DIGITS))
  let randomDigits = ''
  for (let i = 0; i < RANDOM_DIGITS; i++) {
    randomDigits += String(randomBytes[i] % 10)
  }
  const body = yearStr + randomDigits
  const checkDigit = luhnCheckDigit(body)
  return body + String(checkDigit)
}

/** Strips spaces and dashes from a serial-like input. */
export function normalizeSerial(input: string): string {
  return input.replace(/[\s-]/g, '')
}

/** Validates that the input, once normalized, is a 16-digit Luhn-valid serial number. */
export function isValidSerial(input: string): boolean {
  const normalized = normalizeSerial(input)
  if (!/^\d{16}$/.test(normalized)) return false
  return luhnIsValid(normalized)
}

/** Formats a normalized 16-digit serial into groups of 4 separated by spaces. */
export function formatSerial(serial: string): string {
  const normalized = normalizeSerial(serial)
  const groups = normalized.match(/.{1,4}/g) ?? []
  return groups.join(' ')
}

const TURKISH_FOLD_MAP: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  i: 'i',
  İ: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  Ç: 'c',
  Ğ: 'g',
  Ö: 'o',
  Ş: 's',
  Ü: 'u',
}

/**
 * Slugifies a (possibly Turkish) product name: folds Turkish characters, lowercases,
 * keeps a-z0-9, collapses other runs into a single dash, trims leading/trailing dashes.
 * Falls back to 'urun' when the result is empty.
 */
export function slugify(name: string): string {
  let folded = ''
  for (const ch of name) {
    folded += TURKISH_FOLD_MAP[ch] ?? ch
  }
  const lowered = folded.toLowerCase()
  const collapsed = lowered
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return collapsed.length > 0 ? collapsed : 'urun'
}
