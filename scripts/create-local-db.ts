import '../apps/api/src/config';
import { Database } from '../apps/api/src/db';
const url = new URL(process.env.DATABASE_URL!);
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !['/edument', '/bilsem'].includes(url.pathname))
  throw new Error('Yalnızca yerel edument veritabanı oluşturulabilir.');
const databaseName = url.pathname.slice(1);
url.pathname = '/postgres';
const db = new Database({ datasourceUrl: url.toString() });
db.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`)
  .then(() => console.log('Yerel veritabanı oluşturuldu.'))
  .catch((e) => {
    if (e.meta?.code === '42P04') console.log('Veritabanı zaten mevcut.');
    else {
      console.error(e.message);
      process.exitCode = 1;
    }
  })
  .finally(() => db.$disconnect());
