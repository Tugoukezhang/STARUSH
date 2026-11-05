import { createRequire } from 'node:module';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const nativeRequire = createRequire(import.meta.url);
const { transformSync } = nativeRequire('esbuild');

// Load the complete scene and owners. Transform source in memory so a junction or
// sandbox does not send a bundler searching unrelated parent directories.
export function loadBattleScene({ Phaser, document = {}, window = {}, includeOwners = false }) {
  const entry = fileURLToPath(new URL('../../src/scenes/BattleScene.js', import.meta.url));
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const { code } = transformSync(readFileSync(filename, 'utf8'), { format: 'cjs', loader: 'js' });
    vm.runInNewContext(code, {
      module, exports: module.exports, console, document, window,
      setTimeout, clearTimeout,
      require: (id) => id === 'phaser' ? Phaser
        : id.startsWith('.') ? load(path.resolve(path.dirname(filename), id)) : nativeRequire(id),
    }, { filename });
    return module.exports;
  }
  const BattleScene = load(entry).BattleScene;
  return includeOwners ? { BattleScene, PaintZoneSystem: load(path.resolve(path.dirname(entry), '../systems/PaintZoneSystem.js')).PaintZoneSystem } : BattleScene;
}
