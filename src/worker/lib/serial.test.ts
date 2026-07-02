import { describe, it, expect } from 'vitest'
import { generateSerial, isValidSerial, normalizeSerial, formatSerial, slugify } from './serial'

describe('serial generation', () => {
  it('generates a 16-digit serial starting with the given year', () => {
    const serial = generateSerial(2026)
    expect(serial).toMatch(/^\d{16}$/)
    expect(serial.startsWith('2026')).toBe(true)
  })

  it('generates a Luhn-valid serial', () => {
    const serial = generateSerial(2026)
    expect(isValidSerial(serial)).toBe(true)
  })

  it('generates different serials on consecutive calls', () => {
    const a = generateSerial(2026)
    const b = generateSerial(2026)
    expect(a).not.toBe(b)
  })
})

describe('isValidSerial', () => {
  it('rejects wrong length', () => {
    expect(isValidSerial('123456789012345')).toBe(false) // 15 digits
    expect(isValidSerial('12345678901234567')).toBe(false) // 17 digits
  })

  it('rejects non-digit input', () => {
    expect(isValidSerial('2026482910447abc')).toBe(false)
  })

  it('rejects a corrupted check digit', () => {
    const serial = generateSerial(2026)
    const lastDigit = Number(serial[15])
    const corruptedLastDigit = (lastDigit + 1) % 10
    const corrupted = serial.slice(0, 15) + String(corruptedLastDigit)
    expect(isValidSerial(corrupted)).toBe(false)
  })

  it('accepts spaced/grouped input', () => {
    const serial = generateSerial(2026)
    const formatted = formatSerial(serial)
    expect(isValidSerial(formatted)).toBe(true)
  })
})

describe('normalizeSerial / formatSerial round-trip', () => {
  it('formats into groups of 4 separated by spaces', () => {
    const serial = generateSerial(2026)
    const formatted = formatSerial(serial)
    expect(formatted).toMatch(/^\d{4} \d{4} \d{4} \d{4}$/)
  })

  it('normalize strips spaces and dashes back to the raw serial', () => {
    const serial = generateSerial(2026)
    const formatted = formatSerial(serial)
    expect(normalizeSerial(formatted)).toBe(serial)

    const dashed = serial.match(/.{1,4}/g)!.join('-')
    expect(normalizeSerial(dashed)).toBe(serial)
  })
})

describe('slugify', () => {
  it('converts a simple Turkish phrase to a slug', () => {
    expect(slugify('Kuka Tesbih')).toBe('kuka-tesbih')
  })

  it('folds Turkish characters and symbols', () => {
    expect(slugify('Şimşir & Gümüş Püskül')).toBe('simsir-gumus-puskul')
  })

  it('folds İ/ı correctly', () => {
    expect(slugify('İnci')).toBe('inci')
  })

  it('falls back to "urun" for symbol-only input', () => {
    expect(slugify('!!!')).toBe('urun')
  })

  it('falls back to "urun" for empty input', () => {
    expect(slugify('')).toBe('urun')
  })
})
