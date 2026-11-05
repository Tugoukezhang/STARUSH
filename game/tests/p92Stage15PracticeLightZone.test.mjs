import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');

function sourceBlock(startNeedle, endNeedle) {
  const start = battleSceneSource.indexOf(startNeedle);
  const end = battleSceneSource.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return battleSceneSource.slice(start, end);
}

function numericConstant(name) {
  const match = battleSceneSource.match(new RegExp(`const ${name} = ([0-9.]+|0x[0-9A-Fa-f]+);`));
  assert.ok(match, `missing numeric constant: ${name}`);
  return Number(match[1]);
}

{
  const depth = numericConstant('P1_92_PRACTICE_LIGHT_ZONE_DEPTH');

  assert.ok(depth < numericConstant('P1_64_PLAYER_MARKER_DEPTH'), 'practice zone should sit below the player marker');
  assert.ok(depth < 2, 'practice zone should sit below P1-8 ground hit marks');
  assert.ok(depth < 3, 'practice zone should sit below enemies');
  assert.ok(depth < numericConstant('P1_67_BULLET_VISUAL_DEPTH'), 'practice zone should sit below player bullets');
  assert.ok(depth < 54, 'practice zone should sit below P1-9 C-position / Encore FX');
}

{
  const alpha = numericConstant('P1_92_PRACTICE_LIGHT_ZONE_ALPHA');
  assert.ok(alpha >= 0.10 && alpha <= 0.18, 'practice zone alpha should stay low');
}

{
  const createBlock = sourceBlock(
    '  _createStage15PracticeLightZone() {',
    '  _clearStage15PracticeLightZone() {'
  );

  const guardIndex = createBlock.indexOf('if (!this._isStage15PracticeMode()) return;');
  const graphicsIndex = createBlock.indexOf('this.add.graphics()');

  assert.ok(guardIndex >= 0, 'practice zone creation should be gated by practiceMode');
  assert.ok(graphicsIndex > guardIndex, 'practice guard should run before graphics creation');
  assert.ok(createBlock.includes('setDepth(P1_92_PRACTICE_LIGHT_ZONE_DEPTH)'), 'practice zone should use the configured depth');
  assert.ok(createBlock.includes('fillEllipse'), 'practice zone should use a soft filled ellipse');
  assert.ok(createBlock.includes('strokeEllipse'), 'practice zone should use a light edge stroke');
  assert.equal(createBlock.includes('this.add.image'), false, 'practice zone should not use PNG images');
  assert.equal(createBlock.includes('this.load'), false, 'practice zone should not load assets');
  assert.equal(createBlock.includes('setInteractive'), false, 'practice zone should not be interactive');
}

{
  const stageVisualBlock = sourceBlock(
    '    this._drawStageFloor();',
    '    if (this.defenseMode) this._createPaintJars();'
  );

  assert.ok(
    stageVisualBlock.includes('this._createStage15PracticeLightZone();'),
    'stage visual setup should create the practice light zone after drawing the floor'
  );
}

{
  const clearBlock = sourceBlock(
    '  _clearStage15PracticeLightZone() {',
    '  _clearActivePlayerBulletGraphics() {'
  );

  assert.ok(clearBlock.includes('this.stage15PracticeLightZone.destroy()'), 'cleanup should destroy zone graphics');
  assert.ok(clearBlock.includes('this.stage15PracticeLightZone = null'), 'cleanup should clear zone reference');
}

{
  const shutdownBlock = sourceBlock("this.events.once('shutdown', () => {", '    });');
  const endBattleBlock = sourceBlock('  _endBattle(type) {', '  _showP43ResultPreview(preview) {');
  const releaseBlock = sourceBlock(
    "  _releaseBattleRuntimeObjects(reason = 'unspecified') {",
    '  _clearActivePlayerBulletGraphics() {'
  );

  assert.ok(releaseBlock.includes('_clearStage15PracticeLightZone()'), 'release facade should own practice zone cleanup');
  assert.ok(shutdownBlock.includes("_releaseBattleRuntimeObjects('shutdown')"), 'shutdown should release practice zone ownership');
  assert.ok(endBattleBlock.includes("_releaseBattleRuntimeObjects('battle-end')"), 'result transition should release practice zone ownership');
}

{
  const surfaceBlock = sourceBlock(
    '  _createStage15PracticeLightZone() {',
    '  _clearActivePlayerBulletGraphics() {'
  );

  [
    'reward',
    'XP',
    'Stage 2',
    'StageScene',
    'shop',
    'gacha',
    'social',
    'backend',
    'analytics',
    'this.load',
    'this.add.image',
    'this.physics',
    'setInteractive',
    'writeP15Stage1ClearCount',
    'writeP47Stage1ReplayObjectiveIndex',
  ].forEach((forbidden) => {
    assert.equal(surfaceBlock.includes(forbidden), false, `practice zone should not introduce: ${forbidden}`);
  });
}
