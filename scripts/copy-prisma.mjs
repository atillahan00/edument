import fs from 'node:fs';
import path from 'node:path';
const source = path.resolve('generated/prisma');
const destination = path.resolve('dist/apps/api/generated/prisma');
fs.mkdirSync(destination, { recursive: true });
for (const file of fs.readdirSync(source))
  if (file.endsWith('.node') || file.endsWith('.dll')) {
    const src = path.join(source, file),
      dest = path.join(destination, file);
    if (!fs.existsSync(dest) || !fs.readFileSync(src).equals(fs.readFileSync(dest)))
      fs.copyFileSync(src, dest);
  }
