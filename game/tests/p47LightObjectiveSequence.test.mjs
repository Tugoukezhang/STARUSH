import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BATTLE_RESULT_TYPES, getBattleResultConfig } from '../src/utils/battleResult.mjs';
import {
  getNextStage1ReplayObjectiveIndex,
  getStage1ReplayLightObjective,
  getStage1ReplayObjectiveTitleLine,
  normalizeStage1ReplayObjectiveIndex,
  P47_STAGE1_REPLAY_OBJECTIVE_INDEX_KEY,
  readP47Stage1ReplayObjectiveIndex,
  writeP47Stage1ReplayObjectiveIndex,
} from '../src/utils/p41LightObjectives.mjs';
import { resolveStageWaveDefs } from '../src/utils/stageWaves.mjs';

const PLAYER_VISIBLE_FORBIDDEN_COPY = [
  '轻目标',
  '轻任务',
  '任务完成',
  '任务未完成',
  '奖励',
  '领取',
  '进度',
];

function assertPlayerVisibleObjectiveCopy(line) {
  assert.ok(
    line.startsWith('复演目标：') || line.startsWith('本局高光：'),
    `visible objective copy should use the locked replay/highlight tone: ${line}`
  );
  PLAYER_VISIBLE_FORBIDDEN_COPY.forEach((forbidden) => {
    assert.equal(
      line.includes(forbidden),
      false,
      `visible objective copy must not leak forbidden wording: ${forbidden}`
    );
  });
}

function assertOptionalHighlightCopy(line) {
  assert.ok(line.startsWith('本局高光：'), `third replay result copy should use P1-54 tone: ${line}`);
  ['完成', '未完成', '任务', '奖励', '领取', '进度'].forEach((forbidden) => {
    assert.equal(
      line.includes(forbidden),
      false,
      `third replay optional highlight copy must not read like a task or reward: ${forbidden}`
    );
  });
}

assert.equal(normalizeStage1ReplayObjectiveIndex(undefined), 0);
assert.equal(normalizeStage1ReplayObjectiveIndex(99), 2);
assert.equal(normalizeStage1ReplayObjectiveIndex(-1), 0);

{
  const store = new Map();
  const storage = {
    getItem: (key) => store.get(key),
    setItem: (key, value) => store.set(key, value),
  };
  assert.equal(writeP47Stage1ReplayObjectiveIndex(2, storage), 2);
  assert.equal(store.get(P47_STAGE1_REPLAY_OBJECTIVE_INDEX_KEY), '2');
  assert.equal(readP47Stage1ReplayObjectiveIndex(storage), 2);
}

{
  assert.equal(
    getStage1ReplayObjectiveTitleLine({ stageId: 1, stage1ClearCount: 0 }),
    '',
    'fresh title should not show a replay objective'
  );
  assert.equal(
    getStage1ReplayObjectiveTitleLine({ stageId: 1, stage1ClearCount: 1 }),
    '复演目标：点亮场馆装置',
    'after first clear, the first replay objective should appear'
  );
  assert.equal(
    getStage1ReplayObjectiveTitleLine({
      stageId: 1,
      stage1ClearCount: 2,
      stage1ReplayObjectiveIndex: 1,
    }),
    '复演目标：更稳完成，少被碰到'
  );
  assert.equal(
    getStage1ReplayObjectiveTitleLine({
      stageId: 1,
      stage1ClearCount: 3,
      stage1ReplayObjectiveIndex: 2,
    }),
    '高光挑战：试试 C位或 Encore'
  );
}

{
  const first = getStage1ReplayLightObjective({
    stageId: 1,
    stage1ClearCount: 1,
    stage1ReplayObjectiveIndex: 0,
  });
  const second = getStage1ReplayLightObjective({
    stageId: 1,
    stage1ClearCount: 2,
    stage1ReplayObjectiveIndex: 1,
  });
  const third = getStage1ReplayLightObjective({
    stageId: 1,
    stage1ClearCount: 3,
    stage1ReplayObjectiveIndex: 2,
  });

  assert.deepEqual(
    [first.id, second.id, third.id],
    ['stage1-clear-two-waves', 'stage1-steady-clear', 'stage1-highlight-c-or-encore']
  );
  assert.deepEqual(
    [first.kind, second.kind, third.kind],
    ['hard', 'hard', 'optional-highlight'],
    'only the first two replay objectives should be hard objectives'
  );
}

{
  assert.equal(
    getNextStage1ReplayObjectiveIndex({
      stageId: 1,
      stage1ClearCount: 1,
      stage1ReplayObjectiveIndex: 0,
      resultType: BATTLE_RESULT_TYPES.VICTORY,
      clearedWaveCount: 2,
      totalWaves: 2,
      playerHitCount: 3,
    }),
    1,
    'first replay victory should advance to the steady-clear objective'
  );
  assert.equal(
    getNextStage1ReplayObjectiveIndex({
      stageId: 1,
      stage1ClearCount: 2,
      stage1ReplayObjectiveIndex: 1,
      resultType: BATTLE_RESULT_TYPES.VICTORY,
      clearedWaveCount: 2,
      totalWaves: 2,
      playerHitCount: 1,
    }),
    2,
    'second replay victory with <= 1 hit should advance to optional highlight'
  );
  assert.equal(
    getNextStage1ReplayObjectiveIndex({
      stageId: 1,
      stage1ClearCount: 2,
      stage1ReplayObjectiveIndex: 1,
      resultType: BATTLE_RESULT_TYPES.VICTORY,
      clearedWaveCount: 2,
      totalWaves: 2,
      playerHitCount: 2,
    }),
    1,
    'second replay victory with too many hits should not advance'
  );
  assert.equal(
    getNextStage1ReplayObjectiveIndex({
      stageId: 1,
      stage1ClearCount: 2,
      stage1ReplayObjectiveIndex: 1,
      resultType: BATTLE_RESULT_TYPES.PLAYER_DEFEAT,
      clearedWaveCount: 1,
      totalWaves: 2,
      playerHitCount: 0,
    }),
    1,
    'failure should not advance the replay objective'
  );
  assert.equal(
    getNextStage1ReplayObjectiveIndex({
      stageId: 1,
      stage1ClearCount: 3,
      stage1ReplayObjectiveIndex: 2,
      resultType: BATTLE_RESULT_TYPES.VICTORY,
      clearedWaveCount: 2,
      totalWaves: 2,
      playerHitCount: 0,
    }),
    2,
    'optional highlight should not advance into a new system'
  );
}

{
  assert.equal(
    getBattleResultConfig({
      type: BATTLE_RESULT_TYPES.VICTORY,
      stageId: 1,
      stage1ClearCount: 1,
      stage1ReplayObjectiveIndex: 0,
      clearedWaveCount: 2,
      totalWaves: 2,
      playerHitCount: 3,
    }).objectiveLine,
    '复演目标：已点亮场馆装置'
  );
  assert.equal(
    getBattleResultConfig({
      type: BATTLE_RESULT_TYPES.VICTORY,
      stageId: 1,
      stage1ClearCount: 2,
      stage1ReplayObjectiveIndex: 1,
      clearedWaveCount: 2,
      totalWaves: 2,
      playerHitCount: 1,
    }).objectiveLine,
    '复演目标：这次更稳了'
  );
  assert.equal(
    getBattleResultConfig({
      type: BATTLE_RESULT_TYPES.VICTORY,
      stageId: 1,
      stage1ClearCount: 2,
      stage1ReplayObjectiveIndex: 1,
      clearedWaveCount: 2,
      totalWaves: 2,
      playerHitCount: 2,
    }).objectiveLine,
    '复演目标：下次保持移动，少被碰到'
  );
}

{
  assert.equal(
    getBattleResultConfig({
      type: BATTLE_RESULT_TYPES.VICTORY,
      stageId: 1,
      stage1ClearCount: 3,
      stage1ReplayObjectiveIndex: 2,
      clearedWaveCount: 2,
      totalWaves: 2,
      cPositionTriggered: true,
    }).objectiveLine,
    '本局高光：C位登场'
  );
  assert.equal(
    getBattleResultConfig({
      type: BATTLE_RESULT_TYPES.VICTORY,
      stageId: 1,
      stage1ClearCount: 3,
      stage1ReplayObjectiveIndex: 2,
      clearedWaveCount: 2,
      totalWaves: 2,
      encoreTriggered: true,
    }).objectiveLine,
    '本局高光：Encore 安可'
  );
  assert.equal(
    getBattleResultConfig({
      type: BATTLE_RESULT_TYPES.VICTORY,
      stageId: 1,
      stage1ClearCount: 3,
      stage1ReplayObjectiveIndex: 2,
      clearedWaveCount: 2,
      totalWaves: 2,
      cPositionTriggered: true,
      encoreTriggered: true,
    }).objectiveLine,
    '本局高光：C位登场 / Encore 安可'
  );
  const noHighlight = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.VICTORY,
    stageId: 1,
    stage1ClearCount: 3,
    stage1ReplayObjectiveIndex: 2,
    clearedWaveCount: 2,
    totalWaves: 2,
    cPositionTriggered: false,
    encoreTriggered: false,
  }).objectiveLine;
  assert.equal(noHighlight, '本局高光：节奏稳住了');
  assert.equal(noHighlight.includes('未完成'), false, 'optional highlight should not use failure-pressure copy');
  [
    '本局高光：C位登场',
    '本局高光：Encore 安可',
    '本局高光：C位登场 / Encore 安可',
    noHighlight,
  ].forEach(assertOptionalHighlightCopy);
}

{
  [
    getBattleResultConfig({
      type: BATTLE_RESULT_TYPES.VICTORY,
      stageId: 1,
      stage1ClearCount: 1,
      stage1ReplayObjectiveIndex: 0,
      clearedWaveCount: 2,
      totalWaves: 2,
    }).objectiveLine,
    getBattleResultConfig({
      type: BATTLE_RESULT_TYPES.VICTORY,
      stageId: 1,
      stage1ClearCount: 2,
      stage1ReplayObjectiveIndex: 1,
      clearedWaveCount: 2,
      totalWaves: 2,
      playerHitCount: 2,
    }).objectiveLine,
    getBattleResultConfig({
      type: BATTLE_RESULT_TYPES.PLAYER_DEFEAT,
      stageId: 1,
      stage1ClearCount: 2,
      stage1ReplayObjectiveIndex: 1,
      clearedWaveCount: 1,
      totalWaves: 2,
    }).objectiveLine,
    getBattleResultConfig({
      type: BATTLE_RESULT_TYPES.VICTORY,
      stageId: 1,
      stage1ClearCount: 3,
      stage1ReplayObjectiveIndex: 2,
      clearedWaveCount: 2,
      totalWaves: 2,
      cPositionTriggered: true,
    }).objectiveLine,
    getBattleResultConfig({
      type: BATTLE_RESULT_TYPES.VICTORY,
      stageId: 1,
      stage1ClearCount: 3,
      stage1ReplayObjectiveIndex: 2,
      clearedWaveCount: 2,
      totalWaves: 2,
      encoreTriggered: true,
    }).objectiveLine,
  ].forEach(assertPlayerVisibleObjectiveCopy);
}

{
  const defs = resolveStageWaveDefs({
    battleData: { stageId: 1 },
    waveDefs: Array.from({ length: 3 }, (_, index) => ({
      wave: index + 1,
      label: `Wave ${index + 1}`,
      interval: 1200,
      enemies: [{ type: 'trainee', count: index + 4 }],
    })),
    getStageById: () => ({ id: 1, waves: 2 }),
  });

  assert.deepEqual(defs, [], 'public Stage 1 is a paint round, not WAVE 1/2');
}

{
  const titleSceneSource = readFileSync(new URL('../src/scenes/TitleScene.js', import.meta.url), 'utf8');
  const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');

  assert.ok(
    titleSceneSource.includes('readP47Stage1ReplayObjectiveIndex'),
    'TitleScene should read the session-local replay objective index'
  );
  assert.ok(
    battleSceneSource.includes('playerHitCount'),
    'BattleScene should record player hit count for the steady-clear objective'
  );
  assert.ok(
    battleSceneSource.includes('writeP47Stage1ReplayObjectiveIndex'),
    'BattleScene should persist objective progression session-locally'
  );
  assert.equal(
    battleSceneSource.includes('保持节奏，等舞台高光出现'),
    false,
    'P1-55 should not force the battle-before hint into the first-play-only hint seam'
  );
  [
    '奖励',
    'XP',
    '掉落',
    'Stage 2',
    '商店',
    '抽卡',
    '任务系统',
    '红点',
    '后端',
  ].forEach((forbidden) => {
    assert.equal(
      titleSceneSource.includes(forbidden) || battleSceneSource.includes(forbidden),
      false,
      `P1-47 must not surface forbidden system copy: ${forbidden}`
    );
  });
}
