import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  BATTLE_RESULT_TYPES,
  getBattleResultConfig,
  getBattleResultPanelLayout,
} from '../src/utils/battleResult.mjs';

const previewModulePath = new URL('../src/utils/p43ResultPreview.mjs', import.meta.url);

assert.equal(
  existsSync(previewModulePath),
  true,
  'P1-43 should keep QA result preview parsing in a small helper module'
);

const {
  P43_RESULT_PREVIEW_BATTLE_DATA_KEY,
  getP43ResultPreviewFromQuery,
  withP43ResultPreviewBattleData,
} = await import(previewModulePath);

{
  assert.equal(
    getP43ResultPreviewFromQuery(new URLSearchParams('p43ResultPreview=player-defeat')),
    null,
    'result preview must be inactive without the debug query gate'
  );
  assert.equal(
    getP43ResultPreviewFromQuery(new URLSearchParams('debug=&p43ResultPreview=shop')),
    null,
    'unknown preview result types should silently no-op'
  );
}

{
  const preview = getP43ResultPreviewFromQuery(
    new URLSearchParams('debug=&p43ResultPreview=player-defeat&p43LightObjective=incomplete')
  );

  assert.deepEqual(preview, {
    type: BATTLE_RESULT_TYPES.PLAYER_DEFEAT,
    stageId: 1,
    stage1ClearCount: 1,
    stage1ReplayObjectiveIndex: 0,
    clearedWaveCount: 1,
    totalWaves: 2,
    playerHitCount: 2,
  });
}

{
  const preview = getP43ResultPreviewFromQuery(
    new URLSearchParams('debug=&p43ResultPreview=defense-defeat&p43LightObjective=incomplete')
  );
  const result = getBattleResultConfig({
    type: preview.type,
    stageId: preview.stageId,
    stage1ClearCount: preview.stage1ClearCount,
    clearedWaveCount: preview.clearedWaveCount,
    totalWaves: preview.totalWaves,
  });

  assert.equal(result.title, '公演中断');
  assert.equal(result.objectiveLine, '复演目标：本次还差一点');
}

{
  const result = getBattleResultConfig({
    type: BATTLE_RESULT_TYPES.PLAYER_DEFEAT,
    stageId: 1,
    stage1ClearCount: 1,
    stage1ReplayObjectiveIndex: 0,
    clearedWaveCount: 1,
    totalWaves: 2,
    playerHitCount: 2,
  });

  assert.equal(result.title, '公演中断');
  assert.equal(result.objectiveLine, '复演目标：本次还差一点');
}

{
  const preview = getP43ResultPreviewFromQuery(
    new URLSearchParams('debug=&p43ResultPreview=victory&p43LightObjective=completed')
  );
  const result = getBattleResultConfig({
    type: preview.type,
    stageId: preview.stageId,
    stage1ClearCount: preview.stage1ClearCount,
    clearedWaveCount: preview.clearedWaveCount,
    totalWaves: preview.totalWaves,
  });

  assert.equal(result.objectiveLine, '复演目标：已点亮场馆装置');
}

{
  const battleData = { stageId: 1, stageWaves: 2, p15Stage1ClearCount: 0 };
  assert.equal(
    withP43ResultPreviewBattleData(
      battleData,
      new URLSearchParams('p43ResultPreview=player-defeat&p43LightObjective=incomplete')
    ),
    battleData,
    'normal URL battle data should remain unchanged'
  );

  const withPreview = withP43ResultPreviewBattleData(
    battleData,
    new URLSearchParams('debug=&p43ResultPreview=player-defeat&p43LightObjective=incomplete')
  );
  assert.equal(withPreview.stageId, 1);
  assert.equal(withPreview.stageWaves, 2);
  assert.equal(withPreview.p15Stage1ClearCount, 1);
  assert.deepEqual(withPreview[P43_RESULT_PREVIEW_BATTLE_DATA_KEY], {
    type: BATTLE_RESULT_TYPES.PLAYER_DEFEAT,
    stageId: 1,
    stage1ClearCount: 1,
    stage1ReplayObjectiveIndex: 0,
    clearedWaveCount: 1,
    totalWaves: 2,
    playerHitCount: 2,
  });
}

{
  const layout = getBattleResultPanelLayout({
    gameWidth: 375,
    gameHeight: 667,
    lineCount: 4,
    buttonCount: 2,
  });

  assert.ok(layout.panelTop >= 24, 'failure preview panel should stay inside 375x667');
  assert.ok(
    layout.buttonYs[0] - layout.bodyLineYs.at(-1) >= 58,
    'failure preview copy should not overlap result buttons'
  );
}

{
  const titleSceneSource = readFileSync(new URL('../src/scenes/TitleScene.js', import.meta.url), 'utf8');
  const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');

  assert.ok(
    titleSceneSource.includes('withP43ResultPreviewBattleData'),
    'TitleScene debug start should be the only URL-to-battleData preview seam'
  );
  assert.ok(
    battleSceneSource.includes('P43_RESULT_PREVIEW_BATTLE_DATA_KEY'),
    'BattleScene should consume explicit QA preview battleData'
  );
  assert.ok(
    battleSceneSource.includes('_showP43ResultPreview'),
    'BattleScene should keep the QA preview path separate from normal _endBattle flow'
  );
  [
    '奖励',
    'XP',
    '任务系统',
    '红点',
    'Stage 2',
    '商店',
    '抽卡',
    '社交',
    '后端',
  ].forEach((forbidden) => {
    assert.equal(
      titleSceneSource.includes(forbidden) || battleSceneSource.includes(forbidden),
      false,
      `P1-43 QA seam must not surface forbidden system copy: ${forbidden}`
    );
  });
}
