export const COMBAT_STAIN_RESOLUTION_MODES = Object.freeze({
  PRACTICE_SPLASH: 'practice-splash',
  PUBLIC_DISTRIBUTION: 'public-distribution',
});

export function createCombatColorEffectPlan({
  color = null,
  targetAlive = false,
  pinkBeatAccentCritical = false,
  targetWasBurning = false,
  isStage15Practice = false,
  form = null,
} = {}) {
  const practice = isStage15Practice === true;
  let stainResolution = null;
  if (form === 'stain') {
    stainResolution = practice
      ? COMBAT_STAIN_RESOLUTION_MODES.PRACTICE_SPLASH
      : COMBAT_STAIN_RESOLUTION_MODES.PUBLIC_DISTRIBUTION;
  }

  return {
    commitAttackTarget: true,
    applyBlueTempo: color === 'blue' && targetAlive === true,
    armPinkBeatAccent: color === 'pink'
      && targetAlive === true
      && pinkBeatAccentCritical !== true,
    applyBurn: color === 'orange',
    addCorrosion: color === 'purple',
    tryHiddenWeakPointBreak: practice && targetWasBurning === true,
    resolvePublicOrangeConfirmation: !practice,
    triggerAtmosphereHit: true,
    stainResolution,
    recordSupportPhrase: true,
  };
}
