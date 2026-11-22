import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, relative, isAbsolute } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(resolve(root, 'recovery/manifest.json'), 'utf8'));
let failures = 0;
for (const entry of manifest.files) {
  const target = resolve(root, entry.path);
  const local = relative(root, target);
  if (local.startsWith('..') || isAbsolute(local)) throw new Error(`Invalid archive path: ${entry.path}`);
  try {
    const bytes = await readFile(target);
    const sha = createHash('sha256').update(bytes).digest('hex');
    if (bytes.length !== entry.bytes || sha !== entry.sha256) throw new Error('size or SHA-256 differs');
  } catch (error) {
    console.error(`${entry.path}: ${error.message}`);
    failures++;
  }
}
console.log(`${manifest.files.length} files checked; ${failures} missing or changed.`);
process.exitCode = failures ? 1 : 0;
