import assert from 'node:assert/strict';
import {
  CombatObjectLifecycleRegistry,
  disposeCombatObject,
} from '../src/systems/CombatObjectLifecycle.mjs';

function makeObject() {
  return {
    active: true,
    gfx: {
      active: true,
      destroyCalls: 0,
      destroy() {
        this.destroyCalls += 1;
        this.active = false;
      },
    },
    destroyCalls: 0,
    destroy() {
      this.destroyCalls += 1;
      this.active = false;
    },
  };
}

{
  const registry = new CombatObjectLifecycleRegistry({ playerProjectile: 2 });
  const first = makeObject();
  const second = makeObject();
  const overflow = makeObject();

  assert.equal(registry.track('playerProjectile', first), true);
  assert.equal(registry.track('playerProjectile', first), true, 'duplicate tracking is idempotent');
  assert.equal(registry.track('playerProjectile', second), true);
  assert.equal(registry.track('playerProjectile', overflow), false);
  assert.deepEqual(registry.snapshot(), { playerProjectile: { active: 2, limit: 2 } });

  assert.equal(registry.release('playerProjectile', first), true);
  assert.equal(registry.release('playerProjectile', first), false);
  assert.equal(registry.track('playerProjectile', overflow), true);

  const disposed = [];
  assert.equal(registry.clearOwner('playerProjectile', (item) => disposed.push(item)), 2);
  assert.equal(disposed.length, 2);
  assert.deepEqual(registry.snapshot(), { playerProjectile: { active: 0, limit: 2 } });
}

{
  const projectile = makeObject();
  const visual = projectile.gfx;
  const released = [];

  assert.equal(disposeCombatObject(projectile, {
    reason: 'hit',
    onRelease: (item) => released.push(item),
  }), true);
  assert.equal(projectile.gfx, null);
  assert.equal(visual.destroyCalls, 1);
  assert.equal(projectile.active, false);
  assert.equal(projectile.destroyCalls, 1);
  assert.equal(released[0].gfx, null);
  assert.equal(projectile.p16DisposeReason, 'hit');
  assert.deepEqual(released, [projectile]);

  assert.equal(disposeCombatObject(projectile, { reason: 'duplicate' }), false);
  assert.equal(projectile.destroyCalls, 1);
}

console.log('p16006 combat object lifecycle: all assertions passed');
