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
    config.climaxLine,
    ...config.supplementLines,
    ...config.buttons.map((button) => button.label),
  ].filter(Boolean).join('\n');
}

function assertNoP2SurfaceCopy(config) {
  const copy = collectResultCopy(config);
  [
    'Stage 2',
    '奖励',
    '掉落',
    'XP',
    '等级',
    '任务',
    '签到',
    '商店',
    '抽卡',
    '甄选',
    'audition',
    '社交',
    '排行',
    '粉丝团',
    '邮件',
    '通行证',
    '后端',
    'SDK',
    'analytics',
    'push',
  ].forEach((text) => {
    assert.equal(copy.includes(text), false, `P1-32 hook must not expose hidden system copy: ${text}`);
  });
}

{
  const firstVictory = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.VICTORY,
    cPositionTriggered: false,
    encoreTriggered: false,
    stage1ClearCount: 0,
  });

  assert.deepEqual(firstVictory.descriptionLines, ['你完成了星光初演。']);
  assert.deepEqual(firstVictory.supplementLines, ['可以再演一次，或先回到制作台。']);
}

{
  const secondVictory = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.VICTORY,
    cPositionTriggered: true,
    encoreTriggered: true,
    stage1ClearCount: 1,
  });

  assert.equal(secondVictory.title, '公演成功！');
  assert.deepEqual(secondVictory.descriptionLines, ['你又一次完成了星光初演。']);
  assert.equal(secondVictory.climaxLine, '本局高光：C位登场 / Encore 安可');
  assert.deepEqual(secondVictory.supplementLines, ['可以再演一次，或先回到制作台。']);
  assert.deepEqual(secondVictory.buttons.map((button) => button.label), ['再演一次', '返回制作台']);
  assert.deepEqual(secondVictory.buttons.map((button) => button.action), [
    BATTLE_RESULT_ACTIONS.RETRY,
    BATTLE_RESULT_ACTIONS.TITLE,
  ]);
  assert.equal(
    secondVictory.buttons.some((button) => button.label.includes('下一场公演')),
    false,
    'second-run retention hook must not create a next-performance button'
  );
  assertNoP2SurfaceCopy(secondVictory);
}

{
  const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');
  const titleSceneSource = readFileSync(new URL('../src/scenes/TitleScene.js', import.meta.url), 'utf8');

  assert.ok(
    battleSceneSource.includes('readP15Stage1ClearCount'),
    'BattleScene should read session Stage 1 clear count before showing results'
  );
  assert.ok(
    battleSceneSource.includes('writeP15Stage1ClearCount'),
    'BattleScene should persist Stage 1 clear count after victory'
  );
  assert.ok(
    battleSceneSource.includes('this._p15Stage1ClearCount'),
    'BattleScene should pass the pre-result clear count into the result config'
  );
  assert.ok(
    battleSceneSource.includes('p15Stage1ClearCount'),
    'BattleScene replay data should carry the P1.5 clear count'
  );
  assert.ok(
    titleSceneSource.includes('readP15Stage1ClearCount'),
    'TitleScene recommended start should seed battleData from session clear count'
  );
}
