import { test, expect } from '@playwright/test'

test.describe('admin auth', () => {
  test('unauthenticated /admin redirects to login', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login$/)
    await expect(page.getByRole('heading', { name: 'Yönetici Girişi' })).toBeVisible()
  })

  test('wrong credentials show an error message', async ({ page }) => {
    await page.goto('/admin/login')
    await page.getByLabel('E-posta').fill('nobody@example.com')
    await page.getByLabel('Şifre').fill('wrong-password')
    await page.getByRole('button', { name: 'Giriş Yap' }).click()
    await expect(page.getByRole('alert')).toHaveText('E-posta veya şifre hatalı.')
    await expect(page).toHaveURL(/\/admin\/login$/)
  })
})
