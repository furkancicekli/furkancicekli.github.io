import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for furkancicekli.github.io E2E tests.
 *
 * webServer strategy: `npm run dev` (Vite dev server on port 5173).
 *
 * Why dev over preview:
 * - The Cloudflare Vite plugin requires `wrangler` bindings context to build
 *   correctly; `vite preview` serves the built `dist/client` but Cloudflare's
 *   plugin output is a Worker bundle, not a straightforward static dist.
 *   The dev server bypasses this and serves the SPA directly via Vite HMR,
 *   which correctly resolves all routes, aliases, and assets.
 * - `reuseExistingServer: true` lets developers who already have the dev
 *   server running skip the startup wait.
 *
 * CI note: on CI there is no running dev server, so Playwright starts one fresh.
 */
export default defineConfig({
  testDir: './tests/e2e',

  /** Run tests sequentially (single browser, SPA-friendly). */
  workers: 1,

  /** Retry flaky tests once in CI. */
  retries: process.env.CI ? 1 : 0,

  /** Default timeout per test (generous for count-up animations + loader). */
  timeout: 30_000,

  /** Assertion timeout. */
  expect: {
    timeout: 10_000,
  },

  use: {
    baseURL: 'http://localhost:5173',

    /** Capture trace on first retry for debugging. */
    trace: 'on-first-retry',

    /** Always capture screenshot on failure. */
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    /** Reuse a running dev server in local development. */
    reuseExistingServer: !process.env.CI,
    /** Give the dev server up to 30 s to start. */
    timeout: 30_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
