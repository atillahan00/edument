import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { Wallet } from 'ethers';
import { spawnSync } from 'node:child_process';
if (!fs.existsSync('.env')) {
  const password = randomBytes(24).toString('hex');
  let value = fs
    .readFileSync('.env.example', 'utf8')
    .replaceAll('CHANGE_ME', password)
    .replace(
      'BLOCKCHAIN_SIGNER_PRIVATE_KEY=',
      'BLOCKCHAIN_SIGNER_PRIVATE_KEY=' + Wallet.createRandom().privateKey,
    )
    .replace('EDUMENT_PSEUDONYM_SECRET=', 'EDUMENT_PSEUDONYM_SECRET=' + randomBytes(32).toString('hex'))
    .replace(
      'BOOTSTRAP_ADMIN_PASSWORD=',
      'BOOTSTRAP_ADMIN_PASSWORD=DevOnly9!' + randomBytes(16).toString('hex'),
    );
  fs.writeFileSync('.env', value, { mode: 0o600 });
  console.log(
    'Yalnızca geliştirmeye uygun sırlar .env dosyasına yazıldı. Yönetici parolasını bu dosyadan okuyun.',
  );
}
if (!process.argv.includes('--env-only'))
  for (const command of [
    'infra:up',
    'db:generate',
    'db:migrate',
    'contract:compile',
    'contract:deploy',
    'bootstrap:admin',
  ]) {
    const result = spawnSync('pnpm', [command], { stdio: 'inherit', shell: process.platform === 'win32' });
    if (result.status !== 0) {
      process.exitCode = 1;
      break;
    }
  }
