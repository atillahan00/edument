// Optional development-only runtimes. Does not install system services or modify PATH.
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
fs.mkdirSync('.runtime/downloads', { recursive: true });
async function download(url, file) {
  if (fs.existsSync(file)) return;
  const response = await fetch(url, { headers: { 'User-Agent': 'EduMent' } });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(file));
  console.log(`İndirildi: ${file}`);
}
const java = await fetch(
  'https://api.adoptium.net/v3/assets/latest/25/hotspot?architecture=x64&image_type=jdk&os=windows',
  { headers: { 'User-Agent': 'EduMent' } },
).then((r) => r.json());
const tasks = [
  [
    'https://github.com/besu-eth/besu/releases/download/26.8.1/besu-26.8.1.zip',
    '.runtime/downloads/besu.zip',
  ],
  [
    'https://github.com/besu-eth/besu/releases/download/26.8.1/besu-26.8.1.zip.sha256',
    '.runtime/downloads/besu.sha256',
  ],
  [java[0].binary.package.link, '.runtime/downloads/java.zip'],
  [
    'https://repo.maven.apache.org/maven2/io/zonky/test/postgres/embedded-postgres-binaries-windows-amd64/17.6.0/embedded-postgres-binaries-windows-amd64-17.6.0.jar',
    '.runtime/downloads/postgres.jar',
  ],
  ['https://dl.min.io/server/minio/release/windows-amd64/minio.exe', '.runtime/minio.exe'],
];
for (const result of await Promise.allSettled(tasks.map(([url, file]) => download(url, file))))
  if (result.status === 'rejected') console.error(result.reason.message);
fs.writeFileSync('.runtime/downloads/java.sha256', java[0].binary.package.checksum);
