import '../apps/api/src/config';
import { Database } from '../apps/api/src/db';

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^[a-zA-Z_][a-zA-Z0-9_]{0,55}_multi$/.test(name))
    throw new Error('Yalnızca yerel çoklu ağ veritabanı oluşturulabilir.');
  url.pathname = '/postgres';
  const db = new Database({ datasourceUrl: url.toString() });
  try {
    const existing = await db.$queryRaw<
      Array<{ datname: string }>
    >`SELECT datname FROM pg_database WHERE datname = ${name}`;
    if (!existing.length) await db.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
    console.log('Çoklu ağ veritabanı hazır; mevcut kayıtlar korundu.');
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error('Çoklu ağ veritabanı hazırlanamadı.');
  process.exitCode = 1;
});
