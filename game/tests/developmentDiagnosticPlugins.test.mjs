import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { rollup } from 'rollup';

const root = fs.realpathSync(path.resolve(import.meta.dirname, '..'));
const helperPath = path.join(root, 'scripts/tooling-plugins.mjs');
assert.ok(fs.existsSync(helperPath), 'development diagnostic plugin helper must exist');
const { createBundleAnalysisPlugins, validateLocalQaUrl, summarizeGpuCapture, fetchLocalQaHealth, isAllowedQaRequest, guardQaRoute, captureWhileMoving, finalizeGpuReport } = await import(pathToFileURL(helperPath));

assert.deepEqual(createBundleAnalysisPlugins(root), [], 'ordinary builds must not enable diagnostics');
for (const enabled of [false, undefined, '1', 1]) {
  assert.deepEqual(createBundleAnalysisPlugins(root, { enabled }), []);
}
assert.equal(createBundleAnalysisPlugins(root, { enabled: true }).length, 2);
assert.equal(validateLocalQaUrl('http://127.0.0.1:5174/?build=tools').hostname, '127.0.0.1');
assert.equal(validateLocalQaUrl('http://localhost:5174/').hostname, 'localhost');
assert.equal(validateLocalQaUrl('http://[::1]:5174/').hostname, '[::1]');
for (const url of ['https://example.com/', 'file:///D:/STARUSH/', 'http://127.0.0.1.evil/', 'http://user:pass@localhost:5174/']) {
  assert.throws(() => validateLocalQaUrl(url), /loopback/);
}
assert.throws(() => summarizeGpuCapture({ commands: [] }), /draw commands/);
const summary = summarizeGpuCapture({
  commands: [{ name: 'drawElements', status: 40 }, { name: 'bindTexture', status: 30 }, { name: 'drawArrays', status: 40 }],
  canvas: { width: 375, height: 667 }, frameMemory: { WebGLTexture: 123 }, analyses: [],
});
assert.equal(summary.drawCalls, 2);
assert.equal(summary.commandCount, 3);
assert.equal(summary.redundantCommands, 1);
assert.equal(summary.frameMemory.WebGLTexture, 123);

assert.equal(typeof fetchLocalQaHealth, 'function', 'health must reject redirects before following them');
let fetchOptions;
await assert.rejects(fetchLocalQaHealth('http://127.0.0.1:5174/', async (_url, options) => {
  fetchOptions = options;
  return { status: 302, ok: false, json: () => { throw new Error('must not parse redirect'); } };
}), /redirect/);
assert.equal(fetchOptions.redirect, 'manual');
assert.equal(isAllowedQaRequest('http://127.0.0.1:5174/assets/game.js', 'http://127.0.0.1:5174'), true);
assert.equal(isAllowedQaRequest('https://example.com/game', 'http://127.0.0.1:5174'), false);
assert.equal(isAllowedQaRequest('http://127.0.0.1:5175/game', 'http://127.0.0.1:5174'), false);
let aborted, fulfilled = false, requestedOptions, blocked;
await guardQaRoute({
  request: () => ({ url: () => 'http://127.0.0.1:5174/' }),
  fetch: async options => { requestedOptions = options; return { status: () => 302 }; },
  abort: async reason => { aborted = reason; }, fulfill: async () => { fulfilled = true; },
}, 'http://127.0.0.1:5174', event => { blocked = event; });
assert.equal(requestedOptions.maxRedirects, 0);
assert.equal(aborted, 'blockedbyclient');
assert.equal(blocked.reason, 'redirect');
assert.equal(fulfilled, false);
await guardQaRoute({
  request: () => ({ url: () => 'https://example.com/' }),
  fetch: async () => { throw new Error('external request must never start'); }, abort: async () => {},
}, 'http://127.0.0.1:5174', event => { blocked = event; });
assert.equal(blocked.reason, 'external origin');
await guardQaRoute({
  request: () => ({ url: () => 'http://127.0.0.1:5174/' }),
  fetch: async () => ({ status: () => 200 }),
  fulfill: async () => { throw new Error('response disposed during context close'); },
  abort: async () => { throw new Error('context already closed'); },
}, 'http://127.0.0.1:5174', () => { throw new Error('normal close must not be logged as a game failure'); }, () => true);

let held = false;
const inputLog = [];
const fakePage = {
  keyboard: { down: async key => { held = true; inputLog.push('down:' + key); }, up: async key => { held = false; inputLog.push('up:' + key); } },
  waitForTimeout: async () => { assert.equal(held, true); inputLog.push('wait'); },
};
assert.equal(await captureWhileMoving(fakePage, async () => { assert.equal(held, true); inputLog.push('capture'); return 42; }), 42);
assert.deepEqual(inputLog, ['down:ArrowUp', 'wait', 'capture', 'up:ArrowUp']);
await assert.rejects(captureWhileMoving(fakePage, async () => { throw new Error('capture failed'); }), /capture failed/);
assert.equal(held, false, 'failed capture must release movement input');
let written;
const failedClose = { ok: true };
await finalizeGpuReport({ close: async () => { throw new Error('close failed'); } }, failedClose, report => { written = { ...report }; });
assert.equal(written.ok, false);
assert.equal(written.browserClosed, false);
assert.match(written.browserCloseError, /close failed/);
const successfulClose = { ok: true };
await finalizeGpuReport({ close: async () => {} }, successfulClose, report => { written = { ...report }; });
assert.equal(written.browserClosed, true);
assert.equal(written.ok, true);

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(pkg.devDependencies['rollup-plugin-visualizer'], '7.1.1');
assert.equal(pkg.devDependencies.spectorjs, '0.9.33');
assert.equal(pkg.scripts['analyze:build'], 'node scripts/analyze-build.mjs');
assert.equal(pkg.scripts['qa:gpu'], 'node scripts/qa-gpu-capture.mjs');
assert.equal(pkg.dependencies.spectorjs, undefined);
const config = fs.readFileSync(path.join(root, 'vite.config.js'), 'utf8');
assert.doesNotMatch(config, /tooling-plugins|spectorjs|rollup-plugin-visualizer/);
assert.match(config, /plugins:\s*\[chapterContentGuard\(\), productFrameworkGuard\(\), p15AssetBoundaryGuard\(OUT_DIR\), runtimePayloadPlugin\(\[\.\.\.RUNTIME_PAYLOAD, \.\.\.HOME_PAYLOAD\]\)\]/);
assert.match(fs.readFileSync(path.join(root, 'scripts/analyze-build.mjs'), 'utf8'), /plugins: createBundleAnalysisPlugins\(root, \{ enabled: true \}\)/);

const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
for (const file of walk(path.join(root, 'src'))) {
  if (!/\.(mjs|js)$/.test(file)) continue;
  assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /spectorjs|rollup-plugin-visualizer|__starushGpuProbe/);
}
const gpuScript = fs.readFileSync(path.join(root, 'scripts/qa-gpu-capture.mjs'), 'utf8');
assert.match(gpuScript, /addInitScript/);
assert.match(gpuScript, /if \(document.head\)/);
assert.match(gpuScript, /MutationObserver/);
assert.match(gpuScript, /finally/);
assert.match(gpuScript, /finalizeGpuReport/);
assert.match(gpuScript, /context\.route/);
assert.match(gpuScript, /location.origin !== origin/);
assert.doesNotMatch(gpuScript, /qa-static-server|execFile|spawn\(|https?:\/\/[^'"\s]*\.(com|site)/);

// Run the actual Rollup plugin on a tiny fixture, rather than only checking its source.
const fixture = path.join(root, 'output/tooling/fixture');
fs.mkdirSync(fixture, { recursive: true });
fs.writeFileSync(path.join(fixture, 'input.mjs'), 'export const value = 42;\n');
const plugins = createBundleAnalysisPlugins(fixture, { enabled: true });
const bundle = await rollup({ input: path.join(fixture, 'input.mjs'), plugins });
try {
  await bundle.write({ file: path.join(fixture, 'dist/fixture.js'), format: 'es' });
} finally {
  await bundle.close();
}
const reportDir = path.join(fixture, 'output/tooling/bundle');
assert.match(fs.readFileSync(path.join(reportDir, 'bundle.html'), 'utf8'), /<html/);
const data = JSON.parse(fs.readFileSync(path.join(reportDir, 'bundle.json'), 'utf8'));
assert.ok(Object.keys(data.nodeMetas).length > 0, 'real module attribution must be emitted');
assert.deepEqual(fs.readdirSync(path.join(fixture, 'dist')), ['fixture.js'], 'reports must not ship in dist');
console.log('development diagnostic plugins: all assertions passed');
