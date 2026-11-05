import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createServer, request } from 'node:http';
import { once } from 'node:events';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

test('static delivery negotiates gzip without changing decoded bytes or binary assets', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'starush-delivery-'));
  mkdirSync(join(dir, 'dist'));
  const text = 'const value = "original-stage";\n'.repeat(12000);
  writeFileSync(join(dir, 'dist/index.html'), '<!doctype html><title>ST RUSH</title>');
  writeFileSync(join(dir, 'dist/game.js'), text);
  writeFileSync(join(dir, 'dist/actor.webp'), Buffer.from([1, 2, 3, 4]));
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(r => probe.close(r));
  const child = spawn(process.execPath, [fileURLToPath(new URL('../scripts/qa-static-server.mjs', import.meta.url)), '--port', String(port), '--ttl', '30'], { cwd: dir, windowsHide: true, stdio: 'ignore' });
  const closed = once(child, 'exit');
  const get = (pathname, encoding, method = 'GET') => new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path: pathname, method, headers: encoding === undefined ? {} : { 'Accept-Encoding': encoding } }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })); res.on('error', reject);
    }); req.on('error', reject); req.end();
  });
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) { try { ready = (await get('/__qa_health')).status === 200; } catch {} if (ready) break; await new Promise(r => setTimeout(r, 50)); }
    assert(ready, 'Bounded test server becomes healthy');
    const zipped = await get('/game.js', 'br, gzip');
    assert.equal(zipped.headers['content-encoding'], 'gzip');
    assert.equal(zipped.headers.vary, 'Accept-Encoding');
    assert.equal(gunzipSync(zipped.body).toString(), text);
    assert(zipped.body.length < Buffer.byteLength(text) / 4);
    for (const encoding of [undefined, 'gzip;q=0', 'gzip;q=0.000, *;q=1', 'br', '*;q=0']) {
      const raw = await get('/game.js', encoding); assert.equal(raw.headers['content-encoding'], undefined); assert.equal(raw.body.toString(), text);
    }
    for (const encoding of ['GZIP;q=0.5', '*;q=0.5']) assert.equal((await get('/game.js', encoding)).headers['content-encoding'], 'gzip');
    const image = await get('/actor.webp', 'gzip'); assert.equal(image.headers['content-encoding'], undefined); assert.deepEqual([...image.body], [1, 2, 3, 4]);
    const head = await get('/game.js', 'gzip', 'HEAD'); assert.equal(head.status, 200); assert.equal(head.headers['content-encoding'], 'gzip'); assert.equal(head.body.length, 0);
    assert.equal((await get('/missing.js', 'gzip')).status, 404);
  } finally {
    if (child.exitCode === null) child.kill(); await closed;
    const retry = await get('/__qa_health').catch(() => null); assert.equal(retry, null);
    const scoped = relative(tmpdir(), dir);
    assert(!isAbsolute(scoped) && !scoped.startsWith('..') && scoped.startsWith('starush-delivery-'));
    rmSync(dir, { recursive: true, force: true });
  }
});
