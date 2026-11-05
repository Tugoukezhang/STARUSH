import assert from 'node:assert/strict';
import {capturePlayerHitSource} from '../src/utils/playerHitSource.mjs';
import { readFileSync } from 'node:fs';

const battleSceneSource = readFileSync(
  new URL('../src/scenes/BattleScene.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');

const OWNER = 'stage-pressure-emitter';

function sourceBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

function compileClassMethod(block, methodName, globals = {}) {
  const names = Object.keys(globals);
  const values = Object.values(globals);
  return Function(
    ...names,
    `"use strict"; return ({${block.trim()}}).${methodName};`
  )(...values);
}

{
  const collisionBlock = sourceBlock(
    battleSceneSource,
    '  _setupCollisions() {',
    '  _onBulletHitEnemy(bullet, enemy) {'
  );
  const setupCollisions = compileClassMethod(collisionBlock, '_setupCollisions');
  const overlaps = [];
  const hitCalls = [];
  const scene = {
    playerBullets: { id: 'playerBullets' },
    enemyBullets: { id: 'enemyBullets' },
    enemies: { id: 'enemies' },
    player: { id: 'player' },
    physics: {
      add: {
        overlap(left, right, callback) {
          overlaps.push({ left, right, callback });
        },
      },
    },
    _onBulletHitEnemy() {},
    _onEnemyHitPlayer(...args) {
      hitCalls.push(args);
    },
    _onEnemyContactPlayer() {
      this._onEnemyHitPlayer();
    },
  };
  setupCollisions.call(scene);

  const exactPulse = {
    active: true,
    x: -999,
    y: -999,
    p15HostileProjectileOwner: OWNER,
  };
  const enemyBulletOverlap = overlaps.find(({ left }) => left === scene.enemyBullets);
  assert.ok(enemyBulletOverlap, 'enemyBullets overlap should remain registered');
  assert.equal(enemyBulletOverlap.right, scene.player, 'enemyBullets overlap should remain registered against player');
  // Installed Phaser 3.90.0 dispatches Group-vs-Sprite as (player, groupChild).
  enemyBulletOverlap.callback(scene.player, exactPulse);
  assert.deepEqual(
    hitCalls.at(-1),
    [exactPulse],
    'enemyBullets overlap must forward the exact bullet into the player-hit path'
  );

  const enemyBodyOverlap = overlaps.find(({ left }) => left === scene.enemies);
  assert.ok(enemyBodyOverlap, 'enemy-body overlap should remain registered');
  enemyBodyOverlap.callback({ active: true }, scene.player);
  assert.deepEqual(
    hitCalls.at(-1),
    [],
    'enemy-body overlap must remain projectile-source-free'
  );
}

{
  const hitBlock = sourceBlock(
    battleSceneSource,
    '  _onEnemyHitPlayer(sourceBullet = null, contactEnemy = null) {',
    '  _getPlayerVisualTarget() {'
  );
  const consumeBlock = sourceBlock(
    battleSceneSource,
    '  _consumeP15HostileProjectile(pulse, reason) {',
    '  _beginP15HostileProjectileRecovery() {'
  );
  const onEnemyHitPlayer = compileClassMethod(hitBlock, '_onEnemyHitPlayer', {capturePlayerHitSource});
  const consumePulse = compileClassMethod(
    consumeBlock,
    '_consumeP15HostileProjectile',
    {
      P15_234_HOSTILE_PROJECTILE_OWNER: OWNER,
      COMBAT_OBJECT_OWNERS: {
        HIDDEN_STAGE_PRESSURE_PROJECTILE: 'hiddenStagePressureProjectile',
      },
    }
  );

  const exactPulse = {
    active: true,
    x: -999,
    y: -999,
    p15HostileProjectileOwner: OWNER,
    p15HostileProjectileConsumed: false,
    gfx: {
      active: true,
      destroy() { this.active = false; },
    },
    destroy() { this.active = false; },
  };
  const unrelatedBullet = {
    active: true,
    p15HostileProjectileOwner: 'legacy-enemy-bullet',
    p15HostileProjectileConsumed: false,
    destroy() { this.active = false; },
  };
  const scene = {
    _battleEnded: true,
    _p15HostileProjectilePulse: exactPulse,
    _p15HostileProjectilePractice2Active: false,
    _p15HostileProjectilePhase: 'travel',
    _consumeP15HostileProjectile(pulse, reason) {
      return consumePulse.call(this, pulse, reason);
    },
    _beginP15HostileProjectileRecovery() {
      throw new Error('recovery should not start in this inactive fixture');
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

  onEnemyHitPlayer.call(scene, exactPulse);
  assert.equal(exactPulse.p15HostileProjectileConsumed, true);
  assert.equal(exactPulse.p15HostileProjectileEndReason, 'hit');
  assert.equal(exactPulse.active, false, 'exact pulse physics host should be destroyed immediately');
  assert.equal(exactPulse.gfx, null, 'exact pulse Graphics should be destroyed immediately');
  assert.equal(scene._p15HostileProjectilePulse, null, 'owned pulse reference should clear immediately');

  onEnemyHitPlayer.call(scene, exactPulse);
  assert.equal(exactPulse.p15HostileProjectileEndReason, 'hit', 'repeat overlap must not change the end reason');

  onEnemyHitPlayer.call(scene, unrelatedBullet);
  assert.equal(unrelatedBullet.active, true, 'unrelated enemy bullet must not be consumed');
  assert.equal(unrelatedBullet.p15HostileProjectileConsumed, false);

  const consumeIndex = hitBlock.indexOf("this._consumeP15HostileProjectile(sourceBullet, 'hit');");
  const battleGuardIndex = hitBlock.indexOf('if (this._battleEnded) return;');
  const invulnerableGuardIndex = hitBlock.indexOf('if (this.player.invulnerable) return;');
  assert.ok(consumeIndex >= 0, 'player-hit path should consume the exact overlap source');
  assert.ok(consumeIndex < battleGuardIndex, 'exact pulse cleanup must precede battle-ended guard');
  assert.ok(consumeIndex < invulnerableGuardIndex, 'exact pulse cleanup must precede invulnerability guard');
  assert.equal(hitBlock.includes('Distance.Between'), false, 'hit identity must not be reconstructed from coordinates');
  assert.equal(
    battleSceneSource.includes('_consumeCollidingP15HostileProjectileAtPlayer'),
    false,
    'obsolete visible-coordinate collision rescan should be retired'
  );
}

console.log('p15236 hostile projectile overlap identity consumption: all assertions passed');
