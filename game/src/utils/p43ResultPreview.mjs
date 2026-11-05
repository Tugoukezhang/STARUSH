import { BATTLE_RESULT_TYPES } from './battleResult.mjs';

export const P43_RESULT_PREVIEW_BATTLE_DATA_KEY = 'p43ResultPreview';

const RESULT_TYPE_BY_QUERY = Object.freeze({
  victory: BATTLE_RESULT_TYPES.VICTORY,
  clear: BATTLE_RESULT_TYPES.VICTORY,
  'player-defeat': BATTLE_RESULT_TYPES.PLAYER_DEFEAT,
  fail: BATTLE_RESULT_TYPES.PLAYER_DEFEAT,
  'defense-defeat': BATTLE_RESULT_TYPES.DEFENSE_DEFEAT,
  defense: BATTLE_RESULT_TYPES.DEFENSE_DEFEAT,
});

function toSearchParams(query) {
  if (query instanceof URLSearchParams) return query;
  return new URLSearchParams(query || '');
}

function normalizeQueryKey(value) {
  return String(value || '').trim().toLowerCase().replaceAll('_', '-');
}

function normalizePreviewType(type) {
  return RESULT_TYPE_BY_QUERY[normalizeQueryKey(type)] || null;
}

function normalizeLightObjectiveState(value, type) {
  const state = normalizeQueryKey(value);
  if (state === 'completed' || state === 'complete') return 'completed';
  if (state === 'incomplete' || state === 'failed') return 'incomplete';
  return type === BATTLE_RESULT_TYPES.VICTORY ? 'completed' : 'incomplete';
}

function createPreview({ type, lightObjectiveState }) {
  const completed = lightObjectiveState === 'completed';
  return {
    type,
    stageId: 1,
    stage1ClearCount: 1,
    stage1ReplayObjectiveIndex: 0,
    clearedWaveCount: completed ? 2 : 1,
    totalWaves: 2,
    playerHitCount: completed ? 0 : 2,
  };
}

export function normalizeP43ResultPreview(value) {
  if (!value || typeof value !== 'object') return null;
  const type = normalizePreviewType(value.type);
  if (!type) return null;

  return createPreview({
    type,
    lightObjectiveState: Number(value.clearedWaveCount) >= 2 ? 'completed' : 'incomplete',
  });
}

export function getP43ResultPreviewFromQuery(query) {
  const params = toSearchParams(query);
  if (!params.has('debug')) return null;

  const type = normalizePreviewType(params.get(P43_RESULT_PREVIEW_BATTLE_DATA_KEY));
  if (!type) return null;

  return createPreview({
    type,
    lightObjectiveState: normalizeLightObjectiveState(params.get('p43LightObjective'), type),
  });
}

export function withP43ResultPreviewBattleData(battleData, query) {
  const preview = getP43ResultPreviewFromQuery(query);
  if (!preview) return battleData;

  return {
    ...battleData,
    stageId: 1,
    stageWaves: 2,
    p15Stage1ClearCount: 1,
    [P43_RESULT_PREVIEW_BATTLE_DATA_KEY]: preview,
  };
}
