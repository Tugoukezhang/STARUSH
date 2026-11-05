import assert from 'node:assert/strict';
import {
  BATTLE_RESULT_TYPES,
  getBattleResultPanelLayout,
  getBattleResultTextStyles,
  getBattleResultConfig,
} from '../src/utils/battleResult.mjs';

const phrase = (...chars) => chars.join('');

const forbiddenCopy = [
  phrase('奖', '励'),
  phrase('掉', '落'),
  phrase('金', '币'),
  phrase('经', '验'),
  phrase('评', '分'),
  phrase('星', '级'),
  phrase('抽', '卡'),
  phrase('商', '店'),
  phrase('养', '成'),
  phrase('任', '务'),
  phrase('体', '力'),
];

const p15ForbiddenStage1ResultCopy = [
  '本局高潮',
  '未触发',
  '下一场公演正在准备中',
  '下一场公演正在筹备中',
  '更多公演正在筹备中',
];

function collectText(config) {
  return [
    config.title,
    ...config.descriptionLines,
    config.climaxLine,
    ...config.supplementLines,
    ...config.buttons.map((button) => button.label),
  ].filter(Boolean).join('\n');
}

function assertNoForbiddenCopy(config) {
  const copy = collectText(config);
  forbiddenCopy.forEach((text) => {
    assert.equal(copy.includes(text), false, `unexpected forbidden copy: ${text}`);
  });
  p15ForbiddenStage1ResultCopy.forEach((text) => {
    assert.equal(copy.includes(text), false, `unexpected P15-95 result copy: ${text}`);
  });
}

{
  const config = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.VICTORY,
    cPositionTriggered: true,
    encoreTriggered: false,
  });

  assert.equal(config.title, '公演成功！');
  assert.deepEqual(config.descriptionLines, ['你完成了星光初演。']);
  assert.equal(config.climaxLine, '本局高光：C位登场');
  assert.deepEqual(config.supplementLines, ['可以再演一次，或先回到制作台。']);
  assert.deepEqual(config.buttons.map((button) => button.label), ['再演一次', '返回制作台']);
  assert.deepEqual(config.buttons.map((button) => button.action), ['retry', 'title']);
  assertNoForbiddenCopy(config);
}

{
  const config = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.VICTORY,
    cPositionTriggered: false,
    encoreTriggered: true,
  });

  assert.equal(config.climaxLine, '本局高光：Encore 安可');
  assertNoForbiddenCopy(config);
}

{
  const config = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.VICTORY,
    cPositionTriggered: false,
    encoreTriggered: false,
  });

  assert.equal(config.climaxLine, '本局高光：节奏稳住了');
  assertNoForbiddenCopy(config);
}

{
  const config = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.VICTORY,
    stage1ClearCount: 1,
  });

  assert.deepEqual(config.descriptionLines, ['你又一次完成了星光初演。']);
  assert.deepEqual(config.supplementLines, ['可以再演一次，或先回到制作台。']);
  assertNoForbiddenCopy(config);
}

{
  const config = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.PLAYER_DEFEAT,
  });

  assert.equal(config.title, '公演中断');
  assert.deepEqual(config.descriptionLines, ['演出被打断了。', '保持移动，再试一次。']);
  assert.deepEqual(config.supplementLines, ['再试一次会从第一波重新开始。']);
  assert.deepEqual(config.buttons.map((button) => button.label), ['再试一次', '返回制作台']);
  assert.deepEqual(config.buttons.map((button) => button.action), ['retry', 'title']);
  assertNoForbiddenCopy(config);
}

{
  const config = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.DEFENSE_DEFEAT,
  });

  assert.equal(config.title, '公演中断');
  assert.deepEqual(config.descriptionLines, ['舞台防线被突破。', '优先清掉靠近舞台的敌人。']);
  assert.deepEqual(config.supplementLines, ['再试一次会从第一波重新开始。']);
  assert.deepEqual(config.buttons.map((button) => button.label), ['再试一次', '返回制作台']);
  assert.deepEqual(config.buttons.map((button) => button.action), ['retry', 'title']);
  assertNoForbiddenCopy(config);
}

{
  const layout = getBattleResultPanelLayout({
    gameWidth: 375,
    gameHeight: 667,
    lineCount: 2,
    buttonCount: 3,
  });

  assert.equal(layout.bodyLineYs.length, 2);
  assert.equal(layout.buttonYs.length, 3);
  assert.ok(layout.panelTop >= 24, 'panel should stay inside the portrait canvas');
  assert.ok(layout.titleY < layout.bodyLineYs[0], 'title should sit above body copy');
  assert.ok(
    layout.buttonYs[0] - layout.bodyLineYs.at(-1) >= 58,
    'body copy should not collide with the first button'
  );
  assert.ok(
    layout.buttonYs.at(-1) + layout.buttonHeight / 2 <= layout.panelBottom - 18,
    'last button should stay inside the panel'
  );
}

{
  const styles = getBattleResultTextStyles({ titleColor: '#FFD700', primaryButton: true });

  assert.ok(styles.title.padding.top >= 8, 'title text needs top padding for CJK glyphs');
  assert.ok(styles.title.padding.bottom >= 6, 'title text needs bottom padding for CJK glyphs');
  assert.ok(styles.body.padding.top >= 5, 'body text needs top padding for CJK glyphs');
  assert.ok(styles.body.padding.bottom >= 5, 'body text needs bottom padding for CJK glyphs');
  assert.ok(styles.button.padding.y >= 12, 'button text needs vertical padding for CJK glyphs');
}
