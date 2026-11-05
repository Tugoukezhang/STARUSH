import {
  PLAYER_PROJECTILE_IMPACT_KINDS,
  createPlayerProjectileContactEvent,
} from './CombatContactEvent.mjs';
import { resolveCombatDamageResult } from './CombatDamageResult.mjs';
import {
  COMBAT_STAIN_RESOLUTION_MODES,
  createCombatColorEffectPlan,
} from './CombatColorEffectPlan.mjs';

export { COMBAT_STAIN_RESOLUTION_MODES };

export const COMBAT_RESOLUTION_KINDS = Object.freeze({
  REJECTED: 'rejected',
  PAINT: 'paint',
  DAMAGE: 'damage',
});

export function beginPlayerProjectileResolution({
  projectile,
  target,
  battleEnded = false,
  isPublicStage1 = false,
} = {}) {
  const contact = createPlayerProjectileContactEvent({
    projectile,
    target,
    battleEnded,
    isPublicStage1,
  });
  if (!contact.accepted) {
    return {
      accepted: false,
      kind: COMBAT_RESOLUTION_KINDS.REJECTED,
      contact,
      damageResult: null,
      effectPlan: null,
    };
  }

  return {
    accepted: true,
    kind: contact.impactKind === PLAYER_PROJECTILE_IMPACT_KINDS.PAINT
      ? COMBAT_RESOLUTION_KINDS.PAINT
      : COMBAT_RESOLUTION_KINDS.DAMAGE,
    contact,
    damageResult: null,
    effectPlan: null,
  };
}

export function completePlayerProjectileDamageResolution({
  resolution,
  hpBefore = 0,
  calculation = {},
  pinkBeatAccentCritical = false,
  targetWasBurning = false,
  isStage15Practice = false,
  form = null,
} = {}) {
  if (resolution?.accepted !== true || resolution.kind !== COMBAT_RESOLUTION_KINDS.DAMAGE) {
    throw new Error('completePlayerProjectileDamageResolution requires an accepted damage contact');
  }

  const damageResult = resolveCombatDamageResult({ hpBefore, calculation });
  const effectPlan = createCombatColorEffectPlan({
    color: resolution.contact.color,
    targetAlive: damageResult.killed !== true,
    pinkBeatAccentCritical,
    targetWasBurning,
    isStage15Practice,
    form,
  });

  return {
    ...resolution,
    damageResult,
    effectPlan,
  };
}
