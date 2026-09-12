import '../apps/api/src/config';
import fs from 'node:fs';
import { Database } from '../apps/api/src/db';
import { ChainService } from '../apps/api/src/blockchain/service';
import { ResearchService } from '../apps/api/src/research.service';
const db = new Database(),
  chain = new ChainService(db),
  research = new ResearchService(db, chain);
async function main() {
  const results = [];
  for (const kind of ['DOCUMENT', 'VERSIONS', 'OVERHEAD', 'MATCHING']) {
    let result;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        result = await research.run(kind, 3, 2204);
        break;
      } catch (e) {
        if ((e as Error).message.includes('meşgul')) {
          await new Promise((r) => setTimeout(r, 700));
          continue;
        }
        throw e;
      }
    }
    if (!result) throw new Error('Deney imzalayıcı kilidi alınamadı.');
    results.push(result);
    console.log(`${kind}: gerçek ölçüm tamamlandı.`);
  }
  fs.mkdirSync('docs/evidence', { recursive: true });
  fs.writeFileSync('docs/evidence/experiments.json', JSON.stringify(results, null, 2));
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    chain.manager.destroy();
    await db.$disconnect();
  });
