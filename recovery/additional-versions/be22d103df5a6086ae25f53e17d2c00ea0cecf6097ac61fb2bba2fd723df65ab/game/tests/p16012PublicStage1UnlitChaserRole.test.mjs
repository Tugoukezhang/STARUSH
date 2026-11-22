import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PUBLIC_STAGE1_ENEMY_ROLES,
  canEnemyDealContactDamage,
} from '../src/systems/PublicStage1EnemyRoles.mjs';
import { PUBLIC_STAGE1_ENCOUNTER_PHASES } from '../src/systems/PublicStage1EncounterDirector.mjs';

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
assert.equal(canEnemyDealContactDamage({
  enemy: { active: true, publicStage1EnemyRole: 'unlit-chaser' },
  isPublicStage1: true,
}), true);
assert.equal(canEnemyDealContactDamage({
  enemy: { active: true, publicStage1EnemyRole: null },
  isPublicStage1: true,
}), false);
assert.equal(canEnemyDealContactDamage({
  enemy: { active: true, publicStage1EnemyRole: null },
  isPublicStage1: false,
}), true);
assert.equal(canEnemyDealContactDamage({
  enemy: { active: false, publicStage1EnemyRole: 'unlit-chaser' },
  isPublicStage1: true,
}), false);

PUBLIC_STAGE1_ENCOUNTER_PHASES.forEach((phase) => {
  assert.equal('unlitShotMs' in phase, false, `${phase.id} must not schedule ranged fire for the contact chaser`);
});

const battleSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');
const spawnBlock = sourceBlock(battleSource, '  _spawnUnlitBlob() {', '  _onUnlitBlobKilled(enemy, imprint = null) {');
const killBlock = sourceBlock(battleSource, '  _onUnlitBlobKilled(enemy, imprint = null) {', '  _clearUnlitBlobs() {');
const clearBlock = sourceBlock(battleSource, '  _clearUnlitBlobs() {', '  _spawnPaintDanmaku(origin = null) {');
const collisionBlock = sourceBlock(battleSource, '  _setupCollisions() {', '  _onBulletHitEnemy(bullet, enemy) {');
const contactBlock = sourceBlock(battleSource, '  _onEnemyContactPlayer(enemy) {', '  _onEnemyHitPlayer(sourceBullet = null) {');

assert.ok(spawnBlock.includes('enemy.publicStage1EnemyRole = PUBLIC_STAGE1_ENEMY_ROLES.UNLIT_CHASER'));
assert.equal(spawnBlock.includes('shootTimer'), false, 'unlit chaser must not own a ranged-fire timer');
assert.equal(spawnBlock.includes('_spawnPaintDanmaku(enemy)'), false, 'unlit chaser must not spawn projectiles');
assert.equal(battleSource.includes('_scheduleUnlitBlobShot('), false, 'mixed unlit ranged scheduler must be removed');
assert.equal(killBlock.includes('shootTimer'), false, 'unlit kill cleanup must not imply ranged ownership');
assert.equal(clearBlock.includes('shootTimer'), false, 'unlit scene cleanup must not imply ranged ownership');

assert.ok(collisionBlock.includes('(_player, enemy) => this._onEnemyContactPlayer(enemy)'));
assert.ok(contactBlock.includes('canEnemyDealContactDamage({'));
assert.ok(contactBlock.includes('this._onEnemyHitPlayer()'));
assert.ok(contactBlock.includes('isPublicStage1: this._isPublicStage1Round()'));

console.log('p16012 public Stage 1 unlit chaser role: all assertions passed');
