import { test, expect } from '@playwright/test';
test('Turkish login, admin authentication and live network page', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Giriş yap' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  await page.getByLabel('E-posta adresi').fill(process.env.BOOTSTRAP_ADMIN_EMAIL!);
  await page.getByLabel('Parola', { exact: true }).fill(process.env.BOOTSTRAP_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Yönetim Merkezi', exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Ana gezinme' })
    .getByRole('link', { name: 'Ağ Durumu', exact: true })
    .click();
  await expect(
    page.getByText('Geliştirme ağı — 1 doğrulayıcı — Bizans hata toleransı sağlanmaz.'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Düğüm 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Çıkış yap' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
test('registration page is Turkish and does not seed data', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Hesap başvurusu' })).toBeVisible();
  await expect(page.getByText('18 yaşından küçüğüm.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Başvuru oluştur' })).toBeVisible();
});
test('mobile navigation and page layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Giriş yap', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
