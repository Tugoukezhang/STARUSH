import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COMBAT_RESOLUTION_KINDS,
  beginPlayerProjectileResolution,
  completePlayerProjectileDamageResolution,
} from '../src/systems/CombatResolutionFacade.mjs';

function projectile(overrides = {}) {
  return {
    active: true,
    x: 12,
    y: 34,
    color: 'blue',
    isCrit: false,
    ...overrides,
  };
}

function target(overrides = {}) {
  return {
    active: true,
    hp: 30,
    type: 'trainee',
    ...overrides,
  };
}

{
  const resolution = beginPlayerProjectileResolution({
    projectile: projectile({ active: false }),
    target: target(),
  });
  assert.equal(resolution.accepted, false);
  assert.equal(resolution.kind, COMBAT_RESOLUTION_KINDS.REJECTED);
  assert.equal(resolution.contact.reason, 'projectile-inactive');
}

{
  const resolution = beginPlayerProjectileResolution({
    projectile: projectile({ paintShot: true }),
    target: target({ unlitBlob: true }),
    isPublicStage1: true,
  });
  assert.equal(resolution.accepted, true);
  assert.equal(resolution.kind, COMBAT_RESOLUTION_KINDS.PAINT);
  assert.equal(resolution.contact.targetKind, 'unlit');
  assert.equal(resolution.damageResult, null);
  assert.equal(resolution.effectPlan, null);
}

{
  const started = beginPlayerProjectileResolution({
    projectile: projectile({ color: 'orange', isCrit: true }),
    target: target(),
    isPublicStage1: true,
  });
  const completed = completePlayerProjectileDamageResolution({
    resolution: started,
    hpBefore: 30,
    calculation: { total: 12, isTrueDamage: false },
    pinkBeatAccentCritical: false,
    targetWasBurning: true,
    isStage15Practice: false,
    form: 'support',
  });
  assert.equal(completed.accepted, true);
  assert.equal(completed.kind, COMBAT_RESOLUTION_KINDS.DAMAGE);
  assert.equal(completed.damageResult.hpAfter, 18);
  assert.equal(completed.effectPlan.applyBurn, true);
  assert.equal(completed.effectPlan.resolvePublicOrangeConfirmation, true);
  assert.equal(completed.effectPlan.recordSupportPhrase, true);
}

{
  const rejected = beginPlayerProjectileResolution({
    projectile: projectile({ active: false }),
    target: target(),
  });
  assert.throws(
    () => completePlayerProjectileDamageResolution({ resolution: rejected }),
    /accepted damage contact/
  );
}

const facadeSource = readFileSync(
  new URL('../src/systems/CombatResolutionFacade.mjs', import.meta.url),
  'utf8'
);
['Phaser', 'document.', 'window.', 'localStorage'].forEach((forbidden) => {
  assert.equal(facadeSource.includes(forbidden), false, `facade must remain pure: ${forbidden}`);
});

console.log('p16008 combat resolution facade: all assertions passed');
