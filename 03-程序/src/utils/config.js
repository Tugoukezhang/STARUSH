/**
 * ST☆RUSH 偶像弹幕射击 - Phase 1 原型
 * 游戏常量与配置
 */

// 5色应援定义
export const COLORS = {
  PINK:   'pink',
  BLUE:   'blue',
  YELLOW: 'yellow',
  PURPLE: 'purple',
  ORANGE: 'orange',
};

export const COLOR_HEX = {
  pink:   0xFF69B4,
  blue:   0x00CED1,
  yellow: 0xFFD700,
  purple: 0x9370DB,
  orange: 0xFF8C00,
};

export const COLOR_CSS = {
  pink:   '#FF69B4',
  blue:   '#00CED1',
  yellow: '#FFD700',
  purple: '#9370DB',
  orange: '#FF8C00',
};

// 游戏尺寸
export const GAME_WIDTH = 375;
export const GAME_HEIGHT = 667;

// 射击参数 (GDD 3.1.2)
export const SHOOT_CONFIG = {
  FIRE_RATE: 333,        // 3发/秒 = 333ms/发
  BULLET_SPEED: 500,    // 弹幕速度 px/s
  BASE_CRIT_RATE: 0.05, // 基础暴击率5%
  CRIT_MULTIPLIER: 1.5, // 暴击伤害150%（GDD v1.2 3.7.2）
};

// 5色应援氛围 (GDD 3.2.1)
export const ATMOSPHERE = {
  pink: {
    name: '甜蜜氛围',
    duration: 4000,     // 持续4秒
    critBonus: 0.20,    // 暴击率+20%
    starParticles: 3,   // 暴击时产3星粒
  },
  blue: {
    name: '清爽氛围',
    duration: 2000,     // 持续2秒
    slowRate: 0.30,     // 减速30%
    selfDmgBonus: 0.15, // 自身受伤+15%
  },
  yellow: {
    name: '闪耀氛围',
    duration: 4000,     // 同甜蜜
    dmgBonus: 0.15,     // +15%伤害
    maxStacks: 3,       // 叠加上限3层
    comboThreshold: 5,  // Combo≥5触发
  },
  purple: {
    name: '神秘氛围',
    duration: 5000,
    dotRate: 0.02,      // 2%/秒腐蚀
    maxStacks: 5,
    standTime: 1000,    // 站定1秒触发
    slowPerStack: 0.10, // 叠满后每层-10%移速
  },
  orange: {
    name: '热烈氛围',
    duration: 3000,
    burnRate: 0.03,      // 3%/秒灼烧
    defReduce: 0.10,     // 防御-10%
    weakPointBonus: 1.5, // 弱点击破时×1.5
  },
};

// 安可呼吁 (GDD 3.3)
export const ENCORE = {
  ANVIL_DURATION: 8000,  // 安可状态持续8秒（v1.2调整，原5秒）
  DMG_BONUS: 0.20,        // +20%伤害
  WEAK_POINT_SUPPORT: 30, // 弱点击破+30应援值
  RAINBOW_TRUE_DMG: 0.30, // 全五色30%真伤（安可目标）
  RAINBOW_NORMAL_DMG: 0.15, // 全五色15%真伤（非安可）
};

// 舞台C位模式 (GDD 3.4)
export const CENTER_STAGE = {
  THRESHOLD: 100,       // 应援值100触发
  DURATION: 8000,       // 8秒增强窗口
  DMG_MULTI: 2.0,       // 伤害×2
  FIRE_RATE_MULTI: 1.5, // 射速×1.5
};

// 应援值获取 (GDD 3.4.1)
export const SUPPORT_GAIN = {
  KILL_SMALL: 5,        // 击杀练习生
  KILL_MEDIUM: 15,      // 击杀黑粉
  WEAK_POINT: 30,       // 弱点击破
  CP_COMBO: 10,         // CP应援触发
  TRIPLE_COMBO: 25,     // 联合应援触发
  TAKE_DAMAGE: 3,       // 受到伤害
  HIT_COMBO: 5,         // Combo连续命中
};

// 伤害乘区模型 (GDD v1.2 3.7)
// Final Damage = Base × (1+SkillSum) × (1+FormSum) × (1+TeamSum) × CritMulti × SituationalMulti + TrueDmg
export const DAMAGE_ZONES = {
  // 技能区（加法区）：应援氛围加成
  SKILL: {
    SHINING_MARK: 0.15,  // 闪耀标记+15%/层（上限3层=+45%）
  },
  // 形态区（加法区）：形态被动
  FORM: {
    ATTACK: 0.20,    // 输出型+20%伤害
    CRIT_DMG: 0.15,  // 输出型暴击伤害+15%
    STAIN_RANGE: 0.50,   // 染色型染色范围+50%
    STAIN_SLOW: 0.20,    // 染色型染色减速+20%
    STAIN_DUR: 1000,     // 染色型染色持续+1秒
    TEAM_ATMO: 0.30,     // 辅助型团队氛围效果+30%
    TEAM_CRIT: 0.10,     // 辅助型团队暴击率+10%
    ENCORE_EXTRA: 1000,  // 辅助型安可状态+1秒
  },
  // 团队区（加法区）：团体等级加成
  TEAM: {
    FAVORITE: 0.10,  // 本命+10%
    SYNERGY: 0.05,   // 默契+5%（5人等级差≤5）
  },
  // 暴击区（乘法区）：独立计算
  CRIT: {
    BASE_RATE: 0.05,      // 基础暴击率5%
    CRIT_DAMAGE: 1.50,    // 暴击伤害150%
    PINK_BONUS: 0.20,     // 甜蜜氛围+20%暴击率
  },
  // 情境区（乘法区）：C位/安可/全五色
  SITUATIONAL: {
    CENTER_STAGE: 2.0,    // C位伤害×2
    ENCORE_BONUS: 0.20,   // 安可+20%（v1.2改为情境区乘法）
  },
  // 独立区：全五色真伤
  INDEPENDENT: {
    RAINBOW_ENCORE: 0.30,   // 全五色30%真伤（安可目标）
    RAINBOW_NORMAL: 0.15,    // 全五色15%真伤（非安可）
  },
};

// 敌人类型 (GDD 6.1)
export const ENEMY_TYPES = {
  TRAINEE: {
    name: '练习生',
    hp: 30,
    speed: 80,
    score: 100,
    supportValue: SUPPORT_GAIN.KILL_SMALL,
    bulletColor: 'gray',
    bulletSpeed: 120,
    bulletStyle: 'fuzzy',
  },
  ANTI: {
    name: '黑粉',
    hp: 80,
    speed: 60,
    score: 300,
    supportValue: SUPPORT_GAIN.KILL_MEDIUM,
    bulletColor: 'darkRed',
    bulletSpeed: 180,
    bulletStyle: 'broken',
  },
};

// 玩家参数
export const PLAYER = {
  SPEED: 250,
  HITBOX_RADIUS: 4,
  INVULN_TIME: 1000,
  BASE_HP: 5,
};
