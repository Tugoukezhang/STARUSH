import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as stageWaves from '../src/utils/stageWaves.mjs';

const stageWavesSource = readFileSync(
  new URL('../src/utils/stageWaves.mjs', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');
const waveSystemSource = readFileSync(
  new URL('../src/systems/WaveSystem.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');
const battleSceneSource = readFileSync(
  new URL('../src/scenes/BattleScene.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');

const ACTION_ID = 'stage1-wave-pressure-event';
const GAME_HEIGHT = 667;

function sourceBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

function compileClassMethod(block, methodName, globals = {}) {
  return Function(
    ...Object.keys(globals),
    `"use strict"; return ({${block.trim()}}).${methodName};`
  )(...Object.values(globals));
}

function compileWaveSystem() {
  const classSource = waveSystemSource
    .slice(waveSystemSource.indexOf('export class WaveSystem'))
    .replace('export class WaveSystem', 'class WaveSystem');
  const Phaser = { Utils: { Array: { Shuffle: (items) => items } } };
  return Function(
    'Phaser',
    'WAVE_DEFS',
    'getDisplayWaveNumber',
    'STAGE_1_PRACTICE_TARGET_TYPE',
    'STAGE_15_STAGE_MARKER_TARGET_TYPE',
    `"use strict"; ${classSource}; return WaveSystem;`
  )(
    Phaser,
    [],
    (current) => current + 1,
    'stage1PracticeTarget',
    'stage15StageMarkerTarget'
  );
}

function makeWaveHarness({ minActiveMs = 0 } = {}) {
  const timers = [];
  const scene = {
    time: {
      now: 0,
      delayedCall(delay, callback) {
        const timer = {
          delay,
          callback,
          removed: false,
          remove() { this.removed = true; },
        };
        timers.push(timer);
        return timer;
      },
    },
  };
  const WaveSystem = compileWaveSystem();
  const system = new WaveSystem(scene, () => {}, [{
    wave: 1,
    label: 'Wave 1',
    interval: 1100,
    minActiveMs,
    enemies: [{ type: 'trainee', count: 1 }],
  }]);
  return { scene, system, timers };
}

// Real RED: current WaveSystem has no pending-action arbitration and would clear
// as soon as enemiesRemaining reaches zero.
{
  const { system } = makeWaveHarness();
  assert.equal(
    typeof system.registerPendingWaveAction,
    'function',
    'WaveSystem must expose a narrow pending-action registration API'
  );
}

{
  const { system } = makeWaveHarness();
  let clears = 0;
  let token = null;
  system.onWaveStart = () => {
    token = system.registerPendingWaveAction(ACTION_ID);
  };
  system.onWaveClear = () => { clears += 1; };
  system.startNextWave();
  system.onEnemyKilled();
  assert.equal(clears, 0, 'enemies-first completion must wait for the authored action');
  assert.equal(system.resolvePendingWaveAction(token), true);
  assert.equal(clears, 1, 'resolving the exact action token should release the wave once');
  assert.equal(system.resolvePendingWaveAction(token), false, 'duplicate resolve must fail closed');
  assert.equal(clears, 1);
}

{
  const { system } = makeWaveHarness();
  let clears = 0;
  let token = null;
  system.onWaveStart = () => {
    token = system.registerPendingWaveAction(ACTION_ID);
  };
  system.onWaveClear = () => { clears += 1; };
  system.startNextWave();
  assert.equal(system.resolvePendingWaveAction(token), true);
  assert.equal(clears, 0, 'action-first completion must wait for remaining enemies');
  system.onEnemyKilled();
  assert.equal(clears, 1);
}

{
  const { scene, system } = makeWaveHarness({ minActiveMs: 1000 });
  let clears = 0;
  let token = null;
  system.onWaveStart = () => {
    token = system.registerPendingWaveAction(ACTION_ID);
  };
  system.onWaveClear = () => { clears += 1; };
  system.startNextWave();
  system.onEnemyKilled();
  system.resolvePendingWaveAction(token);
  assert.equal(clears, 0, 'minActiveMs must still hold after enemy/action completion');
  assert.equal(system.pendingWaveClearTimer?.delay, 1000);
  scene.time.now = 1000;
  system.pendingWaveClearTimer.callback();
  assert.equal(clears, 1);
}

{
  const { system } = makeWaveHarness();
  let token = null;
  system.onWaveStart = () => {
    token = system.registerPendingWaveAction(ACTION_ID);
    assert.equal(system.registerPendingWaveAction(ACTION_ID), null, 'duplicate action id must not mint a token');
  };
  system.startNextWave();
  assert.equal(system.cancelPendingWaveAction(token), true);
  assert.equal(system.cancelPendingWaveAction(token), false, 'duplicate cancel must fail closed');
  assert.equal(system.waveActive, true, 'teardown cancellation must not complete the wave');
  system.destroy();
  assert.equal(system.pendingWaveActions.size, 0, 'destroy should clear pending action ownership');
}

const baseWaveDefs = [
  { wave: 1, label: 'Wave 1', interval: 1800, enemies: [{ type: 'trainee', count: 4 }] },
  { wave: 2, label: 'Wave 2', interval: 1600, enemies: [{ type: 'trainee', count: 5 }] },
];
const getStageById = (stageId) => ({ id: Number(stageId), name: `Stage ${stageId}`, waves: 2 });

{
  assert.equal(stageWaves.STAGE_1_WAVE_PRESSURE_ACTION_ID, ACTION_ID);
  const normal = stageWaves.resolveStageWaveDefs({
    battleData: { stageId: 1, practiceMode: false },
    waveDefs: baseWaveDefs,
    getStageById,
  });
  assert.deepEqual(normal, [], 'public Stage 1 no longer authors kill-wave pressure events');

  const thirdReplay = stageWaves.resolveStageWaveDefs({
    battleData: { stageId: 1, practiceMode: false, stage1ReplayObjectiveIndex: 2 },
    waveDefs: baseWaveDefs,
    getStageById,
  });
  assert.deepEqual(thirdReplay, [], 'public replays stay on the paint round');

  const hiddenPractice = stageWaves.resolveStageWaveDefs({
    battleData: { stageId: 1, practiceMode: true },
    waveDefs: baseWaveDefs,
    getStageById,
  });
  assert.equal(hiddenPractice.length, 4);
  assert.equal(hiddenPractice.some((def) => 'waveAction' in def), false);
}

{
  const announceMs = 240;
  const commitMs = 180;
  const originY = 72;
  const pressureRowY = GAME_HEIGHT - 80;
  const speed = 450;
  const budgetMs = 1800;
  const path = pressureRowY - originY;
  const travelMs = path / speed * 1000;
  assert.ok(announceMs + commitMs + travelMs <= budgetMs);
  assert.equal(path, 515);
  assert.ok(23 <= 250 * (travelMs / 1000));
  assert.ok(travelMs - 92 > 0, 'late-response window must remain nonzero');
}

{
  const scheduleBlock = sourceBlock(
    battleSceneSource,
    '  _scheduleStage1WavePressureEvent(waveIndex) {',
    '  _beginStage1WavePressureEvent(state) {'
  );
  const captureBlock = sourceBlock(
    battleSceneSource,
    '  _captureStage1WavePressureLane(state) {',
    '  _releaseStage1WavePressurePulse(state) {'
  );
  const actualMotionBlock = sourceBlock(
    battleSceneSource,
    '  _getStage1WavePressureHorizontalVelocity() {',
    '  _captureStage1WavePressureLane(state) {'
  );
  const releaseBlock = sourceBlock(
    battleSceneSource,
    '  _releaseStage1WavePressurePulse(state) {',
    '  _updateStage1WavePressureEvent() {'
  );
  const consumeBlock = sourceBlock(
    battleSceneSource,
    '  _consumeStage1WavePressurePulse(pulse, reason) {',
    '  _resolveStage1WavePressureEvent(state, reason) {'
  );
  const resolveBlock = sourceBlock(
    battleSceneSource,
    '  _resolveStage1WavePressureEvent(state, reason) {',
    '  _clearStage1WavePressureEvent('
  );

  assert.ok(scheduleBlock.includes('registerPendingWaveAction'));
  assert.ok(scheduleBlock.includes('def.enemies.reduce'));
  assert.ok(scheduleBlock.includes('slotCount * def.interval + action.postSpawnLeadMs'));
  assert.ok(captureBlock.includes('_resolveStage1WavePressureCapturedX(state)'));
  assert.ok(actualMotionBlock.includes('deltaXFinal()'));
  assert.ok(actualMotionBlock.includes('_lastPlayerMotionFrameDeltaMs'));
  assert.ok(actualMotionBlock.includes('P15_260_STAGE1_WAVE_PRESSURE_CAPTURE_TO_RELEASE_MS'));
  assert.ok(actualMotionBlock.includes('P15_260_STAGE1_WAVE_PRESSURE_PULSE_SPEED'));
  assert.equal(releaseBlock.includes('this.player.x'), false, 'release must use the committed captured X');
  assert.ok(releaseBlock.includes('state.capturedX'));
  assert.ok(releaseBlock.includes('this.enemyBullets.add(pulse)'));
  assert.ok(releaseBlock.includes('pulse.moveVx = 0'));
  assert.ok(releaseBlock.includes('pulse.moveVy = P15_260_STAGE1_WAVE_PRESSURE_PULSE_SPEED'));
  assert.ok(consumeBlock.includes('pulse !== state.pulse'), 'hit consumption must reject non-owned pulse identity');
  assert.equal(consumeBlock.includes('Distance.Between'), false);
  assert.ok(resolveBlock.includes('resolvePendingWaveAction'));

  const consumePulse = compileClassMethod(
    consumeBlock,
    '_consumeStage1WavePressurePulse',
    {
      STAGE_1_WAVE_PRESSURE_ACTION_ID: ACTION_ID,
      COMBAT_OBJECT_OWNERS: {
        PUBLIC_STAGE_PRESSURE_PROJECTILE: 'publicStagePressureProjectile',
      },
    }
  );
  const ownedPulse = {
    active: true,
    p15Stage1WavePressureOwner: ACTION_ID,
    p15Stage1WavePressureConsumed: false,
    gfx: { active: true, destroy() { this.active = false; } },
    destroy() { this.active = false; },
  };
  const unrelatedPulse = {
    active: true,
    p15Stage1WavePressureOwner: ACTION_ID,
    p15Stage1WavePressureConsumed: false,
    destroy() { this.active = false; },
  };
  const state = { pulse: ownedPulse, pulseGfx: ownedPulse.gfx };
  const scene = {
    _stage1WavePressureEvent: state,
    _resolveStage1WavePressureEvent(resolvedState, reason) {
      this.resolved = [resolvedState, reason];
      return true;
    },
    _disposeEnemyProjectile(pulse) {
      if (pulse.p16Disposed === true) return false;
      pulse.p16Disposed = true;
      pulse.gfx?.destroy?.();
      pulse.gfx = null;
      pulse.destroy?.();
      return true;
    },
  };
  assert.equal(consumePulse.call(scene, unrelatedPulse, 'hit'), false);
  assert.equal(unrelatedPulse.active, true, 'same-tag unrelated bullets must survive');
  assert.equal(consumePulse.call(scene, ownedPulse, 'hit'), true);
  assert.deepEqual(scene.resolved, [state, 'hit']);
  assert.equal(ownedPulse.active, false);
  assert.equal(consumePulse.call(scene, ownedPulse, 'hit'), false, 'repeat consumption must be idempotent');

  const startDelays = [[2, 1100, 2700], [3, 900, 3200], [4, 900, 4100]];
  startDelays.forEach(([slots, interval, expected]) => {
    assert.equal(slots * interval + 500, expected);
  });
}

{
  const hitBlock = sourceBlock(
    battleSceneSource,
    '  _onEnemyHitPlayer(sourceBullet = null) {',
    '  _getPlayerVisualTarget() {'
  );
  const publicConsume = hitBlock.indexOf("this._consumeStage1WavePressurePulse?.(arguments[0], 'hit');");
  const hiddenConsume = hitBlock.indexOf("this._consumeP15HostileProjectile(sourceBullet, 'hit');");
  const battleGuard = hitBlock.indexOf('if (this._battleEnded) return;');
  assert.ok(publicConsume >= 0 && publicConsume < hiddenConsume);
  assert.ok(publicConsume < battleGuard);
}

{
  const lifecycle = sourceBlock(
    battleSceneSource,
    "this.events.once('shutdown'",
    'const sceneData = normalizeBattleData'
  );
  const callbacks = sourceBlock(
    battleSceneSource,
    '    this.waveSystem.onWaveStart =',
    '    this.waveSystem.onInterWaveBreak ='
  );
  const assist = sourceBlock(
    battleSceneSource,
    '  _scheduleFirstPlayWaveAssist(waveIndex) {',
    '  _onAllWavesClear() {'
  );
  const endBattle = sourceBlock(
    battleSceneSource,
    '  _endBattle(type) {',
    '  _showP43ResultPreview(preview) {'
  );
  const resultActions = sourceBlock(
    battleSceneSource,
    '  _handleBattleResultAction(action) {',
    '  _switchForm() {'
  );
  const releaseBlock = sourceBlock(
    battleSceneSource,
    "  _releaseBattleRuntimeObjects(reason = 'unspecified') {",
    '  _clearActivePlayerBulletGraphics() {'
  );
  assert.ok(releaseBlock.includes('_clearStage1WavePressureEvent'));
  assert.ok(lifecycle.includes("_releaseBattleRuntimeObjects('shutdown')"));
  assert.ok(callbacks.includes('_scheduleStage1WavePressureEvent(idx)'));
  assert.ok(callbacks.includes('_clearStage1WavePressureEvent'));
  assert.equal(
    assist.includes('enemy.destroy()'),
    false,
    'first-play assist must not auto-destroy Wave 1 enemies'
  );
  assert.ok(endBattle.indexOf("_releaseBattleRuntimeObjects('battle-end')") < endBattle.indexOf('this.physics.pause()'));
  assert.ok(resultActions.includes("_releaseBattleRuntimeObjects('result-retry')"));
  assert.ok(resultActions.includes("_releaseBattleRuntimeObjects('result-title')"));
}

{
  const eventSurface = [
    sourceBlock(
      battleSceneSource,
      'const P15_260_STAGE1_WAVE_PRESSURE_ANNOUNCE_TO_CAPTURE_MS',
      'const P15_229_KAI_BEAT_STEP_DISTANCE_PX'
    ),
    sourceBlock(
      battleSceneSource,
      '  _scheduleStage1WavePressureEvent(waveIndex) {',
      '  _isP15HostileProjectileExperimentEnabled() {'
    ),
  ].join('\n');
  [
    'load.image', "'.png'", "'.wav'", "'.mp3'", "'.ogg'", 'preload', 'registry',
    'P15_234_', 'p15HostileProjectile', '_enemyShoot', 'localStorage',
    'Center Cue', 'Boss', 'Stage 2', 'reward', 'task', 'shop', 'gacha', 'backend',
  ].forEach((forbidden) => {
    assert.equal(eventSurface.includes(forbidden), false, `public event surface must exclude: ${forbidden}`);
  });
  assert.equal(stageWavesSource.includes('p15HostileProjectileExperiment'), false);
}

console.log('p15259 public Stage 1 wave-authored pressure event contract: all assertions passed');
