import '../apps/api/src/config';
import { Database } from '../apps/api/src/db';
import { StorageService } from '../apps/api/src/storage';
const db = new Database(),
  storage = new StorageService();
async function main() {
  const users = await db.user.findMany({
    where: {
      email: { startsWith: 'browser-', endsWith: '@example.invalid' },
      name: { startsWith: 'KURGUSAL ' },
    },
    include: { memberships: true },
  });
  const ids = users.map((u) => u.id);
  for (const evidence of await db.achievementEvidence.findMany({
    where: { version: { ownerId: { in: ids } } },
  }))
    await storage.remove(evidence.objectKey);
  await db.mentorConnectionRequest.deleteMany({
    where: { OR: [{ studentId: { in: ids } }, { mentorId: { in: ids } }] },
  });
  await db.mentorRecommendation.deleteMany({
    where: { OR: [{ studentId: { in: ids } }, { mentorId: { in: ids } }] },
  });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  for (const id of new Set(users.flatMap((u) => u.memberships.map((m) => m.institutionId))))
    if (!(await db.userInstitution.count({ where: { institutionId: id } })))
      await db.institution.delete({ where: { id } });
  console.log(`${ids.length} kesintiye uğramış tarayıcı testi hesabı temizlendi.`);
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
