export const PUBLIC_STAGE1_FINALE_OUTCOMES = Object.freeze({
  ACTIVE: 'active',
  COMPLETED: 'completed',
  TIMEOUT: 'timeout',
});

function count(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

export function canPublicStage1EndInVictory({ isPublicStage1 = false, outcome = null } = {}) {
  if (isPublicStage1 !== true) return true;
  return outcome === PUBLIC_STAGE1_FINALE_OUTCOMES.COMPLETED;
}

export function resolvePublicStage1FinaleResultProgress({
  isPublicStage1 = false,
  objectivesComplete = false,
  outcome = null,
  fallbackComplete = false,
  fallbackTotalWaves = 0,
  fallbackClearedWaveCount = 0,
} = {}) {
  if (isPublicStage1 !== true) {
    return {
      paintRoundComplete: fallbackComplete === true,
      totalWaves: count(fallbackTotalWaves),
      clearedWaveCount: count(fallbackClearedWaveCount),
    };
  }

  const completed = outcome === PUBLIC_STAGE1_FINALE_OUTCOMES.COMPLETED;
  return {
    paintRoundComplete: completed,
    totalWaves: 2,
    clearedWaveCount: completed ? 2 : (objectivesComplete === true ? 1 : 0),
  };
}
