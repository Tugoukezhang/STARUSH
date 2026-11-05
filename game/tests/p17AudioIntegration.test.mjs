import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import {
  P1_7_ALLOWED_AUDIO_FILES,
  P1_7_AUDIO_CUES,
  P1_7_AUDIO_PUBLIC_DIR,
  getP17ResultCueId,
} from '../src/utils/p17AudioCues.mjs';
import { createP17AudioController } from '../src/utils/p17AudioRuntime.mjs';
import { BATTLE_RESULT_TYPES } from '../src/utils/battleResult.mjs';
import { resolveStageWaveDefs } from '../src/utils/stageWaves.mjs';

const EXPECTED_FILES = [
  'support_shot_tick_candidate_a.wav',
  'hit_confirm_candidate_a.wav',
  'player_damage_warning_candidate_b.wav',
  'center_moment_stinger_candidate_b.wav',
  'encore_rush_stinger_candidate_b.wav',
  'clear_fail_stinger_clear_candidate_b.wav',
  'clear_fail_stinger_fail_candidate_a.wav',
];

const EXPECTED_CUE_IDS = [
  'support_shot_tick',
  'hit_confirm',
  'player_damage_warning',
  'center_moment_stinger',
  'encore_rush_stinger',
  'clear_stinger',
  'fail_stinger',
];

function createMockScene(availableCueIds = EXPECTED_CUE_IDS) {
  const plays = [];
  const availableKeys = new Set(
    availableCueIds.map((cueId) => P1_7_AUDIO_CUES[cueId]?.key).filter(Boolean)
  );

  return {
    plays,
    scene: {
      cache: {
        audio: {
          exists: (key) => availableKeys.has(key),
        },
      },
      sound: {
        play: (key, options) => plays.push({ key, options }),
      },
      time: { now: 0 },
    },
  };
}

assert.deepEqual(P1_7_ALLOWED_AUDIO_FILES, EXPECTED_FILES);
assert.deepEqual(Object.keys(P1_7_AUDIO_CUES).sort(), EXPECTED_CUE_IDS.toSorted());

for (const cueId of EXPECTED_CUE_IDS) {
  const cue = P1_7_AUDIO_CUES[cueId];
  assert.equal(cue.id, cueId);
  assert.ok(cue.key.startsWith('p1-7-'), `${cueId} should use a P1-7 audio cache key`);
  assert.ok(cue.assetPath.startsWith(`${P1_7_AUDIO_PUBLIC_DIR}/`));
  assert.ok(EXPECTED_FILES.includes(cue.fileName), `${cueId} should map only to a QA-approved WAV`);
  assert.ok(['P0', 'P1', 'P2'].includes(cue.priority), `${cueId} should declare priority`);
  assert.equal(typeof cue.minIntervalMs, 'number', `${cueId} should declare minIntervalMs`);
  assert.equal(typeof cue.suppressLowerPriorityMs, 'number', `${cueId} should declare suppress policy`);
  assert.equal(cue.missingAssetBehavior, 'silent-no-op');
}

assert.equal(P1_7_AUDIO_CUES.support_shot_tick.fileName, 'support_shot_tick_candidate_a.wav');
assert.equal(P1_7_AUDIO_CUES.hit_confirm.fileName, 'hit_confirm_candidate_a.wav');
assert.equal(P1_7_AUDIO_CUES.player_damage_warning.fileName, 'player_damage_warning_candidate_b.wav');
assert.equal(P1_7_AUDIO_CUES.center_moment_stinger.fileName, 'center_moment_stinger_candidate_b.wav');
assert.equal(P1_7_AUDIO_CUES.encore_rush_stinger.fileName, 'encore_rush_stinger_candidate_b.wav');
assert.equal(P1_7_AUDIO_CUES.clear_stinger.fileName, 'clear_fail_stinger_clear_candidate_b.wav');
assert.equal(P1_7_AUDIO_CUES.fail_stinger.fileName, 'clear_fail_stinger_fail_candidate_a.wav');
assert.equal(P1_7_AUDIO_CUES.support_color_switch, undefined);
assert.equal(P1_7_AUDIO_CUES.form_switch, undefined);

{
  const publicAudioDir = new URL('../public/audio/phase1/p1-7/', import.meta.url);
  assert.equal(existsSync(publicAudioDir), true, 'Program public P1-7 audio directory should exist');
  const copiedWavs = readdirSync(publicAudioDir)
    .filter((fileName) => fileName.toLowerCase().endsWith('.wav'))
    .sort();
  assert.deepEqual(copiedWavs, EXPECTED_FILES.toSorted(), 'only the 7 second-listening-QA WAVs should be copied');
}

{
  const { scene, plays } = createMockScene([]);
  const audio = createP17AudioController(scene);
  assert.doesNotThrow(() => audio.safePlayCue('support_shot_tick', { time: 1000 }));
  assert.deepEqual(plays, [], 'missing assets should silently no-op without placeholder beep');
}

{
  const { scene, plays } = createMockScene();
  const audio = createP17AudioController(scene);
  audio.playShotTick({ time: 1000 });
  audio.playShotTick({ time: 1080 });
  audio.playShotTick({ time: 1181 });
  assert.deepEqual(
    plays.map((play) => play.key),
    [P1_7_AUDIO_CUES.support_shot_tick.key, P1_7_AUDIO_CUES.support_shot_tick.key],
    'support shot tick should be rate-limited instead of playing every shot'
  );
}

{
  const { scene, plays } = createMockScene();
  const audio = createP17AudioController(scene);
  audio.playHitConfirm({ time: 2000 });
  audio.playHitConfirm({ time: 2050 });
  audio.playHitConfirm({ time: 2119 });
  audio.playHitConfirm({ time: 2121 });
  assert.deepEqual(
    plays.map((play) => play.key),
    [P1_7_AUDIO_CUES.hit_confirm.key, P1_7_AUDIO_CUES.hit_confirm.key],
    'direct hit confirms should aggregate inside a short hit window'
  );
}

{
  const { scene, plays } = createMockScene();
  const audio = createP17AudioController(scene);
  audio.playPlayerDamage({ time: 3000, lethal: false });
  audio.playPlayerDamage({ time: 3100, lethal: true });
  assert.deepEqual(
    plays.map((play) => play.key),
    [P1_7_AUDIO_CUES.player_damage_warning.key, P1_7_AUDIO_CUES.fail_stinger.key],
    'lethal damage should let fail stinger win over damage warning'
  );
}

{
  const { scene, plays } = createMockScene();
  const audio = createP17AudioController(scene);
  audio.playCenterMoment({ time: 4000 });
  audio.playCenterMoment({ time: 4400 });
  audio.playShotTick({ time: 4500 });
  assert.deepEqual(
    plays.map((play) => play.key),
    [P1_7_AUDIO_CUES.center_moment_stinger.key],
    'C-position should one-shot and suppress low-priority tails'
  );
}

{
  const { scene, plays } = createMockScene();
  const audio = createP17AudioController(scene);
  audio.playEncore({ time: 5000 });
  audio.playEncore({ time: 6500 });
  audio.playEncore({ time: 7001 });
  assert.deepEqual(
    plays.map((play) => play.key),
    [P1_7_AUDIO_CUES.encore_rush_stinger.key, P1_7_AUDIO_CUES.encore_rush_stinger.key],
    'Encore should globally dedupe for roughly two seconds'
  );
}

assert.equal(getP17ResultCueId(BATTLE_RESULT_TYPES.VICTORY), 'clear_stinger');
assert.equal(getP17ResultCueId(BATTLE_RESULT_TYPES.PLAYER_DEFEAT), 'fail_stinger');
assert.equal(getP17ResultCueId(BATTLE_RESULT_TYPES.DEFENSE_DEFEAT), 'fail_stinger');

{
  const { scene, plays } = createMockScene();
  const audio = createP17AudioController(scene);
  audio.playResult(BATTLE_RESULT_TYPES.VICTORY, { time: 8000 });
  audio.playResult(BATTLE_RESULT_TYPES.PLAYER_DEFEAT, { time: 8100 });
  assert.deepEqual(
    plays.map((play) => play.key),
    [P1_7_AUDIO_CUES.clear_stinger.key],
    'result stinger should be one-shot per battle result flow'
  );
}

{
  const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');
  [
    'preloadP17AudioCues',
    'createP17AudioController',
    'this.p17Audio?.destroy()',
    'this.p17Audio?.playShotTick',
    'this.p17Audio?.playHitConfirm',
    'this.p17Audio?.playPlayerDamage',
    'this.p17Audio?.playCenterMoment',
    'this.p17Audio?.playEncore',
    'this.p17Audio?.playResult',
  ].forEach((snippet) => {
    assert.ok(battleSceneSource.includes(snippet), `BattleScene should include P1-7 audio hook: ${snippet}`);
  });
}

{
  const defs = resolveStageWaveDefs({
    battleData: { stageId: 1 },
    waveDefs: Array.from({ length: 10 }, (_, index) => ({
      wave: index + 1,
      interval: 1200,
      label: `Wave ${index + 1}`,
      enemies: [{ type: 'trainee', count: index + 4 }],
    })),
    getStageById: () => ({ id: 1, waves: 2 }),
  });
  assert.deepEqual(defs, [], 'Stage 1 audio integration must not restore kill-waves over the paint round');
}
