import assert from 'node:assert/strict';
import {
  COMBAT_DAMAGE_EFFECT_TYPES,
  resolveCombatDamageResult,
} from '../src/systems/CombatDamageResult.mjs';

{
  const resolved = resolveCombatDamageResult({
    hpBefore: 100,
    calculation: {
      total: 24,
      isTrueDamage: false,
      trueDamageAmount: 99,
    },
  });

  assert.deepEqual(resolved, {
    hpBefore: 100,
    directDamage: 24,
    trueDamage: 0,
    totalDamage: 24,
    hpAfter: 76,
    killed: false,
    effects: [
      { type: COMBAT_DAMAGE_EFFECT_TYPES.DIRECT_DAMAGE, amount: 24 },
    ],
  });
}

{
  const resolved = resolveCombatDamageResult({
    hpBefore: 30,
    calculation: {
      total: 18,
      isTrueDamage: true,
      trueDamageAmount: 7,
    },
  });

  assert.equal(resolved.hpAfter, 5);
  assert.equal(resolved.totalDamage, 25);
  assert.equal(resolved.killed, false);
  assert.deepEqual(resolved.effects, [
    { type: COMBAT_DAMAGE_EFFECT_TYPES.DIRECT_DAMAGE, amount: 18 },
    { type: COMBAT_DAMAGE_EFFECT_TYPES.TRUE_DAMAGE, amount: 7 },
  ]);
}

{
  const resolved = resolveCombatDamageResult({
    hpBefore: 20,
    calculation: {
      total: 30,
      isTrueDamage: true,
      trueDamageAmount: 5,
    },
  });

  assert.equal(resolved.hpAfter, -15, 'overkill remains observable for existing cleanup semantics');
  assert.equal(resolved.killed, true);
  assert.deepEqual(resolved.effects.at(-1), {
    type: COMBAT_DAMAGE_EFFECT_TYPES.TARGET_DEFEATED,
  });
}

{
  const resolved = resolveCombatDamageResult({
    hpBefore: 12,
    calculation: {
      total: Number.NaN,
      isTrueDamage: true,
      trueDamageAmount: -5,
    },
  });

  assert.equal(resolved.hpAfter, 12);
  assert.equal(resolved.totalDamage, 0);
  assert.equal(resolved.killed, false);
  assert.deepEqual(resolved.effects, []);
}

console.log('p16004 combat damage result: all assertions passed');
