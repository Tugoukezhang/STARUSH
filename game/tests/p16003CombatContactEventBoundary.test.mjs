import assert from 'node:assert/strict';
import {
  COMBAT_CONTACT_EVENT_TYPES,
  PLAYER_PROJECTILE_IMPACT_KINDS,
  createPlayerProjectileContactEvent,
} from '../src/systems/CombatContactEvent.mjs';

function makeProjectile(overrides = {}) {
  return {
    active: true,
    x: 120,
    y: 220,
    color: 'pink',
    isCrit: false,
    paintShot: false,
    ...overrides,
  };
}

function makeTarget(overrides = {}) {
  return {
    active: true,
    x: 125,
    y: 215,
    type: 'trainee',
    ...overrides,
  };
}

{
  const projectile = makeProjectile();
  const target = makeTarget();
  const event = createPlayerProjectileContactEvent({ projectile, target });

  assert.equal(event.accepted, true);
  assert.equal(event.type, COMBAT_CONTACT_EVENT_TYPES.PLAYER_PROJECTILE_CONTACT);
  assert.equal(event.impactKind, PLAYER_PROJECTILE_IMPACT_KINDS.DAMAGE);
  assert.equal(event.projectile, projectile);
  assert.equal(event.target, target);
  assert.deepEqual(event.impact, { x: 120, y: 220 });
  assert.equal(event.color, 'pink');
  assert.equal(event.isCrit, false);
}

{
  const projectile = makeProjectile({ paintShot: true, color: 'blue', isCrit: true });
  const target = makeTarget({ type: undefined, unlitBlob: true });
  const event = createPlayerProjectileContactEvent({
    projectile,
    target,
    isPublicStage1: true,
  });

  assert.equal(event.accepted, true);
  assert.equal(event.impactKind, PLAYER_PROJECTILE_IMPACT_KINDS.PAINT);
  assert.equal(event.targetKind, 'unlit');
  assert.equal(event.color, 'blue');
  assert.equal(event.isCrit, true);
}

{
  const legacyPaintFlag = createPlayerProjectileContactEvent({
    projectile: makeProjectile({ paintShot: true }),
    target: makeTarget(),
    isPublicStage1: false,
  });
  assert.equal(
    legacyPaintFlag.impactKind,
    PLAYER_PROJECTILE_IMPACT_KINDS.DAMAGE,
    'paint flags outside public Stage 1 must not bypass the canonical damage path'
  );
}

{
  const ended = createPlayerProjectileContactEvent({
    projectile: makeProjectile(),
    target: makeTarget(),
    battleEnded: true,
  });
  assert.deepEqual(ended, { accepted: false, reason: 'battle-ended' });

  const inactiveProjectile = createPlayerProjectileContactEvent({
    projectile: makeProjectile({ active: false }),
    target: makeTarget(),
  });
  assert.deepEqual(inactiveProjectile, { accepted: false, reason: 'projectile-inactive' });

  const inactiveTarget = createPlayerProjectileContactEvent({
    projectile: makeProjectile(),
    target: makeTarget({ active: false }),
  });
  assert.deepEqual(inactiveTarget, { accepted: false, reason: 'target-inactive' });
}

console.log('p16003 combat contact event boundary: all assertions passed');
