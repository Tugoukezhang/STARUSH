import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolveStageWaveDefs,
  STAGE_1_PRACTICE_TARGET_TYPE,
  STAGE_15_DRIFTING_LIGHTSTICK_TYPE,
  STAGE_15_STAGE_MARKER_TARGET_TYPE,
} from '../src/utils/stageWaves.mjs';

const waveSystemSource = readFileSync(new URL('../src/systems/WaveSystem.js', import.meta.url), 'utf8');
const titleSceneSource = readFileSync(new URL('../src/scenes/TitleScene.js', import.meta.url), 'utf8');
const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');

const baseWaveDefs = [
  { wave: 1, label: 'Wave 1', interval: 1800, enemies: [{ type: 'trainee', count: 4 }] },
  { wave: 2, label: 'Wave 2', interval: 1600, enemies: [{ type: 'trainee', count: 5 }] },
  { wave: 3, label: 'Wave 3', interval: 1500, enemies: [{ type: 'trainee', count: 6 }] },
];

function getStageById(stageId) {
  if (Number(stageId) === 1) return { id: 1, name: 'Stage 1', waves: 2 };
  return null;
}

function sourceBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

{
  const defs = resolveStageWaveDefs({
    battleData: { stageId: 1, practiceMode: true },
    waveDefs: baseWaveDefs,
    getStageById,
  });

  assert.equal(defs.length, 4);
  assert.deepEqual(defs.map((def) => def.interval), [3000, 2200, 500, 2200]);
  assert.deepEqual(defs.map((def) => def.minActiveMs), [9000, 12000, 8000, 10000]);
  assert.deepEqual(defs[1].enemies, [{ type: STAGE_15_DRIFTING_LIGHTSTICK_TYPE, count: 2 }]);
  assert.deepEqual(defs[2].enemies, [
    { type: 'trainee', count: 1 },
    { type: STAGE_15_STAGE_MARKER_TARGET_TYPE, count: 1 },
  ]);
  assert.deepEqual(defs[3].enemies, [{ type: STAGE_1_PRACTICE_TARGET_TYPE, count: 1 }]);
  const estimatedPracticeMs = 3000 + defs.reduce((sum, def) => sum + def.minActiveMs, 0) + 3000 * defs.length;
  assert.ok(
    estimatedPracticeMs >= 35000,
    'practice pacing should have enough minimum active time to avoid a 5-10s debug skip'
  );
  assert.ok(
    estimatedPracticeMs <= 60000,
    'practice pacing should stay inside the short 35-60s hidden-practice envelope'
  );
  assert.ok(
    estimatedPracticeMs >= 50000 && estimatedPracticeMs <= 58000,
    'P15-81 tuning should target the recommended 50-58s practice runtime band'
  );
}

{
  const defs = resolveStageWaveDefs({
    battleData: { stageId: 1, practiceMode: false, p47Stage1ReplayObjectiveIndex: 0 },
    waveDefs: baseWaveDefs,
    getStageById,
  });

  assert.deepEqual(defs, [], 'public Stage 1 is a paint round, not a minActive kill-wave hold');
}

{
  assert.ok(waveSystemSource.includes('pendingWaveClearTimer'), 'WaveSystem should track deferred wave clear timers');
  assert.ok(waveSystemSource.includes('waveStartedAt'), 'WaveSystem should record when a wave starts');
  assert.ok(waveSystemSource.includes('minActiveMs'), 'WaveSystem should honor practice minActiveMs');
  assert.ok(
    waveSystemSource.includes('_completeCurrentWave()'),
    'WaveSystem should centralize wave completion after minimum pacing is satisfied'
  );
  assert.ok(
    waveSystemSource.includes('this.onInterWaveBreak = null'),
    'WaveSystem inter-wave cue hook should stay default-inactive'
  );
  assert.ok(
    waveSystemSource.includes('_scheduleNextWaveAfterBreak(clearedWaveIndex)'),
    'WaveSystem should route wave transitions through the inter-wave break scheduler'
  );
  assert.ok(
    waveSystemSource.includes('this.scene.time.delayedCall(3000, () => this.startNextWave())'),
    'ordinary practice should keep the existing three-second next-wave delay when no cue hook handles it'
  );
}

{
  const createBlock = sourceBlock(titleSceneSource, '  create() {', '  _buildRecommendedBattleData');
  assert.ok(
    createBlock.includes('suppressDebugAutoStart'),
    'TitleScene should allow result-return to suppress debug auto-start'
  );
  assert.ok(
    createBlock.includes("if (query.has('debug') && !suppressDebugAutoStart)"),
    'debug auto-start should be skipped after returning to title from practice'
  );
  assert.ok(
    createBlock.includes('this._buildRecommendedBattleData(suppressDebugAutoStart ? new URLSearchParams() : undefined)'),
    'title start button should ignore stale debug query after practice return'
  );
}

{
  const actionBlock = sourceBlock(
    battleSceneSource,
    '  _handleBattleResultAction(action) {',
    '  // ====================='
  );
  assert.ok(
    actionBlock.includes('suppressDebugAutoStart: this._isStage15PracticeMode() === true'),
    'return title from practice should suppress debug auto-reentry'
  );
  assert.ok(
    actionBlock.includes("this.scene.start('TitleScene'"),
    'result title action should still return to TitleScene'
  );
}

{
  const endBattleBlock = sourceBlock(
    battleSceneSource,
    '  _endBattle(type) {',
    '  _showP43ResultPreview(preview) {'
  );

  assert.ok(
    endBattleBlock.includes('this.waveSystem?.pendingWaveClearTimer'),
    'battle end should clear any deferred practice wave-clear timer'
  );
}
