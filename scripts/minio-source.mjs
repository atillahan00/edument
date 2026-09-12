import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
const releases = await fetch('https://go.dev/dl/?mode=json').then((r) => r.json());
const go = releases[0].files.find((f) => f.os === 'windows' && f.arch === 'amd64' && f.kind === 'archive');
for (const [url, file] of [
  [`https://go.dev/dl/${go.filename}`, '.runtime/downloads/go.zip'],
  [
    'https://codeload.github.com/minio/minio/zip/refs/tags/RELEASE.2025-04-22T22-12-26Z',
    '.runtime/downloads/minio-source.zip',
  ],
]) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`İndirme başarısız: ${r.status}`);
  await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(file));
  console.log(`İndirildi: ${file}`);
}
fs.writeFileSync('.runtime/downloads/go.sha256', go.sha256);
