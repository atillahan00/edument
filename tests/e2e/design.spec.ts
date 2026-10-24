import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const designs = ['ultra', 'minimal', 'brutalist', 'glass'];
const screenshots = '.runtime/design-review';
async function noOverflow(page: import('@playwright/test').Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
test('design switching preserves form values and persists across pages and reloads', async ({ page }) => {
  fs.mkdirSync(screenshots, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Giriş yap' })).toBeVisible();
  await page.getByLabel('E-posta adresi').fill('tasarim@example.invalid');
  for (const design of designs) {
    await page.getByLabel('Görünüm', { exact: true }).selectOption(design);
    await expect(page.locator('html')).toHaveAttribute('data-design', design);
    await expect(page.getByLabel('E-posta adresi')).toHaveValue('tasarim@example.invalid');
    await noOverflow(page);
    await page.screenshot({ path: `${screenshots}/login-${design}.png`, fullPage: true });
  }
  await page.reload();
  await expect(page.getByLabel('Görünüm', { exact: true })).toHaveValue('glass');
  await page.getByRole('link', { name: 'Hesap başvurusu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hesap başvurusu' })).toBeVisible();
  await expect(page.getByLabel('Görünüm', { exact: true })).toHaveValue('glass');
  await page.getByLabel('Ad ve soyad').fill('Arayüz kontrolü');
  await page.getByLabel('Hesap türü').selectOption('MENTOR');
  await page.getByLabel('18 yaşından küçüğüm.').uncheck();
  await page.getByLabel('Görünüm', { exact: true }).selectOption('ultra');
  await expect(page.getByLabel('Ad ve soyad')).toHaveValue('Arayüz kontrolü');
  await expect(page.getByLabel('Hesap türü')).toHaveValue('MENTOR');
  await expect(page.getByLabel('18 yaşından küçüğüm.')).not.toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const design of designs) {
    await page.getByLabel('Görünüm', { exact: true }).selectOption(design);
    await noOverflow(page);
    await expect(page.getByRole('button', { name: 'Başvuru oluştur' })).toBeVisible();
    await page.screenshot({ path: `${screenshots}/register-mobile-${design}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});
test('all designs retain admin navigation, unsaved fields and mobile controls', async ({ page }) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/login');
  await page.getByLabel('E-posta adresi').fill(process.env.BOOTSTRAP_ADMIN_EMAIL!);
  await page.getByLabel('Parola', { exact: true }).fill(process.env.BOOTSTRAP_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Yönetim Merkezi', exact: true })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Ana gezinme' });
  await expect(nav.getByRole('link')).toHaveCount(11);
  const weight = page.locator('input[type="number"]').first();
  await expect(weight).toBeVisible();
  const original = await weight.inputValue();
  await weight.fill('0.13');
  for (const design of designs) {
    await page.getByLabel('Görünüm', { exact: true }).selectOption(design);
    await expect(weight).toHaveValue('0.13');
    await expect(nav.getByRole('link')).toHaveCount(11);
    await noOverflow(page);
    await page.screenshot({ path: `${screenshots}/admin-${design}.png`, fullPage: true });
  }
  await weight.fill(original); // No settings are submitted.
  const routes = await nav
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')!));
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('.content h1')).toBeVisible();
    await expect(page.getByText('Bu sayfayı görüntüleme yetkiniz bulunmuyor.')).toHaveCount(0);
    await expect(page.getByLabel('Görünüm', { exact: true })).toHaveValue('glass');
    await noOverflow(page);
  }
  await page.goto('/admin');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const design of designs) {
    await page.getByLabel('Görünüm', { exact: true }).selectOption(design);
    await noOverflow(page);
    await page.getByRole('button', { name: 'Menüyü aç' }).click();
    await expect(nav).toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Menüyü aç' })).toHaveAttribute('aria-expanded', 'false');
    await page.screenshot({ path: `${screenshots}/admin-mobile-${design}.png`, fullPage: true });
  }
  await page.getByRole('button', { name: 'Menüyü aç' }).click();
  await nav.getByRole('link', { name: 'Gizlilik ve İzinler', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gizlilik ve İzinler', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menüyü aç' })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Çıkış yap' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
test('theme controls work when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('Storage unavailable');
    };
    Storage.prototype.setItem = () => {
      throw new Error('Storage unavailable');
    };
  });
  await page.goto('/login');
  await page.getByLabel('Görünüm', { exact: true }).selectOption('brutalist');
  await expect(page.locator('html')).toHaveAttribute('data-design', 'brutalist');
  await expect(page.getByRole('button', { name: 'Giriş yap', exact: true })).toBeEnabled();
});

test('student and mentor form controls survive all designs without submitting data', async ({ page }) => {
  test.setTimeout(90000);
  let role = 'STUDENT';
  await page.route('**/api/v1/**', async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace('/api/v1/', '');
    expect(route.request().method()).toBe('GET');
    const profile = {
      version: 2,
      snapshot: {
        bio: '',
        interests: ['Matematik'],
        skills: [{ name: 'Python', level: 3 }],
        goals: ['Proje geliştirmek'],
        languages: ['Türkçe'],
        mode: 'ONLINE',
      },
    };
    const response =
      endpoint === 'auth/me'
        ? { id: 'design-only', name: 'Tasarım Kontrolü', role, active: true, memberships: [] }
        : endpoint === 'students/profile'
          ? profile
          : endpoint === 'students/history'
            ? [{ ...profile, version: 1 }, profile]
            : endpoint === 'mentors/profile'
              ? { data: profile.snapshot }
              : endpoint === 'institutions'
                ? [{ id: 'design-institution', name: 'Örnek kurum' }]
                : [];
    await route.fulfill({ json: response });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Öğrenci Paneli', exact: true })).toBeVisible();
  await expect(page.locator('.recharts-bar')).toHaveCount(2);
  await page.screenshot({ path: `${screenshots}/student-ultra.png`, fullPage: true });
  await page.goto('/achievements/new');
  await page.getByLabel('Başarı başlığı').fill('Tasarım kontrolü');
  await page.getByLabel('Kanıt belgesi', { exact: true }).setInputFiles({
    name: 'tasarim-kontrol.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%%EOF'),
  });
  for (const design of designs) {
    await page.getByLabel('Görünüm', { exact: true }).selectOption(design);
    await expect(page.getByLabel('Başarı başlığı')).toHaveValue('Tasarım kontrolü');
    expect(
      await page
        .getByLabel('Kanıt belgesi', { exact: true })
        .evaluate((input: HTMLInputElement) => input.files?.[0]?.name),
    ).toBe('tasarim-kontrol.pdf');
    await expect(page.getByRole('button', { name: 'Kurum doğrulamasına gönder' })).toBeEnabled();
    await noOverflow(page);
  }
  role = 'MENTOR';
  await page.goto('/mentor/profile');
  const expertise = page.getByLabel('Uzmanlık alanları', { exact: true });
  await expect(expertise).toBeVisible();
  await expertise.fill('Matematik, Robotik');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const design of designs) {
    await page.getByLabel('Görünüm', { exact: true }).selectOption(design);
    await expect(expertise).toHaveValue('Matematik, Robotik');
    await expect(page.getByRole('button', { name: 'Kaydet', exact: true })).toBeVisible();
    await noOverflow(page);
  }
  role = 'VERIFIER';
  await page.goto('/verifier/queue');
  await expect(page.getByRole('heading', { name: 'Doğrulama Kuyruğu', exact: true })).toBeVisible();
  await noOverflow(page);
});
