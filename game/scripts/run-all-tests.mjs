import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const testsDir = path.join(projectRoot, 'tests');

const testFiles = fs.readdirSync(testsDir)
  .filter((fileName) => fileName.endsWith('.test.mjs'))
  .sort((a, b) => a.localeCompare(b, 'en'));

for (const fileName of testFiles) {
  const result = spawnSync(process.execPath, [path.join(testsDir, fileName)], {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    console.error(`test:all failed: ${fileName}`);
    process.exit(result.status ?? 1);
  }
}

console.log(`test:all passed: ${testFiles.length} files`);
