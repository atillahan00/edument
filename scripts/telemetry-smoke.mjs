// Isolated Windows integration test. Never uses .env database/chain or user records.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { Wallet, encodeRlp, ZeroHash, JsonRpcProvider, ContractFactory } from 'ethers';
import assert from 'node:assert/strict';
const root = process.env.EDUMENT_SMOKE_ROOT || process.cwd();
process.chdir(root);
const dir = path.join(root, '.runtime', `telemetry-smoke-${Date.now()}`);
fs.mkdirSync(dir, { recursive: true });
const relative = path.relative(root, dir);
const children = [];
const ports = [55432, 18551, 18552, 18553, 18554];
let chain;
let db,
  telemetry,
  monitor,
  provider,
  pgStarted = false;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(port) {
  return new Promise((resolve) => {
    const s = net.connect(port, '127.0.0.1');
    s.setTimeout(1000);
    s.once('connect', () => {
      s.destroy();
      resolve(true);
    });
    s.once('error', () => resolve(false));
    s.once('timeout', () => {
      s.destroy();
      resolve(false);
    });
  });
}
function run(file, args) {
  const result = spawnSync(file, args, { cwd: root, windowsHide: true, encoding: 'utf8', timeout: 120000 });
  if (result.status !== 0)
    throw new Error(`${path.basename(file)}: ${result.stderr || result.stdout || result.error}`);
}
function pg(action) {
  const exe = path.join(root, '.runtime/postgres/bin/pg_ctl.exe');
  const args =
    action === 'start'
      ? ['start', '-D', `${relative}/pg`, '-l', `${relative}/pg.log`, '-o', '"-h 127.0.0.1 -p 55432"', '-w']
      : ['stop', '-D', `${relative}/pg`, '-m', 'fast', '-w'];
  // Explicit hidden launcher; inherited output is not held by the postgres daemon.
  const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
  const command = `$p = Start-Process -FilePath ${quote(exe)} -ArgumentList @(${args.map(quote).join(',')}) -WindowStyle Hidden -PassThru; $p.WaitForExit(); exit $p.ExitCode`;
  run('powershell.exe', ['-NoProfile', '-Command', command]);
}
try {
  for (const port of ports) assert.equal(await open(port), false, `Test port ${port} already occupied`);
  const password = randomBytes(24).toString('hex');
  fs.writeFileSync(path.join(dir, 'password'), password);
  run(path.join(root, '.runtime/postgres/bin/initdb.exe'), [
    '-D',
    `${relative}/pg`,
    '-U',
    'edument',
    `--pwfile=${relative}/password`,
    '--auth=scram-sha-256',
    '--encoding=UTF8',
    '--locale=C',
  ]);
  fs.unlinkSync(path.join(dir, 'password'));
  pg('start');
  pgStarted = true;
  process.env.DATABASE_URL = `postgresql://edument:${password}@127.0.0.1:55432/postgres`;
  run(process.execPath, [
    'node_modules/prisma/build/index.js',
    'migrate',
    'deploy',
    '--schema',
    'apps/api/prisma/schema.prisma',
  ]);
  const signer = Wallet.createRandom();
  const validators = Array.from({ length: 4 }, () => Wallet.createRandom());
  const genesis = {
    config: {
      chainId: 19338,
      berlinBlock: 0,
      londonBlock: 0,
      zeroBaseFee: true,
      qbft: { blockperiodseconds: 1, epochlength: 30000, requesttimeoutseconds: 4 },
    },
    nonce: '0x0',
    timestamp: '0x0',
    gasLimit: '0x1c9c380',
    difficulty: '0x1',
    mixHash: '0x63746963616c2062797a616e74696e65206661756c7420746f6c6572616e6365',
    coinbase: '0x0000000000000000000000000000000000000000',
    baseFeePerGas: '0x0',
    alloc: { [signer.address.slice(2)]: { balance: '0x3635c9adc5dea00000' } },
    extraData: encodeRlp([ZeroHash, validators.map((w) => w.address.toLowerCase()).sort(), [], '0x', []]),
  };
  fs.writeFileSync(path.join(dir, 'genesis.json'), JSON.stringify(genesis));
  const jdk = fs.readdirSync('.runtime/tools').find((n) => n.startsWith('jdk-25'));
  for (let i = 0; i < 4; i++) {
    const nodeDir = path.join(dir, `node${i}`);
    fs.mkdirSync(nodeDir);
    fs.writeFileSync(path.join(nodeDir, 'key'), validators[i].privateKey.slice(2));
    fs.writeFileSync(
      path.join(nodeDir, 'peers.json'),
      JSON.stringify(
        validators
          .map((w, j) => `enode://${w.signingKey.publicKey.slice(4)}@127.0.0.1:${19311 + j}`)
          .filter((_, j) => i !== j),
      ),
    );
    const log = fs.openSync(path.join(dir, `node${i}.log`), 'a');
    const child = spawn(
      path.join(root, '.runtime/tools', jdk, 'bin/java.exe'),
      [
        '-Xmx384m',
        '--enable-native-access=ALL-UNNAMED',
        '--add-opens=java.base/sun.security.provider=ALL-UNNAMED',
        '--add-opens=java.base/java.nio=ALL-UNNAMED',
        '-Dvertx.disableFileCPResolving=true',
        '-classpath',
        path.join(root, '.runtime/tools/besu-26.8.1/lib/*'),
        'org.hyperledger.besu.Besu',
        `--data-path=${nodeDir}/data`,
        `--genesis-file=${dir}/genesis.json`,
        `--node-private-key-file=${nodeDir}/key`,
        `--static-nodes-file=${nodeDir}/peers.json`,
        '--rpc-http-enabled',
        '--rpc-http-host=127.0.0.1',
        `--rpc-http-port=${18551 + i}`,
        '--rpc-http-api=ETH,NET,QBFT',
        '--host-allowlist=localhost,127.0.0.1',
        '--min-gas-price=0',
        '--discovery-enabled=false',
        '--p2p-host=127.0.0.1',
        `--p2p-port=${19311 + i}`,
      ],
      { cwd: root, windowsHide: true, stdio: ['ignore', log, log] },
    );
    children.push(child);
    fs.closeSync(log);
  }
  fs.writeFileSync(path.join(dir, 'pids.json'), JSON.stringify(children.map((c) => c.pid)));
  Object.assign(process.env, {
    CHAIN_ID: '19338',
    CHAIN_MODE: 'multi',
    TELEMETRY_ENVIRONMENT: 'integration-test',
    TELEMETRY_ENABLED: 'true',
    BLOCKCHAIN_SIGNER_PRIVATE_KEY: signer.privateKey,
    EDUMENT_PSEUDONYM_SECRET: randomBytes(32).toString('hex'),
    BESU_GENESIS_HASH: '',
    BESU_RPC_URLS: [18551, 18552, 18553, 18554].map((p) => `http://127.0.0.1:${p}`).join(','),
    BESU_WRITE_RPC_URL: 'http://127.0.0.1:18551',
  });
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const { BlockchainProviderManager } = require('../apps/api/src/blockchain/provider.ts');
  const ready = new BlockchainProviderManager(process.env.BESU_RPC_URLS.split(','), 19338);
  try {
    for (let i = 0; i < 90; i++) {
      const states = await ready.health();
      if (states.every((s) => s.online && s.validators === 4 && s.block > 0)) break;
      if (i === 89) throw new Error(`Four Besu nodes did not become ready: ${relative}`);
      await delay(1000);
    }
  } finally {
    ready.destroy();
  }
  console.log('Four real QBFT validators ready');
  provider = new JsonRpcProvider('http://127.0.0.1:18551');
  const artifact = JSON.parse(
    fs.readFileSync(
      'packages/contracts/artifacts/contracts/EduMentRegistry.sol/EduMentRegistry.json',
    ),
  );
  const contract = await new ContractFactory(
    artifact.abi,
    artifact.bytecode,
    signer.connect(provider),
  ).deploy(signer.address, signer.address, { gasPrice: 0, gasLimit: 5000000 });
  await contract.waitForDeployment();
  process.env.CONTRACT_ADDRESS = await contract.getAddress();
  const { Database } = require('../apps/api/src/db.ts');
  const { Telemetry } = require('../apps/api/src/telemetry.ts');
  const { ChainService } = require('../apps/api/src/blockchain/service.ts');
  const { MonitorService } = require('../apps/api/src/monitor.service.ts');
  const { TelemetryController } = require('../apps/api/src/telemetry.controller.ts');
  const { hashRecord } = require('../apps/api/src/hash.ts');
  db = new Database();
  telemetry = new Telemetry(db);
  telemetry.onModuleInit();
  chain = new ChainService(db, telemetry);
  const snapshot = { synthetic: true, value: 'telemetry smoke' };
  const version = await db.recordVersion.create({
    data: { ownerId: randomUUID(), type: 'PROFILE', version: 1, snapshot, contentHash: hashRecord(snapshot) },
  });
  await db.$transaction((tx) => chain.enqueue(tx, version));
  for (let i = 0; i < 5; i++) {
    await chain.processOne();
    if (await db.blockchainAnchor.count({ where: { status: 'CONFIRMED' } })) break;
    await delay(1500);
  }
  assert.equal(await db.blockchainAnchor.count({ where: { status: 'CONFIRMED' } }), 1);
  monitor = new MonitorService(db, chain, telemetry, {});
  await monitor.tick();
  const valid = await db.telemetryEvent.findMany({ where: { kind: 'integrity.sample' } });
  assert.ok(valid.some((r) => r.data.state === 'VALID'));
  await db.recordVersion.update({
    where: { id: version.id },
    data: { snapshot: { ...snapshot, value: 'altered fixture' } },
  });
  monitor.lastIntegrity = 0;
  await monitor.tick();
  assert.ok(
    (await db.telemetryEvent.findMany({ where: { kind: 'integrity.sample' } })).some(
      (r) => r.data.state === 'MISMATCH',
    ),
  );
  assert.ok(
    (await db.telemetryEvent.findMany({ where: { kind: 'network.consistency' } })).some(
      (r) => r.data.status === 'MATCH',
    ),
  );
  const controller = new TelemetryController(db, telemetry);
  const query = {
    from: new Date(Date.now() - 3600000).toISOString(),
    to: new Date(Date.now() + 60000).toISOString(),
  };
  const summary = await controller.daily(query);
  assert.equal(summary.days[0].confirmationEvents, 1);
  assert.equal(summary.days[0].mismatchChecks, 1);
  let csv = '';
  await controller.export(
    { ...query, format: 'csv' },
    {
      setHeader() {},
      type() {},
      write(s) {
        csv += s;
        return true;
      },
      end() {},
      destroy() {
        throw new Error('export failed');
      },
    },
  );
  assert.ok(csv.includes('transaction.confirmed') && csv.includes('network.consistency'));
  // Real node loss, observed as missing (not consistent); remaining three still produce blocks.
  const before = await provider.getBlockNumber();
  children[3].kill();
  await delay(8000);
  await monitor.tick();
  const last = await db.telemetryEvent.findFirst({
    where: { kind: 'network.consistency' },
    orderBy: { observedAt: 'desc' },
  });
  assert.equal(last.data.status, 'INSUFFICIENT_DATA');
  assert.ok((await provider.getBlockNumber()) > before);
  const evidence = {
    at: new Date().toISOString(),
    validators: 4,
    syntheticOnly: true,
    checks: [
      'real transaction lifecycle',
      'four-node common-height consistency',
      'valid and tampered fixture',
      'daily summary',
      'CSV export',
      'one node offline and remaining chain progresses',
    ],
    observations: await db.telemetryEvent.count(),
    summary,
  };
  fs.mkdirSync('docs/evidence', { recursive: true });
  fs.writeFileSync('docs/evidence/telemetry-smoke.json', JSON.stringify(evidence, null, 2));
  fs.writeFileSync(path.join(dir, 'observations.csv'), csv);
  chain.manager.destroy();
  console.log(JSON.stringify({ passed: true, observations: evidence.observations }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (monitor) await monitor.onModuleDestroy();
  if (telemetry) await telemetry.onModuleDestroy();
  if (db) await db.$disconnect();
  provider?.destroy();
  chain?.manager.destroy();
  for (const child of children) if (child.exitCode === null) child.kill();
  if (pgStarted) {
    try {
      pg('stop');
    } catch (e) {
      console.error(e.message);
      process.exitCode = 1;
    }
  }
  await delay(1000);
  const active = [];
  for (const port of ports) if (await open(port)) active.push(port);
  console.log(JSON.stringify({ testNetworkStopped: active.length === 0, activePorts: active }));
  if (active.length) process.exitCode = 1;
}
