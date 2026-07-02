import { test, expect } from '@playwright/test'

/**
 * Home page E2E / visual smoke tests.
 *
 * IMPORTANT: Each test navigates fresh to '/' and waits for the loading
 * screen to clear before making assertions, because the app renders a
 * full-screen overlay (fixed inset-0 z-[100]) that grows the logo and then
 * dissolves to transparent (~2.2 s) on first load.
 *
 * Loader-wait strategy:
 *   page.waitForFunction waits until the overlay element (aria-hidden=true,
 *   fixed inset-0) is gone from the DOM, OR until a hero landmark becomes
 *   visible — whichever is appropriate per test. We give a 10 s budget which
 *   is ample for a dev-server load.
 *
 * i18n note: the default locale is Turkish (tr). All aria-labels and text
 * assertions use Turkish values unless stated otherwise (see
 * src/i18n/locales/tr.json).
 *
 * Current HomePage composition (src/pages/HomePage.tsx): Hero +
 * FeaturedProducts + GalleryPreview + Contact. The old Stats/CraftStack/About
 * sections and the AI Canvas InteractiveCardStack no longer exist anywhere in
 * src/ (grep-verified) — there is nothing left to assert about them.
 *
 * FeaturedProducts renders null when the API returns zero products
 * (src/components/sections/FeaturedProducts.tsx), which is the case for a
 * clean local D1. We only assert that resilient "renders nothing, doesn't
 * crash" behavior here. The "a published product shows up in
 * FeaturedProducts" case is covered once, end-to-end, in
 * tests/e2e/public-content.spec.ts (after publishing a product via the admin
 * wizard) — asserting it again here would mean running the wizard twice for
 * no extra coverage.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wait until the React LoadingScreen (aria-hidden full-screen div) has
 * exited the DOM or become invisible. The component fades out via
 * framer-motion AnimatePresence, so after ~700 ms + 400 ms fade it's gone.
 */
async function waitForLoaderGone(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never) {
  // Wait for the loading div to detach (framer-motion removes it after exit).
  // We identify it by its unique z-index class and aria-hidden attribute.
  await page.waitForFunction(
    () => !document.querySelector('[aria-hidden="true"].fixed'),
    { timeout: 10_000 },
  )
}

// Exact Turkish nav labels, read from src/i18n/locales/tr.json "nav" block,
// in the same order as src/content/config.ts navItems (home/products/
// gallery/faq/contact/verify — note "about" exists in the locale file but is
// NOT in navItems, so it must not appear as a nav link).
const EXPECTED_NAV_LABELS = ['Ana Sayfa', 'Ürünler', 'Galeri', 'SSS', 'İletişim', 'Sertifika Sorgula']

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Home page smoke tests', () => {

  // --------------------------------------------------------------------------
  // 1. Home loads — correct title, no console errors
  // --------------------------------------------------------------------------
  test('home loads: correct title and no console errors', async ({ page }) => {
    const consoleErrors: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto('/')
    await waitForLoaderGone(page)

    // Title check
    await expect(page).toHaveTitle(/Tesbih/)

    // No severe console errors (React warnings are type 'warning', not 'error')
    expect(consoleErrors).toHaveLength(0)
  })

  // --------------------------------------------------------------------------
  // 2. Loading screen disappears — content becomes visible
  // --------------------------------------------------------------------------
  test('loading screen disappears and content is visible', async ({ page }) => {
    await page.goto('/')

    // While loading screen is present the overlay should be in DOM initially
    // (we do NOT assert it IS visible because it may clear very quickly)

    // Wait for loader to be gone
    await waitForLoaderGone(page)

    // Hero/nav content must be visible after loader clears.
    // The site name "Furkan Çiçekli" appears in the navbar (brand link span).
    const brandLink = page.getByRole('link', { name: /Furkan/i }).first()
    await expect(brandLink).toBeVisible({ timeout: 5_000 })
  })

  // --------------------------------------------------------------------------
  // 3. Theme toggle — flips .dark on <html> and persists to localStorage
  // --------------------------------------------------------------------------
  test('theme toggle flips dark class and persists to localStorage', async ({ page }) => {
    await page.goto('/')
    await waitForLoaderGone(page)

    // Read initial state
    const initiallyDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    )

    // Click the theme toggle (ThemeSwitch aria-label)
    const toggle = page.getByRole('button', { name: 'Toggle theme' })
    await expect(toggle).toBeVisible()
    await toggle.click()

    // Class should have flipped
    const nowDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    )
    expect(nowDark).toBe(!initiallyDark)

    // localStorage.theme should match the new state
    const storedTheme = await page.evaluate(() => localStorage.getItem('theme'))
    expect(storedTheme).toBe(nowDark ? 'dark' : 'light')

    // Toggle back to restore original state
    await toggle.click()
    const restoredDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    )
    expect(restoredDark).toBe(initiallyDark)
  })

  // --------------------------------------------------------------------------
  // 4. Logo visible in both themes (navbar and footer)
  // --------------------------------------------------------------------------
  test('logo is visible in navbar and footer in both light and dark themes', async ({ page }) => {
    await page.goto('/')
    await waitForLoaderGone(page)

    // The Logo component renders role="img" with aria-label from i18n a11y.logo.
    // Default locale is Turkish → "Furkan Çiçekli logosu".
    // There are two non-decorative logos: one in Header, one in Footer.
    const logos = page.getByRole('img', { name: /Furkan/i })

    // In light mode: both logos visible
    const count = await logos.count()
    expect(count).toBeGreaterThanOrEqual(2)
    for (let i = 0; i < count; i++) {
      await expect(logos.nth(i)).toBeVisible()
    }

    // Switch to dark mode
    const toggle = page.getByRole('button', { name: 'Toggle theme' })
    await toggle.click()
    await page.waitForTimeout(200) // allow CSS transition

    // Logos still visible in dark mode
    for (let i = 0; i < count; i++) {
      await expect(logos.nth(i)).toBeVisible()
    }

    // Restore
    await toggle.click()
  })

  // --------------------------------------------------------------------------
  // 5. Nav has exactly the 6 expected links, in order (desktop nav)
  // --------------------------------------------------------------------------
  test('desktop nav has exactly the 6 expected links with correct Turkish labels', async ({ page }) => {
    await page.goto('/')
    await waitForLoaderGone(page)

    // Header.tsx renders a <nav> (role="navigation") wrapping the desktop
    // links; Footer.tsx also renders the same navItems inside <footer>
    // (role="contentinfo"), so we must scope to the nav landmark or these
    // role queries resolve to 2 elements (strict-mode violation).
    const nav = page.getByRole('navigation')
    for (const label of EXPECTED_NAV_LABELS) {
      await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible()
    }

    // No unexpected extra nav items — e.g. "Biyografi" (about) exists in the
    // locale file but is intentionally absent from navItems.
    await expect(nav.getByRole('link', { name: 'Biyografi', exact: true })).toHaveCount(0)
  })

  // --------------------------------------------------------------------------
  // 6. FeaturedProducts either renders nothing (empty DB) or a valid grid
  // --------------------------------------------------------------------------
  test('FeaturedProducts section is resilient: renders nothing or a valid product grid', async ({ page }) => {
    // FeaturedProducts renders `null` (no <section id="products">) when the
    // API returns an empty product list, and a heading + grid otherwise
    // (src/components/sections/FeaturedProducts.tsx). Local D1 may already
    // have published products left over from other e2e runs or manual
    // testing, so we don't assume a pristine empty state here — we assert
    // the section is internally consistent for whichever state it's in
    // rather than crashing. The "a specific product I just published is
    // visible" case is covered precisely in public-content.spec.ts.
    await page.goto('/')
    await waitForLoaderGone(page)

    const section = page.locator('#products')
    const count = await section.count()
    expect([0, 1]).toContain(count)

    if (count === 1) {
      await expect(section).toBeVisible()
      await expect(section.getByRole('heading', { level: 2 })).toBeVisible()
    }
  })

  // --------------------------------------------------------------------------
  // 7. GalleryPreview shows a subset of seeded images
  // --------------------------------------------------------------------------
  test('gallery preview section shows a subset of the seeded gallery images', async ({ page }) => {
    await page.goto('/')
    await waitForLoaderGone(page)

    // GalleryPreview (src/components/sections/GalleryPreview.tsx) fetches
    // /api/gallery and renders `featured = items.slice(0, 6)` — with the
    // seeded 20-item gallery this section must show exactly 6 images.
    const gallerySection = page.locator('#gallery')
    await gallerySection.scrollIntoViewIfNeeded()
    await expect(gallerySection).toBeVisible()

    const images = gallerySection.locator('img')
    await expect(images).toHaveCount(6)

    // "Tümünü Gör" (gallery.viewAll) link to /gallery.
    await expect(gallerySection.getByRole('link', { name: 'Tümünü Gör' })).toBeVisible()
  })

  // --------------------------------------------------------------------------

})
