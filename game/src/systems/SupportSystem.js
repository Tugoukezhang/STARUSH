/**
 * 应援值 + C位模式 系统
 * GDD 3.4: 应援值累积（只增不减）→ 100触发C位模式
 */

import { CENTER_STAGE, SUPPORT_GAIN } from '../utils/config.js';

export class SupportSystem {
  constructor(scene) {
    this.scene = scene;
    this.value = 0;
    this.maxValue = CENTER_STAGE.THRESHOLD;
    
    // C位模式状态
    this.centerStageActive = false;
    this.centerStageTimer = null;
    
    // 回调
    this.onValueChange = null;    // (value, max)
    this.onCenterStageStart = null;
    this.onCenterStageEnd = null;
  }

  /** 增加应援值 */
  addValue(amount) {
    if (this.centerStageActive) return; // C位期间不累积
    
    // 辅助型被动：团队氛围效果+30%
    amount = Math.floor(amount * (this.gainMultiplier || 1.0));
    
    this.value = Math.min(this.value + amount, this.maxValue + 50); // 允许溢出到150
    if (this.onValueChange) this.onValueChange(this.value, this.maxValue);
    
    // 检查C位触发
    if (this.value >= this.maxValue) {
      this._triggerCenterStage();
    }
  }

  /** 各事件对应应援值 */
  gainFromKillSmall()    { this.addValue(SUPPORT_GAIN.KILL_SMALL); }
  gainFromKillMedium()   { this.addValue(SUPPORT_GAIN.KILL_MEDIUM); }
  gainFromWeakPoint()    { this.addValue(SUPPORT_GAIN.WEAK_POINT); }
  gainFromCPCombo()      { this.addValue(SUPPORT_GAIN.CP_COMBO); }
  gainFromTripleCombo()  { this.addValue(SUPPORT_GAIN.TRIPLE_COMBO); }
  gainFromTakeDamage()   { this.addValue(SUPPORT_GAIN.TAKE_DAMAGE); }
  gainFromHitCombo()     { this.addValue(SUPPORT_GAIN.HIT_COMBO); }

  _triggerCenterStage() {
    this.centerStageActive = true;
    this.value = 0;
    if (this.onValueChange) this.onValueChange(0, this.maxValue);
    if (this.onCenterStageStart) this.onCenterStageStart();
    
    // 8秒后结束
    this.centerStageTimer = this.scene.time.delayedCall(CENTER_STAGE.DURATION, () => {
      this.centerStageActive = false;
      if (this.onCenterStageEnd) this.onCenterStageEnd();
    });
  }

  /** C位模式是否激活 */
  isCenterStageActive() {
    return this.centerStageActive;
  }

  /** C位模式伤害乘区（已废弃，由DamageCalculator情境区直接调用isCenterStageActive） */
  getCenterStageMultiplier() {
    return this.centerStageActive ? CENTER_STAGE.DMG_MULTI : 1.0;
  }

  /** C位模式射速乘区 */
  getCenterStageFireRateMultiplier() {
    return this.centerStageActive ? CENTER_STAGE.FIRE_RATE_MULTI : 1.0;
  }

  /** 应援值百分比 */
  getPercent() {
    return Math.min(this.value / this.maxValue, 1.0);
  }

  destroy() {
    if (this.centerStageTimer) this.centerStageTimer.remove(false);
  }
}
