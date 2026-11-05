import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BATTLE_RESULT_TYPES,
  getBattleResultConfig,
} from '../src/utils/battleResult.mjs';
import {
  resolveStageWaveDefs,
  STAGE_1_PRACTICE_TARGET_TYPE,
  STAGE_15_DRIFTING_LIGHTSTICK_TYPE,
  STAGE_15_STAGE_MARKER_TARGET_TYPE,
} from '../src/utils/stageWaves.mjs';

const baseWaveDefs = [
  { wave: 1, label: 'Wave 1', interval: 1800, enemies: [{ type: 'trainee', count: 4 }] },
  { wave: 2, label: 'Wave 2', interval: 1600, enemies: [{ type: 'trainee', count: 5 }] },
  { wave: 3, label: 'Wave 3', interval: 1500, enemies: [{ type: 'trainee', count: 6 }] },
];

function getStageById(stageId) {
  if (Number(stageId) === 1) return { id: 1, name: 'Stage 1', waves: 2 };
  if (Number(stageId) === 2) return { id: 2, name: 'Stage 2', waves: 3 };
  return null;
}

function getStage1Defs(index) {
  return resolveStageWaveDefs({
    battleData: { stageId: 1, p47Stage1ReplayObjectiveIndex: index },
    waveDefs: baseWaveDefs,
    getStageById,
  });
}

const stage15PracticeOnlyTypes = [
  STAGE_15_DRIFTING_LIGHTSTICK_TYPE,
  STAGE_15_STAGE_MARKER_TARGET_TYPE,
];

{
  assert.equal(STAGE_1_PRACTICE_TARGET_TYPE, 'stage1PracticeTarget');
}

{
  [undefined, 0, 1].forEach((index) => {
    const defs = getStage1Defs(index);
    assert.deepEqual(defs, [], 'public Stage 1 is a paint round before any replay ladder');
    const types = defs.flatMap((def) => def.enemies.map((enemy) => enemy.type));
    stage15PracticeOnlyTypes.forEach((type) => {
      assert.equal(types.includes(type), false, `${type} must not appear before the third replay`);
    });
  });
}

{
  [2, 3, 99].forEach((index) => {
    const defs = getStage1Defs(index);
    assert.deepEqual(defs, [], 'public Stage 1 replays stay on the paint round');
  });
}

{
  const defs = resolveStageWaveDefs({
    battleData: { stageId: 2, p47Stage1ReplayObjectiveIndex: 2 },
    waveDefs: baseWaveDefs,
    getStageById,
  });
  assert.equal(
    defs.flatMap((def) => def.enemies).some((enemy) => enemy.type === STAGE_1_PRACTICE_TARGET_TYPE),
    false,
    'non-Stage 1 waves must never receive the Stage 1 practice target'
  );
  stage15PracticeOnlyTypes.forEach((type) => {
    assert.equal(
      defs.flatMap((def) => def.enemies).some((enemy) => enemy.type === type),
      false,
      `${type} must never appear in non-Stage 1 waves`
    );
  });
}

{
  const waveSystemSource = readFileSync(new URL('../src/systems/WaveSystem.js', import.meta.url), 'utf8');
  assert.ok(
    waveSystemSource.includes('anchorLastTypes') && waveSystemSource.includes('STAGE_1_PRACTICE_TARGET_TYPE'),
    'WaveSystem should keep the practice target in the anchored-last spawn group'
  );
  assert.ok(
    waveSystemSource.includes('this.spawnQueue = [...regulars, ...bosses]'),
    'WaveSystem should append anchored targets after shuffled regular enemies'
  );
}

{
  const result = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.VICTORY,
    stageId: 1,
    stage1ClearCount: 3,
    stage1ReplayObjectiveIndex: 2,
    clearedWaveCount: 2,
    totalWaves: 2,
    cPositionTriggered: false,
    encoreTriggered: false,
  });
  assert.equal(result.objectiveLine, '本局高光：节奏稳住了');
}

{
  const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');
  const stageWavesSource = readFileSync(new URL('../src/utils/stageWaves.mjs', import.meta.url), 'utf8');
  const runtimeSource = `${battleSceneSource}\n${stageWavesSource}`;

  assert.ok(
    battleSceneSource.includes('STAGE_1_PRACTICE_TARGET_TYPE'),
    'BattleScene should spawn the practice target through the existing enemy type seam'
  );
  assert.ok(
    battleSceneSource.includes('supportValueOverride'),
    'practice target should use a local support gain override instead of global support constants'
  );

  const spawnMethodStart = battleSceneSource.indexOf('  _spawnEnemyByType(type) {');
  const spawnMethodEnd = battleSceneSource.indexOf('  _createBossHpBar', spawnMethodStart);
  const spawnMethod = battleSceneSource.slice(spawnMethodStart, spawnMethodEnd);
  assert.ok(spawnMethodStart >= 0 && spawnMethodEnd > spawnMethodStart, '_spawnEnemyByType should stay discoverable for the P1-57 seam');
  assert.equal(
    spawnMethod.includes(`enemyType === '${STAGE_1_PRACTICE_TARGET_TYPE}'`) && spawnMethod.includes('_enemyShoot'),
    false,
    'practice target must not enter anti/miniboss/boss shooting path'
  );
  assert.equal(
    spawnMethod.includes('c_position_marker') || spawnMethod.includes('encore_marker'),
    false,
    'practice target must not pull in P1-38 C-position or Encore marker assets'
  );

  [
    'Stage 2',
    'reward',
    'XP',
    '任务',
    '红点',
    'shop',
    'gacha',
    'social',
    'backend',
    'analytics',
  ].forEach((forbidden) => {
    assert.equal(
      runtimeSource.includes(forbidden),
      false,
      `P1-57 must not add forbidden surface: ${forbidden}`
    );
  });
}
