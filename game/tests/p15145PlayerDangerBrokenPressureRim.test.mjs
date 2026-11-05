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
  assert.equal(numericConstant('P15_145_PLAYER_DANGER_RIM_DEPTH'), 4);
  assert.equal(numericConstant('P15_145_PLAYER_DANGER_RIM_RADIUS'), 24);
  assert.equal(numericConstant('P15_145_PLAYER_DANGER_RIM_MAX_ALPHA'), 0.22);
  assert.equal(numericConstant('P15_145_PLAYER_DANGER_RIM_LINE_WIDTH'), 1.35);
  assert.equal(numericConstant('P15_145_PLAYER_DANGER_ENEMY_MARGIN'), 34);
  assert.equal(numericConstant('P15_145_PLAYER_DANGER_BULLET_DISTANCE'), 46);
  assert.ok(
    numericConstant('P15_145_PLAYER_DANGER_RIM_MAX_ALPHA') <= 0.24,
    'danger rim alpha must stay below shield/buff/readability FX brightness'
  );
  assert.ok(
    numericConstant('P15_145_PLAYER_DANGER_RIM_DEPTH') < numericConstant('P1_67_BULLET_VISUAL_DEPTH'),
    'danger rim should stay below readable player bullets'
  );
  assert.ok(
    numericConstant('P15_145_PLAYER_DANGER_RIM_DEPTH') < numericConstant('P15_131_LAUNCH_FLICK_DEPTH'),
    'danger rim should stay below launch flick'
  );
  assert.ok(
    numericConstant('P15_145_PLAYER_DANGER_RIM_DEPTH') < numericConstant('P15_108N_HIT_SPARK_DEPTH'),
    'danger rim should stay below hit spark'
  );
}

{
  [
    '_findPlayerDangerPressureThreat',
    '_shouldShowPlayerDangerPressureRim',
    '_updatePlayerDangerPressureRim',
    '_clearPlayerDangerPressureRim',
  ].forEach((helper) => {
    assert.ok(battleSceneSource.includes(`  ${helper}(`), `BattleScene should define ${helper}`);
  });
}

{
  const threatBlock = sourceBlock(
    '  _findPlayerDangerPressureThreat() {',
    '  _shouldShowPlayerDangerPressureRim() {'
  );

  [
    'this.enemies?.children?.iterate',
    'this.enemyBullets?.children?.iterate',
    'enemy?.drawRadius || enemy?.body?.radius || 12',
    'PLAYER.HITBOX_RADIUS + P15_145_PLAYER_DANGER_ENEMY_MARGIN',
    'P15_145_PLAYER_DANGER_BULLET_DISTANCE',
    'item.active === false',
  ].forEach((snippet) => {
    assert.ok(threatBlock.includes(snippet), `_findPlayerDangerPressureThreat should include proximity contract: ${snippet}`);
  });

  [
    'this.player.hp',
    'this.player.invulnerable',
    '_onEnemyHitPlayer',
    '_p15SetlistCueId',
    'stable_beat',
    'focus_stage',
    'hold_highlight',
    'CENTER_STAGE',
    'ENCORE',
    'score',
    'support.gain',
    'waveSystem',
  ].forEach((forbidden) => {
    assert.equal(threatBlock.includes(forbidden), false, `_findPlayerDangerPressureThreat must not depend on forbidden state: ${forbidden}`);
  });
}

{
  const shouldBlock = sourceBlock(
    '  _shouldShowPlayerDangerPressureRim() {',
    '  _updatePlayerDangerPressureRim() {'
  );
  assert.ok(shouldBlock.includes('return Boolean(this._findPlayerDangerPressureThreat())'));
  assert.equal(shouldBlock.includes('this.player.hp'), false);
  assert.equal(shouldBlock.includes('this.player.invulnerable'), false);
  assert.equal(shouldBlock.includes('_p15SetlistCueId'), false);
}

{
  const rimBlock = sourceBlock(
    '  _updatePlayerDangerPressureRim() {',
    '  _clearPlayerDangerPressureRim() {'
  );

  [
    'this.playerDangerPressureRim = this.add.graphics()',
    '.setDepth(P15_145_PLAYER_DANGER_RIM_DEPTH)',
    '.setAlpha(P15_145_PLAYER_DANGER_RIM_MAX_ALPHA)',
    'this.playerDangerPressureRim.clear()',
    'this.playerDangerPressureRim.setPosition(this.player.x, this.player.y)',
    'P15_145_PLAYER_DANGER_RIM_RADIUS',
    'P15_145_PLAYER_DANGER_RIM_LINE_WIDTH',
    '0xF7D8E8',
    '0x77D6C3',
    '0xA892FF',
    '0xF7A8D8',
    '.arc(0, 0,',
    '.lineBetween(',
    'setVisible(false)',
  ].forEach((snippet) => {
    assert.ok(rimBlock.includes(snippet), `_updatePlayerDangerPressureRim should include graphics-only broken rim snippet: ${snippet}`);
  });

  [
    'strokeCircle',
    'fillCircle',
    'fillStyle',
    'this.add.image',
    'this.load',
    'preload',
    'registry',
    '.png',
    'broken_pressure_rim_source',
    'phase15-p15-142',
    'this.tweens.add',
    'duration',
    'Math.sin',
    'this.player.hp',
    'this.player.invulnerable',
    '_p15SetlistCueId',
    'stable_beat',
    'focus_stage',
    'hold_highlight',
    'score',
    'support',
    'enemy.hp',
  ].forEach((forbidden) => {
    assert.equal(rimBlock.includes(forbidden), false, `_updatePlayerDangerPressureRim must not use forbidden path: ${forbidden}`);
  });
}

{
  const cleanupBlock = sourceBlock(
    '  _clearPlayerDangerPressureRim() {',
    '  _switchColor() {'
  );
  assert.ok(cleanupBlock.includes('this.playerDangerPressureRim.destroy()'));
  assert.ok(cleanupBlock.includes('this.playerDangerPressureRim = null'));

  const updateBlock = sourceBlock('  update(time, delta) {', '    // 更新玩家视觉');
  assert.ok(updateBlock.includes('this._updatePlayerReadabilityMarker(this.isMoving)'));
  assert.ok(updateBlock.includes('this._updatePlayerDangerPressureRim()'));

  const shutdownBlock = sourceBlock("    this.events.once('shutdown', () => {", '    });');
  const releaseBlock = sourceBlock(
    "  _releaseBattleRuntimeObjects(reason = 'unspecified') {",
    '  _clearActivePlayerBulletGraphics() {'
  );
  assert.ok(releaseBlock.includes('_clearPlayerDangerPressureRim()'), 'release facade should own danger rim cleanup');
  assert.ok(shutdownBlock.includes("_releaseBattleRuntimeObjects('shutdown')"), 'scene shutdown should release battle runtime objects');

  const endBattleBlock = sourceBlock('  _endBattle(type) {', '    this.physics.pause();');
  assert.ok(endBattleBlock.includes("_releaseBattleRuntimeObjects('battle-end')"), 'result transition should release battle runtime objects');
}

{
  const battleSurface = [
    sourceBlock('const P15_145_PLAYER_DANGER_RIM_DEPTH', 'const MOBILE_MOVE_ZONE_RIGHT'),
    sourceBlock('  _findPlayerDangerPressureThreat() {', '  _switchColor() {'),
  ].join('\n');

  [
    'shield',
    'buff',
    'reward',
    'task',
    'red dot',
    'Stage 2',
    'shop',
    'gacha',
    'backend',
    'analytics',
    'c_position_marker',
    'encore_marker',
  ].forEach((forbidden) => {
    assert.equal(battleSurface.includes(forbidden), false, `danger rim surface must not add forbidden semantics: ${forbidden}`);
  });
}

{
  [
    'broken_pressure_rim_source',
    'player_hit_beat_flash_source',
    'low_hp_stage_noise_edge_source',
    'phase15-p15-142',
  ].forEach((forbidden) => {
    assert.equal(battleSceneSource.includes(forbidden), false, `runtime source must not reference P15-142 source art: ${forbidden}`);
  });
}

console.log('p15145 player danger broken pressure rim: all assertions passed');
