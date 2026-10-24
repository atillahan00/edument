// Downloads only isolated test dependencies; never modifies system PATH or installs services.
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
const dir = '.runtime/downloads';
fs.mkdirSync(dir, { recursive: true });
async function download(url, name, checksum) {
  const target = `${dir}/${name}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${name}: ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(target));
  if (checksum) {
    const hash = createHash('sha256');
    for await (const chunk of fs.createReadStream(target)) hash.update(chunk);
    if (hash.digest('hex') !== checksum.trim().split(/\s/)[0])
      throw new Error(`${name}: sağlama toplamı eşleşmiyor`);
  }
  console.log(`${name} indirildi ve doğrulandı`);
}
const java = await fetch(
  'https://api.adoptium.net/v3/assets/latest/25/hotspot?architecture=x64&image_type=jdk&os=windows',
).then((r) => r.json());
const besuHashResponse = await fetch(
  'https://github.com/besu-eth/besu/releases/download/26.8.1/besu-26.8.1.zip.sha256',
);
if (!besuHashResponse.ok) throw new Error('Besu sağlama toplamı alınamadı');
const besuHash = await besuHashResponse.text();
await Promise.all([
  download(java[0].binary.package.link, 'java.zip', java[0].binary.package.checksum),
  download('https://github.com/besu-eth/besu/releases/download/26.8.1/besu-26.8.1.zip', 'besu.zip', besuHash),
  download(
    'https://repo.maven.apache.org/maven2/io/zonky/test/postgres/embedded-postgres-binaries-windows-amd64/17.6.0/embedded-postgres-binaries-windows-amd64-17.6.0.jar',
    'postgres.zip',
  ),
]);
