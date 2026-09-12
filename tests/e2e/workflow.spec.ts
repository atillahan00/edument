import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { Database } from '../../apps/api/src/db';
import { StorageService } from '../../apps/api/src/storage';
import { privateDefaults } from '../../packages/shared/src';
test('student profile, PDF submission, verifier approval, real proof and recommendations', async ({
  page,
}) => {
  test.setTimeout(120000);
  const db = new Database();
  const storage = new StorageService();
  const suffix = randomUUID().slice(0, 8);
  const password = 'BrowserTest9!' + randomUUID();
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const institution = await db.institution.create({ data: { name: 'KURGUSAL tarayıcı test kurumu' } });
  const ids: string[] = [];
  async function login(email: string) {
    await page.goto('/login');
    await page.getByLabel('E-posta adresi').fill(email);
    await page.getByLabel('Parola').fill(password);
    await page.getByRole('button', { name: 'Giriş yap', exact: true }).click();
    await page
      .locator('input[type=password]')
      .evaluateAll((inputs) => inputs.forEach((input) => ((input as HTMLInputElement).value = '')));
  }
  try {
    for (const role of ['STUDENT', 'VERIFIER', 'MENTOR'] as const) {
      const user = await db.user.create({
        data: {
          name: `KURGUSAL ${role === 'STUDENT' ? 'Öğrenci' : role === 'MENTOR' ? 'Mentor' : 'Doğrulayıcı'}`,
          email: `browser-${role.toLowerCase()}-${suffix}@example.invalid`,
          passwordHash,
          role,
          active: true,
          minor: role === 'STUDENT',
          memberships: { create: { institutionId: institution.id } },
          privacy: { create: { settings: privateDefaults } },
        },
      });
      ids.push(user.id);
    }
    await db.mentorProfile.create({
      data: {
        userId: ids[2],
        verified: true,
        verifiedBy: ids[1],
        verifiedAt: new Date(),
        data: {
          bio: 'Sentetik test uzmanlığı',
          expertise: ['Python', 'Robotik'],
          interests: ['Robotik'],
          goals: ['Python'],
          availability: ['Pazartesi 17:00'],
          languages: ['Türkçe'],
          mode: 'ONLINE',
          city: '',
          experience: 4,
          capacity: 3,
        },
      },
    });
    await login(`browser-student-${suffix}@example.invalid`);
    await expect(page.getByRole('heading', { name: 'Öğrenci Paneli', exact: true })).toBeVisible();
    await page.goto('/profile/edit');
    await page.getByLabel('İlgi alanları').fill('Robotik');
    await page.getByLabel('Gelişim hedefleri').fill('Python');
    await page.getByLabel('Beceriler (öz değerlendirme)').fill('Python:2');
    await page.getByLabel('Uygunluk saatleri').fill('Pazartesi 17:00');
    await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
    await expect(
      page.getByText('Yeni profil sürümünüz oluşturuldu. Blokzincir onayı bekleniyor.'),
    ).toBeVisible();
    await page.goto('/profile/history');
    await expect(page.getByRole('heading', { name: 'Sürüm 1' })).toBeVisible();
    await page.goto('/achievements/new');
    await page.getByLabel('Başarı başlığı').fill('KURGUSAL tarayıcı başarı testi');
    await page.getByLabel('Kategori').fill('Proje');
    await page.getByLabel('Etkinlik tarihi').fill('2026-09-12');
    await page.getByLabel('Açıklama').fill('Bu belge yalnızca uçtan uca tarayıcı testinde kullanılır.');
    await page.getByLabel('Doğrulayacak kurum').selectOption(institution.id);
    await page.getByLabel('Kanıt belgesi').setInputFiles({
      name: 'sentetik.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF'),
    });
    await page.getByRole('button', { name: 'Kurum doğrulamasına gönder' }).click();
    await expect(page).toHaveURL(/\/achievements\/[a-f0-9-]+$/);
    const achievementId = page.url().split('/').at(-1)!;
    await page.getByRole('button', { name: 'Çıkış yap' }).click();
    await login(`browser-verifier-${suffix}@example.invalid`);
    await expect(page.getByRole('heading', { name: 'Doğrulama Kuyruğu', exact: true })).toBeVisible();
    await page.goto(`/verifier/achievements/${achievementId}`);
    await page.getByLabel('Doğrulama gerekçesi').fill('Sentetik kanıt tarayıcı testinde incelendi.');
    await page.getByRole('button', { name: 'Onaylandı', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Geçersiz kıl', exact: true })).toBeVisible();
    await expect
      .poll(
        async () => {
          const a = await db.achievement.findUnique({
            where: { id: achievementId },
            include: { versions: { include: { anchor: true } } },
          });
          return a?.versions[0].anchor?.status;
        },
        { timeout: 40000 },
      )
      .toBe('CONFIRMED');
    await page.reload();
    await page.getByRole('button', { name: 'Bütünlüğü denetle' }).click();
    await expect(page.getByText('Bütünlük Doğrulandı')).toBeVisible();
    await page.getByRole('button', { name: 'Çıkış yap' }).click();
    await login(`browser-student-${suffix}@example.invalid`);
    await expect(page.getByRole('heading', { name: 'Öğrenci Paneli', exact: true })).toBeVisible();
    await page.goto('/settings/privacy');
    await page.getByRole('button', { name: 'İzin ver', exact: true }).first().click();
    await page.goto('/matches');
    await expect(page.getByRole('heading', { name: 'KURGUSAL Mentor', exact: true })).toBeVisible();
    await page.getByText('Bu mentor neden önerildi?').click();
    await expect(page.getByText(/İlgi uyumu:/)).toBeVisible();
    await page.goto('/dashboard');
    await page.screenshot({ path: '.runtime/screenshots/student-dashboard.png', fullPage: true });
  } finally {
    for (const e of await db.achievementEvidence.findMany({ where: { version: { ownerId: { in: ids } } } }))
      await storage.remove(e.objectKey);
    await db.mentorRecommendation.deleteMany({ where: { studentId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.institution.delete({ where: { id: institution.id } });
    await db.$disconnect();
  }
});
