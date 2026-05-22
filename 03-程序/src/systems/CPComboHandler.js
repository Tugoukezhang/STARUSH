/**
 * CP应援效果处理器
 * GDD 3.2.3: 10种双色CP应援的战斗效果
 * Phase 1实现5个核心CP，其余CP只通知名称
 */

import { COLORS, COLOR_HEX } from '../utils/config.js';

/** CP效果定义 */
export const CP_EFFECTS = {
  // 🌸 甜蜜清爽（粉+蓝）：星粒雨减速场
  'blue+pink': {
    name: '甜蜜清爽',
    effectType: 'slow_field',      // 减速场
    slowRate: 0.30,                // 30%减速（GDD v1.5）
    radius: 120,                   // 120px范围（GDD v1.5）
    duration: 2000,
    starParticleRate: 2,           // 星粒产生倍率
  },
  // ✨ 甜蜜闪耀（粉+黄）：星爆连击
  'pink+yellow': {
    name: '甜蜜闪耀',
    effectType: 'crit_burst',      // 暴击连发
    critBonus: 0.15,               // 额外+15%暴击率（叠加甜蜜氛围）
    duration: 3000,
  },
  // 💎 清爽闪耀（蓝+黄）：冰晶闪耀
  'blue+yellow': {
    name: '冰晶闪耀',
    effectType: 'frost_shine',     // 减速场内闪耀×1.5
    slowRate: 0.30,
    dmgMultiplier: 1.5,
    radius: 80,
    duration: 2000,
  },
  // 🔥 甜蜜热烈（粉+橙）：热恋灼烧（范围扩散）
  'orange+pink': {
    name: '热恋灼烧',
    effectType: 'burn_spread',     // 灼烧蔓延
    burnSpreadRadius: 60,          // 扩散范围
    duration: 3000,
  },
  // 🖤 神秘热烈（紫+橙）：炼狱之焰
  'orange+purple': {
    name: '炼狱之焰',
    effectType: 'dot_chain',       // 腐蚀触发灼烧
    dotChainCount: 3,              // 最多3次链式反应
    duration: 3000,
  },
  // 其余5种CP只显示名称，Phase 2补效果
  'pink+purple':     { name: '甜蜜神秘', effectType: 'none' },
  'blue+purple':     { name: '清爽神秘', effectType: 'none' },
  'blue+orange':     { name: '清爽热烈', effectType: 'none' },
  'orange+yellow':   { name: '闪耀热烈', effectType: 'none' },
  'purple+yellow':   { name: '闪耀神秘', effectType: 'none' },
};

export class CPComboHandler {
  constructor(scene) {
    this.scene = scene;

    // 当前激活的CP效果
    this.activeEffects = new Map(); // cpKey → { timer, config }

    // 回调
    this.onSlowField = null;        // (radius, slowRate, duration) 减速场
    this.onCritBurst = null;        // (critBonus, duration) 暴击连发
    this.onFrostShine = null;       // (radius, slowRate, dmgMulti, duration) 冰晶闪耀
    this.onBurnSpread = null;       // (spreadRadius, duration) 灼烧扩散
    this.onDotChain = null;         // (chainCount, duration) DOT链
    this.onCPComboName = null;      // (name, colors[]) CP名称显示
  }

  /** 尝试触发CP效果 */
  tryTrigger(colors) {
    const key = [...colors].sort().join('+');
    const config = CP_EFFECTS[key];
    if (!config) return;

    // 显示CP名称
    if (this.onCPComboName) this.onCPComboName(config.name, colors);

    // Phase 1只处理5个核心CP
    if (config.effectType === 'none') return;

    // 刷新或新建
    if (this.activeEffects.has(key)) {
      const existing = this.activeEffects.get(key);
      if (existing.timer) existing.timer.remove(false);
    }

    this.activeEffects.set(key, { config });

    // 触发效果回调
    switch (config.effectType) {
      case 'slow_field':
        if (this.onSlowField) this.onSlowField(config.radius, config.slowRate, config.duration);
        break;
      case 'crit_burst':
        if (this.onCritBurst) this.onCritBurst(config.critBonus, config.duration);
        break;
      case 'frost_shine':
        if (this.onFrostShine) this.onFrostShine(config.radius, config.slowRate, config.dmgMultiplier, config.duration);
        break;
      case 'burn_spread':
        if (this.onBurnSpread) this.onBurnSpread(config.burnSpreadRadius, config.duration);
        break;
      case 'dot_chain':
        if (this.onDotChain) this.onDotChain(config.dotChainCount, config.duration);
        break;
    }

    // 自动过期
    const timer = this.scene.time.delayedCall(config.duration || 3000, () => {
      this.activeEffects.delete(key);
    });
    const entry = this.activeEffects.get(key);
    if (entry) entry.timer = timer;
  }

  /** 检查某CP是否激活 */
  isActive(cpKey) {
    return this.activeEffects.has(cpKey);
  }

  /** 获取活跃CP列表 */
  getActiveCPs() {
    return [...this.activeEffects.entries()].map(([key, val]) => ({
      key, name: val.config.name, effectType: val.config.effectType,
    }));
  }

  destroy() {
    for (const [_, val] of this.activeEffects) {
      if (val.timer) val.timer.remove(false);
    }
    this.activeEffects.clear();
  }
}
