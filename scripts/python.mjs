import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
const local = process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python';
const python = process.env.PYTHON_BIN || (fs.existsSync(local) ? local : 'python3');
const result = spawnSync(python, process.argv.slice(2), {
  stdio: 'inherit',
  env: { ...process.env, PYTHONUTF8: '1' },
});
if (result.error) console.error('Python ortamı bulunamadı. README içindeki kurulum adımlarını uygulayın.');
process.exitCode = result.status ?? 1;
