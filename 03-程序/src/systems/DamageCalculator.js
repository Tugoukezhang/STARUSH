/**
 * 伤害计算器 — 6区乘区模型
 * GDD v1.2 3.7:
 *   Final Damage = Base × (1+SkillSum) × (1+FormSum) × (1+TeamSum)
 *                   × CritMultiplier × SituationalMultiplier
 *                   + TrueDamage
 */

import { DAMAGE_ZONES, SHOOT_CONFIG, ENCORE } from '../utils/config.js';

/** 形态枚举 */
export const FORM_TYPE = {
  ATTACK: 'attack',  // 输出型
  STAIN:   'stain',   // 染色型
  SUPPORT: 'support', // 辅助型
};

export class DamageCalculator {
  /**
   * @param {AtmosphereSystem} atmosphere
   * @param {EncoreSystem} encore
   * @param {SupportSystem} support
   */
  constructor(atmosphere, encore, support) {
    this.atmosphere = atmosphere;
    this.encore = encore;
    this.support = support;

    // 养成状态（Phase 1先用默认值）
    this.hasFavoriteBonus = true;   // 本命+10%
    this.hasSynergyBonus = false;   // 默契+5%（需5人等级差≤5）
    this.currentForm = FORM_TYPE.ATTACK; // 当前形态
  }

  /**
   * 计算单次伤害（6区模型）
   * @param {number} baseDamage 基础伤害（角色ATK+武器ATK）
   * @param {object} target 敌人对象 { isEncore, hasBurn, ... }
   * @param {boolean} isCrit 是否暴击（由 rollCrit 预先判定）
   * @returns {{ total: number, breakdown: object, isTrueDamage: boolean, trueDamageAmount: number }}
   */
  calculate(baseDamage, target, isCrit) {
    const breakdown = {};

    // ── 1. 基础区 ──
    let damage = baseDamage;
    breakdown.base = baseDamage;

    // ── 2. 技能区（加法区）：应援氛围 ──
    const skillSum = this._getSkillBonus(target);
    damage *= (1 + skillSum);
    breakdown.skillSum = skillSum;
    breakdown.afterSkill = damage;

    // ── 3. 形态区（加法区）：形态被动 ──
    const formSum = this._getFormBonus();
    damage *= (1 + formSum);
    breakdown.formSum = formSum;
    breakdown.afterForm = damage;

    // ── 4. 团队区（加法区）：本命+默契 ──
    const teamSum = this._getTeamBonus();
    damage *= (1 + teamSum);
    breakdown.teamSum = teamSum;
    breakdown.afterTeam = damage;

    // ── 5. 暴击区（乘法区） ──
    const critMulti = isCrit ? DAMAGE_ZONES.CRIT.CRIT_DAMAGE : 1.0;
    damage *= critMulti;
    breakdown.critMulti = critMulti;
    breakdown.afterCrit = damage;

    // ── 6. 情境区（乘法区）：C位×2 + 安可+20% ──
    const situationalMulti = this._getSituationalMultiplier(target);
    damage *= situationalMulti;
    breakdown.situationalMulti = situationalMulti;
    breakdown.afterSituational = damage;

    // ── 独立区：全五色真伤 ──
    let trueDamageAmount = 0;
    let isTrueDamage = false;
    if (this.atmosphere.isRainbow()) {
      isTrueDamage = true;
      const rate = target.isEncore
        ? DAMAGE_ZONES.INDEPENDENT.RAINBOW_ENCORE
        : DAMAGE_ZONES.INDEPENDENT.RAINBOW_NORMAL;
      trueDamageAmount = baseDamage * rate;
    }

    return {
      total: Math.floor(damage),
      breakdown,
      isTrueDamage,
      trueDamageAmount: Math.floor(trueDamageAmount),
    };
  }

  // ── 各乘区计算 ──

  /** 技能区：闪耀标记 +15%/层 */
  _getSkillBonus(target) {
    let sum = 0;
    if (this.atmosphere.activeAtmospheres.yellow?.active) {
      const stacks = this.atmosphere.activeAtmospheres.yellow.stacks || 1;
      sum += DAMAGE_ZONES.SKILL.SHINING_MARK * stacks;
    }
    return sum;
  }

  /** 形态区：输出+20%/染色+0%/辅助+0%（染色/辅助的非伤害加成另算） */
  _getFormBonus() {
    switch (this.currentForm) {
      case FORM_TYPE.ATTACK:
        return DAMAGE_ZONES.FORM.ATTACK; // +20%伤害
      case FORM_TYPE.STAIN:
        return 0; // 染色范围+50%等不在伤害乘区
      case FORM_TYPE.SUPPORT:
        return 0; // 团队氛围+30%等不在伤害乘区
      default:
        return 0;
    }
  }

  /** 团队区：本命+10% + 默契+5% */
  _getTeamBonus() {
    let sum = 0;
    if (this.hasFavoriteBonus) sum += DAMAGE_ZONES.TEAM.FAVORITE;
    if (this.hasSynergyBonus)  sum += DAMAGE_ZONES.TEAM.SYNERGY;
    return sum;
  }

  /** 情境区（乘法区）：C位×2 × 安可+20% */
  _getSituationalMultiplier(target) {
    let multi = 1.0;

    // C位模式 ×2
    if (this.support.isCenterStageActive()) {
      multi *= DAMAGE_ZONES.SITUATIONAL.CENTER_STAGE;
    }

    // 安可状态 +20%（乘法区，不是加法区）
    if (target.isEncore) {
      multi *= (1 + DAMAGE_ZONES.SITUATIONAL.ENCORE_BONUS);
    }

    return multi;
  }

  /** 暴击判定 */
  rollCrit() {
    const critRate = this.atmosphere.getCritRate();
    return Math.random() < critRate;
  }

  /** 切换形态 */
  setForm(formType) {
    this.currentForm = formType;
  }
}
