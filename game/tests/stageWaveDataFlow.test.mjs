import assert from 'node:assert/strict';
import {
  getDisplayWaveNumber,
  normalizeBattleData,
  resolveStageWaveDefs,
} from '../src/utils/stageWaves.mjs';

const waveDefs = Array.from({ length: 10 }, (_, index) => ({
  wave: index + 1,
  label: `Wave ${index + 1}`,
  interval: 1200,
  enemies: [{ type: 'trainee', count: index + 4 }],
}));

function getStageById(stageId) {
  if (Number(stageId) === 1) return { id: 1, name: '第1关·登台', waves: 2 };
  return null;
}

{
  const data = normalizeBattleData({
    battleData: {
      characterId: 'sakura',
      team: [{ id: 'sakura' }],
    },
    stageId: '1',
  }, getStageById);

  assert.equal(data.stageId, 1, 'stage id from scene data should be normalized to a number');
  assert.equal(data.stageName, '第1关·登台');
  assert.equal(data.stageWaves, 2, 'Stage 1 config may still carry a waves field; public play uses the paint round');
  assert.deepEqual(data.team, [{ id: 'sakura' }], 'nested battleData should be preserved');
}

{
  const defs = resolveStageWaveDefs({
    battleData: { stageId: '1' },
    waveDefs,
    getStageById,
  });

  assert.deepEqual(defs, [], 'public Stage 1 no longer uses kill-waves; paint-round owns the fight');
}

assert.equal(getDisplayWaveNumber(0, 2), 1);
assert.equal(getDisplayWaveNumber(1, 2), 2);
assert.equal(getDisplayWaveNumber(2, 2), 2, 'Stage 1 HUD should not display WAVE 3/2 after final clear');
