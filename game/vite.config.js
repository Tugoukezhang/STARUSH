import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { runtimePayloadPlugin, RUNTIME_PAYLOAD, Q_REBASE_TRIAL_PAYLOAD, ENJO_VISUAL_STUDY_PAYLOAD } from './scripts/runtime-payload.mjs';
import {chapterContentGuard} from './scripts/check-chapter-content.mjs';
import {productFrameworkGuard} from './scripts/check-product-framework.mjs';

// P15-302 / P15-307 asset boundary guard.
//
// Six PNGs on this list were moved from public/ into the source-art quarantine on
// 2026-08-20. The atlas JSON remains as a clean frame-layout descriptor. Keep the
// full list as a permanent interlock: if any guarded file re-enters public/, Vite's
// wholesale public copy must not publish it.
//
// The durable fix is the owner file move out of 03-程序/public/ recorded in
// P15-302 section 3. This guard is the interlock, not the fix: it keeps an
// unauthorised asset out of a build even if one is present in public/, and it
// stays in place afterwards so a future asset cannot silently reach a build.
//
// sakura-spritesheet-v1.json carries no watermark of its own. It is the atlas
// manifest for sakura-spritesheet-v1/v2.png and has no other consumer, so it is
// listed with them.
//
// tests/p15AssetBoundaryGuard.test.mjs locks this list against the P15-302
// disposition and asserts that no runtime source file loads anything on it.
export const P15_UNAUTHORISED_RUNTIME_ASSETS = Object.freeze([
  'bullets-v4-clear.png',
  'particles-burst-v1-clear.png',
  'particles-trail-v1-clear.png',
  'sakura-spritesheet-v1.json',
  'sakura-spritesheet-v1.png',
  'sakura-spritesheet-v2.png',
  'stage-bg-v3-clear.png',
]);

function p15AssetBoundaryGuard(outDir) {
  return {
    name: 'p15-asset-boundary-guard',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const removed = [];
      for (const assetName of P15_UNAUTHORISED_RUNTIME_ASSETS) {
        const target = path.resolve(outDir, assetName);
        if (!fs.existsSync(target)) continue;
        fs.rmSync(target);
        removed.push(assetName);
      }

      if (removed.length === 0) {
        console.log(`[p15-asset-boundary-guard] clean: no unauthorised asset reached ${outDir}/`);
        return;
      }

      console.log(`[p15-asset-boundary-guard] removed ${removed.length} unauthorised asset(s) from ${outDir}/:`);
      for (const assetName of removed) console.log(`[p15-asset-boundary-guard]   - ${assetName}`);
      console.log('[p15-asset-boundary-guard] build output repaired; inspect public/ for an unauthorised asset re-entry.');
    },
  };
}

const OUT_DIR = 'dist';
const HOME_PAYLOAD = JSON.parse(fs.readFileSync(new URL('./home-payload.json', import.meta.url), 'utf8'));
const Q_TRIAL_BUILD = process.env?.STARUSH_Q_REBASE_TRIAL === '1';
// Match Vite's real module paths when the project is opened through a junction.
const ROOT = fs.realpathSync(path.dirname(fileURLToPath(import.meta.url)));

export default defineConfig({
  root: ROOT,
  define: { __Q_REBASE_TRIAL__: JSON.stringify(Q_TRIAL_BUILD) },
  base: './',
  resolve: {
    alias: [{ find: /^phaser$/, replacement: path.join(ROOT, 'node_modules/phaser/dist/phaser-arcade-physics.js') }],
  },
  build: {
    outDir: Q_TRIAL_BUILD ? 'dist-q-rebase' : OUT_DIR,
    assetsDir: 'assets',
  },
  server: {
    port: 3000,
    open: false,
  },
  plugins: [chapterContentGuard(), productFrameworkGuard(), p15AssetBoundaryGuard(OUT_DIR), runtimePayloadPlugin([...RUNTIME_PAYLOAD, ...HOME_PAYLOAD])],
  ...(Q_TRIAL_BUILD ? {
    plugins: [chapterContentGuard(), productFrameworkGuard(), p15AssetBoundaryGuard(OUT_DIR), runtimePayloadPlugin([...RUNTIME_PAYLOAD, ...Q_REBASE_TRIAL_PAYLOAD, ...ENJO_VISUAL_STUDY_PAYLOAD])],
  } : {}),
});
