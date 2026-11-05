import { BATTLE_RESULT_TYPES } from './battleResult.mjs';

export const P1_7_AUDIO_PUBLIC_DIR = 'audio/phase1/p1-7';

export const P1_7_ALLOWED_AUDIO_FILES = Object.freeze([
  'support_shot_tick_candidate_a.wav',
  'hit_confirm_candidate_a.wav',
  'player_damage_warning_candidate_b.wav',
  'center_moment_stinger_candidate_b.wav',
  'encore_rush_stinger_candidate_b.wav',
  'clear_fail_stinger_clear_candidate_b.wav',
  'clear_fail_stinger_fail_candidate_a.wav',
]);

function cue({
  id,
  fileName,
  priority,
  minIntervalMs,
  suppressLowerPriorityMs = 0,
  volume = 1,
  oneShot = false,
}) {
  return Object.freeze({
    id,
    key: `p1-7-${id}`,
    fileName,
    assetPath: `${P1_7_AUDIO_PUBLIC_DIR}/${fileName}`,
    priority,
    minIntervalMs,
    suppressLowerPriorityMs,
    volume,
    oneShot,
    missingAssetBehavior: 'silent-no-op',
  });
}

export const P1_7_AUDIO_CUES = Object.freeze({
  support_shot_tick: cue({
    id: 'support_shot_tick',
    fileName: 'support_shot_tick_candidate_a.wav',
    priority: 'P1',
    minIntervalMs: 180,
    volume: 0.45,
  }),
  hit_confirm: cue({
    id: 'hit_confirm',
    fileName: 'hit_confirm_candidate_a.wav',
    priority: 'P1',
    minIntervalMs: 120,
    volume: 0.5,
  }),
  player_damage_warning: cue({
    id: 'player_damage_warning',
    fileName: 'player_damage_warning_candidate_b.wav',
    priority: 'P0',
    minIntervalMs: 900,
    suppressLowerPriorityMs: 900,
    volume: 0.65,
  }),
  center_moment_stinger: cue({
    id: 'center_moment_stinger',
    fileName: 'center_moment_stinger_candidate_b.wav',
    priority: 'P0',
    minIntervalMs: 900,
    suppressLowerPriorityMs: 850,
    volume: 0.7,
  }),
  encore_rush_stinger: cue({
    id: 'encore_rush_stinger',
    fileName: 'encore_rush_stinger_candidate_b.wav',
    priority: 'P0',
    minIntervalMs: 2000,
    suppressLowerPriorityMs: 900,
    volume: 0.68,
  }),
  clear_stinger: cue({
    id: 'clear_stinger',
    fileName: 'clear_fail_stinger_clear_candidate_b.wav',
    priority: 'P2',
    minIntervalMs: 0,
    oneShot: true,
    volume: 0.62,
  }),
  fail_stinger: cue({
    id: 'fail_stinger',
    fileName: 'clear_fail_stinger_fail_candidate_a.wav',
    priority: 'P0',
    minIntervalMs: 0,
    suppressLowerPriorityMs: 1000,
    oneShot: true,
    volume: 0.7,
  }),
});

export function getP17AudioCue(cueId) {
  return P1_7_AUDIO_CUES[cueId] || null;
}

export function getP17ResultCueId(type) {
  if (type === BATTLE_RESULT_TYPES.VICTORY) return 'clear_stinger';
  if (type === BATTLE_RESULT_TYPES.PLAYER_DEFEAT) return 'fail_stinger';
  if (type === BATTLE_RESULT_TYPES.DEFENSE_DEFEAT) return 'fail_stinger';
  return null;
}
