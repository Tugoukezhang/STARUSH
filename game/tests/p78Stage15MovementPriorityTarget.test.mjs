import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolveStageWaveDefs,
  STAGE_1_PRACTICE_TARGET_TYPE,
  STAGE_15_DRIFTING_LIGHTSTICK_TYPE,
  STAGE_15_STAGE_MARKER_TARGET_TYPE,
} from '../src/utils/stageWaves.mjs';

const stageWavesSource = readFileSync(new URL('../src/utils/stageWaves.mjs', import.meta.url), 'utf8');
const waveSystemSource = readFileSync(new URL('../src/systems/WaveSystem.js', import.meta.url), 'utf8');
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

function sourceBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

{
  assert.equal(STAGE_15_DRIFTING_LIGHTSTICK_TYPE, 'stage15DriftingLightstick');
  assert.equal(STAGE_15_STAGE_MARKER_TARGET_TYPE, 'stage15StageMarkerTarget');
}

{
  const defs = resolveStageWaveDefs({
    battleData: { stageId: 1, practiceMode: true },
    waveDefs: baseWaveDefs,
    getStageById,
  });

  assert.equal(defs.length, 4, 'Stage 1.5 hidden practice should use four active practice segments');
  assert.deepEqual(defs.map((def) => def.interval), [3000, 2200, 500, 2200]);
  assert.deepEqual(defs.map((def) => def.minActiveMs), [9000, 12000, 8000, 10000]);
  const estimatedPracticeMs = 3000 + defs.reduce((sum, def) => sum + def.minActiveMs, 0) + 3000 * defs.length;
  assert.ok(estimatedPracticeMs >= 50000, 'practice tuning should not collapse below the 35-60s lesson shape');
  assert.ok(estimatedPracticeMs <= 58000, 'practice tuning should land in the recommended 50-58s band');
  assert.deepEqual(defs[0].enemies, [{ type: 'trainee', count: 2 }]);
  assert.deepEqual(defs[1].enemies, [{ type: STAGE_15_DRIFTING_LIGHTSTICK_TYPE, count: 2 }]);
  assert.deepEqual(defs[2].enemies, [
    { type: 'trainee', count: 1 },
    { type: STAGE_15_STAGE_MARKER_TARGET_TYPE, count: 1 },
  ]);
  assert.deepEqual(defs[3].enemies, [{ type: STAGE_1_PRACTICE_TARGET_TYPE, count: 1 }]);
}

{
  [
    { stageId: 1, practiceMode: false, p47Stage1ReplayObjectiveIndex: 2 },
    { stageId: 1, p47Stage1ReplayObjectiveIndex: 2 },
    { stageId: 2, practiceMode: true },
  ].forEach((battleData) => {
    const defs = resolveStageWaveDefs({ battleData, waveDefs: baseWaveDefs, getStageById });
    const types = defs.flatMap((def) => def.enemies.map((enemy) => enemy.type));
    assert.equal(types.includes(STAGE_15_DRIFTING_LIGHTSTICK_TYPE), false);
    assert.equal(types.includes(STAGE_15_STAGE_MARKER_TARGET_TYPE), false);
  });
}

{
  const anchorBlock = sourceBlock(
    waveSystemSource,
    'const anchorLastTypes = new Set',
    'const regulars = this.spawnQueue.filter'
  );
  assert.ok(anchorBlock.includes('STAGE_1_PRACTICE_TARGET_TYPE'));
  assert.ok(anchorBlock.includes('STAGE_15_STAGE_MARKER_TARGET_TYPE'));
  assert.equal(anchorBlock.includes('STAGE_15_DRIFTING_LIGHTSTICK_TYPE'), false);
}

{
  const spawnMethod = sourceBlock(
    battleSceneSource,
    '  _spawnEnemyByType(type) {',
    '  _attachStage1EnemyReadabilityOutline'
  );
  assert.ok(spawnMethod.includes('STAGE_15_DRIFTING_LIGHTSTICK_TYPE'));
  assert.ok(spawnMethod.includes('STAGE_15_STAGE_MARKER_TARGET_TYPE'));
  assert.ok(spawnMethod.includes('this._isStage15PracticeMode() === true'));
  assert.ok(spawnMethod.includes('STAGE_15_STAGE_MARKER_TARGET_ENTRY_Y'));
  assert.ok(spawnMethod.includes('STAGE_15_STAGE_MARKER_TARGET_ENTRY_Y'));
  assert.ok(spawnMethod.includes('Number.isFinite(opts.y)'));
  assert.ok(spawnMethod.includes('this.physics.add.sprite(x, spawnY, texKey)'));
  assert.ok(spawnMethod.includes('stage15PracticeOnly'));
  assert.ok(spawnMethod.includes('stage15DisableBottomChase'));
  assert.ok(spawnMethod.includes('supportValueOverride = 0'));

  const shootBlock = sourceBlock(
    spawnMethod,
    "if (enemyType === 'anti' || enemyType === 'boss' || enemyType === 'miniboss')",
    'this.time.delayedCall(120000'
  );
  assert.equal(shootBlock.includes('STAGE_15_DRIFTING_LIGHTSTICK_TYPE'), false);
  assert.equal(shootBlock.includes('STAGE_15_STAGE_MARKER_TARGET_TYPE'), false);
  assert.equal(shootBlock.includes('_enemyShoot'), true);
}

{
  const graphicsBlock = sourceBlock(
    battleSceneSource,
    '  _attachStage15PressureGraphics(enemy, enemyType, radius) {',
    '  _attachStage1EnemyReadabilityOutline'
  );
  assert.ok(graphicsBlock.includes('this.add.graphics()'));
  assert.ok(graphicsBlock.includes('fillRoundedRect'));
  assert.ok(graphicsBlock.includes('strokeCircle'));
  assert.equal(graphicsBlock.includes('this.add.image'), false);
  assert.equal(graphicsBlock.includes('.png'), false);
}

{
  const movementBlock = sourceBlock(
    battleSceneSource,
    'const BATTLE_FLOOR = GAME_HEIGHT - 60;',
    'if (this.bpmBar)'
  );
  assert.ok(movementBlock.includes('stage15DisableBottomChase === true'));
  assert.ok(movementBlock.includes('STAGE_15_BOTTOM_CHASE_GUARD_Y'));
  assert.ok(movementBlock.includes('return;'));
}

{
  const shutdownBlock = sourceBlock(
    battleSceneSource,
    "this.events.once('shutdown'",
    'const sceneData = normalizeBattleData'
  );
  const killBlock = sourceBlock(
    battleSceneSource,
    '  _onEnemyKilled(enemy, killColor) {',
    '  _onEnemyHitPlayer(sourceBullet = null)'
  );
  const endBattleBlock = sourceBlock(
    battleSceneSource,
    '  _endBattle(type) {',
    '  _showP43ResultPreview(preview) {'
  );
  const releaseBlock = sourceBlock(
    battleSceneSource,
    "  _releaseBattleRuntimeObjects(reason = 'unspecified') {",
    '  _clearActivePlayerBulletGraphics() {'
  );
  assert.ok(releaseBlock.includes('_clearStage15PressureGraphics'));
  assert.ok(shutdownBlock.includes("_releaseBattleRuntimeObjects('shutdown')"));
  assert.ok(killBlock.includes('Number.isFinite(enemy.score)'));
  assert.ok(killBlock.includes('Number.isFinite(enemy.supportValueOverride)'));
  assert.ok(killBlock.includes('_clearStage15PressureGraphics(enemy)'));
  assert.ok(endBattleBlock.includes("_releaseBattleRuntimeObjects('battle-end')"));
}

{
  const forbiddenAssetRefs = [
    'drifting_lightstick.png',
    'stage_marker_target.png',
    'c_position_marker',
    'encore_marker',
  ];
  const runtimeSource = `${stageWavesSource}\n${waveSystemSource}\n${battleSceneSource}`;
  forbiddenAssetRefs.forEach((forbidden) => {
    assert.equal(runtimeSource.includes(forbidden), false, `must not reference forbidden asset: ${forbidden}`);
  });

  [
    'Stage 2',
    'reward',
    'XP',
    '浠诲姟',
    '绾㈢偣',
    'shop',
    'gacha',
    'social',
    'backend',
    'analytics',
  ].forEach((forbidden) => {
    assert.equal(runtimeSource.includes(forbidden), false, `must not add forbidden surface: ${forbidden}`);
  });
}
