import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
let root = process.cwd();
while (!fs.existsSync(path.join(root, 'pnpm-workspace.yaml')) && path.dirname(root) !== root)
  root = path.dirname(root);
dotenv.config({ path: path.join(root, '.env'), quiet: true });
// Preserve existing integrity references when upgrading a local installation.
process.env.EDUMENT_PSEUDONYM_SECRET ||= process.env.BILSEM_PSEUDONYM_SECRET;
export const workspaceRoot = root;
export function required(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`Yapılandırma eksik: ${key}`);
  return value;
}
export function contractAddress() {
  const value = process.env.CONTRACT_ADDRESS;
  if (value) return value;
  const file = path.join(root, 'deployments', `${process.env.CHAIN_ID || 1337}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')).contractAddress as string;
  throw new Error('Akıllı sözleşme henüz dağıtılmadı.');
}
