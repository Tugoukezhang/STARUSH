/**
 * 安可呼吁系统
 * GDD 3.3: 弱点击破 → 安可状态 → 全五色收割
 */

import { ENCORE, COLORS } from '../utils/config.js';

export class EncoreSystem {
  constructor(scene) {
    this.scene = scene;
    
    // 安可状态追踪 { enemyId: { timer, active } }
    this.encoreTargets = new Map();
    
    // 辅助型被动3：安可状态+1秒
    this.extraDuration = 0;
    
    // 回调
    this.onEncoreStart = null;   // (enemy)
    this.onEncoreEnd = null;     // (enemy)
    this.onWeakPointBreak = null; // (enemy, supportGain)
  }

  /** 尝试弱点击破：目标需处于橙色灼烧状态 + 再次命中弱点 */
  tryWeakPointBreak(enemy) {
    if (!enemy.hasBurn) return false;
    
    // 弱点击破成功
    if (this.onWeakPointBreak) this.onWeakPointBreak(enemy, ENCORE.WEAK_POINT_SUPPORT);
    
    // 触发安可状态
    this._applyEncore(enemy);
    return true;
  }

  /** 对目标施加安可状态 */
  _applyEncore(enemy) {
    // 如果已有安可状态，刷新持续时间
    if (this.encoreTargets.has(enemy.id)) {
      const existing = this.encoreTargets.get(enemy.id);
      existing.timer.remove(false);
    }
    
    enemy.isEncore = true;
    enemy.encoreDmgBonus = ENCORE.DMG_BONUS;
    
    const duration = ENCORE.ANVIL_DURATION + this.extraDuration;
    const timer = this.scene.time.delayedCall(duration, () => {
      this._removeEncore(enemy);
    });
    
    this.encoreTargets.set(enemy.id, { timer, active: true });
    
    if (this.onEncoreStart) this.onEncoreStart(enemy);
  }

  _removeEncore(enemy) {
    if (!this.encoreTargets.has(enemy.id)) return;
    
    enemy.isEncore = false;
    enemy.encoreDmgBonus = 0;
    
    this.encoreTargets.delete(enemy.id);
    if (this.onEncoreEnd) this.onEncoreEnd(enemy);
  }

  /** 计算全五色星尘冲击伤害 */
  calcRainbowDamage(baseDamage, targetIsEncore) {
    const trueDamageRate = targetIsEncore ? ENCORE.RAINBOW_TRUE_DMG : ENCORE.RAINBOW_NORMAL_DMG;
    return baseDamage * trueDamageRate;
  }

  /** 目标是否处于安可状态 */
  isEncoreTarget(enemy) {
    return this.encoreTargets.has(enemy.id);
  }

  destroy() {
    for (const [_, data] of this.encoreTargets) {
      if (data.timer) data.timer.remove(false);
    }
    this.encoreTargets.clear();
  }
}
