import {
  P1_7_AUDIO_CUES,
  getP17AudioCue,
  getP17ResultCueId,
} from './p17AudioCues.mjs';
import { BATTLE_RESULT_TYPES } from './battleResult.mjs';

const P0_PRIORITY = 'P0';

export function preloadP17AudioCues(loader) {
  if (!loader || typeof loader.audio !== 'function') return;
  for (const cue of Object.values(P1_7_AUDIO_CUES)) {
    loader.audio(cue.key, cue.assetPath);
  }
}

export function createP17AudioController(scene) {
  return new P17AudioController(scene);
}

export class P17AudioController {
  constructor(scene) {
    this.scene = scene;
    this.destroyed = false;
    this.lastPlayedAt = new Map();
    this.lowerPrioritySuppressedUntil = 0;
    this.resultStingerPlayed = false;
  }

  destroy() {
    this.destroyed = true;
  }

  safePlayCue(cueId, options = {}) {
    if (this.destroyed) return { played: false, reason: 'destroyed' };
    const cue = getP17AudioCue(cueId);
    if (!cue) return { played: false, reason: 'unknown-cue' };

    const time = this._resolveTime(options.time);
    if (cue.priority !== P0_PRIORITY && time < this.lowerPrioritySuppressedUntil) {
      return { played: false, reason: 'suppressed' };
    }

    const lastPlayedAt = this.lastPlayedAt.get(cue.id);
    if (typeof lastPlayedAt === 'number' && time - lastPlayedAt < cue.minIntervalMs) {
      return { played: false, reason: 'rate-limited' };
    }

    if (!this._hasLoadedAsset(cue)) {
      return { played: false, reason: cue.missingAssetBehavior };
    }

    try {
      if (typeof this.scene?.sound?.play !== 'function'
        || this.scene.sound.play(cue.key, { volume: cue.volume }) === false) {
        return { played: false, reason: 'play-failed' };
      }
    } catch (_error) {
      return { played: false, reason: 'play-failed' };
    }

    this.lastPlayedAt.set(cue.id, time);
    if (cue.suppressLowerPriorityMs > 0) {
      this.scene.battleMusic?.duck(cue.suppressLowerPriorityMs / 1000);
      this.lowerPrioritySuppressedUntil = Math.max(
        this.lowerPrioritySuppressedUntil,
        time + cue.suppressLowerPriorityMs
      );
    }

    return { played: true, cueId: cue.id, key: cue.key };
  }

  playShotTick(options = {}) {
    return this.safePlayCue('support_shot_tick', options);
  }

  playHitConfirm(options = {}) {
    return this.safePlayCue('hit_confirm', options);
  }

  playPlayerDamage({ lethal = false, time } = {}) {
    if (lethal) {
      return this.playResult(BATTLE_RESULT_TYPES.PLAYER_DEFEAT, { time });
    }
    return this.safePlayCue('player_damage_warning', { time });
  }

  playCenterMoment(options = {}) {
    return this.safePlayCue('center_moment_stinger', options);
  }

  playEncore(options = {}) {
    return this.safePlayCue('encore_rush_stinger', options);
  }

  playResult(type, options = {}) {
    if (this.resultStingerPlayed) return { played: false, reason: 'result-one-shot' };
    const cueId = getP17ResultCueId(type);
    if (!cueId) return { played: false, reason: 'unknown-result' };

    this.lowerPrioritySuppressedUntil = 0;
    const result = this.safePlayCue(cueId, options);
    this.resultStingerPlayed = result.played;
    return result;
  }

  _resolveTime(time) {
    if (typeof time === 'number' && Number.isFinite(time)) return time;
    const sceneTime = this.scene?.time?.now;
    return typeof sceneTime === 'number' && Number.isFinite(sceneTime) ? sceneTime : 0;
  }

  _hasLoadedAsset(cue) {
    const audioCache = this.scene?.cache?.audio;
    if (typeof audioCache?.exists === 'function') return audioCache.exists(cue.key);
    if (typeof audioCache?.has === 'function') return audioCache.has(cue.key);
    return false;
  }
}
