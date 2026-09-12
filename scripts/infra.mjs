import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';
dotenv.config({ quiet: true });
const args = process.argv.slice(2);
const mode = ['single', 'multi'].includes(args[0]) ? args.shift() : process.env.CHAIN_MODE || 'single';
const action = args.shift() || 'up';
function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32' && command === 'pnpm',
  });
  if (result.error) {
    console.error('Docker veya pnpm çalıştırılamadı. Ön koşulları kontrol edin.');
    process.exit(1);
  }
  if (result.status) process.exit(result.status);
}
const file = `infra/besu/${mode}/compose.yml`;
if (action === 'reset') {
  if (
    !args.includes('--confirm-local-reset') ||
    !['single', 'multi'].includes(mode) ||
    !(process.env.BESU_RPC_URLS || '')
      .split(',')
      .every((u) => ['localhost', '127.0.0.1'].includes(new URL(u).hostname))
  )
    throw new Error('Yalnızca yerel ağ, açık onay bayrağıyla sıfırlanabilir.');
  run('docker', ['compose', '-f', file, 'down', '--volumes']);
  console.log(
    'Yerel zincir hacimleri silindi. PostgreSQL korunur; eski kanıtlar artık bu ağda bulunmayacaktır.',
  );
} else if (action === 'up') {
  run(process.execPath, ['--import', 'tsx', 'scripts/genesis.ts', mode]);
  if (!process.argv.slice(2).includes(mode)) run('docker', ['compose', 'up', '-d', '--build']);
  run('docker', ['compose', '-f', file, 'up', '-d']);
} else if (action === 'down') {
  run('docker', ['compose', '-f', file, 'down']);
  if (!process.argv.slice(2).includes(mode)) run('docker', ['compose', 'down']);
} else throw new Error('Geçersiz altyapı komutu.');
