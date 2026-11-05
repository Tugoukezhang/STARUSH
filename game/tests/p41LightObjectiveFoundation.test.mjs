import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  BATTLE_RESULT_TYPES,
  getBattleResultConfig,
} from '../src/utils/battleResult.mjs';
import { resolveStageWaveDefs } from '../src/utils/stageWaves.mjs';

const lightObjectiveModulePath = new URL('../src/utils/p41LightObjectives.mjs', import.meta.url);

assert.equal(
  existsSync(lightObjectiveModulePath),
  true,
  'P1-41 should keep light objective rules in a small config/helper module'
);

const {
  P41_STAGE1_REPLAY_OBJECTIVE_ID,
  getStage1ReplayObjectiveTitleLine,
  getStage1ReplayLightObjective,
  getStage1ReplayLightObjectiveResultLine,
} = await import(lightObjectiveModulePath);

const waveDefs = [
  { wave: 1, label: 'Wave 1', interval: 1800, enemies: [{ type: 'trainee', count: 4 }] },
  { wave: 2, label: 'Wave 2', interval: 1600, enemies: [{ type: 'trainee', count: 5 }] },
  { wave: 3, label: 'Wave 3', interval: 1500, enemies: [{ type: 'trainee', count: 6 }] },
];

{
  const defs = resolveStageWaveDefs({
    battleData: { stageId: 1 },
    waveDefs,
    getStageById: () => ({ id: 1, waves: 2 }),
  });

  assert.deepEqual(defs, [], 'public Stage 1 fight is the paint round, not authored kill-waves');
}

{
  const objective = getStage1ReplayLightObjective({ stageId: 1, stage1ClearCount: 1 });

  assert.equal(objective.id, P41_STAGE1_REPLAY_OBJECTIVE_ID);
  assert.equal(objective.titleLine, '复演目标：点亮场馆装置');
  assert.deepEqual(
    Object.keys(objective).sort(),
    ['id', 'kind', 'titleLine'].sort(),
    'P1-47 should expose compact objective metadata, not a task list/progress system'
  );
}

{
  assert.equal(
    getStage1ReplayLightObjective({ stageId: 1, stage1ClearCount: 0 }),
    null,
    'first clear should keep the existing first-play result flow'
  );
  assert.equal(
    getStage1ReplayLightObjective({ stageId: 2, stage1ClearCount: 2 }),
    null,
    'P1-41 must not create Stage 2 objective surfaces'
  );
}

{
  assert.equal(
    getStage1ReplayObjectiveTitleLine({ stageId: 1, stage1ClearCount: 1 }),
    '复演目标：点亮场馆装置'
  );
  assert.equal(
    getStage1ReplayLightObjectiveResultLine({
      stageId: 1,
      stage1ClearCount: 1,
      resultType: BATTLE_RESULT_TYPES.VICTORY,
      clearedWaveCount: 2,
      totalWaves: 2,
    }),
    '复演目标：已点亮场馆装置'
  );
  assert.equal(
    getStage1ReplayLightObjectiveResultLine({
      stageId: 1,
      stage1ClearCount: 1,
      resultType: BATTLE_RESULT_TYPES.PLAYER_DEFEAT,
      clearedWaveCount: 1,
      totalWaves: 2,
    }),
    '复演目标：本次还差一点'
  );
  assert.equal(
    getStage1ReplayLightObjectiveResultLine({
      stageId: 1,
      stage1ClearCount: 1,
      resultType: BATTLE_RESULT_TYPES.VICTORY,
    }),
    '',
    'objective result copy should wait for explicit Stage 1 two-wave context'
  );
}

{
  const replayVictory = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.VICTORY,
    stageId: 1,
    stage1ClearCount: 1,
    clearedWaveCount: 2,
    totalWaves: 2,
    cPositionTriggered: true,
    encoreTriggered: true,
  });
  assert.equal(replayVictory.objectiveLine, '复演目标：已点亮场馆装置');
  assert.equal(
    replayVictory.objectiveLine.includes('C位') || replayVictory.objectiveLine.includes('Encore'),
    false,
    'C-position and Encore should remain climax records, not hard objectives'
  );

  const replayDefeat = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.PLAYER_DEFEAT,
    stageId: 1,
    stage1ClearCount: 1,
    clearedWaveCount: 1,
    totalWaves: 2,
  });
  assert.equal(replayDefeat.objectiveLine, '复演目标：本次还差一点');

  const firstVictory = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.VICTORY,
    stageId: 1,
    stage1ClearCount: 0,
    clearedWaveCount: 2,
    totalWaves: 2,
  });
  assert.equal(firstVictory.objectiveLine, '');
}

{
  const titleSceneSource = readFileSync(new URL('../src/scenes/TitleScene.js', import.meta.url), 'utf8');
  const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');
  const stageWaveSource = readFileSync(new URL('../src/utils/stageWaves.mjs', import.meta.url), 'utf8');

  assert.ok(
    !titleSceneSource.includes('getStage1ReplayObjectiveTitleLine'),
    'Shared DOM desk must not resurrect the obsolete canvas replay teaser'
  );
  assert.ok(titleSceneSource.includes('readP47Stage1ReplayObjectiveIndex'),
    'Removing the teaser must preserve replay metadata in the battle builder');
  assert.ok(
    battleSceneSource.includes('objectiveLine'),
    'BattleScene result panel should render one optional objective line'
  );
  assert.equal(
    stageWaveSource.includes('anti'),
    false,
    'P1-41 interval tuning must not add anti enemies'
  );
}
