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
  const match = battleSceneSource.match(new RegExp(`const ${name} = ([0-9.]+);`));
  assert.ok(match, `missing numeric constant: ${name}`);
  return Number(match[1]);
}

{
  assert.equal(numericConstant('P15_131_LAUNCH_FLICK_DEPTH'), 8);
  assert.equal(numericConstant('P15_131_LAUNCH_FLICK_DURATION_MS'), 150);
  assert.equal(numericConstant('P15_131_LAUNCH_FLICK_MAX_ALPHA'), 0.48);
  assert.equal(numericConstant('P15_131_LAUNCH_FLICK_MAX_SIZE'), 14);
  assert.ok(
    numericConstant('P15_131_LAUNCH_FLICK_DURATION_MS') >= 120
      && numericConstant('P15_131_LAUNCH_FLICK_DURATION_MS') <= 180,
    'launch flick should stay shorter than the fastest common firing interval'
  );
  assert.ok(
    numericConstant('P15_131_LAUNCH_FLICK_MAX_ALPHA') <= 0.48,
    'launch flick alpha must stay below hit spark brightness'
  );
  assert.ok(
    numericConstant('P15_131_LAUNCH_FLICK_MAX_SIZE') <= 14,
    'launch flick footprint should remain compact on 375x667'
  );
}

{
  const shootBlock = sourceBlock('  _tryShoot(time) {', '  _setupCollisions() {');
  [
    'const fireRate = SHOOT_CONFIG.FIRE_RATE / this.support.getCenterStageFireRateMultiplier()',
    'originX, originY, \'__DEFAULT\'',
    'bullet.body.setCircle(7, 0, 0)',
    'bullet.moveVx = aimVx * SHOOT_CONFIG.BULLET_SPEED',
    'bullet.moveVy = aimVy * SHOOT_CONFIG.BULLET_SPEED',
    'this._createPlayerBulletVisual(bullet.x, bullet.y, bullet.color, colorHex)',
    'this._spawnChargeNoteFx(this.player.x, this.player.y - 18, this.currentColor)',
  ].forEach((snippet) => {
    assert.ok(shootBlock.includes(snippet), `_tryShoot should preserve launch seam and bullet contract: ${snippet}`);
  });

  assert.equal(shootBlock.includes('player_shot_launch_note_flick_source'), false);
  assert.equal(shootBlock.includes('phase15-p15-128'), false);
}

{
  const hitBlock = sourceBlock('  _onBulletHitEnemy(bullet, enemy) {', '  _onEnemyKilled(enemy, killColor) {');
  assert.ok(hitBlock.includes('const baseDmg = 10'), 'bullet damage contract must remain unchanged');
  assert.ok(hitBlock.includes('this._spawnImpactNoteFx(enemy.x, enemy.y, bullet.color);'), 'hit spark seam must remain enemy-local');
}

{
  const chargeBlock = sourceBlock(
    '  _spawnChargeNoteFx(x, y, color) {',
    '  _spawnImpactNoteFx(x, y, color) {'
  );

  [
    'const hex = COLOR_HEX[color] || 0xFFFFFF',
    'const flick = this.add.graphics()',
    '.setDepth(P15_131_LAUNCH_FLICK_DEPTH)',
    '.setAlpha(P15_131_LAUNCH_FLICK_MAX_ALPHA)',
    'P15_131_LAUNCH_FLICK_MAX_SIZE / 2',
    '0xF7D8E8',
    '0xFF6FAE',
    '0x77D6C3',
    'setPosition(x, y)',
    'duration: P15_131_LAUNCH_FLICK_DURATION_MS',
    'onComplete: () => flick.destroy()',
  ].forEach((snippet) => {
    assert.ok(chargeBlock.includes(snippet), `_spawnChargeNoteFx should include graphics-only launch flick snippet: ${snippet}`);
  });

  [
    'this.add.image',
    'this.add.circle',
    'NOTE_ART_FRAMES',
    'NOTE_ART_ATLAS_KEY',
    '_hasNoteArtFrame',
    '.png',
    'player_shot_launch_note_flick_source',
    'phase15-p15-128',
    'this.load',
    'preload',
    'registry',
    'setInteractive',
    'pointerdown',
    'physics',
    'overlap',
    'score',
    'support.addValue',
    'enemy.hp',
    'baseDmg',
    'waveSystem',
    '_spawnImpactNoteFx',
    '_spawnCPositionPresentationFx',
    '_spawnEncorePresentationFx',
    '_p15SetlistCueId',
  ].forEach((forbidden) => {
    assert.equal(chargeBlock.includes(forbidden), false, `_spawnChargeNoteFx must not use forbidden path: ${forbidden}`);
  });
}

{
  [
    'player_shot_launch_note_flick_source',
    'phase15-p15-128',
  ].forEach((forbidden) => {
    assert.equal(battleSceneSource.includes(forbidden), false, `runtime source must not reference P15-128 source art: ${forbidden}`);
  });
}

console.log('p15131 player shot launch note flick: all assertions passed');
