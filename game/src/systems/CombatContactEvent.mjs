export const COMBAT_CONTACT_EVENT_TYPES = Object.freeze({
  PLAYER_PROJECTILE_CONTACT: 'player-projectile-contact',
});

export const PLAYER_PROJECTILE_IMPACT_KINDS = Object.freeze({
  DAMAGE: 'damage',
  PAINT: 'paint',
});

function rejected(reason) {
  return { accepted: false, reason };
}

export function createPlayerProjectileContactEvent({
  projectile,
  target,
  battleEnded = false,
  isPublicStage1 = false,
} = {}) {
  if (battleEnded === true) return rejected('battle-ended');
  if (!projectile || projectile.active !== true) return rejected('projectile-inactive');
  if (!target || target.active !== true) return rejected('target-inactive');

  const impactKind = isPublicStage1 === true && projectile.paintShot === true
    ? PLAYER_PROJECTILE_IMPACT_KINDS.PAINT
    : PLAYER_PROJECTILE_IMPACT_KINDS.DAMAGE;

  return {
    accepted: true,
    type: COMBAT_CONTACT_EVENT_TYPES.PLAYER_PROJECTILE_CONTACT,
    impactKind,
    projectile,
    target,
    targetKind: target.unlitBlob === true ? 'unlit' : String(target.type || 'enemy'),
    impact: {
      x: Number(projectile.x) || 0,
      y: Number(projectile.y) || 0,
    },
    color: projectile.color || null,
    isCrit: projectile.isCrit === true,
  };
}
