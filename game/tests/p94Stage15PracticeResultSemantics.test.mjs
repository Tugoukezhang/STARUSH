import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BATTLE_RESULT_ACTIONS,
  BATTLE_RESULT_TYPES,
  getBattleResultConfig,
} from '../src/utils/battleResult.mjs';

function collectResultCopy(config) {
  return [
    config.title,
    ...config.descriptionLines,
    config.objectiveLine,
    config.climaxLine,
    ...config.supplementLines,
    ...config.buttons.map((button) => button.label),
  ].filter(Boolean).join('\n');
}

function assertNoForbiddenPracticeCopy(config) {
  const copy = collectResultCopy(config);
  [
    '公演成功',
    '公演中断',
    '本局高潮',
    '舞台练习正在准备中',
    '下一关',
    'Stage 2',
    '解锁',
    '挑战完成',
    '任务完成',
    '领取',
    '奖励',
    'XP',
    '掉落',
    '货币',
    '红点',
    '商店',
    '抽卡',
    '后端',
    'analytics',
  ].forEach((forbidden) => {
    assert.equal(copy.includes(forbidden), false, `practice result should not expose: ${forbidden}`);
  });
}

{
  const config = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.VICTORY,
    stageId: 1,
    practiceMode: true,
    cPositionTriggered: true,
    encoreTriggered: true,
  });

  assert.equal(config.title, '舞台练习完成');
  assert.deepEqual(config.descriptionLines, ['你稳住了练习节奏。']);
  assert.equal(config.objectiveLine, '本局高光：C位登场 / Encore 安可');
  assert.equal(config.climaxLine, '');
  assert.deepEqual(config.supplementLines, []);
  assert.deepEqual(config.buttons.map((button) => button.label), ['再练一次', '返回制作台']);
  assert.deepEqual(config.buttons.map((button) => button.action), [
    BATTLE_RESULT_ACTIONS.RETRY,
    BATTLE_RESULT_ACTIONS.TITLE,
  ]);
  assertNoForbiddenPracticeCopy(config);
}

{
  const cPositionOnly = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.VICTORY,
    stageId: 1,
    practiceMode: true,
    cPositionTriggered: true,
    encoreTriggered: false,
  });
  const encoreOnly = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.VICTORY,
    stageId: 1,
    practiceMode: true,
    cPositionTriggered: false,
    encoreTriggered: true,
  });
  const noHighlight = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.VICTORY,
    stageId: 1,
    practiceMode: true,
    cPositionTriggered: false,
    encoreTriggered: false,
  });

  assert.equal(cPositionOnly.objectiveLine, '本局高光：C位登场');
  assert.equal(encoreOnly.objectiveLine, '本局高光：Encore 安可');
  assert.equal(noHighlight.objectiveLine, '本局高光：节奏稳住了');
  assertNoForbiddenPracticeCopy(noHighlight);
}

{
  const defeat = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.PLAYER_DEFEAT,
    stageId: 1,
    practiceMode: true,
  });
  const defenseDefeat = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.DEFENSE_DEFEAT,
    stageId: 1,
    practiceMode: true,
  });

  [defeat, defenseDefeat].forEach((config) => {
    assert.equal(config.title, '练习中断');
    assert.deepEqual(config.descriptionLines, ['先稳住移动，再练一次。']);
    assert.equal(config.objectiveLine, '');
    assert.equal(config.climaxLine, '');
    assert.deepEqual(config.supplementLines, []);
    assert.deepEqual(config.buttons.map((button) => button.label), ['再练一次', '返回制作台']);
    assert.deepEqual(config.buttons.map((button) => button.action), [
      BATTLE_RESULT_ACTIONS.RETRY,
      BATTLE_RESULT_ACTIONS.TITLE,
    ]);
    assertNoForbiddenPracticeCopy(config);
  });
}

{
  const normalVictory = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.VICTORY,
    stageId: 1,
    practiceMode: false,
    cPositionTriggered: true,
    encoreTriggered: true,
    stage1ClearCount: 1,
  });

  assert.equal(normalVictory.title, '公演成功！');
  assert.equal(normalVictory.climaxLine, '本局高光：C位登场 / Encore 安可');
  assert.deepEqual(normalVictory.supplementLines, ['可以再演一次，或先回到制作台。']);
  assert.deepEqual(normalVictory.buttons.map((button) => button.label), ['再演一次', '返回制作台']);
}

{
  const normalVictoryNoHighlight = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.VICTORY,
    stageId: 1,
    practiceMode: false,
    cPositionTriggered: false,
    encoreTriggered: false,
  });

  assert.equal(normalVictoryNoHighlight.climaxLine, '本局高光：节奏稳住了');
}

{
  const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');

  assert.ok(
    battleSceneSource.includes('practiceMode: preview?.practiceMode ?? this.battleData?.practiceMode'),
    'BattleScene should pass practiceMode into the result config'
  );
}
