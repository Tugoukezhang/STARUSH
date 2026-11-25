import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PUBLIC_STAGE1_ENEMY_ROLES,
  PUBLIC_STAGE1_ENEMY_STATES,
  canEnemyDealContactDamage,
  canEnemyBePublicStage1PaintTarget,
} from '../src/systems/PublicStage1EnemyRoles.mjs';
import {
  PUBLIC_STAGE1_ENCOUNTER_PHASES,
  PublicStage1EncounterDirector,
} from '../src/systems/PublicStage1EncounterDirector.mjs';

function sourceBlock(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  assert.ok(start >= 0, `missing start token: ${startToken}`);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.ok(end > start, `missing end token: ${endToken}`);
  return source.slice(start, end);
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

const chaser = {
  active: true,
  publicStage1EnemyRole: PUBLIC_STAGE1_ENEMY_ROLES.UNLIT_CHASER,
};
const windingEmitter = {
  active: true,
  publicStage1EnemyRole: PUBLIC_STAGE1_ENEMY_ROLES.STAGE_CUE_EMITTER,
  publicStage1EnemyState: PUBLIC_STAGE1_ENEMY_STATES.WINDUP,
};
const recoveringEmitter = {
  ...windingEmitter,
  publicStage1EnemyState: PUBLIC_STAGE1_ENEMY_STATES.RECOVERY,
};

assert.equal(canEnemyDealContactDamage({ enemy: chaser, isPublicStage1: true }), true);
assert.equal(canEnemyDealContactDamage({ enemy: windingEmitter, isPublicStage1: true }), false);
assert.equal(canEnemyDealContactDamage({ enemy: recoveringEmitter, isPublicStage1: true }), false);
assert.equal(canEnemyBePublicStage1PaintTarget(chaser), true);
assert.equal(canEnemyBePublicStage1PaintTarget(windingEmitter), false);
assert.equal(canEnemyBePublicStage1PaintTarget(recoveringEmitter), true);
assert.equal(canEnemyBePublicStage1PaintTarget({ ...recoveringEmitter, active: false }), false);

assert.deepEqual(
  PUBLIC_STAGE1_ENCOUNTER_PHASES.map((phase) => phase.stageCueEmitterIntervalMs),
  [null, 18000, 15000, 12000],
);

const director = new PublicStage1EncounterDirector({ stageId: 1, practiceMode: false });
assert.equal(director.begin({ now: 1000 }), true);
director.advance(1000, { completed: 0, total: 10 });
assert.equal(director.claimStageCueEmitterOpportunity(46000), false, 'opening phase must not emit');
director.advance(46000, { completed: 2, total: 10 });
assert.equal(director.claimStageCueEmitterOpportunity(51999), false, 'phase lead must remain quiet');
assert.equal(director.claimStageCueEmitterOpportunity(52000), true, 'movement phase opens one opportunity');
assert.equal(director.claimStageCueEmitterOpportunity(52001), false, 'opportunity is consumed once');
assert.equal(director.claimStageCueEmitterOpportunity(70000, { hasActiveEmitter: true }), false);
assert.equal(director.claimStageCueEmitterOpportunity(70000), true, 'interval opens another opportunity');
director.reset();
assert.equal(director.claimStageCueEmitterOpportunity(200000), false, 'reset closes opportunities');

const battleSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');
const updateEncounterBlock = sourceBlock(
  battleSource,
  '  _updatePublicStage1Encounter() {',
  '  _scheduleNextUnlitSpawn(initialDelayMs = null) {'
);
const spawnBlock = sourceBlock(
  battleSource,
  '  _spawnPublicStage1StageCueEmitter(restore=null) {',
  '  _releasePublicStage1StageCueEmitter(enemy) {'
);
const releaseBlock = sourceBlock(
  battleSource,
  '  _releasePublicStage1StageCueEmitter(enemy) {',
  '  _spawnPublicStage1StageCuePulse(enemy) {'
);
const pulseBlock = sourceBlock(
  battleSource,
  '  _spawnPublicStage1StageCuePulse(enemy) {',
  '  _consumePublicStage1StageCuePulse(pulse, reason) {'
);
const clearBlock = sourceBlock(
  battleSource,
  '  _clearPublicStage1StageCueEmitter(reason = \'cleared\', { preservePulse = false } = {}) {',
  '  _onUnlitBlobKilled('
);
const targetBlock = sourceBlock(
  battleSource,
  '  _selectAutoAimTarget() {',
  '  _tryShoot(time) {'
);

assert.ok(updateEncounterBlock.includes('getPendingAuthoredRoles'));
assert.ok(updateEncounterBlock.includes('_spawnPublicStage1StageCueEmitter()'));
assert.ok(spawnBlock.includes('PUBLIC_STAGE1_ENEMY_ROLES.STAGE_CUE_EMITTER'));
assert.ok(spawnBlock.includes('PUBLIC_STAGE1_ENEMY_STATES.WINDUP'));
assert.ok(spawnBlock.includes('capturedX: this.player.x'));
assert.ok(spawnBlock.includes('capturedY: this.player.y'));
assert.equal(spawnBlock.includes('shootTimer'), false, 'emitter must not own a repeating shoot timer');
assert.ok(releaseBlock.includes('PUBLIC_STAGE1_ENEMY_STATES.RECOVERY'));
assert.ok(releaseBlock.includes('_spawnPublicStage1StageCuePulse(enemy)'));
assert.ok(pulseBlock.includes('pulse.publicStage1StageCuePulse = true'));
assert.ok(pulseBlock.includes('const dx = enemy.publicStage1CueCapture.capturedX - enemy.x'));
assert.ok(pulseBlock.includes('const dy = enemy.publicStage1CueCapture.capturedY - enemy.y'));
assert.equal(pulseBlock.includes('this.player.x - pulse.x'), false, 'released pulse must not track the player');
assert.ok(clearBlock.includes('_consumePublicStage1StageCuePulse'));
assert.ok(targetBlock.includes('canEnemyBePublicStage1PaintTarget(enemy)'));
assert.ok(targetBlock.includes('nearestStageCueEmitter'));
assert.ok(targetBlock.includes('nearestStageCueEmitterDist <= STAGE1_PAINT_SHOT_RANGE'));
assert.ok(battleSource.includes("_clearPublicStage1StageCueEmitter('round-frozen')"));
assert.equal(battleSource.includes('load.image(\'stage-cue-emitter'), false);
assert.equal(battleSource.includes('load.audio(\'stage-cue-emitter'), false);

console.log('p16013 public Stage 1 stage cue emitter role: all assertions passed');
