import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolveStageWaveDefs,
  STAGE_1_PRACTICE_TARGET_TYPE,
  STAGE_15_DRIFTING_LIGHTSTICK_TYPE,
  STAGE_15_STAGE_MARKER_TARGET_TYPE,
} from '../src/utils/stageWaves.mjs';

const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const stageWavesSource = readFileSync(new URL('../src/utils/stageWaves.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const waveSystemSource = readFileSync(new URL('../src/systems/WaveSystem.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

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

function sourceBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

function numericConstant(name) {
  const match = battleSceneSource.match(new RegExp(`const ${name} = ([0-9.]+);`));
  assert.ok(match, `missing numeric constant: ${name}`);
  return Number(match[1]);
}

{
  assert.equal(numericConstant('P15_165_PLAYER_HIT_BEAT_FLASH_DEPTH'), 7);
  assert.equal(numericConstant('P15_165_PLAYER_HIT_BEAT_FLASH_DURATION_MS'), 160);
  assert.equal(numericConstant('P15_165_PLAYER_HIT_BEAT_FLASH_MAX_ALPHA'), 0.4);
  assert.equal(numericConstant('P15_165_PLAYER_HIT_BEAT_FLASH_MAX_SIZE'), 20);
  assert.equal(numericConstant('P15_165_PLAYER_HIT_BEAT_FLASH_LIMIT'), 4);

  assert.ok(
    numericConstant('P15_145_PLAYER_DANGER_RIM_DEPTH') < numericConstant('P15_165_PLAYER_HIT_BEAT_FLASH_DEPTH'),
    'hit beat flash should read above the before-hit danger rim'
  );
  assert.ok(
    numericConstant('P1_67_BULLET_VISUAL_DEPTH') < numericConstant('P15_165_PLAYER_HIT_BEAT_FLASH_DEPTH'),
    'hit beat flash should briefly read above player bullets at the damage moment'
  );
  assert.ok(
    numericConstant('P15_165_PLAYER_HIT_BEAT_FLASH_DEPTH') < numericConstant('P15_131_LAUNCH_FLICK_DEPTH'),
    'hit beat flash should stay below launch flick hierarchy'
  );
  assert.ok(
    numericConstant('P15_165_PLAYER_HIT_BEAT_FLASH_DEPTH') < numericConstant('P15_108N_HIT_SPARK_DEPTH'),
    'hit beat flash should stay below enemy-local hit spark hierarchy'
  );
  assert.ok(
    numericConstant('P15_165_PLAYER_HIT_BEAT_FLASH_MAX_ALPHA') <= 0.4,
    'hit beat flash alpha must stay restrained'
  );
  assert.ok(
    numericConstant('P15_165_PLAYER_HIT_BEAT_FLASH_MAX_SIZE') <= 20,
    'hit beat flash footprint should stay compact on 375x667'
  );
}

{
  [
    '_spawnPlayerHitBeatFlash',
    '_trackPlayerHitBeatFlashFx',
    '_removePlayerHitBeatFlashFx',
    '_clearPlayerHitBeatFlashFx',
  ].forEach((helper) => {
    assert.ok(battleSceneSource.includes(`  ${helper}(`), `BattleScene should define ${helper}`);
  });
}

{
  const collisionBlock = sourceBlock(
    battleSceneSource,
    '  _setupCollisions() {',
    '  _onBulletHitEnemy(bullet, enemy) {'
  );
  assert.ok(collisionBlock.includes('(_player, bullet) => this._onEnemyHitPlayer(bullet)'));
  assert.ok(collisionBlock.includes('(_player, enemy) => this._onEnemyContactPlayer(enemy)'));
  assert.equal(collisionBlock.includes('sourceHint'), false, 'P15-166 should not add source metadata to collision callbacks');
  assert.equal(collisionBlock.includes('{ source'), false, 'projectile identity must not become source metadata');

  const contactBlock = sourceBlock(
    battleSceneSource,
    '  _onEnemyContactPlayer(enemy) {',
    '  _onEnemyHitPlayer(sourceBullet = null, contactEnemy = null) {'
  );
  assert.ok(contactBlock.includes('this._onEnemyHitPlayer(null,enemy)'));
}

{
  const playerHitBlock = sourceBlock(
    battleSceneSource,
    '  _onEnemyHitPlayer(sourceBullet = null, contactEnemy = null) {',
    '  _getPlayerVisualTarget() {'
  );
  [
    'if (this._battleEnded) return;',
    'if (this.player.invulnerable) return;',
    'this.battleRecord.playerHitCount',
    'this.player.hp--;',
    'const lethalHit = this.player.hp <= 0;',
    'this._spawnPlayerHitBeatFlash(this.player.x, this.player.y);',
    'this.p17Audio?.playPlayerDamage({ time: this.time?.now, lethal: lethalHit });',
    'this.cameras.main.shake(100, 0.005)',
    'this.player.invulnerable = true;',
    'this.support.gainFromTakeDamage();',
    'alpha: 0.3',
    'duration: 100',
    'repeat: 5',
    'if (lethalHit) this._onPlayerDeath();',
  ].forEach((snippet) => {
    assert.ok(playerHitBlock.includes(snippet), `_onEnemyHitPlayer should preserve damage contract and include: ${snippet}`);
  });

  assert.equal(playerHitBlock.includes('this.atmosphere.isSlowActive()'), false);
  assert.equal(playerHitBlock.includes('Math.random()'), false);
  assert.equal(
    (playerHitBlock.match(/this\.player\.hp--;/g) || []).length,
    1,
    'one accepted collision must remove exactly one HP'
  );

  const invulnerableGuardIndex = playerHitBlock.indexOf('if (this.player.invulnerable) return;');
  const stageCuePulseConsumeIndex = playerHitBlock.indexOf("this._consumePublicStage1StageCuePulse?.(sourceBullet, 'hit');");
  const exactPulseConsumeIndex = playerHitBlock.indexOf("this._consumeP15HostileProjectile(sourceBullet, 'hit');");
  const battleRecordIndex = playerHitBlock.indexOf('this.battleRecord.playerHitCount');
  const hpIndex = playerHitBlock.indexOf('this.player.hp--;', battleRecordIndex);
  const lethalIndex = playerHitBlock.indexOf('const lethalHit = this.player.hp <= 0;');
  const flashIndex = playerHitBlock.indexOf('this._spawnPlayerHitBeatFlash(this.player.x, this.player.y);');
  const audioIndex = playerHitBlock.indexOf('this.p17Audio?.playPlayerDamage');

  assert.ok(stageCuePulseConsumeIndex >= 0, 'public Stage 1 stage-cue pulse should consume exact projectile identity');
  assert.ok(stageCuePulseConsumeIndex < invulnerableGuardIndex, 'stage-cue projectile cleanup must precede damage guards');
  assert.ok(exactPulseConsumeIndex >= 0, 'exact projectile identity should be consumed at the existing damage entry');
  assert.ok(exactPulseConsumeIndex < invulnerableGuardIndex, 'projectile cleanup must precede the unchanged damage guards');
  assert.equal(playerHitBlock.includes('sourceHint'), false, 'damage path must not invent guessed source hints');
  assert.equal(playerHitBlock.includes('damageSource'), false, 'damage values must stay source-independent');
  assert.equal((playerHitBlock.match(/sourceBullet/g) || []).length, 4, 'source bullet enters only signature, immutable snapshot and two exact cleanup calls');
  assert.ok(playerHitBlock.indexOf('capturePlayerHitSource(this,sourceBullet,contactEnemy)') < stageCuePulseConsumeIndex);
  assert.ok(playerHitBlock.indexOf('this.battleRecord.lastPlayerHit=Object.freeze') > hpIndex);
  assert.ok(flashIndex > invulnerableGuardIndex, 'hit beat flash must not run before invulnerability guard');
  assert.ok(flashIndex > hpIndex, 'hit beat flash must only run after real HP loss');
  assert.ok(flashIndex > lethalIndex, 'hit beat flash should run after lethal-hit state is known');
  assert.ok(flashIndex < audioIndex, 'hit beat flash should stay at the hit confirmation seam before audio/shake/recovery');
}

{
  const flashBlock = sourceBlock(
    battleSceneSource,
    '  _spawnPlayerHitBeatFlash(x, y) {',
    '  _trackPlayerHitBeatFlashFx(node) {'
  );

  [
    'const r = P15_165_PLAYER_HIT_BEAT_FLASH_MAX_SIZE / 2',
    'this.add.graphics()',
    '.setDepth(P15_165_PLAYER_HIT_BEAT_FLASH_DEPTH)',
    '.setAlpha(P15_165_PLAYER_HIT_BEAT_FLASH_MAX_ALPHA)',
    '0xF7D8E8',
    '0xFF6FAE',
    '0x77D6C3',
    '0xAAB7C4',
    'beginPath',
    'moveTo',
    'lineTo',
    'closePath',
    'fillPath',
    'lineBetween',
    'setPosition(x, y)',
    'duration: P15_165_PLAYER_HIT_BEAT_FLASH_DURATION_MS',
    '_removePlayerHitBeatFlashFx(flash)',
  ].forEach((snippet) => {
    assert.ok(flashBlock.includes(snippet), `_spawnPlayerHitBeatFlash should include graphics-only hit chip snippet: ${snippet}`);
  });

  [
    'this.add.image',
    'this.add.circle',
    'strokeCircle',
    'fillCircle',
    'load.image',
    'this.load',
    'preload',
    'registry',
    '.png',
    'player_hit_beat_flash_source',
    'broken_pressure_rim_source',
    'low_hp_stage_noise_edge_source',
    'phase15-p15-142',
    'p17Audio',
    'this.sound',
    'physics',
    'overlap',
    'enemy.hp',
    'baseDmg',
    'score',
    'support',
    'waveSystem',
    '_spawnImpactNoteFx',
    '_spawnChargeNoteFx',
    '_spawnCPositionPresentationFx',
    '_spawnEncorePresentationFx',
    '_p15SetlistCueId',
  ].forEach((forbidden) => {
    assert.equal(flashBlock.includes(forbidden), false, `_spawnPlayerHitBeatFlash must not use forbidden path: ${forbidden}`);
  });
}

{
  const trackBlock = sourceBlock(
    battleSceneSource,
    '  _trackPlayerHitBeatFlashFx(node) {',
    '  _removePlayerHitBeatFlashFx(node) {'
  );
  assert.ok(trackBlock.includes('this.playerHitBeatFlashFx'));
  assert.ok(trackBlock.includes('P15_165_PLAYER_HIT_BEAT_FLASH_LIMIT'));
  assert.ok(trackBlock.includes('oldest.destroy()'));

  const removeBlock = sourceBlock(
    battleSceneSource,
    '  _removePlayerHitBeatFlashFx(node) {',
    '  _clearPlayerHitBeatFlashFx() {'
  );
  assert.ok(removeBlock.includes('node.destroy()'));
  assert.ok(removeBlock.includes('this.playerHitBeatFlashFx.filter'));

  const clearBlock = sourceBlock(
    battleSceneSource,
    '  _clearPlayerHitBeatFlashFx() {',
    '  _showWaveLabel(label) {'
  );
  assert.ok(clearBlock.includes('node.destroy()'));
  assert.ok(clearBlock.includes('this.playerHitBeatFlashFx = []'));

  const shutdownBlock = sourceBlock(
    battleSceneSource,
    "this.events.once('shutdown'",
    'const sceneData = normalizeBattleData'
  );
  const releaseBlock = sourceBlock(
    battleSceneSource,
    "  _releaseBattleRuntimeObjects(reason = 'unspecified') {",
    '  _clearActivePlayerBulletGraphics() {'
  );
  assert.ok(releaseBlock.includes('_clearPlayerHitBeatFlashFx()'), 'release facade should own hit beat flash FX cleanup');
  assert.ok(shutdownBlock.includes("_releaseBattleRuntimeObjects('shutdown')"), 'scene shutdown should release battle runtime objects');

  const endBattleBlock = sourceBlock(
    battleSceneSource,
    '  _endBattle(type) {',
    '  _showP43ResultPreview(preview) {'
  );
  assert.ok(endBattleBlock.includes("_releaseBattleRuntimeObjects('battle-end')"), 'result transition should release battle runtime objects');
}

{
  const separateSurfaces = [
    ['_updatePlayerDangerPressureRim', '_clearPlayerDangerPressureRim'],
    ['_drawEnemyBodyContactPressureEdge', '_attachStage1EnemyReadabilityOutline'],
    ['_spawnImpactNoteFx', '_showWaveLabel'],
    ['_spawnChargeNoteFx', '_spawnImpactNoteFx'],
    ['_spawnCPositionPresentationFx', '_spawnEncorePresentationFx'],
    ['_spawnEncorePresentationFx', '_trackPresentationPolishFx'],
    ['_attachStage15PressureGraphics', '_attachStage1EnemyReadabilityOutline'],
  ];

  separateSurfaces.forEach(([start, end]) => {
    const block = sourceBlock(battleSceneSource, `  ${start}(`, `  ${end}(`);
    assert.equal(block.includes('_spawnPlayerHitBeatFlash'), false, `${start} should remain separate from player hit beat flash`);
  });
}

{
  const hitFlashSurface = [
    sourceBlock(battleSceneSource, 'const P15_165_PLAYER_HIT_BEAT_FLASH_DEPTH', 'const MOBILE_MOVE_ZONE_RIGHT'),
    sourceBlock(battleSceneSource, '  _spawnPlayerHitBeatFlash(x, y) {', '  _showWaveLabel(label) {'),
  ].join('\n');

  [
    'reward',
    'XP',
    'drop',
    'currency',
    'task',
    'red dot',
    'claim',
    'Stage 2',
    'shop',
    'gacha',
    'social',
    'backend',
    'analytics',
    'shield',
    'buff',
    'upgrade',
    'Setlist',
    'c_position_marker',
    'encore_marker',
  ].forEach((forbidden) => {
    assert.equal(hitFlashSurface.includes(forbidden), false, `hit beat flash surface must not add forbidden semantics: ${forbidden}`);
  });
}

{
  [
    'player_hit_beat_flash_source',
    'broken_pressure_rim_source',
    'low_hp_stage_noise_edge_source',
    'phase15-p15-142',
  ].forEach((forbidden) => {
    assert.equal(battleSceneSource.includes(forbidden), false, `runtime source must not reference P15-142 source art: ${forbidden}`);
  });

  [
    'P15_165_PLAYER_HIT_BEAT_FLASH',
    '_spawnPlayerHitBeatFlash',
  ].forEach((forbidden) => {
    assert.equal(stageWavesSource.includes(forbidden), false, `P15-166 must not change stage wave defs: ${forbidden}`);
    assert.equal(waveSystemSource.includes(forbidden), false, `P15-166 must not change WaveSystem: ${forbidden}`);
  });
}

{
  const stage1Defs = resolveStageWaveDefs({
    battleData: { stageId: 1 },
    waveDefs: baseWaveDefs,
    getStageById,
  });
  assert.deepEqual(stage1Defs, [], 'public Stage 1 uses the paint round');

  const stage1ReplayDefs = resolveStageWaveDefs({
    battleData: { stageId: 1, p47Stage1ReplayObjectiveIndex: 2 },
    waveDefs: baseWaveDefs,
    getStageById,
  });
  assert.deepEqual(stage1ReplayDefs, [], 'public replays stay on the paint round');

  const practiceDefs = resolveStageWaveDefs({
    battleData: { stageId: 1, practiceMode: true },
    waveDefs: baseWaveDefs,
    getStageById,
  });
  assert.equal(practiceDefs.length, 4);
  assert.deepEqual(practiceDefs.map((def) => def.interval), [3000, 2200, 500, 2200]);
  assert.deepEqual(practiceDefs[1].enemies, [{ type: STAGE_15_DRIFTING_LIGHTSTICK_TYPE, count: 2 }]);
  assert.deepEqual(practiceDefs[2].enemies, [
    { type: 'trainee', count: 1 },
    { type: STAGE_15_STAGE_MARKER_TARGET_TYPE, count: 1 },
  ]);
}

console.log('p15165 player hit beat flash: all assertions passed');
