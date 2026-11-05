/**
 * 应援系统 - 核心氛围管理
 * GDD 3.2: 5单色 + 10双色CP + 10三色联合 + 1全五色 = 26种
 */

import { ATMOSPHERE, COLORS, SUPPORT_GAIN } from '../utils/config.js';

export class AtmosphereSystem {
  constructor(scene) {
    this.scene = scene;
    
    // 当前激活的氛围 { color: { stacks, timer, active } }
    this.activeAtmospheres = {};
    this._initAtmospheres();
    
    // Combo计数
    this.combo = 0;
    this.comboTimer = null;
    this.comboTimeout = 2000; // 2秒无命中清零
    
    // 事件发射
    this.onAtmosphereChange = null;  // (color, active, stacks)
    this.onComboChange = null;       // (combo)
    this.onCPCombo = null;           // (cpName, colors[])
    this.onTripleCombo = null;       // (tripleName, colors[])
    this.onRainbow = null;           // ()
  }

  _initAtmospheres() {
    const allColors = [COLORS.PINK, COLORS.BLUE, COLORS.YELLOW, COLORS.PURPLE, COLORS.ORANGE];
    for (const c of allColors) {
      this.activeAtmospheres[c] = {
        active: false,
        stacks: 0,
        maxStacks: ATMOSPHERE[c].maxStacks || 5,
        timer: null,
      };
    }
  }

  /** 击杀敌人时调用，触发对应色应援 */
  triggerFromKill(color) {
    this._activateAtmosphere(color);
  }

  /** Combo命中时调用（非击杀） */
  triggerFromHit(color, { killed = false } = {}) {
    this._addCombo();
    if (color === COLORS.YELLOW && killed !== true) {
      this.triggerYellowFromCombo();
    }
  }

  /** 移动时触发蓝色 */
  triggerBlueFromMove() {
    this._activateAtmosphere(COLORS.BLUE);
  }

  /** Combo≥5触发黄色 */
  triggerYellowFromCombo() {
    if (this.combo >= (ATMOSPHERE.yellow.comboThreshold || 5)) {
      this._activateAtmosphere(COLORS.YELLOW);
    }
  }

  _activateAtmosphere(color) {
    const atmo = this.activeAtmospheres[color];
    const config = ATMOSPHERE[color];
    
    atmo.active = true;
    atmo.stacks = Math.min(atmo.stacks + 1, atmo.maxStacks);
    
    // 清除旧计时器
    if (atmo.timer) atmo.timer.remove(false);
    
    // 设置持续时间
    atmo.timer = this.scene.time.delayedCall(config.duration, () => {
      atmo.active = false;
      atmo.stacks = 0;
      this._notifyChange(color);
    });
    
    this._notifyChange(color);
    this._checkCombos();
  }

  _notifyChange(color) {
    const atmo = this.activeAtmospheres[color];
    if (this.onAtmosphereChange) {
      this.onAtmosphereChange(color, atmo.active, atmo.stacks);
    }
  }

  _addCombo() {
    this.combo++;
    if (this.onComboChange) this.onComboChange(this.combo);
    
    // 重置combo计时器
    if (this.comboTimer) this.comboTimer.remove(false);
    this.comboTimer = this.scene.time.delayedCall(this.comboTimeout, () => {
      this.combo = 0;
      if (this.onComboChange) this.onComboChange(0);
    });
    
  }

  /** 检查CP应援和三色联合 */
  _checkCombos() {
    const active = this._getActiveColors();
    
    // 检查全五色
    if (active.length === 5) {
      if (this.onRainbow) this.onRainbow();
      return; // 全五色优先级最高
    }
    
    // 检查三色联合
    if (active.length === 3) {
      const name = this._getTripleName(active);
      if (this.onTripleCombo) this.onTripleCombo(name, active);
      return;
    }
    
    // 检查双色CP
    if (active.length === 2) {
      const name = this._getCPName(active);
      if (this.onCPCombo) this.onCPCombo(name, active);
    }
  }

  _getActiveColors() {
    return Object.entries(this.activeAtmospheres)
      .filter(([_, v]) => v.active)
      .map(([k, _]) => k);
  }

  /** 10种双色CP名称映射 (GDD 3.2.3) */
  _getCPName(colors) {
    const key = [...colors].sort().join('+');
    const cpMap = {
      'blue+pink':   '甜蜜清爽',
      'pink+yellow': '甜蜜闪耀',
      'pink+purple': '甜蜜神秘',
      'orange+pink': '甜蜜热烈',
      'blue+yellow': '清爽闪耀',
      'blue+purple': '清爽神秘',
      'blue+orange': '清爽热烈',
      'orange+yellow': '闪耀热烈',
      'purple+yellow': '闪耀神秘',
      'orange+purple': '神秘热烈',
    };
    return cpMap[key] || key;
  }

  /** 10种三色联合名称映射 (GDD 3.2.4) */
  _getTripleName(colors) {
    const key = [...colors].sort().join('+');
    const tripleMap = {
      'blue+pink+yellow': '星尘雨',
      'blue+pink+purple': '紫晶之恋',
      'blue+orange+pink': '热恋冰晶',
      'pink+purple+yellow': '紫蝶之舞',
      'orange+pink+yellow': '烈阳星祭',
      'orange+pink+purple': '暗夜烈焰',
      'blue+purple+yellow': '霜紫星辰',
      'blue+orange+yellow': '冰火霓虹',
      'blue+orange+purple': '深渊之火',
      'orange+purple+yellow': '炼狱星陨',
    };
    return tripleMap[key] || key;
  }

  /** 获取当前暴击率（基础5% + 粉色加成 + 临时加成 + 辅助型团队暴击） */
  getCritRate() {
    let rate = 0.05;
    if (this.activeAtmospheres.pink.active) {
      rate += ATMOSPHERE.pink.critBonus;
    }
    rate += (this.tempCritBonus || 0);
    rate += (this.teamCritBonus || 0); // 辅助型团队暴击率+10%
    return rate;
  }

  /** 获取当前伤害加成（加法区间） */
  getAdditiveDamageBonus(encoreActive, hasFavorite, hasSynergy) {
    let bonus = 0;
    if (hasFavorite) bonus += 0.10;  // 本命+10%
    if (hasSynergy) bonus += 0.05;   // 默契+5%
    if (encoreActive) bonus += 0.20;  // 安可+20%
    return bonus;
  }

  /** 蓝色减速是否激活 */
  isSlowActive() {
    return this.activeAtmospheres.blue.active;
  }

  /** 橙色灼烧是否激活 */
  isBurnActive() {
    return this.activeAtmospheres.orange.active;
  }

  /** 是否全五色 */
  isRainbow() {
    return this._getActiveColors().length === 5;
  }

  /** 获取活跃氛围数量 */
  getActiveCount() {
    return this._getActiveColors().length;
  }

  /** 获取指定颜色氛围层数 */
  getLayer(color) {
    return this.activeAtmospheres[color]?.stacks || 0;
  }

  /** 是否所有5色氛围同时激活 */
  areAllColorsActive() {
    const all = [COLORS.PINK, COLORS.BLUE, COLORS.YELLOW, COLORS.PURPLE, COLORS.ORANGE];
    return all.every(c => this.activeAtmospheres[c]?.active);
  }

  destroy() {
    for (const atmo of Object.values(this.activeAtmospheres)) {
      if (atmo.timer) atmo.timer.remove(false);
    }
    if (this.comboTimer) this.comboTimer.remove(false);
  }
}
