import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Public-facing content E2E flow: publish content via admin, then verify it
 * actually renders on the public pages (products grid + detail modal,
 * gallery, FAQ), plus the admin gallery upload/delete flow.
 *
 * Mirrors the structure and conventions of tests/e2e/admin-content.spec.ts
 * (serial mode, `e2e-test-`/Date.now() naming, ConfirmDialog
 * role="alertdialog" pattern, local admin login via UI). There is no shared
 * test helper file in tests/e2e/, so the small login helper is duplicated
 * here rather than cross-imported, matching the existing file's approach.
 *
 * Local D1 is seeded with 20 gallery items (see task description) — the
 * public /gallery page (src/pages/GalleryPage.tsx) renders every item
 * returned by GET /api/gallery with no slicing, so we assert a count of at
 * least 20 and then a baseline+1 after uploading a new image.
 */

const ADMIN_EMAIL = 'admin@local.test'
const ADMIN_PASSWORD = 'yerel-deneme-1234'

const RUN_ID = Date.now()
const PRODUCT_NAME = `e2e-test-public-${RUN_ID}`
const FAQ_QUESTION = `E2E genel test sorusu ${RUN_ID}?`
const FAQ_ANSWER = `E2E genel test cevabı ${RUN_ID}.`

// 1x1 transparent PNG, matches the buffer payload specified in the task.
const TEST_IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

async function loginViaUi(page: Page) {
  await page.goto('/admin/login')
  await page.getByLabel('E-posta').fill(ADMIN_EMAIL)
  await page.getByLabel('Şifre').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Giriş Yap' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

/**
 * Publishes a product via the 4-step admin wizard (same flow as
 * admin-content.spec.ts), leaving "Sitede yayınla" checked and clicking
 * "Bitir" at the end. Returns to /admin/products on success.
 */
async function publishProductViaWizard(page: Page, name: string) {
  await page.goto('/admin/products/new')
  await expect(page).toHaveURL(/\/admin\/products\/new$/)

  // --- Step 1: Bilgiler ---
  await page.getByLabel('Ad *').fill(name)
  await page.getByRole('button', { name: 'Devam' }).click()

  // --- Step 2: Ürün Fotoğrafları (skip) ---
  await expect(page.getByText('Ürünün galeri fotoğrafları.')).toBeVisible()
  await page.getByRole('button', { name: 'Devam' }).click()

  // --- Step 3: Yapım Aşamaları (skip) ---
  await expect(page.getByText('Malzeme ve yapım süreci fotoğrafları')).toBeVisible()
  await page.getByRole('button', { name: 'Devam' }).click()

  // --- Step 4: Sertifika & Yayın ---
  const serialEl = page.locator('p.font-mono', { hasText: /^\d{4} \d{4} \d{4} \d{4}$/ })
  await expect(serialEl).toBeVisible()
  const serialText = (await serialEl.textContent())?.trim() ?? ''

  const publishCheckbox = page.getByRole('checkbox', { name: 'Sitede yayınla' })
  await expect(publishCheckbox).toBeChecked()

  await page.getByRole('button', { name: 'Bitir' }).click()
  await expect(page).toHaveURL(/\/admin\/products$/)

  return { serialFormatted: serialText }
}

test.describe.configure({ mode: 'serial' })

test.describe('public content flows', () => {
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

  test('publish a product, then find it and its detail modal on /products', async ({ page }) => {
    await loginViaUi(page)
    const { serialFormatted } = await publishProductViaWizard(page, PRODUCT_NAME)
    const serialDigitsOnly = serialFormatted.replace(/\s/g, '')

    const productRow = page.locator('tr', { has: page.getByRole('link', { name: PRODUCT_NAME }) })
    await expect(productRow).toBeVisible()
    await expect(productRow.getByText('Yayında')).toBeVisible()

    // --- Public /products grid ---
    await page.goto('/products')
    const card = page.getByRole('button', { name: new RegExp(PRODUCT_NAME) })
    await expect(card).toBeVisible()

    // --- Product detail modal ---
    await card.click()
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()
    await expect(modal.getByRole('heading', { name: PRODUCT_NAME })).toBeVisible()
    // ProductModal shows `${t('product.serial')}: ${product.serialNo}` — the
    // raw (unformatted) serial digits, not the space-grouped display format.
    await expect(modal.getByText(serialDigitsOnly)).toBeVisible()

    // Escape closes the modal.
    await page.keyboard.press('Escape')
    await expect(modal).toBeHidden()
  })

  test('public /gallery shows at least the 20 seeded images', async ({ page }) => {
    await page.goto('/gallery')

    // GalleryPage renders one <img> per gallery item with no slicing.
    const images = page.locator('main img')
    await expect(async () => {
      expect(await images.count()).toBeGreaterThanOrEqual(20)
    }).toPass({ timeout: 10_000 })
  })

  test('add a FAQ via admin, see it on public /faq, then delete it', async ({ page }) => {
    await loginViaUi(page)

    await page.goto('/admin/faq')
    await page.getByLabel('Soru (Türkçe) *').fill(FAQ_QUESTION)
    await page.getByLabel('Cevap (Türkçe) *').fill(FAQ_ANSWER)
    await page.getByRole('button', { name: 'Soru ekle' }).click()

    const faqToggle = page.getByRole('button', { name: FAQ_QUESTION })
    await expect(faqToggle).toBeVisible()

    // --- Public /faq page ---
    await page.goto('/faq')
    const faqSummary = page.getByText(FAQ_QUESTION)
    await expect(faqSummary).toBeVisible()
    // <details> content is only in the accessibility tree/DOM once opened.
    await faqSummary.click()
    await expect(page.getByText(FAQ_ANSWER)).toBeVisible()

    // --- Cleanup: delete via admin ---
    await page.goto('/admin/faq')
    const faqToggleAgain = page.getByRole('button', { name: FAQ_QUESTION })
    await faqToggleAgain.click()
    const faqCard = page.locator('li', { has: faqToggleAgain })
    await faqCard.getByRole('button', { name: 'Sil' }).click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Sil' }).click()

    await expect(page.getByRole('button', { name: FAQ_QUESTION })).toHaveCount(0)
  })

  test('upload a gallery image via admin, verify it publicly, then delete it', async ({ page }) => {
    // --- Baseline count from public /gallery ---
    await page.goto('/gallery')
    const publicImages = page.locator('main img, section img')
    await expect(async () => {
      expect(await publicImages.count()).toBeGreaterThanOrEqual(20)
    }).toPass({ timeout: 10_000 })
    const baselineCount = await publicImages.count()

    // --- Upload via admin gallery (hidden <input type=file> behind the
    // dropzone button in AdminGalleryPage.tsx) ---
    await loginViaUi(page)
    await page.goto('/admin/gallery')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'e2e-test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TEST_IMAGE_BASE64, 'base64'),
    })

    // Uploaded item becomes the last one (highest sort) in the admin grid;
    // wait for the upload to finish by polling the admin thumbnail count.
    const adminThumbCount = page.locator('section img[alt=""]')
    const priorAdminCount = await adminThumbCount.count()
    await expect(async () => {
      expect(await adminThumbCount.count()).toBe(priorAdminCount + 1)
    }).toPass({ timeout: 10_000 })

    // --- Verify publicly: baseline + 1 ---
    await page.goto('/gallery')
    await expect(async () => {
      expect(await publicImages.count()).toBe(baselineCount + 1)
    }).toPass({ timeout: 10_000 })

    // --- Delete the uploaded image via admin (ConfirmDialog) ---
    await page.goto('/admin/gallery')
    await expect(async () => {
      expect(await adminThumbCount.count()).toBe(priorAdminCount + 1)
    }).toPass({ timeout: 10_000 })

    // The most recently uploaded item is appended last (highest sort order).
    const lastTile = page.locator('section .group').last()
    await lastTile.hover()
    await lastTile.getByRole('button', { name: 'Fotoğrafı sil' }).click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Sil' }).click()

    await expect(async () => {
      expect(await adminThumbCount.count()).toBe(priorAdminCount)
    }).toPass({ timeout: 10_000 })

    // --- Confirm removal publicly too ---
    await page.goto('/gallery')
    await expect(async () => {
      expect(await publicImages.count()).toBe(baselineCount)
    }).toPass({ timeout: 10_000 })
  })

  test('cleanup: delete the product created in this run', async ({ page }) => {
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
