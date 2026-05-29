/**
 * Wave波次系统
 * 结构化敌人生成：每波定义敌人类型/数量/节奏
 * Phase 1: 渐进难度 → 练习生 → 黑粉 → Boss
 */

import Phaser from 'phaser';
import { ENEMY_TYPES, GAME_WIDTH, COLORS } from '../utils/config.js';

/** 波次定义 */
export const WAVE_DEFS = [
  // Debut难度（BPM 100）
  { wave: 1,  enemies: [{ type: 'trainee', count: 4 }], interval: 1800, label: 'Wave 1' },
  { wave: 2,  enemies: [{ type: 'trainee', count: 5 }], interval: 1600, label: 'Wave 2' },
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
    this.spawnQueue = [];
    this.spawnTimer = null;

    // UI回调
    this.onWaveStart = null;  // (waveIndex, label)
    this.onWaveClear = null;  // (waveIndex)
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

    // 计算本波总敌人数
    this.enemiesRemaining = def.enemies.reduce((sum, e) => sum + e.count, 0);

    // 通知UI
    if (this.onWaveStart) this.onWaveStart(this.currentWave, def.label);

    // 构建生成队列
    this.spawnQueue = [];
    for (const group of def.enemies) {
      for (let i = 0; i < group.count; i++) {
        this.spawnQueue.push(group.type);
      }
    }
    // 打乱顺序（Boss/miniboss放最后）
    const regulars = this.spawnQueue.filter(t => t !== 'boss' && t !== 'miniboss');
    const bosses = this.spawnQueue.filter(t => t === 'boss' || t === 'miniboss');
    Phaser.Utils.Array.Shuffle(regulars);
    this.spawnQueue = [...regulars, ...bosses];

    // 按间隔生成
    this._scheduleSpawn(def.interval);
  }

  _scheduleSpawn(interval) {
    if (this.spawnQueue.length === 0) {
      // 队列空，等敌人全灭
      return;
    }

    this.spawnTimer = this.scene.time.delayedCall(interval, () => {
      if (this.spawnQueue.length > 0) {
        const type = this.spawnQueue.shift();
        this.spawnFn(type);
        this._scheduleSpawn(interval);
      }
    });
  }

  /** 敌人被击杀时调用 */
  onEnemyKilled() {
    this.enemiesRemaining--;
    if (this.enemiesRemaining <= 0 && this.waveActive) {
      this.waveActive = false;
      if (this.onWaveClear) this.onWaveClear(this.currentWave);

      this.currentWave++;

      // 3秒后开始下一波
      this.scene.time.delayedCall(3000, () => this.startNextWave());
    }
  }

  /** 当前波次编号（1-based） */
  getWaveNumber() {
    return this.currentWave + 1;
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
  }
}
