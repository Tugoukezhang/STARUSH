export const COMBAT_DAMAGE_EFFECT_TYPES = Object.freeze({
  DIRECT_DAMAGE: 'direct-damage',
  TRUE_DAMAGE: 'true-damage',
  TARGET_DEFEATED: 'target-defeated',
});

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function resolveCombatDamageResult({ hpBefore = 0, calculation = {} } = {}) {
  const safeHpBefore = Number.isFinite(Number(hpBefore)) ? Number(hpBefore) : 0;
  const directDamage = nonNegativeNumber(calculation.total);
  const trueDamage = calculation.isTrueDamage === true
    ? nonNegativeNumber(calculation.trueDamageAmount)
    : 0;
  const totalDamage = directDamage + trueDamage;
  const hpAfter = safeHpBefore - totalDamage;
  const killed = hpAfter <= 0;
  const effects = [];

  if (directDamage > 0) {
    effects.push({ type: COMBAT_DAMAGE_EFFECT_TYPES.DIRECT_DAMAGE, amount: directDamage });
  }
  if (trueDamage > 0) {
    effects.push({ type: COMBAT_DAMAGE_EFFECT_TYPES.TRUE_DAMAGE, amount: trueDamage });
  }
  if (killed) {
    effects.push({ type: COMBAT_DAMAGE_EFFECT_TYPES.TARGET_DEFEATED });
  }

  return {
    hpBefore: safeHpBefore,
    directDamage,
    trueDamage,
    totalDamage,
    hpAfter,
    killed,
    effects,
  };
}
