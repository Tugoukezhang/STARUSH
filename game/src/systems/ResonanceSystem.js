/**
 * G1 团体共鸣等级系统
 * GDD v1.5 §5.1：核心组3人平均等级，门槛惩罚，本命/默契加成
 */

export class ResonanceSystem {
  constructor() {
    this.team = [];        // 出战3人：{ name, level, atk, color }
    this.bonuses = {
      favorite: false,    // 本命加成：最高等级角色+10%伤害
      synergy: false,     // 默契加成：Max-Min≤5时+5%伤害
    };
  }

  /** 设置出战队伍 */
  setTeam(members) {
    this.team = members;
    this._calcBonuses();
  }

  /** 获取队伍平均等级 */
  getTeamLevel() {
    if (this.team.length === 0) return 1;
    const sum = this.team.reduce((s, m) => s + (m.level || 1), 0);
    return Math.floor(sum / this.team.length);
  }

  /** 计算加成 */
  _calcBonuses() {
    if (this.team.length === 0) return;
    const maxLv = Math.max(...this.team.map(m => m.level || 1));
    const minLv = Math.min(...this.team.map(m => m.level || 1));
    this.bonuses.favorite = true; // 本命始终触发（简化：最高等级者始终生效）
    this.bonuses.synergy = (maxLv - minLv) <= 5;
  }

  /** 检查是否低于共鸣门槛，返回惩罚倍率 */
  getGatePenalty(requiredGate) {
    const teamLv = this.getTeamLevel();
    if (teamLv >= requiredGate) return { penalized: false };
    return {
      penalized: true,
      enemyHpMultiplier: 1.3,   // +30% HP
      enemyDmgMultiplier: 1.2,  // +20% 伤害
      teamLv,
      requiredGate,
    };
  }

  /** 获取总伤害加成（本命+默契，additive） */
  getDamageBonus() {
    let bonus = 0;
    if (this.bonuses.favorite) bonus += 0.10;
    if (this.bonuses.synergy) bonus += 0.05;
    return bonus;
  }

  /** 获取总伤害乘数 */
  getDamageMultiplier() {
    return 1 + this.getDamageBonus();
  }
}
