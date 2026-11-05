import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const runnerPath = path.join(projectRoot, 'scripts/run-all-tests.mjs');

assert.equal(
  packageJson.scripts?.['test:all'],
  'node scripts/run-all-tests.mjs',
  'package.json must expose the canonical full-test command'
);

assert.equal(
  fs.existsSync(runnerPath),
  true,
  'Canonical full-test runner must exist'
);

const runnerSource = fs.readFileSync(runnerPath, 'utf8');
assert.equal(runnerSource.includes("endsWith('.test.mjs')"), true, 'Runner must discover all Node test files');
assert.equal(runnerSource.includes('spawnSync(process.execPath'), true, 'Runner must execute tests with the active Node runtime');
assert.equal(runnerSource.includes("sort((a, b) => a.localeCompare(b, 'en'))"), true, 'Runner order must be deterministic');

console.log('p15 canonical test:all command: all assertions passed');
