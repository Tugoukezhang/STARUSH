import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getBattleBackgroundConfig,
  STAGE_1_BACKGROUND_SLOT,
} from '../src/utils/stageBackgrounds.mjs';
import { resolveStageWaveDefs } from '../src/utils/stageWaves.mjs';

const stage1Background = getBattleBackgroundConfig(1);
const fallbackBackground = getBattleBackgroundConfig(2);

assert.equal(stage1Background.slot, STAGE_1_BACKGROUND_SLOT);
assert.equal(stage1Background.key, 'stage-1-battle-background');
assert.equal(
  stage1Background.imagePath,
  'art/phase1/p1-6/stage1-music-festival-layered-preview-750x1334.png'
);
assert.equal(stage1Background.depth, -10);
assert.equal(stage1Background.displayWidth, 375);
assert.equal(stage1Background.displayHeight, 667);

assert.notEqual(fallbackBackground.slot, STAGE_1_BACKGROUND_SLOT);
assert.equal(
  fallbackBackground.imagePath,
  'art/phase1/v5-1/stage-combat-idol-v5-1-a-gameplay-polish-750x1334.png',
  'non-Stage 1 fallback should preserve the current background until later art work scopes it'
);

['collision', 'path', 'map', 'navigation', 'tilemap'].forEach((forbiddenKey) => {
  assert.equal(
    Object.hasOwn(stage1Background, forbiddenKey),
    false,
    `background config should not introduce gameplay field: ${forbiddenKey}`
  );
});

{
  const defs = resolveStageWaveDefs({
    battleData: { stageId: 1 },
    waveDefs: Array.from({ length: 10 }, (_, index) => ({
      wave: index + 1,
      interval: 1200,
      label: `Wave ${index + 1}`,
      enemies: [{ type: 'trainee', count: index + 4 }],
    })),
    getStageById: () => ({ id: 1, waves: 2 }),
  });
  assert.deepEqual(defs, [], 'Stage 1 background prep must not restore kill-waves over the paint round');
}

const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');
const backgroundMethod = battleSceneSource.match(/  _createStageBackground\(\) \{[\s\S]*?\n  \}\n\n  _hasNoteArtFrame/);
assert.ok(backgroundMethod, 'BattleScene should keep background rendering isolated');
assert.equal(backgroundMethod[0].includes('this.physics'), false, 'background rendering should not add physics');
assert.equal(backgroundMethod[0].includes('WaveSystem'), false, 'background rendering should not touch waves');
assert.ok(
  battleSceneSource.includes('getBattleBackgroundConfig'),
  'BattleScene should choose battle backgrounds through the Stage 1 integration config'
);
