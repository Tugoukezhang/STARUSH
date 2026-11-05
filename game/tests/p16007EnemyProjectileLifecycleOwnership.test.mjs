import assert from 'node:assert/strict';
import {
  COMBAT_OBJECT_OWNERS,
  DEFAULT_COMBAT_OBJECT_LIMITS,
  createDefaultCombatObjectLifecycleRegistry,
  disposeCombatObject,
} from '../src/systems/CombatObjectLifecycle.mjs';

function makeProjectile() {
  return {
    active: true,
    gfx: {
      destroyCalls: 0,
      destroy() { this.destroyCalls += 1; },
    },
    destroyCalls: 0,
    destroy() {
      this.destroyCalls += 1;
      this.active = false;
    },
  };
}

assert.deepEqual(COMBAT_OBJECT_OWNERS, {
  PLAYER_PROJECTILE: 'playerProjectile',
  ENEMY_PROJECTILE: 'enemyProjectile',
  PUBLIC_STAGE_PRESSURE_PROJECTILE: 'publicStagePressureProjectile',
  HIDDEN_STAGE_PRESSURE_PROJECTILE: 'hiddenStagePressureProjectile',
});
assert.deepEqual(DEFAULT_COMBAT_OBJECT_LIMITS, {
  playerProjectile: 64,
  enemyProjectile: 64,
  publicStagePressureProjectile: 4,
  hiddenStagePressureProjectile: 4,
});

const registry = createDefaultCombatObjectLifecycleRegistry();
const ordinary = makeProjectile();
const publicPressure = makeProjectile();
const hiddenPressure = makeProjectile();

assert.equal(registry.track(COMBAT_OBJECT_OWNERS.ENEMY_PROJECTILE, ordinary), true);
assert.equal(registry.track(COMBAT_OBJECT_OWNERS.PUBLIC_STAGE_PRESSURE_PROJECTILE, publicPressure), true);
assert.equal(registry.track(COMBAT_OBJECT_OWNERS.HIDDEN_STAGE_PRESSURE_PROJECTILE, hiddenPressure), true);
assert.deepEqual(registry.snapshot(), {
  playerProjectile: { active: 0, limit: 64 },
  enemyProjectile: { active: 1, limit: 64 },
  publicStagePressureProjectile: { active: 1, limit: 4 },
  hiddenStagePressureProjectile: { active: 1, limit: 4 },
});

assert.equal(disposeCombatObject(publicPressure, {
  reason: 'hit',
  onRelease: (item) => registry.release(
    COMBAT_OBJECT_OWNERS.PUBLIC_STAGE_PRESSURE_PROJECTILE,
    item
  ),
}), true);
assert.equal(disposeCombatObject(publicPressure, { reason: 'expired' }), false);
assert.equal(publicPressure.p16DisposeReason, 'hit', 'first terminal reason must remain authoritative');
assert.deepEqual(registry.snapshot().publicStagePressureProjectile, { active: 0, limit: 4 });

console.log('p16007 enemy projectile lifecycle ownership: all assertions passed');
