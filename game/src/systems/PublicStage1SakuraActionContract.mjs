import {
  PUBLIC_STAGE1_ENEMY_ROLES,
  PUBLIC_STAGE1_ENEMY_STATES,
} from './PublicStage1EnemyRoles.mjs';

export const PUBLIC_STAGE1_SAKURA_ACTION_OWNER_ID = 'sakura';
export const PUBLIC_STAGE1_SAKURA_ENCORE_WINDOW_MS = 5000;
export const PUBLIC_STAGE1_SAKURA_ENCORE_PAINT_MULTIPLIER = 2;
export const PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS = Object.freeze({
  REQUIRED_ANCHOR: 'required-anchor',
  THREAT_RESOLVED: 'threat-resolved',
  FINALE_ATTACK_RESPONSE: 'finale-attack-response',
  FINALE_WEAK_POINT: 'finale-weak-point',
});

const PUBLIC_STAGE1_SAKURA_CHARGE_AWARDS = Object.freeze({
  [PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS.REQUIRED_ANCHOR]: Object.freeze({ special: 22, encore: 8 }),
  [PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS.THREAT_RESOLVED]: Object.freeze({ special: 18, encore: 14 }),
  [PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS.FINALE_ATTACK_RESPONSE]: Object.freeze({ special: 20, encore: 12 }),
  [PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS.FINALE_WEAK_POINT]: Object.freeze({ special: 24, encore: 16 }),
});

export function resolvePublicStage1SakuraChargeAward(eventId) {
  const award = PUBLIC_STAGE1_SAKURA_CHARGE_AWARDS[eventId];
  return award ? { ...award } : { special: 0, encore: 0 };
}

export function canUsePublicStage1SakuraAction({
  isPublicStage1 = false,
  actionOwnerId = null,
  charge = 0,
  battlePaused = false,
  battleEnded = false,
} = {}) {
  return isPublicStage1 === true
    && actionOwnerId === PUBLIC_STAGE1_SAKURA_ACTION_OWNER_ID
    && Number(charge) >= 100
    && battlePaused !== true
    && battleEnded !== true;
}

export function resolvePublicStage1SakuraEncorePaintAmount(baseAmount, active = false) {
  const safeBase = Math.max(0, Number(baseAmount) || 0);
  return active
    ? safeBase * PUBLIC_STAGE1_SAKURA_ENCORE_PAINT_MULTIPLIER
    : safeBase;
}

export function getPublicStage1SakuraLeadCueTargetPriority(enemy) {
  if (!enemy?.active || enemy.destroyed === true) return -1;
  const role = enemy.publicStage1EnemyRole;
  const state = enemy.publicStage1EnemyState;

  if (
    role === PUBLIC_STAGE1_ENEMY_ROLES.FINALE_BOSS
    && state === PUBLIC_STAGE1_ENEMY_STATES.RECOVERY
  ) return 600;
  if (role === PUBLIC_STAGE1_ENEMY_ROLES.FINALE_WEAK_POINT) return 550;
  if (
    role === PUBLIC_STAGE1_ENEMY_ROLES.SPOTLIGHT_CAPTAIN
    && state === PUBLIC_STAGE1_ENEMY_STATES.RECOVERY
  ) return 500;
  if (
    role === PUBLIC_STAGE1_ENEMY_ROLES.OBJECTIVE_DISRUPTOR
    && (
      state === PUBLIC_STAGE1_ENEMY_STATES.WINDUP
      || state === PUBLIC_STAGE1_ENEMY_STATES.DISRUPTING
    )
  ) return 400;
  if (
    role === PUBLIC_STAGE1_ENEMY_ROLES.STAGE_CUE_EMITTER
    && state === PUBLIC_STAGE1_ENEMY_STATES.RECOVERY
  ) return 300;
  if (role === PUBLIC_STAGE1_ENEMY_ROLES.UNLIT_CHASER) return 100;
  return -1;
}
