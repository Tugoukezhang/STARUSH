import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PUBLIC_STAGE1_ENEMY_ROLES,
  PUBLIC_STAGE1_ENEMY_STATES,
  canEnemyBePublicStage1PaintTarget,
  canEnemyDealContactDamage,
} from '../src/systems/PublicStage1EnemyRoles.mjs';
import {
  PUBLIC_STAGE1_ENCOUNTER_PHASES,
  PublicStage1EncounterDirector,
} from '../src/systems/PublicStage1EncounterDirector.mjs';

const battleSource = readFileSync(
  new URL('../src/scenes/BattleScene.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');
const paintSource = readFileSync(
  new URL('../src/systems/PaintZoneSystem.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');

function sourceBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

function compileClassMethod(block, methodName) {
  return Function(`"use strict"; return ({${block.trim()}}).${methodName};`)();
}

assert.deepEqual(PUBLIC_STAGE1_ENEMY_ROLES, {
  UNLIT_CHASER: 'unlit-chaser',
  STAGE_CUE_EMITTER: 'stage-cue-emitter',
  OBJECTIVE_DISRUPTOR: 'objective-disruptor',
  SPOTLIGHT_CAPTAIN: 'spotlight-captain',
  FINALE_BOSS: 'finale-boss',
  FINALE_WEAK_POINT: 'finale-weak-point',
});
assert.deepEqual(PUBLIC_STAGE1_ENEMY_STATES, {
  WINDUP: 'windup',
  DISRUPTING: 'disrupting',
  RECOVERY: 'recovery',
});

const windingDisruptor = {
  active: true,
  publicStage1EnemyRole: PUBLIC_STAGE1_ENEMY_ROLES.OBJECTIVE_DISRUPTOR,
  publicStage1EnemyState: PUBLIC_STAGE1_ENEMY_STATES.WINDUP,
};
const activeDisruptor = {
  ...windingDisruptor,
  publicStage1EnemyState: PUBLIC_STAGE1_ENEMY_STATES.DISRUPTING,
};
assert.equal(canEnemyDealContactDamage({ enemy: windingDisruptor, isPublicStage1: true }), false);
assert.equal(canEnemyDealContactDamage({ enemy: activeDisruptor, isPublicStage1: true }), false);
assert.equal(canEnemyBePublicStage1PaintTarget(windingDisruptor), true);
assert.equal(canEnemyBePublicStage1PaintTarget(activeDisruptor), true);

assert.deepEqual(
  PUBLIC_STAGE1_ENCOUNTER_PHASES.map((phase) => phase.objectiveDisruptorIntervalMs),
  [null, null, 22000, 16000],
  'objective disruption must enter only in the final two phases'
);

{
  const director = new PublicStage1EncounterDirector({ stageId: 1, practiceMode: false });
  assert.equal(director.begin({ now: 1000 }), true);
  director.advance(106000, { completed: 5, total: 10 });
  assert.equal(
    director.claimObjectiveDisruptorOpportunity(113999),
    false,
    'pressure-stack must preserve an eight-second lead'
  );
  assert.equal(director.claimObjectiveDisruptorOpportunity(114000), true);
  assert.equal(director.claimObjectiveDisruptorOpportunity(114001), false);
  assert.equal(
    director.claimObjectiveDisruptorOpportunity(
      136000,
      { hasActiveDisruptor: true }
    ),
    false,
    'one disruptor owner must block another claim'
  );
  assert.equal(director.claimObjectiveDisruptorOpportunity(136000), true);
  director.reset();
  assert.equal(director.claimObjectiveDisruptorOpportunity(200000), false);
}

const nearestBlock = sourceBlock(
  paintSource,
  '  getNearestCurrentZonePaintable(x, y) {',
  '  clampPlayerY(y) {'
);
const suppressBlock = sourceBlock(
  paintSource,
  '  setDeviceSuppressed(device, suppressed) {',
  '  applyPaint(device, amount = STAGE1_PAINT_PER_HIT, color = null) {'
);
const applyBlock = sourceBlock(
  paintSource,
  '  applyPaint(device, amount = STAGE1_PAINT_PER_HIT, color = null) {',
  '  applyPaintAt('
);
const redrawBlock = sourceBlock(
  paintSource,
  '  _redrawDevice(device) {',
  '  _drawKindShape('
);
const getNearestCurrentZonePaintable = compileClassMethod(
  nearestBlock,
  'getNearestCurrentZonePaintable'
);
const setDeviceSuppressed = compileClassMethod(suppressBlock, 'setDeviceSuppressed');

{
  const currentFar = { x: 300, y: 0, zone: 0, complete: false };
  const currentNear = { x: 100, y: 0, zone: 0, complete: false };
  const completeNear = { x: 20, y: 0, zone: 0, complete: true };
  const futureNear = { x: 10, y: 0, zone: 1, complete: false };
  const zone = {
    currentZone: 0,
    devices: [currentFar, currentNear, completeNear, futureNear],
  };
  assert.equal(getNearestCurrentZonePaintable.call(zone, 0, 0), currentNear);

  let redraws = 0;
  zone._redrawDevice = () => { redraws += 1; };
  assert.equal(setDeviceSuppressed.call(zone, currentNear, true), true);
  assert.equal(currentNear.publicStage1Suppressed, true);
  assert.equal(setDeviceSuppressed.call(zone, currentNear, true), false, 'suppression must be idempotent');
  assert.equal(setDeviceSuppressed.call(zone, currentNear, false), true);
  assert.equal(currentNear.publicStage1Suppressed, false);
  assert.equal(setDeviceSuppressed.call(zone, futureNear, true), false, 'future-zone objectives stay locked');
  assert.equal(redraws, 2);
}

assert.ok(applyBlock.includes('device.publicStage1Suppressed === true'));
assert.ok(redrawBlock.includes('device.publicStage1Suppressed === true'));

const encounterBlock = sourceBlock(
  battleSource,
  '  _updatePublicStage1Encounter() {',
  '  _scheduleNextUnlitSpawn('
);
const drawBlock = sourceBlock(
  battleSource,
  '  _drawPublicStage1ObjectiveDisruptorGfx(',
  '  _spawnPublicStage1ObjectiveDisruptor(restore=null) {'
);
const spawnBlock = sourceBlock(
  battleSource,
  '  _spawnPublicStage1ObjectiveDisruptor(restore=null) {',
  '  _activatePublicStage1ObjectiveDisruptor(enemy) {'
);
const activateBlock = sourceBlock(
  battleSource,
  '  _activatePublicStage1ObjectiveDisruptor(enemy) {',
  '  _clearPublicStage1ObjectiveDisruptor('
);
const clearBlock = sourceBlock(
  battleSource,
  "  _clearPublicStage1ObjectiveDisruptor(reason = 'cleared') {",
  '  _drawPublicStage1StageCueEmitterGfx('
);
const paintTargetBlock = sourceBlock(
  battleSource,
  '  _paintPublicStage1TargetsAt(',
  '  _drawUnlitBlobGfx('
);
const targetBlock = sourceBlock(
  battleSource,
  '  _selectAutoAimTarget() {',
  '  _tryShoot(time) {'
);
const freezeBlock = sourceBlock(
  battleSource,
  "  _freezePublicPaintRound(reason = 'stopped') {",
  '  _clearPublicPaintRound() {'
);

assert.ok(encounterBlock.includes('getPendingAuthoredRoles'));
assert.ok(encounterBlock.includes('_spawnPublicStage1ObjectiveDisruptor()'));
assert.ok(spawnBlock.includes('getNearestCurrentZonePaintable'));
assert.ok(spawnBlock.includes('PUBLIC_STAGE1_ENEMY_ROLES.OBJECTIVE_DISRUPTOR'));
assert.ok(spawnBlock.includes('PUBLIC_STAGE1_ENEMY_STATES.WINDUP'));
assert.ok(spawnBlock.includes('P16_016_OBJECTIVE_DISRUPTOR_PAINT_HP'));
assert.ok(activateBlock.includes('PUBLIC_STAGE1_ENEMY_STATES.DISRUPTING'));
assert.ok(activateBlock.includes('setDeviceSuppressed(device, true)'));
assert.ok(clearBlock.includes('setDeviceSuppressed(device, false)'));
assert.ok(clearBlock.includes('publicStage1ObjectiveWindupTimer'));
assert.ok(clearBlock.includes('publicStage1ObjectiveSuppressionTimer'));
assert.ok(paintTargetBlock.includes('OBJECTIVE_DISRUPTOR'));
assert.ok(targetBlock.includes('nearestObjectiveDisruptor'));
assert.ok(freezeBlock.includes("_clearPublicStage1ObjectiveDisruptor('round-frozen')"));
assert.ok(drawBlock.includes('lineBetween'));
assert.equal(/load\.(image|audio)|this\.add\.(image|sprite|text)|tweens\./.test(drawBlock), false);
assert.equal(battleSource.includes("load.image('objective-disruptor"), false);
assert.equal(battleSource.includes("load.audio('objective-disruptor"), false);

console.log('p16016 public Stage 1 objective disruptor role: all assertions passed');
