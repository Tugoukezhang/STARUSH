import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const stageWavesSource = readFileSync(new URL('../src/utils/stageWaves.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function sourceBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

{
  const helperBlock = sourceBlock(
    battleSceneSource,
    '  _selectAutoAimTarget() {',
    '  _tryShoot(time) {'
  );

  assert.ok(
    helperBlock.includes('const preferStage15PriorityTarget = this._isStage15PracticeMode() === true;'),
    'auto-aim priority should be hidden Stage 1.5 practice only'
  );
  assert.ok(helperBlock.includes('let nearestEnemy = null;'), 'helper should keep nearest-enemy fallback');
  assert.ok(helperBlock.includes('let nearestPriorityTarget = null;'), 'helper should track the nearest priority marker');
  assert.ok(helperBlock.includes('if (!enemy || !enemy.active) return;'), 'helper should skip missing or inactive enemies');
  assert.ok(
    helperBlock.includes('enemy.type === STAGE_15_STAGE_MARKER_TARGET_TYPE'),
    'only Stage Marker Target should receive hidden-practice priority'
  );
  assert.ok(
    helperBlock.includes('return nearestPriorityTarget || nearestEnemy;'),
    'helper should fall back to the nearest active enemy when no marker exists'
  );

  [
    '_p15SetlistCueId',
    'P15_117_FOCUS_STAGE_CUE_ID',
    'focus_stage',
    'stable_beat',
    'hold_highlight',
    'STAGE_1_PRACTICE_TARGET_TYPE',
    'STAGE_15_DRIFTING_LIGHTSTICK_TYPE',
  ].forEach((forbidden) => {
    assert.equal(helperBlock.includes(forbidden), false, `target helper must not depend on forbidden selector: ${forbidden}`);
  });
}

{
  const shootBlock = sourceBlock(
    battleSceneSource,
    '  _tryShoot(time) {',
    '  _setupCollisions() {'
  );

  assert.ok(
    shootBlock.includes('const nearestEnemy = this._selectAutoAimTarget();'),
    '_tryShoot should delegate only target selection to _selectAutoAimTarget'
  );
  assert.equal(
    shootBlock.includes('this.enemies.children.iterate'),
    false,
    '_tryShoot should not keep a second inline target-selection loop'
  );

  [
    'const fireRate = SHOOT_CONFIG.FIRE_RATE / this.support.getCenterStageFireRateMultiplier()',
    'originX, originY, \'__DEFAULT\'',
    'bullet.body.setCircle(7, 0, 0)',
    'bullet.moveVx = aimVx * SHOOT_CONFIG.BULLET_SPEED',
    'bullet.moveVy = aimVy * SHOOT_CONFIG.BULLET_SPEED',
    'this._createPlayerBulletVisual(bullet.x, bullet.y, bullet.color, colorHex)',
    'this._spawnChargeNoteFx(this.player.x, this.player.y - 18, this.currentColor)',
  ].forEach((snippet) => {
    assert.ok(shootBlock.includes(snippet), `_tryShoot should preserve shot contract: ${snippet}`);
  });
}

{
  assert.equal(stageWavesSource.includes('P15_135'), false, 'P15-135 must not change wave defs');
  assert.equal(stageWavesSource.includes('_selectAutoAimTarget'), false, 'target selection must stay out of stage wave defs');
}

{
  [
    'priority_target.png',
    'stage_marker_target.png',
    'auto_aim_priority',
    'target_lock',
    'lock-on',
    'reward',
    'task',
    'red dot',
    'Stage 2',
    'shop',
    'gacha',
    'backend',
    'analytics',
  ].forEach((forbidden) => {
    assert.equal(battleSceneSource.includes(forbidden), false, `auto-aim alignment must not introduce forbidden surface: ${forbidden}`);
  });
}

console.log('p15135 auto-aim priority target alignment: all assertions passed');
