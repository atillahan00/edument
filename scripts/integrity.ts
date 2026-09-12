import '../apps/api/src/config';
import { Database } from '../apps/api/src/db';
import { ChainService } from '../apps/api/src/blockchain/service';
const db = new Database();
const chain = new ChainService(db);
async function main() {
  let cursor: string | undefined;
  while (true) {
    const rows = await db.recordVersion.findMany({
      where: { anchor: { status: 'CONFIRMED' } },
      include: { anchor: true, evidence: true },
      take: 100,
      orderBy: { id: 'asc' },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!rows.length) break;
    for (const row of rows) {
      const result = await chain.integrity(row);
      console.log(JSON.stringify({ versionId: row.id, ...result }));
      if (['MISMATCH', 'ERROR'].includes(result.state)) process.exitCode = 1;
    }
    cursor = rows.at(-1)!.id;
  }
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
