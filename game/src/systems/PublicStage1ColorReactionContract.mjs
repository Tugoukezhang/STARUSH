export const PUBLIC_STAGE1_REACTION_BASE_PAINT = 14;
export const PUBLIC_STAGE1_REACTION_BONUS_PAINT = 8;

export const PUBLIC_STAGE1_REACTION_COLORS = Object.freeze([
  Object.freeze({ id: 'pink', label: '粉', phrase: '直击' }),
  Object.freeze({ id: 'blue', label: '蓝', phrase: '缓行' }),
  Object.freeze({ id: 'yellow', label: '黄', phrase: '连染' }),
  Object.freeze({ id: 'purple', label: '紫', phrase: '转调' }),
  Object.freeze({ id: 'orange', label: '橙', phrase: '扩染' }),
]);

const COLOR_IDS = Object.freeze(PUBLIC_STAGE1_REACTION_COLORS.map(({ id }) => id));

export function isPublicStage1ReactionColor(color) {
  return COLOR_IDS.includes(color);
}

export function getPublicStage1ReactionColor(sequenceIndex = 0) {
  const length = COLOR_IDS.length;
  const numeric = Number.isFinite(Number(sequenceIndex)) ? Math.trunc(Number(sequenceIndex)) : 0;
  const index = ((numeric % length) + length) % length;
  return COLOR_IDS[index];
}

export function resolvePublicStage1ColorReaction({
  selectedColor = null,
  targetColor = null,
  basePaint = PUBLIC_STAGE1_REACTION_BASE_PAINT,
} = {}) {
  const safeBase = Math.max(1, Number(basePaint) || PUBLIC_STAGE1_REACTION_BASE_PAINT);
  const matched = isPublicStage1ReactionColor(selectedColor)
    && selectedColor === targetColor;
  const bonusPaint = matched ? PUBLIC_STAGE1_REACTION_BONUS_PAINT : 0;
  return {
    selectedColor,
    targetColor,
    matched,
    basePaint: safeBase,
    bonusPaint,
    totalPaint: safeBase + bonusPaint,
    feedback: matched ? '合拍' : '',
  };
}

// Original first-stage tuning. Matching a visible cue remains optional; each
// color also has a useful role without requiring the target to match it.
export function planPublicStage1ColorEffect({ color, now = 0, primeUntil = 0 } = {}) {
  const valid = isPublicStage1ReactionColor(color);
  const consumedPrime = valid && color !== 'purple' && primeUntil > now;
  return {
    damageBonus: (color === 'pink' ? 6 : 0) + (consumedPrime ? 14 : 0),
    slow: color === 'blue',
    chainPaint: color === 'yellow' ? 7 : 0,
    anchorPaint: color === 'orange' ? 7 : 0,
    primeUntil: color === 'purple' ? now + 2400 : consumedPrime ? 0 : primeUntil,
    consumedPrime,
  };
}
