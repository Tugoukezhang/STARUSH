import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PUBLIC_STAGE1_FINALE_PHASES,
  PublicStage1FinaleController,
} from '../src/systems/PublicStage1FinaleController.mjs';
import {
  PUBLIC_STAGE1_ENEMY_ROLES,
  PUBLIC_STAGE1_ENEMY_STATES,
  canEnemyBePublicStage1PaintTarget,
  canEnemyDealContactDamage,
} from '../src/systems/PublicStage1EnemyRoles.mjs';

const battleSource = readFileSync(
  new URL('../src/scenes/BattleScene.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');

function sourceBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

assert.deepEqual(PUBLIC_STAGE1_FINALE_PHASES, {
  ATTACK: 'attack',
  WEAK_POINT: 'weak-point',
  BOSS_RECOVERY: 'boss-recovery',
  COMPLETE: 'complete',
  FAILED: 'failed',
});

{
  const finale = new PublicStage1FinaleController({ stageId: 1, practiceMode: false });
  assert.equal(finale.isEligible(), true);
  assert.equal(finale.begin({ now: 1000 }), true);
  assert.equal(finale.begin({ now: 1001 }), false);
  assert.deepEqual(finale.snapshot(1000), {
    active: true,
    phase: 'attack',
    weakPointsResolved: 0,
    weakPointCount: 3,
    attackIndex: 0,
    attackPattern: 'captured-line',
    lastAttackOutcome: null,
    remainingMs: 32000,
    complete: false,
    failed: false,
  });
  assert.equal(finale.recordAttackResolved(1500, { outcome: 'evaded' }), true);
  assert.equal(finale.recordWeakPointResolved(2000), true);
  assert.equal(finale.recordAttackResolved(2250, { outcome: 'hit' }), true);
  assert.equal(finale.recordWeakPointResolved(2500), true);
  assert.equal(finale.recordAttackResolved(2750, { outcome: 'evaded' }), true);
  assert.equal(finale.recordWeakPointResolved(3000), true);
  assert.equal(finale.snapshot(3000).phase, PUBLIC_STAGE1_FINALE_PHASES.BOSS_RECOVERY);
  assert.equal(finale.recordWeakPointResolved(3100), false);
  assert.equal(finale.recordBossDefeated(5000), true);
  assert.equal(finale.snapshot(5000).phase, PUBLIC_STAGE1_FINALE_PHASES.COMPLETE);
  assert.equal(finale.snapshot(5000).complete, true);
  finale.reset();
  assert.equal(finale.snapshot(6000).active, false);
}

{
  const finale = new PublicStage1FinaleController({ stageId: 1, practiceMode: false });
  assert.equal(finale.begin({ now: 0 }), true);
  const expired = finale.advance(32000);
  assert.equal(expired.phase, PUBLIC_STAGE1_FINALE_PHASES.FAILED);
  assert.equal(expired.failed, true);
  assert.equal(expired.active, false);
}

{
  const hidden = new PublicStage1FinaleController({ stageId: 1, practiceMode: true });
  const stage2 = new PublicStage1FinaleController({ stageId: 2, practiceMode: false });
  assert.equal(hidden.isEligible(), false);
  assert.equal(hidden.begin({ now: 0 }), false);
  assert.equal(stage2.isEligible(), false);
}

const weakPoint = {
  active: true,
  publicStage1EnemyRole: PUBLIC_STAGE1_ENEMY_ROLES.FINALE_WEAK_POINT,
  publicStage1EnemyState: PUBLIC_STAGE1_ENEMY_STATES.RECOVERY,
};
const closedBoss = {
  active: true,
  publicStage1EnemyRole: PUBLIC_STAGE1_ENEMY_ROLES.FINALE_BOSS,
  publicStage1EnemyState: PUBLIC_STAGE1_ENEMY_STATES.WINDUP,
};
const openBoss = {
  ...closedBoss,
  publicStage1EnemyState: PUBLIC_STAGE1_ENEMY_STATES.RECOVERY,
};
assert.equal(canEnemyBePublicStage1PaintTarget(weakPoint), true);
assert.equal(canEnemyBePublicStage1PaintTarget(closedBoss), false);
assert.equal(canEnemyBePublicStage1PaintTarget(openBoss), true);
assert.equal(canEnemyDealContactDamage({ enemy: weakPoint, isPublicStage1: true }), false);
assert.equal(canEnemyDealContactDamage({ enemy: openBoss, isPublicStage1: true }), false);

assert.match(
  battleSource,
  /P16_018_FINALE_BOSS_PAINT_HP\s*=\s*STAGE1_PAINT_PER_HIT\s*\*\s*6/
);
assert.match(
  battleSource,
  /P16_018_FINALE_WEAK_POINT_PAINT_HP\s*=\s*STAGE1_PAINT_PER_HIT/
);

const beginRoundBlock = sourceBlock(
  battleSource,
  '  _beginPublicPaintRound() {',
  '  _beginPublicFever() {'
);
const beginFinaleBlock = sourceBlock(
  battleSource,
  '  _beginPublicStage1Finale() {',
  '  _drawPublicStage1FinaleBossGfx('
);
const spawnBossBlock = sourceBlock(
  battleSource,
  '  _spawnPublicStage1FinaleBoss() {',
  '  _spawnPublicStage1FinaleWeakPoint('
);
const weakPointBlock = sourceBlock(
  battleSource,
  '  _spawnPublicStage1FinaleWeakPoint(',
  '  _resolvePublicStage1FinaleWeakPoint('
);
const resolveBlock = sourceBlock(
  battleSource,
  '  _resolvePublicStage1FinaleWeakPoint(',
  '  _startPublicStage1FinaleAttack() {'
);
const attackBlock = sourceBlock(
  battleSource,
  '  _startPublicStage1FinaleAttack() {',
  '  _openPublicStage1FinaleBossRecovery('
);
const recoveryBlock = sourceBlock(
  battleSource,
  '  _openPublicStage1FinaleBossRecovery(',
  '  _updatePublicStage1Finale() {'
);
const updateBlock = sourceBlock(
  battleSource,
  '  _updatePublicStage1Finale() {',
  "  _clearPublicStage1Finale(reason = 'cleared'"
);
const clearBlock = sourceBlock(
  battleSource,
  "  _clearPublicStage1Finale(reason = 'cleared'",
  '  _beginPublicFever() {'
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
const mainUpdateBlock = sourceBlock(
  battleSource,
  '  update(time, delta) {',
  '  _onPlayerDeath() {'
);

assert.ok(beginRoundBlock.includes('this._beginPublicStage1Finale()'));
assert.ok(beginFinaleBlock.includes('this.publicStage1Finale.begin'));
assert.ok(beginFinaleBlock.includes('this._paintRoundEndsAt = null'));
assert.ok(beginFinaleBlock.includes('this.publicStage1Encounter?.reset()'));
assert.ok(spawnBossBlock.includes('PUBLIC_STAGE1_ENEMY_ROLES.FINALE_BOSS'));
assert.ok(spawnBossBlock.includes('P16_018_FINALE_BOSS_PAINT_HP'));
assert.ok(weakPointBlock.includes('PUBLIC_STAGE1_ENEMY_ROLES.FINALE_WEAK_POINT'));
assert.ok(weakPointBlock.includes('P16_018_FINALE_WEAK_POINT_PAINT_HP'));
assert.ok(resolveBlock.includes('recordWeakPointResolved'));
assert.ok(resolveBlock.includes('_startPublicStage1FinaleAttack()'));
assert.ok(attackBlock.includes('_spawnPublicStage1StageCuePulse(boss)'));
assert.ok(attackBlock.includes('recordAttackResolved'));
assert.ok(recoveryBlock.includes('PUBLIC_STAGE1_ENEMY_STATES.RECOVERY'));
assert.ok(updateBlock.includes('BATTLE_RESULT_TYPES.PLAYER_DEFEAT'));
assert.ok(clearBlock.includes('publicStage1Finale?.reset()'));
assert.ok(paintTargetBlock.includes('FINALE_WEAK_POINT'));
assert.ok(paintTargetBlock.includes('FINALE_BOSS'));
assert.ok(targetBlock.includes('nearestFinaleWeakPoint'));
assert.ok(targetBlock.includes('nearestFinaleBoss'));
assert.ok(mainUpdateBlock.includes('this._updatePublicStage1Finale()'));
assert.equal(/load\.(image|audio)/.test(beginFinaleBlock + spawnBossBlock + weakPointBlock), false);
assert.equal(battleSource.includes('boss-hp'), false);

console.log('p16018 public Stage 1 finale Boss-lite contract: all assertions passed');
