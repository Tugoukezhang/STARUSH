import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { runtimePayloadPlugin } from '../scripts/runtime-payload.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('esbuild');
const vite = await import(pathToFileURL(path.join(
  path.dirname(require.resolve('vite/package.json')), 'dist/node/index.js'
)).href);
const configFile = fileURLToPath(new URL('../vite.config.js', import.meta.url));
const configDirectory = path.dirname(configFile);
const configSource = fs.readFileSync(configFile, 'utf8');
const guardedAssets = [
  'bullets-v4-clear.png',
  'particles-burst-v1-clear.png',
  'particles-trail-v1-clear.png',
  'sakura-spritesheet-v1.json',
  'sakura-spritesheet-v1.png',
  'sakura-spritesheet-v2.png',
  'stage-bg-v3-clear.png',
];

// Match Vite 5's config-file URL injection without writing a bundled config.
// Intercept filesystem effects so closeBundle never touches real build output.
function evaluateConfig({ filename = configFile, realpathSync = fs.realpathSync } = {}) {
  const state = {
    cwd: path.resolve(configDirectory, '../unrelated-launch-directory'),
    files: new Set(),
    checked: [],
    removed: [],
    logs: [],
  };
  const configFs = {
    realpathSync,
    existsSync(target) {
      state.checked.push(target);
      return state.files.has(target);
    },
    rmSync(target) {
      assert.ok(state.files.delete(target), 'only an existing guarded file may be removed');
      state.removed.push(target);
    },
  };
  const { code } = transformSync(configSource, {
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    sourcefile: filename,
    define: { 'import.meta.url': JSON.stringify(pathToFileURL(filename).href) },
  });
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    __dirname: path.dirname(filename),
    __filename: filename,
    require(id) {
      if (id === 'node:fs') return configFs;
      if (id === 'vite') return vite;
      if (id === './scripts/runtime-payload.mjs') return { runtimePayloadPlugin };
      return require(id);
    },
    process: { cwd: () => state.cwd },
    console: { log: (message) => state.logs.push(message) },
  }, { filename });
  return { config: module.exports.default, assets: module.exports.P15_UNAUTHORISED_RUNTIME_ASSETS, state };
}

test('root is the real config directory, independent of the launch directory', () => {
  const { config, state } = evaluateConfig();
  assert.notEqual(state.cwd, configDirectory);
  assert.equal(config.root, fs.realpathSync(configDirectory));
  assert.ok(path.isAbsolute(config.root));
});

test('logical and physical config paths converge before HTML output naming', () => {
  const logicalRoot = process.platform === 'win32' ? 'C:\\junction\\03-program' : '/junction/03-program';
  const physicalRoot = process.platform === 'win32' ? 'D:\\STARUSH\\03-program' : '/physical/03-program';
  for (const directory of [logicalRoot, physicalRoot]) {
    const canonicalized = [];
    const { config } = evaluateConfig({
      filename: path.join(directory, 'vite.config.js'),
      realpathSync(value) {
        canonicalized.push(value);
        assert.equal(value, directory, 'canonicalize the config directory, not cwd');
        return physicalRoot;
      },
    });
    assert.equal(config.root, physicalRoot);
    assert.deepEqual(canonicalized, [directory]);
    assert.equal(path.relative(config.root, path.join(physicalRoot, 'index.html')), 'index.html');
  }
});

test('existing output settings and exact seven-asset build-only guard are preserved', () => {
  const { config, assets } = evaluateConfig();
  assert.equal(config.base, './');
  assert.equal(config.build.outDir, 'dist');
  assert.equal(config.build.assetsDir, 'assets');
  assert.equal(config.plugins.length, 2);
  assert.equal(config.plugins[1].name, 'runtime-payload-boundary');
  assert.equal(config.plugins[0].name, 'p15-asset-boundary-guard');
  assert.equal(config.plugins[0].apply, 'build');
  assert.deepEqual(Array.from(assets), guardedAssets);
  assert.ok(Object.isFrozen(assets));
});

test('dev server keeps its port without opening a browser automatically', () => {
  const { config } = evaluateConfig();
  assert.equal(config.server.port, 3000);
  assert.equal(config.server.open, false);
});

for (const [label, outDir] of [
  ['default', 'dist'],
  ['nested relative', 'release/mobile'],
  ['parent relative', '../release-mobile'],
  ['absolute', path.resolve(configDirectory, '../absolute-mobile-output')],
]) {
  test(`asset guard uses resolved root and ${label} outDir, not cwd or the config default`, () => {
    const { config, state } = evaluateConfig();
    const plugin = config.plugins[0];
    const root = path.resolve(configDirectory, '../configured-project-root');
    const outputDirectory = path.resolve(root, outDir);
    const expectedRemoved = guardedAssets.map((name) => path.join(outputDirectory, name));
    const preserved = [
      ...guardedAssets.map((name) => path.join(root, 'public', name)),
      ...guardedAssets.map((name) => path.join(state.cwd, 'dist', name)),
      ...guardedAssets.map((name) => path.join(configDirectory, 'dist', name)),
      path.join(outputDirectory, 'particles-impact-atlas.png'),
      path.join(outputDirectory, 'particles-impact-atlas.json'),
      path.join(outputDirectory, 'index.html'),
    ];
    for (const file of [...expectedRemoved, ...preserved]) state.files.add(file);
    assert.equal(typeof plugin.configResolved, 'function', 'capture Vite resolved configuration');
    plugin.configResolved({ root, build: { outDir } });
    state.cwd = path.resolve(configDirectory, '../another-launch-directory');
    const laterCwdFiles = guardedAssets.map((name) => path.join(state.cwd, 'dist', name));
    for (const file of laterCwdFiles) state.files.add(file);

    plugin.closeBundle();

    assert.deepEqual(state.checked, expectedRemoved);
    assert.deepEqual(state.removed, expectedRemoved);
    assert.deepEqual([...state.files], [...preserved, ...laterCwdFiles]);
    assert.ok(state.logs.some((line) => line.includes(outputDirectory)), 'report the actual guarded output');
    plugin.closeBundle();
    assert.deepEqual(state.removed, expectedRemoved, 'a second close is clean and removes nothing else');
    assert.ok(state.logs.at(-1).includes('clean:'));
  });
}

test('clean output and partial guarded re-entry are handled without broad deletion', () => {
  const { config, state } = evaluateConfig();
  const plugin = config.plugins[0];
  const root = fs.realpathSync(configDirectory);
  const outputDirectory = path.join(root, 'dist');
  assert.equal(typeof plugin.configResolved, 'function');
  plugin.configResolved({ root, build: { outDir: 'dist' } });
  plugin.closeBundle();
  assert.equal(state.checked.length, 7);
  assert.deepEqual(state.removed, []);
  assert.ok(state.logs.at(-1).includes('clean:'));

  const reentered = path.join(outputDirectory, guardedAssets[3]);
  state.files.add(reentered);
  plugin.closeBundle();
  assert.deepEqual(state.removed, [reentered]);
  assert.equal(state.files.size, 0);
});
