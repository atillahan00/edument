import '../apps/api/src/config';
import argon2 from 'argon2';
import { Database } from '../apps/api/src/db';
import { required } from '../apps/api/src/config';
import { passwordSchema, privateDefaults } from '../packages/shared/src';
const db = new Database();
async function main() {
  const email = required('BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
  const password = passwordSchema.parse(required('BOOTSTRAP_ADMIN_PASSWORD'));
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log('Mevcut hesap ve parolası korunuyor.');
    return;
  }
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: 'Kurum Yöneticisi',
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        role: 'ADMIN',
        minor: false,
        active: true,
        privacy: { create: { settings: privateDefaults } },
      },
    });
    if (process.env.BOOTSTRAP_INSTITUTION_NAME)
      await tx.institution.create({
        data: { name: process.env.BOOTSTRAP_INSTITUTION_NAME, members: { create: { userId: user.id } } },
      });
  });
  console.log('Yönetici hesabı oluşturuldu. Sentetik öğrenci veya mentor eklenmedi.');
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
