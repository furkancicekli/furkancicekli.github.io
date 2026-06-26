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
 * assertions use Turkish values unless stated otherwise.
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
  // 5. Interactive card stack (AI Canvas) renders and is interactive
  // --------------------------------------------------------------------------
  test('craft card stack renders and its controls are clickable', async ({ page }) => {
    await page.goto('/')
    await waitForLoaderGone(page)

    // The AI Canvas InteractiveCardStack exposes role="group" with this label.
    const stack = page.getByRole('group', { name: 'Interactive card stack' })
    await stack.scrollIntoViewIfNeeded()
    await expect(stack).toBeVisible()

    // Dot indicators + back cards are buttons labelled "Show card N".
    const controls = page.getByRole('button', { name: /Show card/i })
    expect(await controls.count()).toBeGreaterThan(0)

    // A control must be interactive — click should not throw.
    await controls.first().click()
  })

})
