import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Admin content management E2E flow.
 *
 * These tests exercise the full admin workflow against the real local D1
 * database (via `npm run dev` + Miniflare) — there is no API mocking here.
 * Tests run sequentially (see playwright.config.ts: workers: 1) and each
 * step builds on state created by the previous one within this file.
 *
 * Local admin bootstrap requirement:
 * Since these tests cannot provision an admin user themselves (bootstrap
 * only happens via `.dev.vars` env vars on first login), we verify up front
 * that the expected local admin credentials actually work by hitting
 * POST /api/auth/login directly. If that returns 401, the local D1/.dev.vars
 * setup is missing or the admin hasn't been bootstrapped yet — we fail hard
 * (not skip) so the gap is visible.
 *
 * Local D1 may contain leftover data from manual testing, so everything
 * this file creates is tagged with a distinctive `e2e-test-` prefix plus
 * `Date.now()` for uniqueness, and is cleaned up at the end of the run.
 *
 * Product creation flow (certification wizard):
 * /admin/products/new is a 4-step wizard (AdminProductWizard.tsx):
 *   1. Bilgiler       — name/material/weight/size/description; "Devam" calls
 *                        createProduct and returns {id, certificate}.
 *   2. Ürün Fotoğrafları — MediaUploader dropzone (optional); "Devam" to skip.
 *   3. Yapım Aşamaları   — MediaUploader dropzone (optional); "Devam" advances
 *                        straight to step 4 (no separate confirmation step).
 *   4. Sertifika & Yayın — shows the generated 16-digit serial + QR pointing at
 *                        /verify/:qrToken, plus a "Sitede yayınla" checkbox
 *                        (checked by default) and a single "Bitir" button.
 *                        With the checkbox checked, "Bitir" calls
 *                        publishProduct and returns to /admin/products with
 *                        the product shown as "Yayında"; unchecking it would
 *                        leave the product as a draft instead (not exercised
 *                        by this suite).
 *
 * There are no native browser dialogs anywhere in the admin app anymore —
 * destructive actions go through an in-app ConfirmDialog (role="alertdialog").
 * Do NOT use page.on('dialog') in this file.
 */

const ADMIN_EMAIL = 'admin@local.test'
const ADMIN_PASSWORD = 'yerel-deneme-1234'

const RUN_ID = Date.now()
const PRODUCT_NAME = `e2e-test-${RUN_ID}`
const MATERIAL_NAME = `e2e-malzeme-${RUN_ID}`
const FAQ_QUESTION = `E2E test sorusu ${RUN_ID}?`
const FAQ_ANSWER = `E2E test cevabı ${RUN_ID}.`

const SERIAL_FORMAT_RE = /^\d{4} \d{4} \d{4} \d{4}$/

/**
 * Luhn check-digit computation, copied verbatim (algorithm-wise) from
 * src/worker/lib/serial.ts / src/pages/VerifyQueryPage.tsx, so we can mint a
 * syntactically-valid 16-digit serial that the client-side validator accepts
 * but that does not correspond to any real certificate.
 */
function luhnCheckDigit(digits: string): number {
  let sum = 0
  let double = true // rightmost digit of the *body* doubles first, since the
  // check digit itself is appended after and is never doubled.
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

/** Builds an unknown-but-valid-format 16-digit serial (15-digit body + Luhn check digit). */
function makeUnknownValidSerial(): string {
  // 15-digit body: distinguishable from real serials (which start with a
  // 4-digit year, e.g. "2026...") by using an all-9s prefix that is very
  // unlikely to collide with any generated serial.
  const body = '999999999999999'
  const check = luhnCheckDigit(body)
  return body + String(check)
}

async function loginViaUi(page: Page) {
  await page.goto('/admin/login')
  await page.getByLabel('E-posta').fill(ADMIN_EMAIL)
  await page.getByLabel('Şifre').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Giriş Yap' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

test.describe.configure({ mode: 'serial' })

test.describe('admin content management flows', () => {
  let productSerialFormatted = ''
  let certificateVerifyHref = ''

  test('local admin bootstrap sanity check', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    })
    if (res.status() === 401) {
      throw new Error(
        'Yerel admin girişi başarısız (401). ' +
          '.dev.vars bootstrap gerekli: cp .dev.vars.example .dev.vars && ilk girişi yap',
      )
    }
    expect(res.ok()).toBe(true)
  })

  test('create a new product via the certification wizard', async ({ page }) => {
    await loginViaUi(page)

    await page.goto('/admin/products/new')
    await expect(page).toHaveURL(/\/admin\/products\/new$/)

    // --- Step 1: Bilgiler ---
    const nameInput = page.getByLabel('Ad *')
    await nameInput.fill(PRODUCT_NAME)

    const materialSelect = page.getByRole('combobox', { name: 'Malzeme (opsiyonel)' })
    await materialSelect.selectOption('__new__')

    const newMaterialInput = page.getByLabel('Yeni malzeme adı')
    await expect(newMaterialInput).toBeVisible()
    await newMaterialInput.fill(MATERIAL_NAME)
    await page.getByRole('button', { name: 'Ekle' }).click()

    // Regression guard: adding a material must NOT reset step 1 state via a
    // stray nested-form submission (MaterialSelect intentionally avoids
    // rendering its own <form> for this reason).
    await expect(materialSelect).toHaveValue(MATERIAL_NAME)
    await expect(nameInput).toHaveValue(PRODUCT_NAME)

    await page.getByLabel('Gram (opsiyonel)').fill('12.5')
    await page.getByLabel('Boyut (opsiyonel)').fill('M')
    await page.getByLabel('Açıklama (opsiyonel)').fill('E2E test açıklaması.')

    await page.getByRole('button', { name: 'Devam' }).click()

    // --- Step 2: Ürün Fotoğrafları (skip) ---
    await expect(page.getByText('Ürünün galeri fotoğrafları.')).toBeVisible()
    await page.getByRole('button', { name: 'Devam' }).click()

    // --- Step 3: Yapım Aşamaları (skip) — advances straight to step 4 ---
    await expect(page.getByText('Malzeme ve yapım süreci fotoğrafları')).toBeVisible()
    await page.getByRole('button', { name: 'Devam' }).click()

    // --- Step 4: Sertifika & Yayın ---
    const serialEl = page.locator('p.font-mono', { hasText: /^\d{4} \d{4} \d{4} \d{4}$/ })
    await expect(serialEl).toBeVisible()
    const serialText = (await serialEl.textContent())?.trim() ?? ''
    expect(serialText).toMatch(SERIAL_FORMAT_RE)
    productSerialFormatted = serialText

    await expect(page.getByRole('img', { name: 'Doğrulama QR kodu' })).toBeVisible()

    // "Sitede yayınla" checkbox is checked by default; finishing with it
    // checked publishes the product (single "Bitir" button now replaces the
    // old separate Yayınla/Taslak-olarak-bitir buttons).
    const publishCheckbox = page.getByRole('checkbox', { name: 'Sitede yayınla' })
    await expect(publishCheckbox).toBeChecked()

    await page.getByRole('button', { name: 'Bitir' }).click()

    await expect(page).toHaveURL(/\/admin\/products$/)
    const productRow = page.locator('tr', { has: page.getByRole('link', { name: PRODUCT_NAME }) })
    await expect(productRow).toBeVisible()
    await expect(productRow.getByText('Yayında')).toBeVisible()
  })

  test('find the certificate card and open its verification page', async ({ page }) => {
    await loginViaUi(page)

    await page.goto('/admin/certificates')
    const certCard = page.locator('li', { hasText: productSerialFormatted })
    await expect(certCard).toBeVisible()
    await expect(certCard.getByRole('img', { name: 'Doğrulama QR kodu' })).toBeVisible()

    const verifyLink = certCard.getByRole('link', { name: 'Doğrulama sayfası' })
    certificateVerifyHref = (await verifyLink.getAttribute('href')) ?? ''
    expect(certificateVerifyHref).toMatch(/^\/verify\//)

    await page.goto(certificateVerifyHref)
    await expect(page.getByRole('heading', { name: 'Orijinallik Sertifikası' })).toBeVisible()
    await expect(page.getByText(PRODUCT_NAME)).toBeVisible()
  })

  test('public /verify query page: valid serial, invalid format, unknown serial', async ({ page }) => {
    // VerifyQueryPage's input auto-formats as you type (formatSerialInput in
    // src/pages/VerifyQueryPage.tsx): strips non-digits, caps at 16 digits,
    // and inserts a dash after every group of 4 (e.g. "1234-5678-...").
    // Its placeholder is therefore dash-separated, not space-separated.
    const productSerialDigitsOnly = productSerialFormatted.replace(/\s/g, '')
    const productSerialDashFormatted = productSerialDigitsOnly.replace(/(\d{4})(?=\d)/g, '$1-')

    await page.goto('/verify')

    // 1) Valid, known serial — fill with digits only (as a user would type);
    // the field auto-formats with dashes, and submission still works since
    // the server normalizes.
    const input = page.getByPlaceholder('0000-0000-0000-0000')
    await input.fill(productSerialDigitsOnly)
    await expect(input).toHaveValue(productSerialDashFormatted)
    await page.getByRole('button', { name: 'Sorgula' }).click()
    await expect(page).toHaveURL(/\/verify\/.+/)
    await expect(page.getByRole('heading', { name: 'Orijinallik Sertifikası' })).toBeVisible()

    // 2) Syntactically invalid number — inline format error, no navigation.
    await page.goto('/verify')
    const input2 = page.getByPlaceholder('0000-0000-0000-0000')
    await input2.fill('1234')
    await expect(input2).toHaveValue('1234')
    await page.getByRole('button', { name: 'Sorgula' }).click()
    await expect(page.getByRole('alert')).toHaveText('Numara hatalı görünüyor — kontrol et.')
    await expect(page).toHaveURL(/\/verify$/)

    // 3) Syntactically valid but unknown serial — passes client format check,
    // server reports not found.
    const unknownSerial = makeUnknownValidSerial()
    expect(unknownSerial).toMatch(/^\d{16}$/)
    const unknownSerialDashFormatted = unknownSerial.replace(/(\d{4})(?=\d)/g, '$1-')
    await page.goto('/verify')
    const input3 = page.getByPlaceholder('0000-0000-0000-0000')
    await input3.fill(unknownSerial)
    await expect(input3).toHaveValue(unknownSerialDashFormatted)
    await page.getByRole('button', { name: 'Sorgula' }).click()
    await expect(page.getByRole('alert')).toHaveText('Sertifika bulunamadı.')
    await expect(page).toHaveURL(/\/verify$/)
  })

  test('add and delete a FAQ entry via the confirm modal', async ({ page }) => {
    await loginViaUi(page)

    await page.goto('/admin/faq')
    await page.getByLabel('Soru (Türkçe) *').fill(FAQ_QUESTION)
    await page.getByLabel('Cevap (Türkçe) *').fill(FAQ_ANSWER)
    await page.getByRole('button', { name: 'Soru ekle' }).click()

    const faqToggle = page.getByRole('button', { name: FAQ_QUESTION })
    await expect(faqToggle).toBeVisible()

    // The delete button only renders once the card is expanded.
    await faqToggle.click()
    const faqCard = page.locator('li', { has: faqToggle })
    await faqCard.getByRole('button', { name: 'Sil' }).click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Sil' }).click()

    await expect(page.getByRole('button', { name: FAQ_QUESTION })).toHaveCount(0)
  })

  test('cleanup: delete the product created in this run (cascades certificate)', async ({ page }) => {
    await loginViaUi(page)

    await page.goto('/admin/products')
    await page.getByRole('link', { name: PRODUCT_NAME }).click()
    await expect(page).toHaveURL(/\/admin\/products\/\d+$/)

    await page.getByRole('button', { name: 'Ürünü sil' }).click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Sil' }).click()

    await expect(page).toHaveURL(/\/admin\/products$/)
    await expect(page.getByRole('link', { name: PRODUCT_NAME })).toHaveCount(0)
  })
})
