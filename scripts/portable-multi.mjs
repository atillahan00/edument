import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Wallet } from 'ethers';
const root = process.env.EDUMENT_NATIVE_ROOT || process.env.BILSEM_NATIVE_ROOT || process.cwd();
const jdk = fs.readdirSync('.runtime/tools').find((n) => n.startsWith('jdk-'));
const wallets = Array.from(
  { length: 4 },
  (_, i) => new Wallet('0x' + fs.readFileSync(`infra/besu/generated/multi/node${i + 1}/key`, 'utf8').trim()),
);
const selected = process.argv[2];
if (selected && !['1', '2', '3', '4'].includes(selected)) throw new Error('Geçersiz düğüm.');
for (let i = 0; i < 4; i++) {
  if (selected && Number(selected) !== i + 1) continue;
  const data = path.join(root, '.runtime', `multi-node${i + 1}`);
  fs.mkdirSync(data, { recursive: true });
  const peers = wallets
    .map((w, j) => `enode://${w.signingKey.publicKey.slice(4)}@127.0.0.1:${30311 + j}`)
    .filter((_, j) => j !== i);
  fs.writeFileSync(path.join(data, 'static-nodes.json'), JSON.stringify(peers));
  const log = fs.openSync(`.runtime/logs/multi-node${i + 1}.log`, 'a');
  const child = spawn(
    path.join(root, '.runtime/tools', jdk, 'bin/java.exe'),
    [
      '-Xmx512m',
      '--enable-native-access=ALL-UNNAMED',
      '--add-opens=java.base/sun.security.provider=ALL-UNNAMED',
      '--add-opens=java.base/java.nio=ALL-UNNAMED',
      '-Dvertx.disableFileCPResolving=true',
      '-classpath',
      path.join(root, '.runtime/tools/besu-26.8.1/lib/*'),
      'org.hyperledger.besu.Besu',
      `--data-path=${data}`,
      `--genesis-file=${path.join(root, 'infra/besu/generated/multi/genesis.json')}`,
      `--node-private-key-file=${path.join(root, `infra/besu/generated/multi/node${i + 1}/key`)}`,
      `--static-nodes-file=${path.join(data, 'static-nodes.json')}`,
      '--rpc-http-enabled',
      '--rpc-http-host=127.0.0.1',
      `--rpc-http-port=${8551 + i}`,
      '--rpc-http-api=ETH,NET,QBFT',
      '--host-allowlist=localhost,127.0.0.1',
      '--min-gas-price=0',
      '--discovery-enabled=false',
      '--p2p-host=127.0.0.1',
      `--p2p-port=${30311 + i}`,
    ],
    { cwd: root, windowsHide: true, detached: true, stdio: ['ignore', log, log] },
  );
  await new Promise((resolve, reject) => {
    child.once('spawn', resolve);
    child.once('error', reject);
  });
  fs.closeSync(log);
  child.unref();
  fs.writeFileSync(`.runtime/multi-node${i + 1}.pid`, String(child.pid));
  console.log(`Doğrulayıcı ${i + 1} başlatıldı.`);
}
