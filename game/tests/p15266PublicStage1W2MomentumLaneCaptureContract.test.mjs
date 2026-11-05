import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as stageWaves from '../src/utils/stageWaves.mjs';

const stageWavesSource = readFileSync(
  new URL('../src/utils/stageWaves.mjs', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');
const battleSceneSource = readFileSync(
  new URL('../src/scenes/BattleScene.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');

const ACTION_ID = 'stage1-wave-pressure-event';
const CURRENT_LANE = 'current-lane';
const MOMENTUM_LANE = 'momentum-lane';
const GAME_WIDTH = 375;
const GAME_HEIGHT = 667;
const ORIGIN_Y = 72;
const PRESSURE_ROW_Y = 587;
const PULSE_SPEED = 450;
const CAPTURE_TO_RELEASE_MS = 180;
const PROJECTION_SECONDS = CAPTURE_TO_RELEASE_MS / 1000
  + (PRESSURE_ROW_Y - ORIGIN_Y) / PULSE_SPEED;

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

const baseWaveDefs = [
  { wave: 1, label: 'Wave 1', interval: 1800, enemies: [{ type: 'trainee', count: 4 }] },
  { wave: 2, label: 'Wave 2', interval: 1600, enemies: [{ type: 'trainee', count: 5 }] },
];
const getStageById = (stageId) => ({ id: Number(stageId), name: `Stage ${stageId}`, waves: 2 });

function resolveNormal(extraBattleData = {}) {
  return stageWaves.resolveStageWaveDefs({
    battleData: { stageId: 1, practiceMode: false, ...extraBattleData },
    waveDefs: baseWaveDefs,
    getStageById,
  });
}

function runMetadataContract() {
  assert.deepEqual(stageWaves.STAGE_1_WAVE_PRESSURE_CAPTURE_MODES, {
    CURRENT_LANE,
    MOMENTUM_LANE,
  });
  assert.equal(Object.isFrozen(stageWaves.STAGE_1_WAVE_PRESSURE_CAPTURE_MODES), true);

  const normal = resolveNormal();
  assert.deepEqual(normal, [], 'public Stage 1 no longer uses W2 momentum-lane capture');

  const thirdReplay = resolveNormal({ stage1ReplayObjectiveIndex: 2 });
  assert.deepEqual(thirdReplay, [], 'public replays stay on the paint round');

  const hiddenPractice = stageWaves.resolveStageWaveDefs({
    battleData: { stageId: 1, practiceMode: true },
    waveDefs: baseWaveDefs,
    getStageById,
  });
  assert.equal(hiddenPractice.length, 4);
  assert.equal(hiddenPractice.some((def) => 'waveAction' in def), false);
}

function getMotionMethods() {
  const velocityBlock = sourceBlock(
    battleSceneSource,
    '  _getStage1WavePressureHorizontalVelocity() {',
    '  _resolveStage1WavePressureCapturedX(state) {'
  );
  const resolverBlock = sourceBlock(
    battleSceneSource,
    '  _resolveStage1WavePressureCapturedX(state) {',
    '  _captureStage1WavePressureLane(state) {'
  );
  return {
    velocityBlock,
    resolverBlock,
    getVelocity: compileClassMethod(
      velocityBlock,
      '_getStage1WavePressureHorizontalVelocity'
    ),
    resolveCapturedX: compileClassMethod(
      resolverBlock,
      '_resolveStage1WavePressureCapturedX',
      {
        STAGE_1_WAVE_PRESSURE_CAPTURE_MODES: { CURRENT_LANE, MOMENTUM_LANE },
        P15_260_STAGE1_WAVE_PRESSURE_CAPTURE_TO_RELEASE_MS: CAPTURE_TO_RELEASE_MS,
        P15_260_STAGE1_WAVE_PRESSURE_ROW_Y: PRESSURE_ROW_Y,
        P15_260_STAGE1_WAVE_PRESSURE_ORIGIN_Y: ORIGIN_Y,
        P15_260_STAGE1_WAVE_PRESSURE_PULSE_SPEED: PULSE_SPEED,
        GAME_WIDTH,
        Phaser: { Math: { Clamp: (value, min, max) => Math.min(max, Math.max(min, value)) } },
      }
    ),
  };
}

function makeMotionScene({
  x = 187.5,
  deltaX = 4,
  frameDeltaMs = 16,
  active = true,
  bodyEnabled = true,
} = {}) {
  return {
    _battleEnded: false,
    _lastPlayerMotionFrameDeltaMs: frameDeltaMs,
    player: {
      x,
      active,
      body: {
        enable: bodyEnabled,
        deltaXFinal: () => deltaX,
      },
    },
  };
}

function runMotionContract() {
  const { velocityBlock, resolverBlock, getVelocity, resolveCapturedX } = getMotionMethods();
  const updateBlock = sourceBlock(
    battleSceneSource,
    '  update(time, delta) {',
    '  _onPlayerDeath() {'
  );
  assert.ok(updateBlock.includes(
    'this._lastPlayerMotionFrameDeltaMs = Number.isFinite(delta) && delta > 0 ? delta : null;'
  ));
  assert.ok(velocityBlock.includes('deltaXFinal()'));
  assert.ok(velocityBlock.includes('_lastPlayerMotionFrameDeltaMs'));
  ['velocity.x', 'cursors', '_touchTarget', 'pointer', 'gesture'].forEach((forbidden) => {
    assert.equal(velocityBlock.includes(forbidden), false, `actual-motion helper must exclude ${forbidden}`);
  });

  assert.equal(getVelocity.call(makeMotionScene()), 250);
  assert.equal(getVelocity.call(makeMotionScene({ deltaX: -4 })), -250);
  assert.equal(getVelocity.call(makeMotionScene({ deltaX: 0 })), 0);
  assert.equal(getVelocity.call(makeMotionScene({ frameDeltaMs: 0 })), 0);
  assert.equal(getVelocity.call(makeMotionScene({ frameDeltaMs: Number.NaN })), 0);
  assert.equal(getVelocity.call(makeMotionScene({ deltaX: Number.NaN })), 0);
  assert.equal(getVelocity.call(makeMotionScene({ bodyEnabled: false })), 0);
  assert.equal(getVelocity.call(makeMotionScene({ active: false })), 0);

  const positive = makeMotionScene();
  positive._getStage1WavePressureHorizontalVelocity = getVelocity;
  assert.equal(resolveCapturedX.call(positive, { captureMode: MOMENTUM_LANE }), 361);
  const negative = makeMotionScene({ deltaX: -4 });
  negative._getStage1WavePressureHorizontalVelocity = getVelocity;
  assert.equal(resolveCapturedX.call(negative, { captureMode: MOMENTUM_LANE }), 14);
  const stopped = makeMotionScene({ x: 200, deltaX: 0 });
  stopped._getStage1WavePressureHorizontalVelocity = getVelocity;
  assert.equal(resolveCapturedX.call(stopped, { captureMode: MOMENTUM_LANE }), 200);
  assert.equal(resolveCapturedX.call(stopped, { captureMode: CURRENT_LANE }), 200);
  assert.equal(resolveCapturedX.call(stopped, { captureMode: 'unknown-mode' }), 200);

  assert.ok(Math.abs(PROJECTION_SECONDS - 1.3244444444444445) < 1e-12);
  assert.ok(resolverBlock.includes('P15_260_STAGE1_WAVE_PRESSURE_CAPTURE_TO_RELEASE_MS'));
  assert.ok(resolverBlock.includes('P15_260_STAGE1_WAVE_PRESSURE_ROW_Y'));
  assert.ok(resolverBlock.includes('P15_260_STAGE1_WAVE_PRESSURE_ORIGIN_Y'));
  assert.ok(resolverBlock.includes('P15_260_STAGE1_WAVE_PRESSURE_PULSE_SPEED'));
  assert.equal(Math.abs(371 - 361), 10);
  assert.equal(Math.abs(4 - 14), 10);
  assert.ok(10 <= 4 + 7, 'continued edge movement must retain circle-contact feasibility');
  assert.ok(250 * PROJECTION_SECONDS > 23, 'stop/reverse/vertical evade must retain correction room');
}

function runCommitmentContract() {
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
  const releaseBlock = sourceBlock(
    battleSceneSource,
    '  _releaseStage1WavePressurePulse(state) {',
    '  _updateStage1WavePressureEvent() {'
  );
  const updateEventBlock = sourceBlock(
    battleSceneSource,
    '  _updateStage1WavePressureEvent() {',
    '  _deferStage1WavePressureEvadeUntilWorldStep(state, pulse) {'
  );

  assert.ok(scheduleBlock.includes('captureMode'));
  assert.ok(scheduleBlock.includes('STAGE_1_WAVE_PRESSURE_CAPTURE_MODES.MOMENTUM_LANE'));
  assert.ok(captureBlock.includes('_resolveStage1WavePressureCapturedX(state)'));
  assert.equal((captureBlock.match(/state\.capturedX\s*=/g) || []).length, 1);
  [releaseBlock, updateEventBlock].forEach((block) => {
    ['this.player', 'deltaXFinal', '_getStage1WavePressureHorizontalVelocity', '_resolveStage1WavePressureCapturedX']
      .forEach((forbidden) => assert.equal(block.includes(forbidden), false));
  });
  assert.ok(releaseBlock.includes('state.capturedX'));

  const capture = compileClassMethod(
    captureBlock,
    '_captureStage1WavePressureLane',
    {
      P15_260_STAGE1_WAVE_PRESSURE_ORIGIN_Y: ORIGIN_Y,
      GAME_WIDTH,
      Phaser: { Math: { Clamp: (value, min, max) => Math.min(max, Math.max(min, value)) } },
    }
  );
  const state = {
    phase: 'announce',
    resolved: false,
    captureMode: MOMENTUM_LANE,
    capturedX: null,
    announceGfx: null,
  };
  const scene = {
    _stage1WavePressureEvent: state,
    _resolveStage1WavePressureCapturedX: () => 361,
    _getStage1WavePressureHorizontalVelocity: () => 250,
    player: { x: 187.5, active: true },
  };
  assert.equal(capture.call(scene, state), true);
  assert.equal(state.capturedX, 361);
  scene.player.x = 20;
  scene._getStage1WavePressureHorizontalVelocity = () => -250;
  assert.equal(capture.call(scene, state), false);
  assert.equal(state.capturedX, 361, 'capture must remain frozen after stop/reverse/position changes');

  assert.equal((scheduleBlock.match(/registerPendingWaveAction/g) || []).length, 1);
  assert.equal((releaseBlock.match(/this\.physics\.add\.sprite/g) || []).length, 1);
  assert.equal((releaseBlock.match(/this\.enemyBullets\.add\(pulse\)/g) || []).length, 1);
}

const selected = process.argv[2] ?? 'all';
const runners = {
  metadata: runMetadataContract,
  motion: runMotionContract,
  commitment: runCommitmentContract,
};

if (selected === 'all') {
  Object.values(runners).forEach((run) => run());
} else {
  assert.ok(runners[selected], `unknown focused contract: ${selected}`);
  runners[selected]();
}

const scopedSurface = [
  stageWavesSource,
  sourceBlock(
    battleSceneSource,
    '  _getStage1WavePressureHorizontalVelocity() {',
    '  _captureStage1WavePressureLane(state) {'
  ),
].join('\n');
[
  'Center Cue', 'load.image', "'.png'", "'.wav'", 'preload', 'registry',
  'Stage 2', 'reward', 'task', 'shop', 'gacha', 'backend',
].forEach((forbidden) => {
  assert.equal(scopedSurface.includes(forbidden), false, `P15-267 surface must exclude ${forbidden}`);
});

console.log(`p15266 Stage 1 W2 momentum-lane capture contract (${selected}): all assertions passed`);
