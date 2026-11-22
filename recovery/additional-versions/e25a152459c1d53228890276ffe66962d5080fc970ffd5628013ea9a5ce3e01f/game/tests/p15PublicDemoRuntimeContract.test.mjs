import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const contractPath = path.join(projectRoot, 'src/utils/publicDemoRuntimeContract.mjs');

assert.equal(
  fs.existsSync(contractPath),
  true,
  'Public demo runtime contract module must exist'
);

const {
  PUBLIC_DEMO_SCENE_KEYS,
  assertPublicDemoSceneRegistry,
  createPublicDemoSceneRegistry,
} = await import(pathToFileURL(contractPath).href);

assert.deepEqual(
  PUBLIC_DEMO_SCENE_KEYS,
  ['TitleScene', 'TourRouteScene', 'IdolRosterScene', 'BattleScene'],
  'Public scene order must contain only accepted Phase 15 surfaces'
);

assert.equal(
  assertPublicDemoSceneRegistry(PUBLIC_DEMO_SCENE_KEYS),
  true,
  'Canonical public registry should pass'
);

for (const legacyKey of ['CharacterScene', 'StageScene']) {
  assert.throws(
    () => assertPublicDemoSceneRegistry([...PUBLIC_DEMO_SCENE_KEYS, legacyKey]),
    new RegExp(`legacy scene: ${legacyKey}`),
    `Registry must reject ${legacyKey}`
  );
}

assert.throws(
  () => assertPublicDemoSceneRegistry(['TitleScene', 'BattleScene']),
  /missing public scene: TourRouteScene/,
  'Registry must reject missing accepted read-only surfaces'
);

assert.throws(
  () => assertPublicDemoSceneRegistry([...PUBLIC_DEMO_SCENE_KEYS, 'BattleScene']),
  /duplicate public scene: BattleScene/,
  'Registry must reject duplicate scene registration'
);

const productionLikeEntries = PUBLIC_DEMO_SCENE_KEYS.map((key) => ({
  key,
  SceneClass: class a {},
}));

assert.deepEqual(
  createPublicDemoSceneRegistry(productionLikeEntries),
  productionLikeEntries.map(({ SceneClass }) => SceneClass),
  'Explicit scene keys must survive production class-name minification'
);

console.log('p15 public demo runtime contract: all assertions passed');
