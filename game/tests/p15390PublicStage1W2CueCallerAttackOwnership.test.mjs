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

const CALLER_TYPE = 'stage1CueCaller';
const OWNER_SPAWN = 'owner-spawn';
const AFTER_SPAWNS = 'after-spawns';

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
  const Phaser = { Utils: { Array: { Shuffle: (items) => items.reverse() } } };
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

const baseWaveDefs = [
  { wave: 1, label: 'Wave 1', interval: 1800, enemies: [{ type: 'trainee', count: 4 }] },
  { wave: 2, label: 'Wave 2', interval: 1600, enemies: [{ type: 'trainee', count: 5 }] },
];
const getStageById = (stageId) => ({ id: Number(stageId), name: `Stage ${stageId}`, waves: 2 });

assert.equal(stageWaves.STAGE_1_CUE_CALLER_TYPE, CALLER_TYPE);
assert.deepEqual(stageWaves.STAGE_1_WAVE_PRESSURE_START_MODES, {
  AFTER_SPAWNS,
  OWNER_SPAWN,
});

const normal = stageWaves.resolveStageWaveDefs({
  battleData: { stageId: 1, practiceMode: false },
  waveDefs: baseWaveDefs,
  getStageById,
});
assert.deepEqual(normal, [], 'public Stage 1 no longer authors W2 cue-caller waves');

const thirdReplay = stageWaves.resolveStageWaveDefs({
  battleData: { stageId: 1, practiceMode: false, stage1ReplayObjectiveIndex: 2 },
  waveDefs: baseWaveDefs,
  getStageById,
});
assert.deepEqual(thirdReplay, [], 'public replays stay on the paint round');

const hidden = stageWaves.resolveStageWaveDefs({
  battleData: { stageId: 1, practiceMode: true },
  waveDefs: baseWaveDefs,
  getStageById,
});
assert.equal(hidden.flatMap((def) => def.enemies).some((entry) => entry.type === CALLER_TYPE), false);
assert.equal(hidden.some((def) => 'waveAction' in def), false);

{
  const WaveSystem = compileWaveSystem();
  const timers = [];
  const spawned = [];
  const scene = {
    time: {
      now: 0,
      delayedCall(delay, callback) {
        const timer = { delay, callback, remove() {} };
        timers.push(timer);
        return timer;
      },
    },
  };
  const def = {
    wave: 2,
    interval: 1800,
    minActiveMs: 0,
    enemies: [
      { type: CALLER_TYPE, count: 1, spawnOrder: 'first' },
      { type: 'trainee', count: 6 },
      { type: stageWaves.STAGE_1_PRACTICE_TARGET_TYPE, count: 1 },
    ],
  };
  const system = new WaveSystem(scene, (type) => spawned.push(type), [def]);
  system.startNextWave();
  assert.deepEqual(system.spawnQueue, [CALLER_TYPE, 'trainee', 'trainee', 'trainee', 'trainee', 'trainee', 'trainee', 'stage1PracticeTarget']);
  while (timers.length > 0) {
    timers.shift().callback();
  }
  assert.deepEqual(spawned, [CALLER_TYPE, 'trainee', 'trainee', 'trainee', 'trainee', 'trainee', 'trainee', 'stage1PracticeTarget']);
}

const maybeBeginBlock = sourceBlock(
  battleSceneSource,
  '  _maybeBeginStage1CueCallerPressureAction(enemy) {',
  '  _handleStage1CueCallerPressureOwnerDestroyed(enemy) {'
);
const ownerDestroyedBlock = sourceBlock(
  battleSceneSource,
  '  _handleStage1CueCallerPressureOwnerDestroyed(enemy) {',
  '  _beginStage1WavePressureEvent(state) {'
);
const maybeBegin = compileClassMethod(maybeBeginBlock, '_maybeBeginStage1CueCallerPressureAction', {
  STAGE_1_WAVE_PRESSURE_START_MODES: { AFTER_SPAWNS, OWNER_SPAWN },
  STAGE_1_CUE_CALLER_TYPE: CALLER_TYPE,
  Phaser: { GameObjects: { Events: { DESTROY: 'destroy' } } },
});
const handleDestroyed = compileClassMethod(
  ownerDestroyedBlock,
  '_handleStage1CueCallerPressureOwnerDestroyed'
);

{
  let beginCount = 0;
  let destroyHandler = null;
  const state = {
    phase: 'waiting',
    resolved: false,
    startMode: OWNER_SPAWN,
    ownerType: CALLER_TYPE,
    owner: null,
    pulse: null,
  };
  const enemy = {
    type: CALLER_TYPE,
    active: true,
    once(event, callback) {
      assert.equal(event, 'destroy');
      destroyHandler = callback;
    },
  };
  const scene = {
    _battleEnded: false,
    _stage1WavePressureEvent: state,
    _beginStage1WavePressureEvent(received) {
      assert.equal(received, state);
      beginCount += 1;
      received.phase = 'announce';
      return true;
    },
    _handleStage1CueCallerPressureOwnerDestroyed: handleDestroyed,
    _resolveStage1WavePressureEvent(received, reason) {
      assert.equal(received, state);
      received.resolved = true;
      received.phase = reason;
      return true;
    },
  };
  assert.equal(maybeBegin.call(scene, enemy), true);
  assert.equal(state.owner, enemy);
  assert.equal(beginCount, 1);
  assert.equal(maybeBegin.call(scene, enemy), false, 'owner activation must be one-shot');
  assert.equal(typeof destroyHandler, 'function');
  destroyHandler();
  assert.equal(state.phase, 'owner-cancelled');
}

{
  const enemy = { type: CALLER_TYPE };
  const state = {
    phase: 'travel',
    resolved: false,
    owner: enemy,
    pulse: { active: true },
  };
  let resolveCount = 0;
  const scene = {
    _stage1WavePressureEvent: state,
    _resolveStage1WavePressureEvent() {
      resolveCount += 1;
      return true;
    },
  };
  assert.equal(handleDestroyed.call(scene, enemy), false);
  assert.equal(resolveCount, 0, 'released pulse must survive owner destruction');
}

const scheduleBlock = sourceBlock(
  battleSceneSource,
  '  _scheduleStage1WavePressureEvent(waveIndex) {',
  '  _maybeBeginStage1CueCallerPressureAction(enemy) {'
);
assert.ok(scheduleBlock.includes("state.startMode === STAGE_1_WAVE_PRESSURE_START_MODES.OWNER_SPAWN"));
assert.ok(scheduleBlock.includes('slotCount * def.interval + action.postSpawnLeadMs'));
assert.ok(scheduleBlock.includes('return true'));

const beginBlock = sourceBlock(
  battleSceneSource,
  '  _beginStage1WavePressureEvent(state) {',
  '  _getStage1WavePressureHorizontalVelocity() {'
);
assert.ok(beginBlock.includes('P15_260_STAGE1_WAVE_PRESSURE_ANNOUNCE_TO_CAPTURE_MS'));
assert.ok(beginBlock.includes('P15_260_STAGE1_WAVE_PRESSURE_CAPTURE_TO_RELEASE_MS'));
assert.ok(beginBlock.includes('state.owner'));

const spawnBlock = sourceBlock(
  battleSceneSource,
  '  _spawnEnemyByType(type) {',
  '  _attachStage15PressureGraphics(enemy, enemyType, radius) {'
);
assert.ok(spawnBlock.includes('case STAGE_1_CUE_CALLER_TYPE:'));
assert.ok(spawnBlock.includes('ENEMY_TYPES.TRAINEE.hp'));
assert.ok(spawnBlock.includes('ENEMY_TYPES.TRAINEE.speed'));
assert.ok(spawnBlock.includes('_maybeBeginStage1CueCallerPressureAction(enemy)'));

const callerSurface = [scheduleBlock, maybeBeginBlock, ownerDestroyedBlock, beginBlock, spawnBlock]
  .join('\n');
[
  'load.image',
  '.png',
  'invulnerable',
  'shield',
  'Stage 2',
].forEach((forbidden) => {
  assert.equal(
    callerSurface.includes(forbidden),
    false,
    `caller contract must not introduce forbidden dependency: ${forbidden}`
  );
});
assert.equal(/\.wav(?:['"`]|$)/.test(callerSurface), false);

console.log('p15390 public Stage 1 W2 cue caller attack ownership: all assertions passed');
