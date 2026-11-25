export const PUBLIC_STAGE1_ENEMY_ROLES = Object.freeze({
  UNLIT_CHASER: 'unlit-chaser',
  STAGE_CUE_EMITTER: 'stage-cue-emitter',
  OBJECTIVE_DISRUPTOR: 'objective-disruptor',
  SPOTLIGHT_CAPTAIN: 'spotlight-captain',
  FINALE_BOSS: 'finale-boss',
  FINALE_WEAK_POINT: 'finale-weak-point',
});

export const PUBLIC_STAGE1_ENEMY_STATES = Object.freeze({
  WINDUP: 'windup',
  DISRUPTING: 'disrupting',
  RECOVERY: 'recovery',
});

export function canEnemyDealContactDamage({ enemy, isPublicStage1 = false } = {}) {
  if (!enemy?.active || enemy.destroyed === true) return false;
  if (!isPublicStage1) return true;
  return enemy.publicStage1EnemyRole === PUBLIC_STAGE1_ENEMY_ROLES.UNLIT_CHASER;
}

// One second of ordinary approach at 48 units/s. A spent rush has no contact damage.
export function isCloseContactThreat(enemy, distance) {
  return distance <= 48 && enemy?.publicStage1EnemyRole === PUBLIC_STAGE1_ENEMY_ROLES.UNLIT_CHASER
    && enemy.active === true && !enemy.destroyed && enemy.hp > 0
    && enemy.chapterChaserMotion?.state !== 'recovery';
}

// One chaser body radius of tolerance between ordinary attacks avoids left/right oscillation.
export function getBasicAimDistance(target, distance, previous) {
  return target === previous && target?.publicStage1EnemyRole === PUBLIC_STAGE1_ENEMY_ROLES.UNLIT_CHASER
    ? distance - 12 : distance;
}

export function canEnemyBePublicStage1PaintTarget(enemy) {
  if (!enemy?.active || enemy.destroyed === true) return false;
  if (enemy.publicStage1EnemyRole === PUBLIC_STAGE1_ENEMY_ROLES.UNLIT_CHASER) return true;
  if (enemy.publicStage1EnemyRole === PUBLIC_STAGE1_ENEMY_ROLES.OBJECTIVE_DISRUPTOR) {
    return enemy.publicStage1EnemyState === PUBLIC_STAGE1_ENEMY_STATES.WINDUP
      || enemy.publicStage1EnemyState === PUBLIC_STAGE1_ENEMY_STATES.DISRUPTING;
  }
  if (enemy.publicStage1EnemyRole === PUBLIC_STAGE1_ENEMY_ROLES.SPOTLIGHT_CAPTAIN) {
    return enemy.publicStage1EnemyState === PUBLIC_STAGE1_ENEMY_STATES.RECOVERY;
  }
  if (enemy.publicStage1EnemyRole === PUBLIC_STAGE1_ENEMY_ROLES.FINALE_WEAK_POINT) return true;
  if (enemy.publicStage1EnemyRole === PUBLIC_STAGE1_ENEMY_ROLES.FINALE_BOSS) {
    return enemy.publicStage1EnemyState === PUBLIC_STAGE1_ENEMY_STATES.RECOVERY;
  }
  return enemy.publicStage1EnemyRole === PUBLIC_STAGE1_ENEMY_ROLES.STAGE_CUE_EMITTER
    && enemy.publicStage1EnemyState === PUBLIC_STAGE1_ENEMY_STATES.RECOVERY;
}

// Aiming at a protected body is not permission to deal paint damage or award impact.
export function isProtectedPublicStage1Boss(enemy) {
  return enemy?.active === true && enemy.destroyed !== true && Number.isFinite(enemy.hp) && enemy.hp > 0
    && enemy.publicStage1EnemyRole === PUBLIC_STAGE1_ENEMY_ROLES.FINALE_BOSS
    && enemy.publicStage1EnemyState === PUBLIC_STAGE1_ENEMY_STATES.WINDUP;
}

export function canEnemyUseLegacyBottomChaseAI({ enemy, isPublicStage1 = false } = {}) {
  if (!enemy?.active || enemy.destroyed === true) return false;
  if (!isPublicStage1) return true;
  return !enemy.publicStage1EnemyRole;
}
