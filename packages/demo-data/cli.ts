import '../../apps/api/src/config';
import fs from 'node:fs';
import argon2 from 'argon2';
import { Database } from '../../apps/api/src/db';
import { ChainService } from '../../apps/api/src/blockchain/service';
import { RecordsService } from '../../apps/api/src/records.service';
import { hashRecord } from '../../apps/api/src/hash';
import { privateDefaults, passwordSchema } from '../shared/src';
const args = process.argv.slice(2);
const command = args.shift();
function number(key: string, fallback: number) {
  const index = args.indexOf('--' + key);
  const value = index >= 0 ? Number(args[index + 1]) : fallback;
  if (!Number.isInteger(value) || value < 0 || value > 10000) throw new Error('Geçersiz veri üretim sayısı.');
  return value;
}
const file = 'demo-output/dataset.json';
function generate() {
  const seed = number('seed', 2204);
  let state = seed || 1;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const topics = ['Robotik', 'Yazılım', 'Matematik', 'Fizik', 'Astronomi'];
  const students = number('students', 20);
  const mentors = number('mentors', 8);
  const achievements = number('achievements', 30);
  const users = Array.from({ length: students + mentors }, (_, i) => ({
    name: `KURGUSAL ${i < students ? 'Öğrenci' : 'Mentor'} ${i + 1}`,
    email: `kurgu-${seed}-${i}@example.invalid`,
    role: i < students ? 'STUDENT' : 'MENTOR',
    profile: {
      bio: 'Bu profil açıkça sentetik gösterim verisidir.',
      interests: [topics[Math.floor(next() * topics.length)]],
      skills: [{ name: 'Python', level: 1 + Math.floor(next() * 5) }],
      goals: ['Python', 'Robotik'],
      availability: ['Pazartesi 17:00'],
      languages: ['Türkçe'],
      mode: 'ONLINE',
      city: '',
    },
  }));
  const data = {
    seed,
    users,
    achievements: Array.from({ length: students ? achievements : 0 }, (_, i) => ({
      studentIndex: i % students,
      title: `KURGUSAL proje ${i + 1}`,
      description: 'Gerçek başarı değildir. Yalnızca açıkça etiketli gösterim verisidir.',
      category: topics[Math.floor(next() * topics.length)],
      date: '2026-09-12',
    })),
  };
  fs.mkdirSync('demo-output', { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log('Tekrarlanabilir sentetik dosya oluşturuldu; veritabanına aktarılmadı.');
}
async function run() {
  if (command === 'generate') {
    generate();
    return;
  }
  const db = new Database();
  const chain = new ChainService(db);
  try {
    if (command === 'import') {
      if (process.env.DEMO_DATA_ENABLED !== 'true')
        throw new Error('Açık aktarım için DEMO_DATA_ENABLED=true ayarlayın.');
      const password = passwordSchema.parse(process.env.DEMO_PASSWORD);
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      const withChain = args.includes('--with-chain');
      if (withChain)
        console.log(
          'UYARI: Bu işlem kalıcı sentetik blokzincir kanıtları oluşturur. demo:remove bu kanıtları silemez.',
        );
      const batch = await db.demoSeedBatch.create({ data: { seed: data.seed, withChain } });
      const institution = await db.institution.create({ data: { name: `KURGUSAL Kurum ${batch.id}` } });
      const userIds: string[] = [];
      const hash = await argon2.hash(password, { type: argon2.argon2id });
      for (const entry of data.users) {
        const user = await db.user.create({
          data: {
            name: entry.name,
            email: entry.email,
            role: entry.role,
            active: true,
            minor: entry.role === 'STUDENT',
            passwordHash: hash,
            demoSeedBatchId: batch.id,
            memberships: { create: { institutionId: institution.id } },
            privacy: { create: { settings: privateDefaults } },
          },
        });
        userIds.push(user.id);
        if (user.role === 'STUDENT') {
          if (withChain) await new RecordsService(db, chain).profile(user.id, entry.profile);
          else
            await db.studentProfile.create({
              data: {
                userId: user.id,
                versions: {
                  create: {
                    ownerId: user.id,
                    type: 'PROFILE',
                    version: 1,
                    snapshot: entry.profile,
                    contentHash: hashRecord(entry.profile),
                  },
                },
              },
            });
        } else
          await db.mentorProfile.create({
            data: {
              userId: user.id,
              data: { ...entry.profile, expertise: entry.profile.interests, experience: 3, capacity: 5 },
              verified: false,
            },
          });
      }
      for (const a of data.achievements) {
        const { studentIndex, ...snapshot } = a;
        const ownerId = userIds[studentIndex];
        await db.achievement.create({
          data: {
            userId: ownerId,
            institutionId: institution.id,
            versions: {
              create: {
                ownerId,
                type: 'ACHIEVEMENT',
                version: 1,
                snapshot,
                contentHash: hashRecord(snapshot),
              },
            },
          },
        });
      }
      fs.writeFileSync(
        'demo-output/last-batch.json',
        JSON.stringify({ batchId: batch.id, institutionId: institution.id }, null, 2),
      );
      console.log(
        `Aktarım tamamlandı. Parti: ${batch.id}. Mentorlar doğrulama, başarılar belge ve kurum kararı bekler.`,
      );
    } else if (command === 'remove') {
      const batch = JSON.parse(fs.readFileSync('demo-output/last-batch.json', 'utf8'));
      const ids = (await db.user.findMany({ where: { demoSeedBatchId: batch.batchId } })).map((u) => u.id);
      await db.mentorConnectionRequest.deleteMany({
        where: { OR: [{ studentId: { in: ids } }, { mentorId: { in: ids } }] },
      });
      await db.mentorRecommendation.deleteMany({
        where: { OR: [{ studentId: { in: ids } }, { mentorId: { in: ids } }] },
      });
      await db.user.deleteMany({ where: { demoSeedBatchId: batch.batchId } });
      await db.institution.delete({ where: { id: batch.institutionId } });
      await db.demoSeedBatch.delete({ where: { id: batch.batchId } });
      console.log('Partiye ait uygulama verisi kaldırıldı. Kalıcı blokzincir kayıtları korunur.');
    } else throw new Error('Komut: generate, import veya remove');
  } finally {
    chain.manager.destroy();
    await db.$disconnect();
  }
}
run().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
