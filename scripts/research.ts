import '../apps/api/src/config';
import { Database } from '../apps/api/src/db';
import { ChainService } from '../apps/api/src/blockchain/service';
import { ResearchService } from '../apps/api/src/research.service';
const db = new Database();
const chain = new ChainService(db);
const service = new ResearchService(db, chain);
const kind = process.argv[2] || 'INTEGRITY';
if (!['INTEGRITY', 'DOCUMENT', 'VERSIONS', 'OVERHEAD', 'MULTI', 'MATCHING'].includes(kind))
  throw new Error('Geçersiz deney türü.');
service
  .run(kind)
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    chain.manager.destroy();
    await db.$disconnect();
  });
