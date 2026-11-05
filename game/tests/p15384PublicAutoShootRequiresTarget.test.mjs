import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n');

function sourceBlock(startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

function compileMethod(block, methodName, globals = {}) {
  const names = Object.keys(globals);
  const values = Object.values(globals);
  return Function(
    ...names,
    `"use strict"; return ({\n${block.trim()}\n}).${methodName};`
  )(...values);
}

function makeBullet() {
  return {
    active: true,
    setAlpha() { return this; },
    setDepth() { return this; },
    body: { moves: true, allowGravity: true, setCircle() {} },
    destroy() { this.active = false; },
  };
}

const shootBlock = sourceBlock('  _tryShoot(time) {', '  _setupCollisions() {');
const tryShoot = compileMethod(shootBlock, '_tryShoot', {
  SHOOT_CONFIG: { FIRE_RATE: 333, BULLET_SPEED: 500 },
  COLOR_HEX: { blue: 0x66E6FF },
  COMBAT_OBJECT_OWNERS: { PLAYER_PROJECTILE: 'playerProjectile' },
});

function makeScene(target) {
  const calls = { bullets: 0, launchFx: 0, audio: 0 };
  const scene = {
    _selectAutoAimTarget: () => target,
    support: { getCenterStageFireRateMultiplier: () => 1 },
    lastShotTime: 100,
    currentColor: 'blue',
    player: { x: 100, y: 500 },
    physics: { add: { sprite: () => { calls.bullets += 1; return makeBullet(); } } },
    dmgCalc: { rollCrit: () => false },
    _createPlayerBulletVisual: () => ({
      node: { active: true, destroy() { this.active = false; } },
      offsetX: 0,
      offsetY: 0,
    }),
    _trackCombatObject: () => true,
    playerBullets: { add() {} },
    _spawnChargeNoteFx: () => { calls.launchFx += 1; },
    _spawnCritFx() {},
    p17Audio: { playShotTick: () => { calls.audio += 1; } },
    time: { delayedCall: () => ({ remove() {} }) },
  };
  return { scene, calls };
}

const noTarget = makeScene(null);
tryShoot.call(noTarget.scene, 1000);
assert.deepEqual(noTarget.calls, { bullets: 0, launchFx: 0, audio: 0 });
assert.equal(noTarget.scene.lastShotTime, 100);

const targeted = makeScene({ x: 100, y: 100, moveVx: 0, moveVy: 0, active: true });
tryShoot.call(targeted.scene, 1000);
assert.deepEqual(targeted.calls, { bullets: 1, launchFx: 1, audio: 1 });
assert.equal(targeted.scene.lastShotTime, 1000);

[
  'P15_373_LEAD_NOTE',
  'PublicStage1LeadNote',
  '_publicStage1LeadNote',
  "'lead-note'",
  "'长音'",
].forEach((retired) => {
  assert.equal(source.includes(retired), false, `retired Lead Note runtime symbol remains: ${retired}`);
});

assert.ok(source.includes('_isPublicBattleActionOwnedBy'));
assert.ok(shootBlock.indexOf('const nearestEnemy = this._selectAutoAimTarget();')
  < shootBlock.indexOf('this.lastShotTime = time;'));
assert.ok(shootBlock.includes('if (!nearestEnemy) return;'));

console.log('p15384 public auto-shoot requires target and Lead Note retirement tests passed.');
