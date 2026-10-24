import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import dotenv from 'dotenv';
dotenv.config({ quiet: true });
const root = process.env.EDUMENT_NATIVE_ROOT || process.env.BILSEM_NATIVE_ROOT || process.cwd();
fs.mkdirSync('.runtime/logs', { recursive: true });
const executable = (relative) => path.join(root, relative);
function start(name, command, args, env = {}) {
  const log = fs.openSync(`.runtime/logs/${name}.log`, 'a');
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    windowsHide: true,
    detached: true,
    stdio: ['ignore', log, log],
  });
  child.unref();
  fs.writeFileSync(`.runtime/${name}.pid`, String(child.pid));
  console.log(`${name} başlatıldı; süreç ${child.pid}.`);
}
const target = process.argv[2] || 'all';
if (target === 'postgres' || target === 'all') {
  const data = executable('.runtime/pg-data');
  if (!fs.existsSync(path.join(data, 'PG_VERSION'))) {
    fs.writeFileSync('.runtime/pg-password', process.env.POSTGRES_PASSWORD, { mode: 0o600 });
    const result = spawnSync(
      executable('.runtime/postgres/bin/initdb.exe'),
      [
        '-D',
        data,
        '-U',
        decodeURIComponent(new URL(process.env.DATABASE_URL).username),
        '--pwfile=' + executable('.runtime/pg-password'),
        '--auth=scram-sha-256',
        '--encoding=UTF8',
        '--locale=C',
      ],
      { stdio: 'inherit', windowsHide: true },
    );
    fs.unlinkSync('.runtime/pg-password');
    if (result.status) process.exit(result.status);
  }
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-File', executable('scripts/portable-postgres.ps1'), 'start'],
    { windowsHide: true, stdio: 'inherit', env: { ...process.env, EDUMENT_NATIVE_ROOT: root } },
  );
  if (result.status) process.exit(result.status);
}
if (target === 'besu' || target === 'all') {
  const jdk = fs.readdirSync('.runtime/tools').find((n) => n.startsWith('jdk-'));
  start('besu', executable(`.runtime/tools/${jdk}/bin/java.exe`), [
    '-Xmx768m',
    '--enable-native-access=ALL-UNNAMED',
    '--add-opens=java.base/sun.security.provider=ALL-UNNAMED',
    '--add-opens=java.base/java.nio=ALL-UNNAMED',
    '-Dvertx.disableFileCPResolving=true',
    '-classpath',
    executable('.runtime/tools/besu-26.8.1/lib/*'),
    'org.hyperledger.besu.Besu',
    '--data-path=' + executable('.runtime/besu-data'),
    '--genesis-file=' + executable('infra/besu/generated/single/genesis.json'),
    '--node-private-key-file=' + executable('infra/besu/generated/single/node1/key'),
    '--rpc-http-enabled',
    '--rpc-http-host=127.0.0.1',
    '--rpc-http-api=ETH,NET,QBFT',
    '--host-allowlist=localhost,127.0.0.1',
    '--min-gas-price=0',
    '--discovery-enabled=false',
    '--p2p-host=127.0.0.1',
  ]);
}
if (target === 'matcher' || target === 'all')
  start(
    'matcher',
    executable('.venv/Scripts/python.exe'),
    [
      '-m',
      'uvicorn',
      'app:app',
      '--app-dir',
      executable('services/matcher'),
      '--host',
      '127.0.0.1',
      '--port',
      '8000',
    ],
    { PYTHONUTF8: '1' },
  );
if (target === 'minio')
  start(
    'minio',
    executable('.runtime/minio.exe'),
    [
      'server',
      executable('.runtime/minio-data'),
      '--address',
      '127.0.0.1:9000',
      '--console-address',
      '127.0.0.1:9001',
    ],
    { MINIO_ROOT_USER: process.env.MINIO_ACCESS_KEY, MINIO_ROOT_PASSWORD: process.env.MINIO_SECRET_KEY },
  );
