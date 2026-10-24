import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
dotenv.config({ path: path.join(root, '.env'), quiet: true });
const logs = path.join(root, '.runtime/logs');
fs.mkdirSync(logs, { recursive: true });
const lock = path.join(root, '.runtime/easy-start.lock');
let ownsLock = false;
let postgresPort = 5432;
const modeIndex = process.argv.indexOf('--mode');
const mode = modeIndex < 0 ? 'single' : process.argv[modeIndex + 1];
const stateFile = path.join(root, '.runtime/active-mode.json');
function runNode(args, timeout = 120000) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    windowsHide: true,
    stdio: 'inherit',
    timeout,
  });
  if (result.error || result.status !== 0) throw new Error('Kurulum adımı tamamlanamadı: ' + args.join(' '));
}
async function rpc(url, method, params = []) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(5000),
  });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error('Düğüm yanıt vermedi.');
  return body.result;
}
const alive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
function listening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const finish = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(800);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}
async function httpReady(url, rpc = false) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      ...(rpc
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 }),
          }
        : {}),
    });
    if (!response.ok) return false;
    return !rpc || Number((await response.json()).result) === Number(process.env.CHAIN_ID || 1337);
  } catch {
    return false;
  }
}
async function waitFor(name, check, seconds = 120) {
  const end = Date.now() + seconds * 1000;
  do {
    if (await check()) return;
    await delay(1000);
  } while (Date.now() < end);
  throw new Error(`${name} hazır olmadı. Günlükler: ${logs}`);
}
function portable(target) {
  const command =
    target === 'postgres' ? path.join(root, '.runtime/postgres/bin/pg_ctl.exe') : process.execPath;
  const args =
    target === 'postgres'
      ? [
          'start',
          '-D',
          path.join(root, '.runtime/pg-data'),
          '-l',
          path.join(logs, 'postgres.log'),
          '-o',
          `-h 127.0.0.1 -p ${postgresPort}`,
          '-w',
          '-s',
        ]
      : ['scripts/portable-start.mjs', target];
  const result = spawnSync(command, args, {
    cwd: root,
    windowsHide: true,
    stdio: 'inherit',
    timeout: 120000,
  });
  if (result.error || result.status !== 0)
    throw new Error(`${target} başlatılamadı: ${result.error?.message || result.status}`);
}
async function background(name, args, cwd) {
  const log = fs.openSync(path.join(logs, `${name}.log`), 'a');
  const child = spawn(process.execPath, args, {
    cwd,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', log, log],
  });
  try {
    await new Promise((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
    fs.writeFileSync(path.join(root, `.runtime/${name}.pid`), String(child.pid));
    child.unref();
  } finally {
    fs.closeSync(log);
  }
}
async function ensure(name, port, start, check = () => listening(port)) {
  if (await check()) {
    console.log(`${name} zaten hazır.`);
    return;
  }
  if (!(await listening(port))) {
    console.log(`${name} başlatılıyor...`);
    await start();
  }
  await waitFor(name, check);
  console.log(`${name} hazır.`);
}
try {
  const databaseUrl = new URL(process.env.DATABASE_URL);
  if (!['127.0.0.1', 'localhost'].includes(databaseUrl.hostname))
    throw new Error('Bu başlatıcı yerel veritabanı içindir.');
  postgresPort = Number(databaseUrl.port || 5432);
  if (!['single', 'multi'].includes(mode)) throw new Error('Mod single veya multi olmalı.');
  process.env.CHAIN_MODE = mode;
  process.env.CHAIN_ID = mode === 'single' ? '1337' : '1338';
  const ports = mode === 'single' ? [8545] : [8551, 8552, 8553, 8554];
  const urls = ports.map((port) => `http://127.0.0.1:${port}`);
  process.env.BESU_RPC_URLS = urls.join(',');
  process.env.BESU_WRITE_RPC_URL = urls[0];
  process.env.BESU_GENESIS_HASH = '';
  process.env.CONTRACT_ADDRESS = '';
  if (mode === 'multi') {
    const name = decodeURIComponent(databaseUrl.pathname.slice(1));
    if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,55}$/.test(name)) throw new Error('Yerel veritabanı adı desteklenmiyor.');
    databaseUrl.pathname = '/' + name + '_multi';
    process.env.DATABASE_URL = databaseUrl.toString();
  }
  for (const file of [
    '.env',
    '.runtime/pg-data/PG_VERSION',
    '.runtime/postgres/bin/pg_ctl.exe',
    '.runtime/minio.exe',
    '.venv/Scripts/python.exe',
    'node_modules/tsx/dist/cli.mjs',
    'apps/web/node_modules/next/dist/bin/next',
    'node_modules/prisma/build/index.js',
    'packages/contracts/artifacts/contracts/EduMentRegistry.sol/EduMentRegistry.json',
  ]) {
    if (!fs.existsSync(path.join(root, file))) throw new Error(`Kurulum dosyası eksik: ${file}`);
  }
  if (process.argv.includes('--check')) {
    console.log('Başlatıcı ön kontrolleri başarılı.');
  } else {
    if (fs.existsSync(lock)) {
      const pid = Number(fs.readFileSync(lock, 'utf8'));
      if (alive(pid)) throw new Error('Başlatma zaten devam ediyor. Açık başlatıcı penceresini bekleyin.');
      fs.unlinkSync(lock);
    }
    fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
    ownsLock = true;
    console.log(
      mode === 'single' ? 'Tek düğüm modu (1337)' : 'Çoklu düğüm modu: 4 doğrulayıcı (1338), ayrı veritabanı',
    );
    const previous = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : null;
    if (previous?.mode !== mode) {
      console.log('Servisler seçilen ağ için yeniden başlatılıyor...');
      runNode(['scripts/easy-stop.mjs', '--from-launcher']);
    }
    // Failed switches must not leave an old successful mode marker behind.
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
    await ensure('PostgreSQL', postgresPort, () => portable('postgres'));
    if (mode === 'multi') {
      runNode(['--import', 'tsx', 'scripts/prepare-multi-db.ts']);
      runNode([
        'node_modules/prisma/build/index.js',
        'migrate',
        'deploy',
        '--schema',
        'apps/api/prisma/schema.prisma',
      ]);
      runNode(['--import', 'tsx', 'scripts/admin.ts']);
    }
    const databaseCheck = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/check-database.ts'], {
      cwd: root,
      windowsHide: true,
      stdio: 'inherit',
      timeout: 30000,
    });
    if (databaseCheck.error || databaseCheck.status !== 0)
      throw new Error('Veritabanı kontrolü başarısız. Açılış durduruldu.');
    if (mode === 'multi') {
      runNode(['--import', 'tsx', 'scripts/genesis.ts', 'multi']);
      for (let i = 0; i < ports.length; i++) {
        if (!(await listening(ports[i]))) runNode(['scripts/portable-multi.mjs', String(i + 1)]);
      }
    }
    for (let i = 0; i < ports.length; i++) {
      if (mode === 'single')
        await ensure(
          'Blokzincir',
          ports[i],
          () => portable('besu'),
          () => httpReady(urls[i], true),
        );
      else await waitFor(`Blokzincir ${i + 1}`, () => httpReady(urls[i], true));
    }
    const initialBlocks = await Promise.all(urls.map((url) => rpc(url, 'eth_blockNumber')));
    await waitFor('Ag mutabakati', async () => {
      try {
        const blocks = await Promise.all(urls.map((url) => rpc(url, 'eth_blockNumber')));
        return blocks.every((block, i) => Number(block) > Number(initialBlocks[i]));
      } catch {
        return false;
      }
    });
    const genesis = await Promise.all(urls.map((url) => rpc(url, 'eth_getBlockByNumber', ['0x0', false])));
    if (!genesis.every((block) => block.hash === genesis[0].hash))
      throw new Error('Düğümler aynı ağda değil.');
    process.env.BESU_GENESIS_HASH = genesis[0].hash;
    const deploymentFile = path.join(root, `deployments/${process.env.CHAIN_ID}.json`);
    if (!fs.existsSync(deploymentFile)) runNode(['--import', 'tsx', 'scripts/deploy.ts']);
    const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    if ((await rpc(urls[0], 'eth_getCode', [deployment.contractAddress, 'latest'])) === '0x') {
      throw new Error('Kayıtlı sözleşme bu ağda bulunamadı. Mevcut kayıtlar korunarak açılış durduruldu.');
    }
    await ensure(
      'Dosya deposu',
      9000,
      () => portable('minio'),
      () => httpReady('http://127.0.0.1:9000/minio/health/live'),
    );
    await ensure(
      'Eslestirme servisi',
      8000,
      () => portable('matcher'),
      () => httpReady('http://127.0.0.1:8000/health'),
    );
    const apiPort = Number(process.env.API_PORT || 3001);
    await ensure(
      'API',
      apiPort,
      () =>
        background(
          'api',
          ['--import', 'tsx', path.join(root, 'apps/api/src/main.ts')],
          path.join(root, 'apps/api'),
        ),
      () => httpReady(`http://127.0.0.1:${apiPort}/api/docs`),
    );
    await ensure(
      'Arayuz',
      3000,
      () =>
        background(
          'web',
          [
            path.join(root, 'apps/web/node_modules/next/dist/bin/next'),
            'dev',
            '-H',
            '127.0.0.1',
            '-p',
            '3000',
          ],
          path.join(root, 'apps/web'),
        ),
      () => httpReady('http://127.0.0.1:3000'),
    );
    fs.writeFileSync(stateFile, JSON.stringify({ mode }));
    console.log(
      '\nEduMent hazır: http://localhost:3000\nBu pencereyi kapatabilirsiniz. Servisler arka planda çalışır.',
    );
    if (!process.argv.includes('--no-browser')) {
      const result = spawnSync(
        'powershell.exe',
        ['-NoProfile', '-Command', "Start-Process 'http://localhost:3000'"],
        { windowsHide: true },
      );
      if (result.error || result.status !== 0) console.log('Tarayıcıda http://localhost:3000 adresini açın.');
    }
  }
} catch (error) {
  console.error(`\nHATA: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (ownsLock) fs.unlinkSync(lock);
}
