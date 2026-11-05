import assert from 'node:assert/strict';
import {
  COMBAT_STAIN_RESOLUTION_MODES,
  createCombatColorEffectPlan,
} from '../src/systems/CombatColorEffectPlan.mjs';

function plan(overrides = {}) {
  return createCombatColorEffectPlan({
    color: 'blue',
    targetAlive: true,
    pinkBeatAccentCritical: false,
    targetWasBurning: false,
    isStage15Practice: false,
    form: 'attack',
    ...overrides,
  });
}

{
  assert.deepEqual(plan(), {
    commitAttackTarget: true,
    applyBlueTempo: true,
    armPinkBeatAccent: false,
    applyBurn: false,
    addCorrosion: false,
    tryHiddenWeakPointBreak: false,
    resolvePublicOrangeConfirmation: true,
    triggerAtmosphereHit: true,
    stainResolution: null,
    recordSupportPhrase: true,
  });
}

{
  assert.equal(plan({ color: 'pink' }).armPinkBeatAccent, true);
  assert.equal(plan({ color: 'pink', pinkBeatAccentCritical: true }).armPinkBeatAccent, false);
  assert.equal(plan({ color: 'pink', targetAlive: false }).armPinkBeatAccent, false);
  assert.equal(plan({ color: 'blue', targetAlive: false }).applyBlueTempo, false);
}

{
  assert.equal(plan({ color: 'orange' }).applyBurn, true);
  assert.equal(plan({ color: 'purple' }).addCorrosion, true);
  assert.equal(plan({ color: 'orange', targetAlive: false }).applyBurn, true);
  assert.equal(plan({ color: 'purple', targetAlive: false }).addCorrosion, true);
}

{
  const hidden = plan({
    color: 'orange',
    isStage15Practice: true,
    targetWasBurning: true,
  });
  assert.equal(hidden.tryHiddenWeakPointBreak, true);
  assert.equal(hidden.resolvePublicOrangeConfirmation, false);
}

{
  assert.equal(
    plan({ form: 'stain' }).stainResolution,
    COMBAT_STAIN_RESOLUTION_MODES.PUBLIC_DISTRIBUTION
  );
  assert.equal(
    plan({ form: 'stain', isStage15Practice: true }).stainResolution,
    COMBAT_STAIN_RESOLUTION_MODES.PRACTICE_SPLASH
  );
  assert.equal(plan({ form: 'support' }).stainResolution, null);
}

console.log('p16005 combat color effect plan: all assertions passed');
