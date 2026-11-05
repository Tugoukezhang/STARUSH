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
    '奖励',
    '掉落',
    '经验',
    '等级',
    '抽卡',
    '甄选',
    '招募',
    '商店',
    '任务',
    '签到',
    '邮件',
    '通行证',
    '赛季',
    '体力',
    '付费',
  ].forEach((text) => {
    assert.equal(copy.includes(text), false, `P1.5 bridge must not expose P2 surface copy: ${text}`);
  });
}

{
  const config = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.VICTORY,
    cPositionTriggered: true,
    encoreTriggered: true,
  });

  assert.equal(config.title, '公演成功！');
  assert.deepEqual(config.descriptionLines, ['你完成了星光初演。']);
  assert.equal(config.climaxLine, '本局高光：C位登场 / Encore 安可');
  assert.deepEqual(config.supplementLines, ['可以再演一次，或先回到制作台。']);
  assert.deepEqual(config.buttons.map((button) => button.label), ['再演一次', '返回制作台']);
  assert.deepEqual(config.buttons.map((button) => button.action), [
    BATTLE_RESULT_ACTIONS.RETRY,
    BATTLE_RESULT_ACTIONS.TITLE,
  ]);
  assert.equal(
    config.buttons.some((button) => button.label.includes('下一场公演')),
    false,
    'next performance teaser should be non-clickable body copy, not a button'
  );
  assertNoP2SurfaceCopy(config);
}

{
  const config = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.PLAYER_DEFEAT,
  });

  assert.equal(config.title, '公演中断');
  assert.deepEqual(config.descriptionLines, ['演出被打断了。', '保持移动，再试一次。']);
  assert.deepEqual(config.supplementLines, ['再试一次会从第一波重新开始。']);
  assert.deepEqual(config.buttons.map((button) => button.label), ['再试一次', '返回制作台']);
  assert.deepEqual(config.buttons.map((button) => button.action), [
    BATTLE_RESULT_ACTIONS.RETRY,
    BATTLE_RESULT_ACTIONS.TITLE,
  ]);
  assertNoP2SurfaceCopy(config);
}

{
  const config = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.DEFENSE_DEFEAT,
  });

  assert.equal(config.title, '公演中断');
  assert.deepEqual(config.descriptionLines, ['舞台防线被突破。', '优先清掉靠近舞台的敌人。']);
  assert.deepEqual(config.supplementLines, ['再试一次会从第一波重新开始。']);
  assert.deepEqual(config.buttons.map((button) => button.label), ['再试一次', '返回制作台']);
  assert.deepEqual(config.buttons.map((button) => button.action), [
    BATTLE_RESULT_ACTIONS.RETRY,
    BATTLE_RESULT_ACTIONS.TITLE,
  ]);
  assertNoP2SurfaceCopy(config);
}

{
  const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');
  const actionMatch = battleSceneSource.match(/  _handleBattleResultAction\(action\) \{[\s\S]*?\n  \}\n\n  \/\/ =====================/);

  assert.ok(actionMatch, 'BattleScene should keep result navigation in a dedicated handler');
  assert.ok(
    actionMatch[0].includes("this.scene.restart(this.battleData || {})"),
    'result replay should restart the same Stage 1 first-play battle data'
  );
  assert.ok(
    actionMatch[0].includes("this.scene.start('TitleScene'"),
    'result return should go back to title'
  );
  assert.equal(
    actionMatch[0].includes("this.scene.start('StageScene'"),
    false,
    'P1.5 result bridge must not expose a stage-select return route'
  );
}
