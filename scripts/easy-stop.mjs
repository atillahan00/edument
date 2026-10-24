import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const normalize = (value) => (value || '').replaceAll('\\', '/').toLowerCase();
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: root,
    windowsHide: true,
    encoding: 'utf8',
    timeout: 60000,
    ...options,
  });
  if (result.error || result.status !== 0)
    throw new Error(result.error?.message || result.stderr || `${command}: ${result.status}`);
  return result.stdout;
};
try {
  const lock = path.join(root, '.runtime/easy-start.lock');
  if (fs.existsSync(lock)) {
    const pid = Number(fs.readFileSync(lock, 'utf8'));
    let running = false;
    if (Number.isInteger(pid) && pid > 0) {
      try {
        process.kill(pid, 0);
        running = true;
      } catch {
        /* Stale lock. */
      }
    }
    if (running && !(process.argv.includes('--from-launcher') && pid === process.ppid))
      throw new Error('Açılış devam ediyor. Açılış tamamlanınca yeniden kapatın.');
  }
  const output = run('powershell.exe', [
    '-NoProfile',
    '-Command',
    "[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding; @(Get-CimInstance Win32_Process | Where-Object { $_.Name -in 'node.exe','python.exe','java.exe','minio.exe' } | Select-Object ProcessId,Name,CommandLine,@{Name='CreationDate';Expression={$_.CreationDate.ToUniversalTime().Ticks.ToString()}}) | ConvertTo-Json -Compress",
  ]);
  const parsed = JSON.parse(output.replace(/^\uFEFF/, '') || '[]');
  const processes = Array.isArray(parsed) ? parsed : [parsed];
  const legacyPath = path.join(root, '.runtime/easy-stop-legacy-api.json');
  const legacy = fs.existsSync(legacyPath)
    ? JSON.parse(fs.readFileSync(legacyPath, 'utf8').replace(/^\uFEFF/, ''))
    : null;
  const projectPrefix = normalize(root) + '/';
  const targets = processes.filter((p) => {
    const command = normalize(p.CommandLine);
    if (
      legacy &&
      p.ProcessId === legacy.ProcessId &&
      p.CreationDate === legacy.CreationDate &&
      p.CommandLine === legacy.CommandLine
    )
      return true;
    if (!command.includes(projectPrefix)) return false;
    return (
      (p.Name === 'node.exe' &&
        (command.includes(projectPrefix + 'apps/api/src/main.ts') ||
          (command.includes('/next/') &&
            (command.includes('/dist/bin/next') || command.includes('/dist/server/lib/start-server.js'))))) ||
      (p.Name === 'python.exe' &&
        command.includes('uvicorn') &&
        command.includes(projectPrefix + 'services/matcher')) ||
      (p.Name === 'java.exe' &&
        command.includes('org.hyperledger.besu.besu') &&
        (command.includes(projectPrefix + '.runtime/besu-data') ||
          [1, 2, 3, 4].some((i) => command.includes(projectPrefix + `.runtime/multi-node${i}`)))) ||
      (p.Name === 'minio.exe' && command.includes(projectPrefix + '.runtime/minio-data'))
    );
  });
  const dryRun = process.argv.includes('--check');
  // Stop API/web before their backing services. Never terminate by executable name or port.
  targets.sort((a, b) => (a.Name === 'node.exe' ? 0 : 1) - (b.Name === 'node.exe' ? 0 : 1));
  for (const p of targets) {
    console.log(`${dryRun ? 'Kapatılacak' : 'Kapatılıyor'}: ${p.Name} (${p.ProcessId})`);
    if (!dryRun) {
      // A parent termination can also remove another target in this snapshot.
      try {
        process.kill(p.ProcessId, 0);
      } catch {
        continue;
      }
      run('taskkill.exe', ['/PID', String(p.ProcessId), '/T', '/F']);
    }
  }
  const pgCtl = path.join(root, '.runtime/postgres/bin/pg_ctl.exe');
  const pgData = path.join(root, '.runtime/pg-data');
  const status = spawnSync(pgCtl, ['status', '-D', pgData], { windowsHide: true, encoding: 'utf8' });
  if (status.error || ![0, 3].includes(status.status)) throw new Error('PostgreSQL durumu denetlenemedi.');
  if (status.status === 0) {
    console.log(
      dryRun
        ? 'PostgreSQL normal kapatma ile durdurulacak.'
        : 'PostgreSQL kayıtları diske yazılarak kapatılıyor...',
    );
    if (!dryRun) run(pgCtl, ['stop', '-D', pgData, '-m', 'fast', '-w', '-t', '45']);
  }
  console.log(
    dryRun
      ? 'Kapatma kontrolü tamamlandı; servisler değiştirilmedi.'
      : 'EduMent kapatıldı. Tarayıcı sekmesini de kapatabilirsiniz.',
  );
} catch (error) {
  console.error(`HATA: ${error.message}`);
  process.exitCode = 1;
}
