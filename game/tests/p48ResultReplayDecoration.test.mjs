import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { BATTLE_RESULT_TYPES, getBattleResultPanelLayout } from '../src/utils/battleResult.mjs';
import { getP43ResultPreviewFromQuery } from '../src/utils/p43ResultPreview.mjs';
import {
  getP48BattleResultDecorPlacements,
  getP48ResultReplayDecorAssets,
  getP48TitleReplayObjectiveDecorPlacements,
  P48_RESULT_REPLAY_DECOR_BASE_PATH,
} from '../src/utils/p48ResultReplayDecor.mjs';

const allowedAssets = [
  'result_soft_sparkle',
  'replay_goal_pin',
  'retry_path_chevron',
  'first_play_hint_tab',
];
const allowedFiles = allowedAssets.map((id) => `${id}.png`).sort();
const forbiddenAssets = [
  'player_idol_marker',
  'trainee_enemy',
  'anti_enemy',
  'miniboss_enemy',
  'pink_heart_bullet',
  'cyan_diamond_bullet',
  'yellow_star_bullet',
  'purple_crescent_bullet',
  'orange_triangle_bullet',
  'hit_spark_support',
  'ground_hit_marker',
  'c_position_marker',
  'encore_marker',
];

function boxOf(placement) {
  return {
    left: placement.x - placement.displayWidth / 2,
    right: placement.x + placement.displayWidth / 2,
    top: placement.y - placement.displayHeight / 2,
    bottom: placement.y + placement.displayHeight / 2,
  };
}

function intersects(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function assertNoIntersection(placement, zones, label) {
  const placementBox = boxOf(placement);
  zones.forEach((zone) => {
    assert.equal(
      intersects(placementBox, zone),
      false,
      `${placement.id} should not overlap ${label}`
    );
  });
}

{
  const assets = getP48ResultReplayDecorAssets();
  assert.deepEqual(assets.map((asset) => asset.id).sort(), allowedAssets.toSorted());
  assert.deepEqual(assets.map((asset) => asset.fileName).sort(), allowedFiles);
  assert.equal(P48_RESULT_REPLAY_DECOR_BASE_PATH, 'art/phase1/p1-38');
  assets.forEach((asset) => {
    assert.equal(asset.path, `${P48_RESULT_REPLAY_DECOR_BASE_PATH}/${asset.fileName}`);
    assert.ok(asset.key.startsWith('p48-'), 'runtime keys should stay scoped to P1-48 decor');
  });
}

{
  const runtimeDir = new URL('../public/art/phase1/p1-38/', import.meta.url);
  assert.equal(existsSync(runtimeDir), true, 'P1-48 should copy decor assets into public/art/phase1/p1-38');
  assert.deepEqual(
    readdirSync(runtimeDir).filter((file) => file.endsWith('.png')).sort(),
    allowedFiles,
    'runtime p1-38 folder should contain only the four QA-approved decor assets'
  );
}

{
  const titlePlacements = getP48TitleReplayObjectiveDecorPlacements({
    gameWidth: 375,
    gameHeight: 667,
    hasReplayObjective: true,
  });
  assert.deepEqual(
    titlePlacements.map((placement) => placement.id).sort(),
    ['first_play_hint_tab', 'replay_goal_pin']
  );

  const replayTextZone = { left: 82, right: 293, top: 318, bottom: 336 };
  const startButtonZone = { left: 112, right: 263, top: 200, bottom: 247 };
  const memberButtonZone = { left: 126, right: 249, top: 421, bottom: 453 };
  titlePlacements.forEach((placement) => {
    assert.equal(placement.interactive, false, 'title decor must not become a clickable entry');
    assert.equal(placement.alpha <= 0.62, true, 'title decor should stay subtle');
    assertNoIntersection(placement, [replayTextZone], 'the single-line replay objective copy');
    assertNoIntersection(placement, [startButtonZone, memberButtonZone], 'title buttons');
  });
  assert.deepEqual(
    getP48TitleReplayObjectiveDecorPlacements({ hasReplayObjective: false }),
    [],
    'fresh title should not show replay objective decoration before the replay objective exists'
  );
}

{
  const victoryLayout = getBattleResultPanelLayout({
    gameWidth: 375,
    gameHeight: 667,
    lineCount: 5,
    buttonCount: 2,
  });
  const victoryPlacements = getP48BattleResultDecorPlacements({
    type: BATTLE_RESULT_TYPES.VICTORY,
    layout: victoryLayout,
  });
  assert.deepEqual(victoryPlacements.map((placement) => placement.id), ['result_soft_sparkle']);

  const titleZone = { left: 72, right: 303, top: victoryLayout.titleY - 18, bottom: victoryLayout.titleY + 18 };
  const bodyZones = victoryLayout.bodyLineYs.map((y) => ({
    left: 48,
    right: 327,
    top: y - 12,
    bottom: y + 12,
  }));
  const buttonZones = victoryLayout.buttonYs.map((y) => ({
    left: 70,
    right: 305,
    top: y - victoryLayout.buttonHeight / 2,
    bottom: y + victoryLayout.buttonHeight / 2,
  }));
  victoryPlacements.forEach((placement) => {
    assert.equal(placement.interactive, false);
    assert.equal(placement.alpha <= 0.48, true, 'victory sparkle should not read as reward burst');
    assertNoIntersection(placement, [titleZone, ...bodyZones, ...buttonZones], 'victory result panel copy or buttons');
  });
}

{
  const failureLayout = getBattleResultPanelLayout({
    gameWidth: 375,
    gameHeight: 667,
    lineCount: 4,
    buttonCount: 2,
  });
  [BATTLE_RESULT_TYPES.PLAYER_DEFEAT, BATTLE_RESULT_TYPES.DEFENSE_DEFEAT].forEach((type) => {
    const failurePlacements = getP48BattleResultDecorPlacements({ type, layout: failureLayout });
    assert.deepEqual(failurePlacements.map((placement) => placement.id), ['retry_path_chevron']);
    const bodyZones = failureLayout.bodyLineYs.map((y) => ({
      left: 48,
      right: 327,
      top: y - 12,
      bottom: y + 12,
    }));
    const buttonZones = failureLayout.buttonYs.map((y) => ({
      left: 70,
      right: 305,
      top: y - failureLayout.buttonHeight / 2,
      bottom: y + failureLayout.buttonHeight / 2,
    }));
    failurePlacements.forEach((placement) => {
      assert.equal(placement.interactive, false);
      assert.equal(placement.alpha <= 0.38, true, 'failure chevron should not read as next-stage entry');
      assertNoIntersection(placement, [...bodyZones, ...buttonZones], 'failure copy or buttons');
    });
  });
}

{
  [
    'debug=&p43ResultPreview=victory&p43LightObjective=completed',
    'debug=&p43ResultPreview=player-defeat&p43LightObjective=incomplete',
    'debug=&p43ResultPreview=defense-defeat&p43LightObjective=incomplete',
  ].forEach((queryString) => {
    assert.ok(
      getP43ResultPreviewFromQuery(new URLSearchParams(queryString)),
      `P1-43 preview seam should still parse: ${queryString}`
    );
  });
}

{
  const titleSceneSource = readFileSync(new URL('../src/scenes/TitleScene.js', import.meta.url), 'utf8');
  const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');
  const decorSource = readFileSync(new URL('../src/utils/p48ResultReplayDecor.mjs', import.meta.url), 'utf8');
  const runtimeSource = `${titleSceneSource}\n${battleSceneSource}\n${decorSource}`;

  assert.doesNotMatch(titleSceneSource, /getP48TitleReplayObjectiveDecorPlacements|addP48DecorImage|preloadP48ResultReplayDecorAssets/,
    'Retired title replay decoration must not load or draw in the DOM shell');
  assert.ok(titleSceneSource.includes('readP47Stage1ReplayObjectiveIndex'),
    'Replay builder data survives independently of title decoration');

  allowedAssets.forEach((id) => {
    assert.ok(runtimeSource.includes(`${id}.png`), `runtime should reference allowed decor asset: ${id}`);
  });
  forbiddenAssets.forEach((id) => {
    assert.equal(runtimeSource.includes(id), false, `runtime must not reference deferred P1-38 asset: ${id}`);
  });
  [
    'Stage 2',
    '奖励',
    '领取',
    '任务系统',
    '红点',
    'XP',
    '掉落',
    '商店',
    '抽卡',
    '社交',
    '后端',
  ].forEach((forbidden) => {
    assert.equal(runtimeSource.includes(forbidden), false, `P1-48 decor must not surface forbidden system copy: ${forbidden}`);
  });
  assert.equal(runtimeSource.includes('setInteractive({ useHandCursor: true })'), true, 'existing buttons stay interactive');
  assert.equal(decorSource.includes('setInteractive'), false, 'decor helper must not define interactive UI entries');
}
