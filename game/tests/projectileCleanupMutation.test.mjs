import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadScenes } from './helpers/publicShellHarness.mjs';

const require = createRequire(import.meta.url);
const PhaserSet = require('phaser/src/structs/Set.js');
const env = loadScenes();
const { BattleScene } = env.loadRuntime('scenes/BattleScene.js');
const { COMBAT_OBJECT_OWNERS: OWNERS, createDefaultCombatObjectLifecycleRegistry } =
  env.loadRuntime('systems/CombatObjectLifecycle.mjs');
const ENEMY_OWNERS = [
  OWNERS.ENEMY_PROJECTILE,
  OWNERS.PUBLIC_STAGE_PRESSURE_PROJECTILE,
  OWNERS.HIDDEN_STAGE_PRESSURE_PROJECTILE,
];

// Mirrors Phaser Group membership: destroying a child removes it from the group's own Set.
function addBullet(children, registry, owner, index, destroys) {
  const bullet = {
    x: 100 + index,
    y: 200 + index,
    p16LifecycleOwner: owner,
    gfx: { destroyed: false, destroy() { this.destroyed = true; } },
    destroy() {
      destroys.set(bullet, (destroys.get(bullet) || 0) + 1);
      children.delete(bullet);
    },
  };
  children.set(bullet);
  assert.equal(registry.track(owner, bullet), true);
  return bullet;
}

function createScene(count, ownerFor) {
  const scene = Object.create(BattleScene.prototype);
  const registry = createDefaultCombatObjectLifecycleRegistry();
  const children = new PhaserSet();
  const destroys = new Map();
  const bullets = Array.from({ length: count }, (_, i) => addBullet(children, registry, ownerFor(i), i, destroys));
  const clearCalls = [];
  const clearOwner = registry.clearOwner.bind(registry);
  registry.clearOwner = (owner, disposer) => {
    clearCalls.push({ owner, childrenLeft: children.size });
    return clearOwner(owner, disposer);
  };
  scene.combatObjectLifecycle = registry;
  return { scene, registry, children, destroys, bullets, clearCalls };
}

function activeCount(registry, owners) {
  const snapshot = registry.snapshot();
  return owners.reduce((sum, owner) => sum + snapshot[owner].active, 0);
}

const cases = [
  {
    name: 'player',
    owners: [OWNERS.PLAYER_PROJECTILE],
    ownerFor: () => OWNERS.PLAYER_PROJECTILE,
    groupKey: 'playerBullets',
    disposerKey: '_disposePlayerProjectile',
    clear: (scene) => scene._clearActivePlayerBulletGraphics(),
  },
  {
    name: 'enemy',
    owners: ENEMY_OWNERS,
    ownerFor: (i) => ENEMY_OWNERS[i % ENEMY_OWNERS.length],
    groupKey: 'enemyBullets',
    disposerKey: '_disposeEnemyProjectile',
    clear: (scene) => scene._clearActiveEnemyProjectileGraphics(),
  },
];

for (const spec of cases) {
  for (const count of [2, 3, 4]) {
    // Regression proof: Phaser Set.iterate reads live entries while disposal deletes them.
    {
      const fx = createScene(count, spec.ownerFor);
      fx.children.iterate((bullet) => fx.scene[spec.disposerKey](bullet, 'scene-clear'));
      spec.owners.forEach((owner) => fx.registry.clearOwner(owner));
      assert.ok(fx.children.size > 0, `${spec.name} ${count}: Set.iterate must leave a live child behind`);
      assert.equal(activeCount(fx.registry, spec.owners), 0, `${spec.name} ${count}: registry is cleared anyway`);
    }

    // Formal cleanup: every child disposed exactly once, registry cleared only after children are empty.
    {
      const fx = createScene(count, spec.ownerFor);
      fx.scene[spec.groupKey] = { children: fx.children };
      spec.clear(fx.scene);
      assert.equal(fx.children.size, 0, `${spec.name} ${count}: all children removed`);
      fx.bullets.forEach((bullet, i) => {
        assert.equal(fx.destroys.get(bullet), 1, `${spec.name} ${count}: bullet ${i} destroyed once`);
        assert.equal(bullet.p16Disposed, true);
        assert.equal(bullet.p16DisposeReason, 'scene-clear');
        assert.equal(bullet.gfx, null);
      });
      assert.equal(activeCount(fx.registry, spec.owners), 0, `${spec.name} ${count}: registry empty`);
      assert.deepEqual(fx.clearCalls.map((call) => call.owner), spec.owners);
      fx.clearCalls.forEach((call) => assert.equal(call.childrenLeft, 0, `${spec.name} ${count}: registry cleared before children empty`));

      spec.clear(fx.scene);
      assert.equal(fx.children.size, 0, `${spec.name} ${count}: repeat clear stays empty`);
      fx.bullets.forEach((bullet) => assert.equal(fx.destroys.get(bullet), 1, `${spec.name} ${count}: repeat clear is idempotent`));
    }

    // QA-style observer wrapper reads bullet.x before delegating; it must never receive undefined.
    {
      const fx = createScene(count, spec.ownerFor);
      fx.scene[spec.groupKey] = { children: fx.children };
      const original = fx.scene[spec.disposerKey];
      const seen = [];
      fx.scene[spec.disposerKey] = function observed(bullet, ...rest) {
        seen.push(bullet.x);
        return original.call(this, bullet, ...rest);
      };
      assert.doesNotThrow(() => spec.clear(fx.scene), `${spec.name} ${count}: wrapper must not see undefined`);
      assert.deepEqual(seen, fx.bullets.map((bullet) => bullet.x));
      assert.equal(fx.children.size, 0);
      assert.equal(activeCount(fx.registry, spec.owners), 0);
    }
  }
}

console.log('projectileCleanupMutation: ok');
