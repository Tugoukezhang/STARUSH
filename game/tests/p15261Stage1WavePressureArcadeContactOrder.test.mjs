import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/scenes/BattleScene.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');

const ACTION_ID = 'stage1-wave-pressure-event';
const WORLD_STEP = 'worldstep';
const PRESSURE_ROW_Y = 587;

function sourceBlock(startNeedle, endNeedle) {
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

function makeWorld() {
  const listeners = new Map();
  let registrationCount = 0;
  return {
    once(event, callback) {
      registrationCount += 1;
      const entries = listeners.get(event) || [];
      entries.push(callback);
      listeners.set(event, entries);
      return this;
    },
    off(event, callback) {
      const entries = listeners.get(event) || [];
      listeners.set(event, entries.filter((entry) => entry !== callback));
      return this;
    },
    emit(event) {
      const entries = listeners.get(event) || [];
      listeners.set(event, []);
      entries.forEach((callback) => callback());
    },
    listenerCount(event) {
      return (listeners.get(event) || []).length;
    },
    get registrationCount() {
      return registrationCount;
    },
  };
}

function makeNode() {
  return {
    active: true,
    destroyCount: 0,
    destroy() {
      this.destroyCount += 1;
      this.active = false;
    },
  };
}

const updateBlock = sourceBlock(
  '  _updateStage1WavePressureEvent() {',
  '  _deferStage1WavePressureEvadeUntilWorldStep(state, pulse) {'
);
const updatePressureEvent = compileClassMethod(
  updateBlock,
  '_updateStage1WavePressureEvent',
  { P15_260_STAGE1_WAVE_PRESSURE_ROW_Y: PRESSURE_ROW_Y }
);

// The pre-fix implementation fails here because crossing the row consumes the
// pulse as evaded immediately, before another Arcade physics step can overlap.
{
  const pulse = {
    active: true,
    x: 188,
    y: 590,
    p15Stage1WavePressureConsumed: false,
  };
  const state = { phase: 'travel', resolved: false, capturedX: 188, pulse };
  const consumed = [];
  const deferred = [];
  const scene = {
    _stage1WavePressureEvent: state,
    _consumeStage1WavePressurePulse(target, reason) {
      consumed.push([target, reason]);
    },
    _deferStage1WavePressureEvadeUntilWorldStep(targetState, targetPulse) {
      deferred.push([targetState, targetPulse]);
      return true;
    },
  };
  updatePressureEvent.call(scene);
  assert.deepEqual(
    consumed,
    [],
    'reaching the pressure row must not resolve evaded before the next Arcade physics step'
  );
  assert.deepEqual(deferred, [[state, pulse]]);
}

const deferBlock = sourceBlock(
  '  _deferStage1WavePressureEvadeUntilWorldStep(state, pulse) {',
  '  _clearStage1WavePressureEvadeWorldStep(state) {'
);
const clearListenerBlock = sourceBlock(
  '  _clearStage1WavePressureEvadeWorldStep(state) {',
  '  _consumeStage1WavePressurePulse(pulse, reason) {'
);
const consumeBlock = sourceBlock(
  '  _consumeStage1WavePressurePulse(pulse, reason) {',
  '  _resolveStage1WavePressureEvent(state, reason) {'
);
const resolveBlock = sourceBlock(
  '  _resolveStage1WavePressureEvent(state, reason) {',
  '  _clearStage1WavePressureEvent('
);
const clearEventBlock = sourceBlock(
  '  _clearStage1WavePressureEvent(',
  '  _isP15HostileProjectileExperimentEnabled() {'
);

const Phaser = {
  Physics: { Arcade: { Events: { WORLD_STEP } } },
};
const globals = {
  Phaser,
  P15_260_STAGE1_WAVE_PRESSURE_ROW_Y: PRESSURE_ROW_Y,
  STAGE_1_WAVE_PRESSURE_ACTION_ID: ACTION_ID,
  COMBAT_OBJECT_OWNERS: {
    PUBLIC_STAGE_PRESSURE_PROJECTILE: 'publicStagePressureProjectile',
  },
};
const deferEvade = compileClassMethod(
  deferBlock,
  '_deferStage1WavePressureEvadeUntilWorldStep',
  globals
);
const clearListener = compileClassMethod(
  clearListenerBlock,
  '_clearStage1WavePressureEvadeWorldStep',
  globals
);
const consumePulse = compileClassMethod(
  consumeBlock,
  '_consumeStage1WavePressurePulse',
  globals
);
const resolveEvent = compileClassMethod(
  resolveBlock,
  '_resolveStage1WavePressureEvent',
  globals
);
const clearEvent = compileClassMethod(
  clearEventBlock,
  '_clearStage1WavePressureEvent',
  globals
);

function makeHarness() {
  const world = makeWorld();
  const gfx = makeNode();
  gfx.x = 0;
  gfx.y = 0;
  gfx.setPosition = function setPosition(x, y) {
    this.x = x;
    this.y = y;
    return this;
  };
  const pulse = makeNode();
  pulse.x = 191;
  pulse.y = 591;
  pulse.moveVx = 0;
  pulse.moveVy = 450;
  pulse.gfx = gfx;
  pulse.p15Stage1WavePressureOwner = ACTION_ID;
  pulse.p15Stage1WavePressureConsumed = false;
  pulse.body = {
    resetCalls: [],
    reset(x, y) {
      this.resetCalls.push([x, y]);
    },
  };
  const token = { id: ACTION_ID };
  const state = {
    phase: 'travel',
    resolved: false,
    capturedX: 187,
    waveActionToken: token,
    startTimer: null,
    captureTimer: null,
    releaseTimer: null,
    expiryTimer: null,
    announceGfx: null,
    pulse,
    pulseGfx: gfx,
    evadeWorldStepHandler: null,
  };
  const resolvedTokens = [];
  const cancelledTokens = [];
  const scene = {
    physics: { world },
    _stage1WavePressureEvent: state,
    waveSystem: {
      resolvePendingWaveAction(value) {
        resolvedTokens.push(value);
        return true;
      },
      cancelPendingWaveAction(value) {
        cancelledTokens.push(value);
        return true;
      },
    },
    _deferStage1WavePressureEvadeUntilWorldStep(targetState, targetPulse) {
      return deferEvade.call(this, targetState, targetPulse);
    },
    _clearStage1WavePressureEvadeWorldStep(targetState) {
      return clearListener.call(this, targetState);
    },
    _consumeStage1WavePressurePulse(targetPulse, reason) {
      return consumePulse.call(this, targetPulse, reason);
    },
    _resolveStage1WavePressureEvent(targetState, reason) {
      return resolveEvent.call(this, targetState, reason);
    },
    _disposeEnemyProjectile(targetPulse) {
      if (targetPulse.p16Disposed === true) return false;
      targetPulse.p16Disposed = true;
      targetPulse.gfx?.destroy?.();
      targetPulse.gfx = null;
      targetPulse.destroy?.();
      return true;
    },
  };
  return {
    scene,
    state,
    pulse,
    gfx,
    world,
    resolvedTokens,
    cancelledTokens,
  };
}

{
  const harness = makeHarness();
  assert.equal(deferEvade.call(harness.scene, harness.state, harness.pulse), true);
  assert.equal(harness.state.phase, 'awaiting-contact-step');
  assert.equal(harness.pulse.x, harness.state.capturedX);
  assert.equal(harness.pulse.y, PRESSURE_ROW_Y);
  assert.equal(harness.pulse.moveVx, 0);
  assert.equal(harness.pulse.moveVy, 0);
  assert.deepEqual(harness.pulse.body.resetCalls, [[harness.state.capturedX, PRESSURE_ROW_Y]]);
  assert.deepEqual([harness.gfx.x, harness.gfx.y], [harness.state.capturedX, PRESSURE_ROW_Y]);
  assert.equal(harness.world.listenerCount(WORLD_STEP), 1);
  assert.equal(deferEvade.call(harness.scene, harness.state, harness.pulse), false);
  assert.equal(harness.world.registrationCount, 1, 'repeat Scene updates must not add listeners');

  assert.equal(consumePulse.call(harness.scene, harness.pulse, 'hit'), true);
  assert.equal(harness.pulse.p15Stage1WavePressureEndReason, 'hit');
  assert.equal(harness.world.listenerCount(WORLD_STEP), 0, 'hit must remove deferred evade');
  harness.world.emit(WORLD_STEP);
  assert.equal(harness.pulse.p15Stage1WavePressureEndReason, 'hit');
  assert.equal(harness.resolvedTokens.length, 1);
}

{
  const harness = makeHarness();
  deferEvade.call(harness.scene, harness.state, harness.pulse);
  harness.world.emit(WORLD_STEP);
  assert.equal(harness.pulse.p15Stage1WavePressureEndReason, 'evaded');
  assert.equal(harness.pulse.destroyCount, 1);
  assert.equal(harness.gfx.destroyCount, 1);
  assert.equal(harness.resolvedTokens.length, 1);
  harness.world.emit(WORLD_STEP);
  assert.equal(harness.pulse.destroyCount, 1, 'deferred evade consumption must be idempotent');
}

{
  const harness = makeHarness();
  deferEvade.call(harness.scene, harness.state, harness.pulse);
  clearEvent.call(harness.scene);
  assert.equal(harness.world.listenerCount(WORLD_STEP), 0);
  assert.deepEqual(harness.cancelledTokens, [harness.state.waveActionToken]);
  harness.world.emit(WORLD_STEP);
  assert.equal(harness.resolvedTokens.length, 0, 'stale cleanup listener must not affect later waves');
}

assert.ok(deferBlock.includes('Phaser.Physics.Arcade.Events.WORLD_STEP'));
assert.ok(deferBlock.includes('.once('));
assert.ok(clearListenerBlock.includes('.off?.('));
assert.equal(deferBlock.includes('delayedCall'), false);
assert.equal(deferBlock.includes('setTimeout'), false);
assert.equal(deferBlock.includes('requestAnimationFrame'), false);
assert.equal(deferBlock.includes('Distance.Between'), false);
assert.equal(deferBlock.includes('overlap('), false);
assert.ok(source.includes('const P15_260_STAGE1_WAVE_PRESSURE_PULSE_SPEED = 450;'));
assert.ok(source.includes('const P15_260_STAGE1_WAVE_PRESSURE_HIT_RADIUS = 7;'));
assert.ok(source.includes('const P15_260_STAGE1_WAVE_PRESSURE_EVENT_BUDGET_MS = 1800;'));
assert.ok(source.includes('const P15_260_STAGE1_WAVE_PRESSURE_ROW_Y = GAME_HEIGHT - 80;'));

console.log('p15261 Stage 1 wave pressure Arcade contact order: all assertions passed');
