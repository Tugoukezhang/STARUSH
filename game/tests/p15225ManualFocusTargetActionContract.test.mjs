import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const battleSceneSource = readFileSync(
  new URL('../src/scenes/BattleScene.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');
const titleSceneSource = readFileSync(
  new URL('../src/scenes/TitleScene.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');
const stageWavesSource = readFileSync(
  new URL('../src/utils/stageWaves.mjs', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');
const waveSystemSource = readFileSync(
  new URL('../src/systems/WaveSystem.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');

const STAGE_MARKER_TYPE = 'stage15StageMarkerTarget';

function sourceBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

function compileClassMethod(block, methodName, globals = {}) {
  const names = Object.keys(globals);
  const values = Object.values(globals);
  return Function(
    ...names,
    `"use strict"; return ({${block.trim()}}).${methodName};`
  )(...values);
}

function makeEnemy(type, x, y, overrides = {}) {
  return {
    type,
    x,
    y,
    active: true,
    destroyed: false,
    scene: {},
    ...overrides,
  };
}

function makeEnemyCollection(enemies) {
  return {
    contains: (enemy) => enemies.includes(enemy),
    getChildren: () => enemies,
    children: {
      iterate(callback) {
        enemies.forEach(callback);
      },
    },
  };
}

{
  const builderBlock = sourceBlock(
    titleSceneSource,
    '  _buildRecommendedBattleData(',
    '\n  }\n}'
  );

  assert.ok(
    builderBlock.includes('p15ManualFocusExperiment: query.has(\'debug\')'),
    'TitleScene should create an explicit manual-focus experiment battleData flag'
  );
  assert.ok(
    builderBlock.includes("query.get('p88Stage15Practice') === '1'"),
    'manual focus must require hidden Stage 1.5 practice'
  );
  assert.ok(
    builderBlock.includes("query.get('p15ManualFocus') === '1'"),
    'manual focus must require the dedicated query flag'
  );
  assert.equal(
    builderBlock.includes('localStorage')
      || builderBlock.includes('_p15SetlistCueId')
      || builderBlock.includes('characterId ===')
      || builderBlock.includes('team ==='),
    false,
    'manual focus must not depend on persistence, Setlist Cue, character, or team'
  );
}

const gateBlock = sourceBlock(
  battleSceneSource,
  '  _isP15ManualFocusExperimentEnabled() {',
  '  _isP15ManualFocusEligibleEnemy(enemy) {'
);
const gate = compileClassMethod(gateBlock, '_isP15ManualFocusExperimentEnabled');

{
  assert.equal(gate.call({
    battleData: {
      stageId: 1,
      practiceMode: true,
      p15ManualFocusExperiment: true,
    },
  }), true, 'all three hidden gates should enable manual focus');
  assert.equal(gate.call({
    battleData: {
      stageId: 1,
      practiceMode: false,
      p15ManualFocusExperiment: true,
    },
  }), false, 'normal Stage 1 must not enable manual focus');
  assert.equal(gate.call({
    battleData: {
      stageId: 2,
      practiceMode: true,
      p15ManualFocusExperiment: true,
    },
  }), false, 'manual focus must stay on Stage 1 hidden practice data');
  assert.equal(gate.call({
    battleData: {
      stageId: 1,
      practiceMode: true,
      p15ManualFocusExperiment: false,
    },
  }), false, 'ordinary hidden practice must remain unchanged');
}

const selectBlock = sourceBlock(
  battleSceneSource,
  '  _selectAutoAimTarget() {',
  '  _getPublicStage1ProtectedBossTarget() {'
);
const selectAutoAimTarget = compileClassMethod(
  selectBlock,
  '_selectAutoAimTarget',
  { STAGE_15_STAGE_MARKER_TARGET_TYPE: STAGE_MARKER_TYPE }
);

{
  const trainee = makeEnemy('trainee', 180, 280);
  const marker = makeEnemy(STAGE_MARKER_TYPE, 188, 170);
  const enemies = [trainee, marker];
  const scene = {
    player: { x: 188, y: 560 },
    enemies: makeEnemyCollection(enemies),
    _isStage15PracticeMode: () => true,
    _getValidP15ManualFocusTarget: () => trainee,
  };

  assert.equal(
    selectAutoAimTarget.call(scene),
    trainee,
    'a manually selected trainee must override an active Stage Marker Target'
  );

  scene._getValidP15ManualFocusTarget = () => marker;
  assert.equal(
    selectAutoAimTarget.call(scene),
    marker,
    'a manually selected Stage Marker Target must remain a valid focus'
  );

  scene._getValidP15ManualFocusTarget = () => null;
  assert.equal(
    selectAutoAimTarget.call(scene),
    marker,
    'without a valid manual target, hidden practice must preserve Stage Marker auto-priority'
  );
}

{
  const nearTrainee = makeEnemy('trainee', 180, 500);
  const farMarker = makeEnemy(STAGE_MARKER_TYPE, 180, 120);
  const enemies = [nearTrainee, farMarker];
  const normalScene = {
    player: { x: 180, y: 560 },
    enemies: makeEnemyCollection(enemies),
    _isStage15PracticeMode: () => false,
    _getValidP15ManualFocusTarget: () => null,
  };

  assert.equal(
    selectAutoAimTarget.call(normalScene),
    nearTrainee,
    'normal Stage 1 must keep nearest-active-enemy auto-aim'
  );
}

const validTargetBlock = sourceBlock(
  battleSceneSource,
  '  _getValidP15ManualFocusTarget() {',
  '  _createP15ManualFocusFx(target) {'
);
const getValidTarget = compileClassMethod(
  validTargetBlock,
  '_getValidP15ManualFocusTarget'
);

{
  const invalidTarget = makeEnemy('trainee', 100, 100, { active: false });
  let clearCount = 0;
  const scene = {
    _p15ManualFocusTarget: invalidTarget,
    _isP15ManualFocusEligibleEnemy: () => false,
    _clearP15ManualFocusTarget: () => {
      clearCount += 1;
      scene._p15ManualFocusTarget = null;
    },
  };

  assert.equal(getValidTarget.call(scene), null, 'inactive manual target should be rejected');
  assert.equal(clearCount, 1, 'invalid manual target should clear exactly once');
}

const chooseBlock = sourceBlock(
  battleSceneSource,
  '  _selectP15ManualFocusTarget(enemy) {',
  '  _clearP15ManualFocusTarget() {'
);
const chooseTarget = compileClassMethod(
  chooseBlock,
  '_selectP15ManualFocusTarget'
);

{
  const trainee = makeEnemy('trainee', 100, 100);
  let clearCount = 0;
  const scene = {
    _p15ManualFocusTarget: trainee,
    _isP15ManualFocusEligibleEnemy: () => true,
    _clearP15ManualFocusTarget: () => {
      clearCount += 1;
      scene._p15ManualFocusTarget = null;
    },
  };

  assert.equal(
    chooseTarget.call(scene, trainee),
    false,
    'tapping the current manual target again should cancel focus'
  );
  assert.equal(clearCount, 1, 'cancel should clear focus state and graphics');
}

{
  const eligibilityBlock = sourceBlock(
    battleSceneSource,
    '  _isP15ManualFocusEligibleEnemy(enemy) {',
    '  _bindP15ManualFocusTargetInput(enemy) {'
  );
  [
    "'trainee'",
    'STAGE_15_STAGE_MARKER_TARGET_TYPE',
    'STAGE_15_DRIFTING_LIGHTSTICK_TYPE',
    'STAGE_1_PRACTICE_TARGET_TYPE',
    'Number.isFinite(enemy.x)',
    'Number.isFinite(enemy.y)',
  ].forEach((snippet) => {
    assert.ok(eligibilityBlock.includes(snippet), `eligibility should include: ${snippet}`);
  });
  assert.ok(
    eligibilityBlock.includes('_isP15ManualFocusExperimentEnabled()'),
    'enemy eligibility must require the explicit hidden experiment gate'
  );

  const bindBlock = sourceBlock(
    battleSceneSource,
    '  _bindP15ManualFocusTargetInput(enemy) {',
    '  _selectP15ManualFocusTarget(enemy) {'
  );
  assert.ok(
    bindBlock.includes('const isStageMarker = enemy.type === STAGE_15_STAGE_MARKER_TARGET_TYPE'),
    'only Stage Marker should select the Graphics input branch'
  );
  assert.ok(
    bindBlock.includes('const host = isStageMarker ? enemy.stage15PressureGfx : enemy'),
    'Stage Marker should use pressure Graphics while other eligible enemies keep their sprite host'
  );
  assert.ok(bindBlock.includes('new Phaser.Geom.Circle('), 'Stage Marker should use a local circular hit area');
  assert.ok(
    bindBlock.includes('P15_227E_STAGE_MARKER_MANUAL_FOCUS_HIT_RADIUS'),
    'Stage Marker hit area should use the locked visible extent'
  );
  assert.ok(
    bindBlock.includes('hitAreaCallback: Phaser.Geom.Circle.Contains'),
    'Stage Marker should use Phaser Circle.Contains'
  );
  assert.ok(bindBlock.includes('useHandCursor: true'), 'eligible input hosts should use the hand cursor');
  assert.ok(bindBlock.includes("host.on('pointerdown'"), 'the selected input host should bind a focus tap');
  assert.equal(
    bindBlock.includes('STAGE_15_DRIFTING_LIGHTSTICK_TYPE'),
    false,
    'Drifting Lightstick must not be rerouted to Graphics'
  );
  assert.ok(bindBlock.includes('event?.stopPropagation'), 'enemy focus tap must stop propagation');
  assert.ok(bindBlock.includes('_selectP15ManualFocusTarget(enemy)'), 'enemy focus tap should update focus selection');
  assert.equal(bindBlock.includes('_startTouchMovement'), false, 'enemy focus tap must not start movement');
  assert.equal(bindBlock.includes('_setTouchTarget'), false, 'enemy focus tap must not change the movement target');

  const inputBlock = sourceBlock(
    battleSceneSource,
    '  _setupInput() {',
    '  _setupMobileControls() {'
  );
  assert.ok(inputBlock.includes('_startTouchMovement(pointer)'), 'empty-floor touch movement must remain intact');
  assert.ok(inputBlock.includes('_touchMovePointerId'), 'pointer-id movement ownership must remain intact');
}

{
  const spawnBlock = sourceBlock(
    battleSceneSource,
    '  _spawnEnemyByType(type) {',
    '  _attachStage15PressureGraphics('
  );
  const killBlock = sourceBlock(
    battleSceneSource,
    '  _onEnemyKilled(enemy, killColor) {',
    '  _onEnemyHitPlayer(sourceBullet = null) {'
  );
  const endBattleBlock = sourceBlock(
    battleSceneSource,
    '  _endBattle(type) {',
    '  _showP43ResultPreview(preview) {'
  );
  const actionBlock = sourceBlock(
    battleSceneSource,
    '  _handleBattleResultAction(action) {',
    '  _switchForm() {'
  );
  const shutdownBlock = sourceBlock(
    battleSceneSource,
    "this.events.once('shutdown', () => {",
    '    });'
  );
  const releaseBlock = sourceBlock(
    battleSceneSource,
    "  _releaseBattleRuntimeObjects(reason = 'unspecified') {",
    '  _clearActivePlayerBulletGraphics() {'
  );

  assert.ok(spawnBlock.includes('_bindP15ManualFocusTargetInput(enemy)'), 'spawn should bind eligible enemy input');
  assert.ok(killBlock.includes('_clearP15ManualFocusTarget()'), 'target death should clear manual focus');
  assert.ok(releaseBlock.includes('_clearP15ManualFocusTarget()'), 'release facade should own manual focus cleanup');
  assert.ok(endBattleBlock.includes("_releaseBattleRuntimeObjects('battle-end')"), 'battle end should release manual focus ownership');
  assert.ok(actionBlock.includes("_releaseBattleRuntimeObjects('result-retry')"), 'retry should release manual focus ownership');
  assert.ok(actionBlock.includes("_releaseBattleRuntimeObjects('result-title')"), 'title should release manual focus ownership');
  assert.ok(shutdownBlock.includes("_releaseBattleRuntimeObjects('shutdown')"), 'shutdown should release manual focus ownership');
}

{
  const visualBlock = sourceBlock(
    battleSceneSource,
    '  _createP15ManualFocusFx(target) {',
    '  _syncP15ManualFocusFx() {'
  );
  const clearBlock = sourceBlock(
    battleSceneSource,
    '  _clearP15ManualFocusTarget() {',
    '  _getValidP15ManualFocusTarget() {'
  );

  assert.ok(visualBlock.includes('this.add.graphics()'), 'manual focus feedback should use Phaser graphics');
  assert.ok(visualBlock.includes('lineBetween'), 'manual focus feedback should use open corner strokes');
  assert.ok(visualBlock.includes("'聚焦目标'"), 'manual focus may show the short acknowledgement copy');
  assert.equal(visualBlock.includes('strokeCircle'), false, 'manual focus feedback must not draw a closed ring');
  assert.equal(visualBlock.includes('this.add.image'), false, 'manual focus feedback must not use an image asset');
  assert.ok(clearBlock.includes('.destroy()'), 'manual focus cleanup should destroy feedback nodes');
  assert.ok(clearBlock.includes('_p15ManualFocusTarget = null'), 'manual focus cleanup should clear target state');
}

{
  assert.equal(stageWavesSource.includes('p15ManualFocus'), false, 'manual focus must not change wave defs');
  assert.equal(waveSystemSource.includes('p15ManualFocus'), false, 'manual focus must not change WaveSystem');

  const manualFocusSurface = [
    gateBlock,
    sourceBlock(
      battleSceneSource,
      '  _isP15ManualFocusEligibleEnemy(enemy) {',
      '  _selectAutoAimTarget() {'
    ),
    selectBlock,
  ].join('\n');

  [
    'load.image',
    'preload',
    '.png',
    '.wav',
    '.mp3',
    '.ogg',
    'localStorage',
    '_p15SetlistCueId',
    'characterId',
    'reward',
    'task',
    'red dot',
    'Stage 2',
    'shop',
    'gacha',
    'backend',
    'analytics',
  ].forEach((forbidden) => {
    assert.equal(
      manualFocusSurface.includes(forbidden),
      false,
      `manual focus surface must not introduce forbidden dependency: ${forbidden}`
    );
  });
}

console.log('p15225 manual focus target action contract: all assertions passed');
