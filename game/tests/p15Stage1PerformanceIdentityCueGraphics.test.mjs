import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveStageWaveDefs, STAGE_1_PRACTICE_TARGET_TYPE } from '../src/utils/stageWaves.mjs';

const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');

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

function sourceBlock(startNeedle, endNeedle) {
  const start = battleSceneSource.indexOf(startNeedle);
  const end = battleSceneSource.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return battleSceneSource.slice(start, end);
}

function numericConstant(name) {
  const match = battleSceneSource.match(new RegExp(`const ${name} = (-?[0-9.]+);`));
  assert.ok(match, `missing numeric constant: ${name}`);
  return Number(match[1]);
}

{
  assert.equal(numericConstant('P15_110_STAGE1_IDENTITY_CUE_DEPTH'), -8);
  assert.equal(numericConstant('P15_110_STAGE1_IDENTITY_CUE_MAX_ALPHA'), 0.18);
  assert.ok(
    numericConstant('P15_110_STAGE1_IDENTITY_CUE_DEPTH') < 0,
    'identity cue must stay behind the Stage floor and gameplay readability layers'
  );
  assert.ok(
    numericConstant('P15_110_STAGE1_IDENTITY_CUE_MAX_ALPHA') <= 0.18,
    'identity cue should keep a low-alpha background/decor read'
  );
}

{
  const createBlock = sourceBlock(
    '    this.cameras.main.setBackgroundColor',
    '    if (this._isP15PerformerSpriteRuntimeEnabled()) this._createSakuraAnims();'
  );
  const backgroundIndex = createBlock.indexOf('this._createStageBackground()');
  const previewReturnIndex = createBlock.indexOf('return;');
  const cueIndex = createBlock.indexOf('this._createStage1PerformanceIdentityCueGraphics()');

  assert.ok(backgroundIndex >= 0, 'BattleScene should still create the stage background first');
  assert.ok(previewReturnIndex > backgroundIndex, 'P43 result preview should still return before battle setup');
  assert.ok(cueIndex > previewReturnIndex, 'cue should not appear in P43 result preview');
  assert.ok(
    cueIndex < createBlock.indexOf('this._generateEnemyTextures()'),
    'cue should be passive battle background decor before actor setup'
  );
}

{
  const helperBlock = sourceBlock(
    '  _createStage1PerformanceIdentityCueGraphics() {',
    '  _clearStage1PerformanceIdentityCueGraphics() {'
  );

  assert.ok(helperBlock.includes('Number(this.battleData?.stageId || 1) !== 1'), 'cue should be Stage 1 only');
  assert.ok(helperBlock.includes('this._isStage15PracticeMode() === true'), 'cue should be guarded out of practiceMode');
  assert.ok(helperBlock.includes('this.add.graphics().setDepth(P15_110_STAGE1_IDENTITY_CUE_DEPTH)'));
  assert.ok(helperBlock.includes('lineStyle') && helperBlock.includes('lineBetween'), 'cue should be thin Phaser graphics strokes');
  assert.ok(helperBlock.includes('P15_110_STAGE1_IDENTITY_CUE_MAX_ALPHA'), 'helper should use the locked alpha cap');

  [
    'this.add.image',
    'this.load',
    'preload',
    '.png',
    'stage_light_call_line_source',
    'phase15-p15-106',
    'setInteractive',
    'pointerdown',
    'this.tweens.add',
    'physics',
    'overlap',
    'body',
    'score',
    'support',
    'damage',
    'waveSystem',
    '_spawnEnemyByType',
    '_createPlayerBulletVisual',
    '_spawnGroundHitColorMark',
    '_spawnCPositionPresentationFx',
    '_spawnEncorePresentationFx',
    '_attachStage15PressureGraphics',
  ].forEach((forbidden) => {
    assert.equal(helperBlock.includes(forbidden), false, `cue helper must not use forbidden path: ${forbidden}`);
  });
}

{
  const clearBlock = sourceBlock(
    '  _clearStage1PerformanceIdentityCueGraphics() {',
    '  _drawStageFloor() {'
  );
  const shutdownBlock = sourceBlock("this.events.once('shutdown', () => {", '    });');
  const endBattleBlock = sourceBlock('  _endBattle(type) {', '  _showP43ResultPreview(preview) {');
  const releaseBlock = sourceBlock(
    "  _releaseBattleRuntimeObjects(reason = 'unspecified') {",
    '  _clearActivePlayerBulletGraphics() {'
  );

  assert.ok(clearBlock.includes('this.stage1PerformanceIdentityCueGraphics.destroy()'), 'clear helper should destroy the graphics node');
  assert.ok(clearBlock.includes('this.stage1PerformanceIdentityCueGraphics = null'), 'clear helper should clear the stored reference');
  assert.ok(releaseBlock.includes('_clearStage1PerformanceIdentityCueGraphics()'), 'release facade should own cue cleanup');
  assert.ok(shutdownBlock.includes("_releaseBattleRuntimeObjects('shutdown')"), 'scene shutdown should release cue ownership');
  assert.ok(endBattleBlock.includes("_releaseBattleRuntimeObjects('battle-end')"), 'result transition should release cue ownership');
}

{
  [
    'stage_light_call_line_source',
    'stage1_battle_performance_cue',
    'phase15-p15-106',
  ].forEach((forbidden) => {
    assert.equal(battleSceneSource.includes(forbidden), false, `runtime source must not reference P15-106 source art: ${forbidden}`);
  });
}

{
  const cueConstantBlock = sourceBlock(
    'const P15_110_STAGE1_IDENTITY_CUE_DEPTH',
    'const MOBILE_MOVE_ZONE_RIGHT'
  );
  const cueHelperBlock = sourceBlock(
    '  _createStage1PerformanceIdentityCueGraphics() {',
    '  _drawStageFloor() {'
  );
  const cueSurfaceBlock = `${cueConstantBlock}\n${cueHelperBlock}`;

  [
    'reward',
    'XP',
    'drop',
    'currency',
    'task',
    'red dot',
    'sign-in',
    'mail',
    'pass',
    'shop',
    'gacha',
    'social',
    'backend',
    'analytics',
    'Stage 2',
    'map node',
    'route node',
    'c_position_marker',
    'encore_marker',
    'Spine',
    'Live2D',
  ].forEach((forbidden) => {
    assert.equal(cueSurfaceBlock.includes(forbidden), false, `P15-110 cue must not add forbidden surface: ${forbidden}`);
  });
}

{
  const defs = resolveStageWaveDefs({
    battleData: { stageId: 1, p47Stage1ReplayObjectiveIndex: 2 },
    waveDefs: baseWaveDefs,
    getStageById,
  });

  assert.deepEqual(defs, [], 'public Stage 1 uses the paint round');
}
