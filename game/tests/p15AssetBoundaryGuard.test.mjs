import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';

// P15-307: the asset boundary guard is an interlock, not a preference. This test
// locks the guarded list against the P15-302 disposition, asserts the guard is
// actually wired into the build, and asserts that no runtime source file loads
// anything on the list.
//
// The list is parsed out of vite.config.js as text rather than imported, so this
// test does not execute the build config or pull in vite.

const viteConfigSource = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
const indexHtmlSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// P15-302 disposition: six AI-generated PNGs carrying a baked background and an
// AI-generation watermark, plus the atlas manifest whose only consumer was the
// quarantined performer spritesheet.
const P15_302_DISPOSITION = [
  'bullets-v4-clear.png',
  'particles-burst-v1-clear.png',
  'particles-trail-v1-clear.png',
  'sakura-spritesheet-v1.json',
  'sakura-spritesheet-v1.png',
  'sakura-spritesheet-v2.png',
  'stage-bg-v3-clear.png',
];

function parseGuardedAssetList() {
  const match = viteConfigSource.match(
    /export const P15_UNAUTHORISED_RUNTIME_ASSETS = Object\.freeze\(\[([\s\S]*?)\]\);/
  );
  assert.ok(match, 'vite.config.js should export a frozen P15_UNAUTHORISED_RUNTIME_ASSETS list');
  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

function collectRuntimeSourceFiles(directoryUrl) {
  const files = [];
  const walk = (dirUrl) => {
    for (const entryName of readdirSync(dirUrl)) {
      const entryUrl = new URL(`${entryName}`, dirUrl);
      if (statSync(entryUrl).isDirectory()) {
        walk(new URL(`${entryName}/`, dirUrl));
        continue;
      }
      if (/\.(js|mjs)$/.test(entryName)) files.push(entryUrl);
    }
  };
  walk(directoryUrl);
  return files;
}

{
  const guarded = parseGuardedAssetList();

  assert.deepEqual(
    [...guarded].sort(),
    [...P15_302_DISPOSITION].sort(),
    'the guarded asset list must match the P15-302 disposition exactly - neither narrowed nor widened without a producer decision'
  );

  assert.ok(
    !guarded.includes('particles-impact-atlas.png') && !guarded.includes('particles-impact-atlas.json'),
    'particles-impact-atlas is clean and authorised; the guard must not remove it'
  );
}

{
  assert.ok(
    viteConfigSource.includes("name: 'p15-asset-boundary-guard'"),
    'vite.config.js should define the p15-asset-boundary-guard plugin'
  );
  assert.ok(
    viteConfigSource.includes("apply: 'build'"),
    'the guard should apply to builds, so dev serving is untouched'
  );
  assert.ok(
    /closeBundle\(\)\s*\{/.test(viteConfigSource),
    'the guard should run at closeBundle, after public/ has been copied into the output directory'
  );
  assert.ok(
    viteConfigSource.includes('fs.rmSync(target)'),
    'the guard should remove a guarded asset that reached the output directory'
  );
  assert.ok(
    /plugins:\s*\[p15AssetBoundaryGuard\(OUT_DIR\), runtimePayloadPlugin\(\)\]/.test(viteConfigSource),
    'the guard must be registered in the build plugin list, or it never runs'
  );
}

{
  const guarded = parseGuardedAssetList();
  const runtimeFiles = collectRuntimeSourceFiles(new URL('../src/', import.meta.url));

  assert.ok(runtimeFiles.length > 0, 'expected to find runtime source files under src/');

  for (const fileUrl of runtimeFiles) {
    const source = readFileSync(fileUrl, 'utf8');
    for (const assetName of guarded) {
      assert.ok(
        !source.includes(assetName),
        `runtime source ${fileUrl.pathname} must not reference the quarantined asset ${assetName}`
      );
    }
  }

  for (const assetName of guarded) {
    assert.ok(
      !indexHtmlSource.includes(assetName),
      `index.html must not reference the quarantined asset ${assetName}`
    );
  }
}

console.log('p15AssetBoundaryGuard: ok');
