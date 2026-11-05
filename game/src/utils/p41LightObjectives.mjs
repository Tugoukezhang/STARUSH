export const P41_STAGE1_REPLAY_OBJECTIVE_ID = 'stage1-clear-two-waves';
export const P47_STAGE1_REPLAY_OBJECTIVE_INDEX_KEY = 'starush.p47.stage1ReplayObjectiveIndex';

const STAGE_1_REPLAY_OBJECTIVES = Object.freeze([
  Object.freeze({
    id: P41_STAGE1_REPLAY_OBJECTIVE_ID,
    kind: 'hard',
    titleLine: '复演目标：点亮场馆装置',
  }),
  Object.freeze({
    id: 'stage1-steady-clear',
    kind: 'hard',
    titleLine: '复演目标：更稳完成，少被碰到',
  }),
  Object.freeze({
    id: 'stage1-highlight-c-or-encore',
    kind: 'optional-highlight',
    titleLine: '高光挑战：试试 C位或 Encore',
  }),
]);

function normalizeCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count) || count < 0) return 0;
  return Math.floor(count);
}

export function normalizeStage1ReplayObjectiveIndex(value) {
  const index = normalizeCount(value);
  return Math.min(index, STAGE_1_REPLAY_OBJECTIVES.length - 1);
}

export function readP47Stage1ReplayObjectiveIndex(storage = globalThis?.sessionStorage) {
  try {
    return normalizeStage1ReplayObjectiveIndex(storage?.getItem?.(P47_STAGE1_REPLAY_OBJECTIVE_INDEX_KEY));
  } catch {
    return 0;
  }
}

export function writeP47Stage1ReplayObjectiveIndex(index, storage = globalThis?.sessionStorage) {
  const normalized = normalizeStage1ReplayObjectiveIndex(index);
  try {
    storage?.setItem?.(P47_STAGE1_REPLAY_OBJECTIVE_INDEX_KEY, String(normalized));
  } catch {
    // This is only a session-local replay hint; gameplay continues if storage is unavailable.
  }
  return normalized;
}

export function getStage1ReplayLightObjective({
  stageId = 1,
  stage1ClearCount = 0,
  stage1ReplayObjectiveIndex = 0,
} = {}) {
  if (Number(stageId) !== 1) return null;
  if (normalizeCount(stage1ClearCount) < 1) return null;
  return STAGE_1_REPLAY_OBJECTIVES[normalizeStage1ReplayObjectiveIndex(stage1ReplayObjectiveIndex)];
}

export function getStage1ReplayObjectiveTitleLine(params = {}) {
  return getStage1ReplayLightObjective(params)?.titleLine || '';
}

function isStage1TwoWaveVictory({ resultType, clearedWaveCount, totalWaves }) {
  return resultType === 'victory'
    && normalizeCount(totalWaves) === 2
    && normalizeCount(clearedWaveCount) >= 2;
}

function getFailureObjectiveLine(resultType) {
  return '复演目标：本次还差一点';
}

function getHighlightLine({ cPositionTriggered = false, encoreTriggered = false } = {}) {
  if (cPositionTriggered && encoreTriggered) return '本局高光：C位登场 / Encore 安可';
  if (cPositionTriggered) return '本局高光：C位登场';
  if (encoreTriggered) return '本局高光：Encore 安可';
  return '本局高光：节奏稳住了';
}

export function getStage1ReplayLightObjectiveResultLine({
  stageId = 1,
  stage1ClearCount = 0,
  stage1ReplayObjectiveIndex = 0,
  resultType,
  clearedWaveCount = 0,
  totalWaves = 0,
  playerHitCount = 0,
  cPositionTriggered = false,
  encoreTriggered = false,
} = {}) {
  const objective = getStage1ReplayLightObjective({
    stageId,
    stage1ClearCount,
    stage1ReplayObjectiveIndex,
  });
  if (!objective) return '';
  if (normalizeCount(totalWaves) !== 2) return '';

  if (objective.kind === 'optional-highlight') {
    return getHighlightLine({ cPositionTriggered, encoreTriggered });
  }

  if (!isStage1TwoWaveVictory({ resultType, clearedWaveCount, totalWaves })) {
    return getFailureObjectiveLine(resultType);
  }

  if (objective.id === P41_STAGE1_REPLAY_OBJECTIVE_ID) {
    return '复演目标：已点亮场馆装置';
  }

  if (objective.id === 'stage1-steady-clear') {
    return normalizeCount(playerHitCount) <= 1
      ? '复演目标：这次更稳了'
      : '复演目标：下次保持移动，少被碰到';
  }

  return '';
}

export function getNextStage1ReplayObjectiveIndex({
  stageId = 1,
  stage1ClearCount = 0,
  stage1ReplayObjectiveIndex = 0,
  resultType,
  clearedWaveCount = 0,
  totalWaves = 0,
  playerHitCount = 0,
} = {}) {
  const currentIndex = normalizeStage1ReplayObjectiveIndex(stage1ReplayObjectiveIndex);
  const objective = getStage1ReplayLightObjective({
    stageId,
    stage1ClearCount,
    stage1ReplayObjectiveIndex: currentIndex,
  });
  if (!objective || objective.kind === 'optional-highlight') return currentIndex;
  if (!isStage1TwoWaveVictory({ resultType, clearedWaveCount, totalWaves })) return currentIndex;

  if (objective.id === P41_STAGE1_REPLAY_OBJECTIVE_ID) return 1;
  if (objective.id === 'stage1-steady-clear' && normalizeCount(playerHitCount) <= 1) return 2;
  return currentIndex;
}
