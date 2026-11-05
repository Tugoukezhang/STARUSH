import { isPublicStage1PaintRound } from './stage1PaintRound.mjs';

export function normalizeBattleData(data = {}, getStageById) {
  const source = data && typeof data === 'object' ? data : {};
  const nested = source.battleData && typeof source.battleData === 'object'
    ? source.battleData
    : {};
  const normalized = { ...nested, ...source };
  delete normalized.battleData;

  const rawStageId = normalized.stageId ?? 1;
  const numericStageId = Number(rawStageId);
  const stageId = Number.isFinite(numericStageId) && numericStageId > 0
    ? numericStageId
    : 1;
  const stage = typeof getStageById === 'function' ? getStageById(stageId) : null;
  const rawStageWaves = normalized.stageWaves ?? stage?.waves;
  const stageWaves = Number(rawStageWaves);

  return {
    ...normalized,
    stageId,
    stageName: normalized.stageName ?? stage?.name,
    stageWaves: Number.isFinite(stageWaves) && stageWaves > 0 ? stageWaves : undefined,
    practiceMode: normalized.practiceMode === true,
  };
}

const STAGE_1_INTERVALS_MS = Object.freeze([2000, 1800]);
const STAGE_1_PUBLIC_TRAINEE_CAPS = Object.freeze([8, 7]);
const STAGE_1_PUBLIC_MIN_ACTIVE_MS = Object.freeze([55000, 70000]);
const STAGE_1_PUBLIC_MAX_ALIVE = 4;
export const STAGE_1_PRACTICE_TARGET_TYPE = 'stage1PracticeTarget';
export const STAGE_1_CUE_CALLER_TYPE = 'stage1CueCaller';
export const STAGE_15_DRIFTING_LIGHTSTICK_TYPE = 'stage15DriftingLightstick';
export const STAGE_15_STAGE_MARKER_TARGET_TYPE = 'stage15StageMarkerTarget';
export const STAGE_1_WAVE_PRESSURE_ACTION_ID = 'stage1-wave-pressure-event';
export const STAGE_1_WAVE_PRESSURE_CAPTURE_MODES = Object.freeze({
  CURRENT_LANE: 'current-lane',
  MOMENTUM_LANE: 'momentum-lane',
});
export const STAGE_1_WAVE_PRESSURE_START_MODES = Object.freeze({
  AFTER_SPAWNS: 'after-spawns',
  OWNER_SPAWN: 'owner-spawn',
});

const STAGE_1_WAVE_PRESSURE_ACTIONS = Object.freeze([
  Object.freeze({
    id: STAGE_1_WAVE_PRESSURE_ACTION_ID,
    postSpawnLeadMs: 500,
    captureMode: STAGE_1_WAVE_PRESSURE_CAPTURE_MODES.CURRENT_LANE,
    startMode: STAGE_1_WAVE_PRESSURE_START_MODES.AFTER_SPAWNS,
  }),
  Object.freeze({
    id: STAGE_1_WAVE_PRESSURE_ACTION_ID,
    captureMode: STAGE_1_WAVE_PRESSURE_CAPTURE_MODES.MOMENTUM_LANE,
    startMode: STAGE_1_WAVE_PRESSURE_START_MODES.OWNER_SPAWN,
    ownerType: STAGE_1_CUE_CALLER_TYPE,
  }),
]);

const STAGE_1_PRACTICE_SEGMENT_DEFS = Object.freeze([
  Object.freeze({
    wave: 1,
    label: 'Practice 1',
    interval: 3000,
    minActiveMs: 9000,
    enemies: Object.freeze([{ type: 'trainee', count: 2 }]),
  }),
  Object.freeze({
    wave: 2,
    label: 'Practice 2',
    interval: 2200,
    minActiveMs: 12000,
    enemies: Object.freeze([{ type: STAGE_15_DRIFTING_LIGHTSTICK_TYPE, count: 2 }]),
  }),
  Object.freeze({
    wave: 3,
    label: 'Practice 3',
    interval: 500,
    minActiveMs: 8000,
    enemies: Object.freeze([
      { type: 'trainee', count: 1 },
      { type: STAGE_15_STAGE_MARKER_TARGET_TYPE, count: 1 },
    ]),
  }),
  Object.freeze({
    wave: 4,
    label: 'Practice 4',
    interval: 2200,
    minActiveMs: 10000,
    enemies: Object.freeze([{ type: STAGE_1_PRACTICE_TARGET_TYPE, count: 1 }]),
  }),
]);

function buildStage1PracticeSegmentDefs() {
  return STAGE_1_PRACTICE_SEGMENT_DEFS.map((def) => ({
    ...def,
    enemies: def.enemies.map((enemy) => ({ ...enemy })),
  }));
}

function normalizeReplayObjectiveIndex(value) {
  const index = Number(value);
  if (!Number.isFinite(index) || index < 0) return 0;
  return Math.floor(index);
}

function shouldAddStage1PracticeTarget(normalized, waveIndex) {
  if (normalized.stageId !== 1 || waveIndex !== 1) return false;
  const index = normalizeReplayObjectiveIndex(
    normalized.p47Stage1ReplayObjectiveIndex ?? normalized.stage1ReplayObjectiveIndex
  );
  return index >= 2;
}

function buildStage1PublicEnemies(def, waveIndex) {
  const cap = STAGE_1_PUBLIC_TRAINEE_CAPS[waveIndex] ?? 6;
  const enemies = def.enemies.map((enemy) => ({
    ...enemy,
    count: enemy.type === 'trainee' ? cap : enemy.count,
  }));
  if (waveIndex !== 1) return enemies;

  const traineeIndex = enemies.findIndex((enemy) => enemy.type === 'trainee' && enemy.count > 0);
  if (traineeIndex < 0) return enemies;

  const trainee = enemies[traineeIndex];
  const rebased = [
    { type: STAGE_1_CUE_CALLER_TYPE, count: 1, spawnOrder: 'first' },
  ];
  enemies.forEach((enemy, index) => {
    if (index !== traineeIndex) {
      rebased.push(enemy);
      return;
    }
    if (trainee.count > 1) {
      rebased.push({ ...trainee, count: trainee.count - 1 });
    }
  });
  return rebased;
}

export function resolveStageWaveDefs({
  battleData = {},
  waveDefs = [],
  getStageById,
} = {}) {
  const normalized = normalizeBattleData(battleData, getStageById);
  if (normalized.practiceMode === true && normalized.stageId === 1) {
    return buildStage1PracticeSegmentDefs();
  }
  if (isPublicStage1PaintRound(normalized)) {
    return [];
  }
  const stage = typeof getStageById === 'function' ? getStageById(normalized.stageId) : null;
  const requestedWaves = Number(normalized.stageWaves ?? stage?.waves ?? waveDefs.length);
  const totalWaves = Math.max(1, Math.min(
    waveDefs.length,
    Number.isFinite(requestedWaves) ? requestedWaves : waveDefs.length
  ));

  return waveDefs.slice(0, totalWaves).map((def, index) => {
    const enemies = normalized.stageId === 1
      ? buildStage1PublicEnemies(def, index)
      : def.enemies.map((enemy) => ({ ...enemy }));
    if (shouldAddStage1PracticeTarget(normalized, index)) {
      enemies.push({ type: STAGE_1_PRACTICE_TARGET_TYPE, count: 1 });
    }

    return {
      ...def,
      wave: index + 1,
      interval: normalized.stageId === 1
        ? STAGE_1_INTERVALS_MS[index] ?? def.interval
        : def.interval,
      enemies,
      ...(normalized.stageId === 1
        ? {
            minActiveMs: STAGE_1_PUBLIC_MIN_ACTIVE_MS[index] ?? 0,
            sustainSpawn: true,
            maxAlive: STAGE_1_PUBLIC_MAX_ALIVE,
            sustainType: 'trainee',
            waveAction: STAGE_1_WAVE_PRESSURE_ACTIONS[index] ?? STAGE_1_WAVE_PRESSURE_ACTIONS[0],
          }
        : {}),
    };
  });
}

export function getDisplayWaveNumber(currentWave, totalWaves) {
  const total = Number(totalWaves);
  if (!Number.isFinite(total) || total <= 0) return 0;

  const current = Number(currentWave);
  const zeroBasedWave = Number.isFinite(current) && current >= 0 ? current : 0;
  return Math.min(zeroBasedWave + 1, total);
}

// P1-88: practiceMode gates all Stage 1 progress persistence.
export function shouldRecordStage1Clear({ stageId, practiceMode, isVictory } = {}) {
  if (practiceMode === true) return false;
  return isVictory === true && Number(stageId || 1) === 1;
}

export function shouldTrackStage1ReplayObjective({ stageId, practiceMode } = {}) {
  if (practiceMode === true) return false;
  return Number(stageId || 1) === 1;
}
