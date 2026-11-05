import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ATMOSPHERE, COLORS, ENCORE, SUPPORT_GAIN } from '../src/utils/config.js';

const source = readFileSync(
  new URL('../src/scenes/BattleScene.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');

function sourceBlock(startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

function compileClassMethods(block, globals = {}) {
  return Function(
    ...Object.keys(globals),
    `"use strict"; return (class {${block.trim()}}).prototype;`
  )(...Object.values(globals));
}

const helperStart = '  _resolvePublicStage1OrangeConfirmation(enemy, bullet) {';
const helperEnd = '  _onEnemyKilled(enemy, killColor) {';
const helpers = compileClassMethods(sourceBlock(helperStart, helperEnd), { COLORS });

function makeScene({ practiceMode = false } = {}) {
  const enemies = [];
  const scene = {
    battleData: { stageId: 1, practiceMode },
    weakPointCalls: 0,
    enemies: { children: { iterate(callback) { enemies.forEach(callback); } } },
    _tryWeakPointBreak(enemy) {
      this.weakPointCalls += 1;
      enemy.weakPointTriggered = true;
      return true;
    },
  };
  [
    '_resolvePublicStage1OrangeConfirmation',
    '_clearPublicStage1OrangeConfirmation',
    '_clearAllPublicStage1OrangeConfirmations',
  ].forEach((name) => { scene[name] = helpers[name]; });
  return { scene, enemies };
}

function enemy(hp = 17) {
  return { active: true, destroyed: false, hp };
}

function bullet(color = COLORS.ORANGE) {
  return { active: true, color };
}

{
  const { scene } = makeScene();
  const target = enemy();
  assert.equal(scene._resolvePublicStage1OrangeConfirmation(target, bullet()), false);
  assert.equal(target.p15OrangeConfirmationPrimed, true);
  assert.equal(scene.weakPointCalls, 0);

  target.hp = 4;
  assert.equal(scene._resolvePublicStage1OrangeConfirmation(target, bullet()), true);
  assert.equal(target.p15OrangeConfirmationPrimed, false);
  assert.equal(target.p15OrangeConfirmationConsumed, true);
  assert.equal(scene.weakPointCalls, 1);

  assert.equal(scene._resolvePublicStage1OrangeConfirmation(target, bullet()), false);
  assert.equal(target.p15OrangeConfirmationPrimed, false);
  assert.equal(scene.weakPointCalls, 1, 'consumed target cannot rearm or trigger twice');
}

{
  const { scene } = makeScene();
  const target = enemy();
  scene._resolvePublicStage1OrangeConfirmation(target, bullet());
  assert.equal(
    scene._resolvePublicStage1OrangeConfirmation(target, bullet(COLORS.PINK)),
    false
  );
  assert.equal(target.p15OrangeConfirmationPrimed, false);
  assert.equal(scene.weakPointCalls, 0);
}

{
  const { scene } = makeScene();
  const targetA = enemy();
  const targetB = enemy();
  scene._resolvePublicStage1OrangeConfirmation(targetA, bullet());
  scene._resolvePublicStage1OrangeConfirmation(targetB, bullet());
  assert.equal(targetA.p15OrangeConfirmationPrimed, true);
  assert.equal(targetB.p15OrangeConfirmationPrimed, true);
  assert.equal(scene.weakPointCalls, 0, 'another target cannot consume the first target state');
}

{
  const { scene } = makeScene();
  const target = enemy();
  scene._resolvePublicStage1OrangeConfirmation(target, bullet());
  target.hp = 0;
  assert.equal(scene._resolvePublicStage1OrangeConfirmation(target, bullet()), false);
  assert.equal(target.p15OrangeConfirmationPrimed, false);
  assert.equal(target.p15OrangeConfirmationConsumed, false);
  assert.equal(scene.weakPointCalls, 0, 'lethal second hit cannot create dead-target Encore');
}

{
  const hidden = makeScene({ practiceMode: true });
  const target = enemy();
  assert.equal(hidden.scene._resolvePublicStage1OrangeConfirmation(target, bullet()), false);
  assert.equal(target.p15OrangeConfirmationPrimed, undefined);
  assert.equal(hidden.scene.weakPointCalls, 0);
}

{
  const { scene, enemies } = makeScene();
  const target = enemy();
  target.p15OrangeConfirmationPrimed = true;
  target.p15OrangeConfirmationConsumed = true;
  enemies.push(target);
  assert.equal(scene._clearAllPublicStage1OrangeConfirmations(), true);
  assert.equal(target.p15OrangeConfirmationPrimed, false);
  assert.equal(target.p15OrangeConfirmationConsumed, false);
}

const hitBlock = sourceBlock('  _onBulletHitEnemy(bullet, enemy) {', '  _applyPublicStage1BlueTempoControl(enemy) {');
assert.ok(hitBlock.includes('const wasBurning = enemy.hasBurn'));
assert.ok(hitBlock.includes('this._applyBurn(enemy, bullet.isCrit)'));
assert.ok(hitBlock.includes('this._resolvePublicStage1OrangeConfirmation(enemy, bullet)'));
assert.ok(hitBlock.includes('targetWasBurning: wasBurning'));
assert.ok(hitBlock.includes('effectPlan.tryHiddenWeakPointBreak'));
assert.ok(hitBlock.includes('effectPlan.resolvePublicOrangeConfirmation'));
assert.ok(
  hitBlock.indexOf('enemy.hp = damageResult.hpAfter')
    < hitBlock.indexOf('this._resolvePublicStage1OrangeConfirmation(enemy, bullet)'),
  'Orange confirmation must resolve after direct damage'
);
assert.equal(
  (hitBlock.match(/this\._tryWeakPointBreak\(enemy\)/g) || []).length,
  1,
  'legacy weak-point call must remain only inside hidden-practice isolation'
);

const helperBlock = sourceBlock(helperStart, helperEnd);
[
  'this.time',
  'this.tweens',
  'this.add',
  'load.image',
  'load.audio',
  '.png',
  '.wav',
  'player.hp',
  'enemy.hp =',
  'support',
  'waveSystem',
].forEach((forbidden) => {
  assert.equal(helperBlock.includes(forbidden), false, `Orange owner helper must exclude: ${forbidden}`);
});

assert.deepEqual(
  {
    burnDuration: ATMOSPHERE.orange.duration,
    burnRate: ATMOSPHERE.orange.burnRate,
    weakPointBonus: ATMOSPHERE.orange.weakPointBonus,
    weakPointSupport: SUPPORT_GAIN.WEAK_POINT,
    encoreDuration: ENCORE.ANVIL_DURATION,
    encoreDamage: ENCORE.DMG_BONUS,
  },
  {
    burnDuration: 3000,
    burnRate: 0.03,
    weakPointBonus: 1.5,
    weakPointSupport: 30,
    encoreDuration: 8000,
    encoreDamage: 0.20,
  }
);
assert.ok(source.includes("this._healPlayer(1, '安可回血')"));

const orangeReleaseBlock = sourceBlock(
  "  _releaseBattleRuntimeObjects(reason = 'unspecified') {",
  '  _clearActivePlayerBulletGraphics() {'
);
const orangeKillBlock = sourceBlock('  _onEnemyKilled(enemy, killColor) {', '  _onEnemyHitPlayer(sourceBullet = null) {');
const orangeEndBlock = sourceBlock('  _endBattle(type) {', '  _showP43ResultPreview(preview) {');
assert.ok(orangeReleaseBlock.includes('_clearAllPublicStage1OrangeConfirmations'));
assert.ok(orangeKillBlock.includes('_clearPublicStage1OrangeConfirmation'));
assert.ok(orangeEndBlock.includes("_releaseBattleRuntimeObjects('battle-end')"));

console.log('p15352 public Stage 1 Orange exact confirmation ownership: all assertions passed');
