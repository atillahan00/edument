import '../apps/api/src/config';
import { Database } from '../apps/api/src/db';
const db = new Database();
async function check() {
  try {
    await db.$queryRaw`SELECT 1`;
    await db.user.findFirst({ select: { id: true } });
    console.log('Veritabanı bağlantısı ve kullanıcı tablosu hazır.');
  } catch {
    console.error(
      'Veritabanına erişilemiyor. .env DATABASE_URL ayarını ve PostgreSQL durumunu kontrol edin.',
    );
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
void check();
