/**
 * Wave波次系统
 * 结构化敌人生成：每波定义敌人类型/数量/节奏
 * Phase 1: 渐进难度 → 练习生 → 黑粉 → Boss
 */

import Phaser from 'phaser';
import { ENEMY_TYPES, GAME_WIDTH, COLORS } from '../utils/config.js';
import {
  getDisplayWaveNumber,
  STAGE_1_PRACTICE_TARGET_TYPE,
  STAGE_15_STAGE_MARKER_TARGET_TYPE,
} from '../utils/stageWaves.mjs';

/** 波次定义 */
export const WAVE_DEFS = [
  // Debut难度（BPM 100）
  { wave: 1,  enemies: [{ type: 'trainee', count: 4 }], interval: 1800, label: 'WAVE 1' },
  { wave: 2,  enemies: [{ type: 'trainee', count: 5 }], interval: 1600, label: 'WAVE 2' },
  { wave: 3,  enemies: [{ type: 'trainee', count: 6 }], interval: 1500, label: 'Wave 3' },
  // Regular难度
  { wave: 4,  enemies: [{ type: 'trainee', count: 4 }, { type: 'anti', count: 1 }], interval: 1500, label: 'Wave 4 — 黑粉来袭!' },
  { wave: 5,  enemies: [{ type: 'trainee', count: 4 }, { type: 'anti', count: 2 }], interval: 1400, label: 'Wave 5' },
  { wave: 6,  enemies: [{ type: 'trainee', count: 3 }, { type: 'anti', count: 3 }], interval: 1300, label: 'Wave 6' },
  // Pro难度
  { wave: 7,  enemies: [{ type: 'anti', count: 4 }, { type: 'trainee', count: 2 }], interval: 1200, label: 'Wave 7' },
  { wave: 8,  enemies: [{ type: 'anti', count: 5 }], interval: 1100, label: 'Wave 8 — 黑粉围攻!' },
  // Mini-Boss
  { wave: 9,  enemies: [{ type: 'miniboss', count: 1 }, { type: 'trainee', count: 3 }], interval: 2000, label: 'Wave 9 — ⚠️ 强敌出现!' },
  // Boss
  { wave: 10, enemies: [{ type: 'boss', count: 1 }], interval: 0, label: 'Wave 10 — 🌸 BOSS战!' },
];

export class WaveSystem {
  /**
   * @param {Phaser.Scene} scene
   * @param {Function} spawnFn - (type, x?) => void 实际生成敌人的回调
   */
  constructor(scene, spawnFn, waveDefs = WAVE_DEFS) {
    this.scene = scene;
    this.spawnFn = spawnFn;
    this.waveDefs = waveDefs;

    this.currentWave = 0;
    this.waveActive = false;
    this.enemiesRemaining = 0;
    this.aliveOnField = 0;
    this.spawnQueue = [];
    this.spawnTimer = null;
    this.pendingWaveClearTimer = null;
    this.pendingWaveActions = new Map();
    this.waveStartedAt = 0;

    // UI回调
    this.onWaveStart = null;  // (waveIndex, label)
    this.onWaveClear = null;  // (waveIndex)
    this.onInterWaveBreak = null;  // (clearedWaveIndex, nextWaveIndex, resumeNextWave)
    this.onAllClear = null;   // ()
  }

  /** 开始下一波 */
  startNextWave() {
    if (this.currentWave >= this.waveDefs.length) {
      if (this.onAllClear) this.onAllClear();
      return;
    }

    const def = this.waveDefs[this.currentWave];
    this.waveActive = true;
    this.aliveOnField = 0;
    this.waveStartedAt = this.scene.time?.now ?? 0;

    // 计算本波总敌人数
    this.enemiesRemaining = def.enemies.reduce((sum, e) => sum + e.count, 0);

    // 通知UI
    if (this.onWaveStart) this.onWaveStart(this.currentWave, def.label);

    // 构建生成队列
    this.spawnQueue = [];
    const firstSpawns = [];
    for (const group of def.enemies) {
      for (let i = 0; i < group.count; i++) {
        const targetQueue = group.spawnOrder === 'first' ? firstSpawns : this.spawnQueue;
        targetQueue.push(group.type);
      }
    }
    // 打乱顺序（Boss/miniboss放最后）
    const anchorLastTypes = new Set([
      'boss',
      'miniboss',
      STAGE_1_PRACTICE_TARGET_TYPE,
      STAGE_15_STAGE_MARKER_TARGET_TYPE,
    ]);
    const regulars = this.spawnQueue.filter(t => !anchorLastTypes.has(t));
    const bosses = this.spawnQueue.filter(t => anchorLastTypes.has(t));
    Phaser.Utils.Array.Shuffle(regulars);
    this.spawnQueue = [...regulars, ...bosses];
    this.spawnQueue.unshift(...firstSpawns);

    this._spawnNext(def.interval, true);
  }

  _currentWaveDef() {
    return this.waveDefs[this.currentWave] || null;
  }

  _waveElapsedMs() {
    return (this.scene.time?.now ?? 0) - this.waveStartedAt;
  }

  _shouldSustainSpawn() {
    const def = this._currentWaveDef();
    if (!this.waveActive || def?.sustainSpawn !== true) return false;
    const minActiveMs = Number(def.minActiveMs ?? 0);
    return minActiveMs > 0 && this._waveElapsedMs() < minActiveMs;
  }

  _maybeRefillSustainSpawn() {
    if (!this._shouldSustainSpawn()) return false;
    const def = this._currentWaveDef();
    const maxAlive = Number(def.maxAlive ?? 4);
    if (this.aliveOnField >= maxAlive) return false;
    let type = def.sustainType || 'trainee';
    if (this.currentWave === 1 && ((this.enemiesRemaining + this.aliveOnField) % 4 === 0)) {
      type = 'anti';
    }
    this.spawnQueue.push(type);
    this.enemiesRemaining += 1;
    return true;
  }

  _spawnNext(interval, immediate) {
    if (this.spawnQueue.length === 0) this._maybeRefillSustainSpawn();
    if (this.spawnQueue.length === 0) {
      if (this._shouldSustainSpawn()) {
        this.spawnTimer = this.scene.time.delayedCall(interval, () => this._spawnNext(interval, false));
      }
      return;
    }

    const spawnOne = () => {
      if (!this.waveActive) return;
      if (this.spawnQueue.length === 0) this._maybeRefillSustainSpawn();
      if (this.spawnQueue.length === 0) {
        this._spawnNext(interval, false);
        return;
      }
      const type = this.spawnQueue.shift();
      this.spawnFn(type);
      this.aliveOnField += 1;
      this._spawnNext(interval, false);
    };

    this.spawnTimer = this.scene.time.delayedCall(immediate === true ? 0 : interval, spawnOne);
  }

  /** 敌人被击杀时调用 */
  registerPendingWaveAction(actionId) {
    const normalizedId = typeof actionId === 'string' ? actionId.trim() : '';
    if (!this.waveActive || !normalizedId || this.pendingWaveActions.has(normalizedId)) {
      return null;
    }
    const token = Object.freeze({
      actionId: normalizedId,
      waveIndex: this.currentWave,
    });
    this.pendingWaveActions.set(normalizedId, token);
    return token;
  }

  resolvePendingWaveAction(token) {
    if (!token || token.waveIndex !== this.currentWave) return false;
    if (this.pendingWaveActions.get(token.actionId) !== token) return false;
    this.pendingWaveActions.delete(token.actionId);
    this._tryCompleteCurrentWave();
    return true;
  }

  cancelPendingWaveAction(token) {
    if (!token || token.waveIndex !== this.currentWave) return false;
    if (this.pendingWaveActions.get(token.actionId) !== token) return false;
    this.pendingWaveActions.delete(token.actionId);
    return true;
  }

  onEnemyKilled() {
    this.enemiesRemaining = Math.max(0, this.enemiesRemaining - 1);
    this.aliveOnField = Math.max(0, this.aliveOnField - 1);
    this._tryCompleteCurrentWave();
  }

  _tryCompleteCurrentWave() {
    if (!this.waveActive) return false;
    if (this.enemiesRemaining > 0 || this.pendingWaveActions.size > 0) return false;

    const minActiveMs = Number(this.waveDefs[this.currentWave]?.minActiveMs ?? 0);
    const elapsed = (this.scene.time?.now ?? 0) - this.waveStartedAt;
    const remainingMs = Math.max(0, minActiveMs - elapsed);
    if (remainingMs > 0) {
      if (!this.pendingWaveClearTimer) {
        this.pendingWaveClearTimer = this.scene.time.delayedCall(remainingMs, () => {
          this.pendingWaveClearTimer = null;
          this._tryCompleteCurrentWave();
        });
      }
      return false;
    }

    this._completeCurrentWave();
    return true;
  }

  /** 当前波次编号（1-based） */
  _completeCurrentWave() {
    if (!this.waveActive || this.enemiesRemaining > 0 || this.pendingWaveActions.size > 0) return;

    this.waveActive = false;
    if (this.pendingWaveClearTimer) {
      this.pendingWaveClearTimer.remove(false);
      this.pendingWaveClearTimer = null;
    }
    const clearedWaveIndex = this.currentWave;
    if (this.onWaveClear) this.onWaveClear(clearedWaveIndex);

    this.currentWave++;

    // 3绉掑悗寮€濮嬩笅涓€娉?
    this._scheduleNextWaveAfterBreak(clearedWaveIndex);
  }

  _scheduleNextWaveAfterBreak(clearedWaveIndex) {
    const nextWaveIndex = this.currentWave;
    const resumeNextWave = () => {
      this.scene.time.delayedCall(600, () => this.startNextWave());
    };
    const handled = this.onInterWaveBreak?.(clearedWaveIndex, nextWaveIndex, resumeNextWave);
    if (handled === true) return;

    this.scene.time.delayedCall(3000, () => this.startNextWave());
  }

  getWaveNumber() {
    return getDisplayWaveNumber(this.currentWave, this.getTotalWaves());
  }

  getTotalWaves() {
    return this.waveDefs.length;
  }

  /** 是否正在战斗 */
  isActive() {
    return this.waveActive;
  }

  destroy() {
    if (this.spawnTimer) this.spawnTimer.remove(false);
    if (this.pendingWaveClearTimer) this.pendingWaveClearTimer.remove(false);
    this.pendingWaveActions.clear();
  }
}
