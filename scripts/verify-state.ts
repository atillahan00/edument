import '../apps/api/src/config';
import fs from 'node:fs';
import { Database } from '../apps/api/src/db';
const db = new Database();
async function main() {
  const counts = {
    students: await db.user.count({ where: { role: 'STUDENT' } }),
    mentors: await db.user.count({ where: { role: 'MENTOR' } }),
    achievements: await db.achievement.count(),
    demoBatches: await db.demoSeedBatch.count(),
    administrators: await db.user.count({ where: { role: 'ADMIN' } }),
  };
  const services: Record<string, number> = {};
  for (const [name, url] of Object.entries({
    web: 'http://localhost:3000/login',
    api: 'http://127.0.0.1:3001/api/docs-json',
    matcher: 'http://127.0.0.1:8000/health',
    minio: 'http://127.0.0.1:9000/minio/health/live',
  })) {
    const result = await fetch(url);
    services[name] = result.status;
    if (!result.ok) process.exitCode = 1;
  }
  const result = {
    at: new Date().toISOString(),
    counts,
    services,
    demoDataAbsent:
      counts.students === 0 && counts.mentors === 0 && counts.achievements === 0 && counts.demoBatches === 0,
  };
  fs.writeFileSync('docs/evidence/final-state.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
