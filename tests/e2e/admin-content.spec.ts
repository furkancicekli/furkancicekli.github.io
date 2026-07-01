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
 */

const ADMIN_EMAIL = 'admin@local.test'
const ADMIN_PASSWORD = 'yerel-deneme-1234'

const RUN_ID = Date.now()
const PRODUCT_SLUG = `e2e-test-${RUN_ID}`
const PRODUCT_NAME = `E2E Test Ürün ${RUN_ID}`
const SERIAL_NO = `E2E-${RUN_ID}`
const FAQ_QUESTION = `E2E test sorusu ${RUN_ID}?`
const FAQ_ANSWER = `E2E test cevabı ${RUN_ID}.`

async function loginViaUi(page: Page) {
  await page.goto('/admin/login')
  await page.getByLabel('E-posta').fill(ADMIN_EMAIL)
  await page.getByLabel('Şifre').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Giriş Yap' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

test.describe.serial('admin content management flows', () => {
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

  test('create a new product via admin UI', async ({ page }) => {
    await loginViaUi(page)

    await page.goto('/admin/products')
    await page.getByRole('link', { name: 'Yeni ürün' }).click()
    await expect(page).toHaveURL(/\/admin\/products\/new$/)

    await page.getByLabel('Slug').fill(PRODUCT_SLUG)
    await page.getByLabel(/^Ad/).fill(PRODUCT_NAME)

    await page.getByRole('button', { name: 'Kaydet' }).click()

    // Create navigates to /admin/products/:id on success.
    await expect(page).toHaveURL(/\/admin\/products\/\d+$/)

    await page.goto('/admin/products')
    await expect(page.getByRole('link', { name: PRODUCT_NAME })).toBeVisible()
  })

  test('mark product as sold, set serial number, then create a certificate', async ({ page }) => {
    await loginViaUi(page)

    await page.goto('/admin/products')
    await page.getByRole('link', { name: PRODUCT_NAME }).click()
    await expect(page).toHaveURL(/\/admin\/products\/\d+$/)

    await page.getByLabel('Seri no').fill(SERIAL_NO)
    await page.getByLabel('Durum').selectOption('sold')

    await page.getByRole('button', { name: 'Kaydet' }).click()
    await expect(page.getByRole('status')).toHaveText('Kaydedildi.')

    await page.goto('/admin/certificates')
    await page.getByLabel('Ürün *').selectOption({ label: PRODUCT_NAME })
    await page.getByRole('button', { name: 'Sertifika oluştur' }).click()

    // The cert card shows the serial number we just set — locate it uniquely.
    const certCard = page.locator('li', { hasText: SERIAL_NO })
    await expect(certCard).toBeVisible()
    await expect(certCard.getByRole('img', { name: 'Doğrulama QR kodu' })).toBeVisible()
  })

  test('open the verification page from the certificate card', async ({ page }) => {
    await loginViaUi(page)

    await page.goto('/admin/certificates')
    const certCard = page.locator('li', { hasText: SERIAL_NO })
    await expect(certCard).toBeVisible()

    const verifyLink = certCard.getByRole('link', { name: 'Doğrulama sayfası' })
    certificateVerifyHref = (await verifyLink.getAttribute('href')) ?? ''
    expect(certificateVerifyHref).toMatch(/^\/verify\//)

    await page.goto(certificateVerifyHref)
    await expect(page.getByRole('heading', { name: 'Orijinallik Sertifikası' })).toBeVisible()

    await page.goto('/verify/gecersiz-token')
    await expect(page.getByRole('heading', { name: 'Sertifika bulunamadı' })).toBeVisible()
  })

  test('add and delete a FAQ entry', async ({ page }) => {
    await loginViaUi(page)

    await page.goto('/admin/faq')
    await page.getByLabel('Soru (Türkçe) *').fill(FAQ_QUESTION)
    await page.getByLabel('Cevap (Türkçe) *').fill(FAQ_ANSWER)
    await page.getByRole('button', { name: 'Soru ekle' }).click()

    const faqEntry = page.getByRole('button', { name: FAQ_QUESTION })
    await expect(faqEntry).toBeVisible()

    // The delete button only renders once the card is expanded.
    await faqEntry.click()
    const faqCard = page.locator('li', { has: faqEntry })
    page.once('dialog', (dialog) => dialog.accept())
    await faqCard.getByRole('button', { name: 'Sil' }).click()

    await expect(page.getByRole('button', { name: FAQ_QUESTION })).toHaveCount(0)
  })

  test('cleanup: delete the product created in this run (cascades certificate)', async ({ page }) => {
    await loginViaUi(page)

    await page.goto('/admin/products')
    await page.getByRole('link', { name: PRODUCT_NAME }).click()
    await expect(page).toHaveURL(/\/admin\/products\/\d+$/)

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Ürünü sil' }).click()

    await expect(page).toHaveURL(/\/admin\/products$/)
    await expect(page.getByRole('link', { name: PRODUCT_NAME })).toHaveCount(0)
  })
})
