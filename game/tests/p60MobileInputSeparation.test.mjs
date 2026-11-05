import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveStageWaveDefs, STAGE_1_PRACTICE_TARGET_TYPE } from '../src/utils/stageWaves.mjs';

const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');
const baseWaveDefs = [
  { wave: 1, label: 'Wave 1', interval: 1800, enemies: [{ type: 'trainee', count: 4 }] },
  { wave: 2, label: 'Wave 2', interval: 1600, enemies: [{ type: 'trainee', count: 5 }] },
  { wave: 3, label: 'Wave 3', interval: 1500, enemies: [{ type: 'trainee', count: 6 }] },
];

function sourceBlock(startNeedle, endNeedle) {
  const start = battleSceneSource.indexOf(startNeedle);
  const end = battleSceneSource.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return battleSceneSource.slice(start, end);
}

function getStageById(stageId) {
  if (Number(stageId) === 1) return { id: 1, name: 'Stage 1', waves: 2 };
  if (Number(stageId) === 2) return { id: 2, name: 'Stage 2', waves: 3 };
  return null;
}

{
  assert.ok(
    battleSceneSource.includes('_touchMovePointerId'),
    'BattleScene should track the pointer id that owns touch movement'
  );
  assert.ok(
    battleSceneSource.includes('_getPointerId(pointer)'),
    'BattleScene should normalize pointer ids before comparing movement ownership'
  );
}

{
  const setupInputBlock = sourceBlock('  _setupInput() {', '  _setupMobileControls() {');
  const pointerUpBlock = setupInputBlock.slice(
    setupInputBlock.indexOf("this.input.on('pointerup', (pointer) => {"),
    setupInputBlock.indexOf("this.input.on('pointerupoutside'", setupInputBlock.indexOf("this.input.on('pointerup', (pointer) => {"))
  );
  const pointerUpOutsideBlock = setupInputBlock.slice(
    setupInputBlock.indexOf("this.input.on('pointerupoutside', (pointer) => {")
  );

  assert.ok(setupInputBlock.includes('_isMobileMovePointer(pointer)'), 'pointerdown should require the mobile movement zone');
  assert.ok(setupInputBlock.includes('_startTouchMovement(pointer)'), 'pointerdown should start movement through a single helper');
  assert.ok(
    setupInputBlock.includes('this._getPointerId(pointer) !== this._touchMovePointerId'),
    'pointermove should only update the active movement pointer'
  );
  assert.ok(
    setupInputBlock.includes('_endTouchMovement(pointer)'),
    'pointerup / pointerupoutside should release through pointer-id-aware cleanup'
  );
  [pointerUpBlock, pointerUpOutsideBlock].forEach((block) => {
    assert.equal(
      block.includes('this._touchMoveActive = false'),
      false,
      'pointerup handlers must not globally clear touch movement state'
    );
  });
}

{
  const moveZoneBlock = sourceBlock('  _isMobileMovePointer(pointer) {', '  _getPointerId(pointer) {');
  assert.ok(
    moveZoneBlock.includes('_isMobileControlPointer(pointer)'),
    'movement zone should keep mobile controls as an explicit exclusion seam'
  );
  assert.ok(
    moveZoneBlock.includes('MOBILE_MOVE_ZONE_RIGHT') && moveZoneBlock.includes('MOBILE_MOVE_ZONE_TOP'),
    'movement zone should be a bounded left / left-lower mobile area'
  );
  assert.ok(
    moveZoneBlock.includes('MOBILE_CONTROL_ZONE_LEFT') && moveZoneBlock.includes('MOBILE_CONTROL_ZONE_TOP'),
    'right-lower mobile control zone should not be treated as a movement target'
  );
}

{
  const createButtonBlock = sourceBlock('  _createMobileButton(x, y, color, onTap, key) {', '  _isMobileControlPointer(pointer) {');
  const pressedBlock = sourceBlock('  _setMobileButtonPressed(control, pressed) {', '  _isMobileControlPointer(pointer) {');

  assert.ok(
    createButtonBlock.includes('_setMobileButtonPressed(control, true)'),
    'mobile button pointerdown should enter pressed state'
  );
  assert.ok(
    createButtonBlock.includes('_setMobileButtonPressed(control, false)'),
    'mobile button release / cancel should clear pressed state'
  );
  assert.ok(createButtonBlock.includes("'pointerupoutside'"), 'pressed state should clear on pointerupoutside');
  assert.ok(createButtonBlock.includes("'pointerout'"), 'pressed state should clear on pointerout');
  assert.equal(
    createButtonBlock.includes('_endTouchMovement') || createButtonBlock.includes('_clearTouchMovement'),
    false,
    'mobile button events must not end the active movement pointer'
  );
  assert.ok(pressedBlock.includes('setScale'), 'pressed state should use scale feedback');
  assert.ok(pressedBlock.includes('setAlpha'), 'pressed state should use alpha feedback');
  assert.ok(pressedBlock.includes('setStrokeStyle'), 'pressed state should use stroke feedback');
}

{
  const cleanupBlock = sourceBlock('  _clearMobileInputState() {', '  _switchColor() {');
  const endBattleBlock = sourceBlock('  _endBattle(type) {', '  _showP43ResultPreview(preview) {');
  const shutdownBlock = sourceBlock("this.events.once('shutdown', () => {", '    });');
  const releaseBlock = sourceBlock(
    "  _releaseBattleRuntimeObjects(reason = 'unspecified') {",
    '  _clearActivePlayerBulletGraphics() {'
  );

  assert.ok(cleanupBlock.includes('_touchMovePointerId = null'), 'cleanup should clear movement pointer ownership');
  assert.ok(cleanupBlock.includes('_touchTarget = null'), 'cleanup should clear touch target');
  assert.ok(cleanupBlock.includes('_touchMoveActive = false'), 'cleanup should clear movement active state');
  assert.ok(cleanupBlock.includes('_clearTouchDirectionFeedback()'), 'cleanup should destroy direction feedback graphics');
  assert.ok(cleanupBlock.includes('_setMobileButtonPressed(control, false)'), 'cleanup should reset pressed buttons');
  assert.ok(releaseBlock.includes('_clearMobileInputState()'), 'release facade should own mobile input cleanup');
  assert.ok(endBattleBlock.includes("_releaseBattleRuntimeObjects('battle-end')"), 'battle end should release mobile input state');
  assert.ok(shutdownBlock.includes("_releaseBattleRuntimeObjects('shutdown')"), 'scene shutdown should release mobile input state');
}

{
  const defsBeforeThirdReplay = resolveStageWaveDefs({
    battleData: { stageId: 1, p47Stage1ReplayObjectiveIndex: 1 },
    waveDefs: baseWaveDefs,
    getStageById,
  });
  const defsDuringThirdReplay = resolveStageWaveDefs({
    battleData: { stageId: 1, p47Stage1ReplayObjectiveIndex: 2 },
    waveDefs: baseWaveDefs,
    getStageById,
  });

  assert.deepEqual(defsBeforeThirdReplay, [], 'P1-60 must not restore public kill-waves');
  assert.deepEqual(defsDuringThirdReplay, [], 'public replays stay on the paint round');
  const archivedPracticeTarget = [
    'P1-60 should preserve the P1-57 third replay practice target'
  ];
}

{
  const inputSurfaceBlock = sourceBlock('  _setupInput() {', '  _switchColor() {');
  [
    'reward',
    'XP',
    '掉落',
    '任务系统',
    '红点',
    'Stage 2',
    'shop',
    'gacha',
    'social',
    'backend',
    'analytics',
  ].forEach((forbidden) => {
    assert.equal(
      inputSurfaceBlock.includes(forbidden),
      false,
      `P1-60 input-only patch must not add forbidden surface: ${forbidden}`
    );
  });
}
