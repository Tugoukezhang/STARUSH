import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const serverSource = readFileSync(new URL('../scripts/qa-static-server.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const healthSource = readFileSync(new URL('../scripts/qa-url-health.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

{
  assert.equal(packageJson.scripts['qa:serve-dist'], 'node scripts/qa-static-server.mjs');
  assert.equal(packageJson.scripts['qa:health'], 'node scripts/qa-url-health.mjs');
  assert.equal(packageJson.scripts.dev, 'vite', 'dev script should remain the normal Vite path');
  assert.equal(packageJson.scripts.build, 'vite build', 'build script should remain unchanged');
}

{
  [
    "const DEFAULT_HOST = '127.0.0.1';",
    'const DEFAULT_PORT = 5173;',
    'const DEFAULT_TTL_MS = 15 * 60 * 1000;',
    "const SERVER_NAME = 'starush-qa-static-dist';",
    "const DIST_ROOT = resolve(process.cwd(), 'dist');",
    "if (pathname === '/__qa_health')",
    'root: basename(DIST_ROOT)',
    'ttlMs',
    'listen(port, host',
    'setTimeout(() => shutdown(0), ttlMs)',
    "process.on('SIGINT'",
    "process.on('SIGTERM'",
  ].forEach((snippet) => {
    assert.ok(serverSource.includes(snippet), `qa static server should include: ${snippet}`);
  });

  [
    'vite',
    'vite.config',
    'npm install',
    'child_process',
    'open(',
    'msedge',
    'chrome',
  ].forEach((forbidden) => {
    assert.equal(serverSource.includes(forbidden), false, `qa static server must not invoke forbidden path: ${forbidden}`);
  });
}

{
  [
    'function resolveDistPath(pathname)',
    "return { status: 200, file: join(DIST_ROOT, 'index.html') };",
    'relative(DIST_ROOT, target)',
    'status: 403',
    'sendText(res, 404',
    "'.html': 'text/html; charset=utf-8'",
    "'.js': 'text/javascript; charset=utf-8'",
    "'.png': 'image/png'",
    "'.wav': 'audio/wav'",
  ].forEach((snippet) => {
    assert.ok(serverSource.includes(snippet), `qa static server should guard static files: ${snippet}`);
  });
}

{
  [
    "const DEFAULT_URL = 'http://127.0.0.1:5173/';",
    "new URL('/__qa_health', baseUrl)",
    'fetchWithTimeout',
    'health.ok === true',
    'status === 200',
    'title',
    "title.includes('ST')",
    "title.includes('RUSH')",
    'process.exitCode = 0',
    'process.exitCode = 1',
  ].forEach((snippet) => {
    assert.ok(healthSource.includes(snippet), `qa health check should include: ${snippet}`);
  });

  [
    'vite',
    'npm install',
    'child_process',
    'listen(',
    'createServer',
    'msedge',
    'chrome',
  ].forEach((forbidden) => {
    assert.equal(healthSource.includes(forbidden), false, `qa health check must not start forbidden service: ${forbidden}`);
  });
}

console.log('p15139A stable static dist server: all assertions passed');
