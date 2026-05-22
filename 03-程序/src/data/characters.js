/**
 * ST☆RUSH 角色数据 - GDD v1.5 §4.4
 * 5角色完整数值、成长率、技能、形态解锁时机
 */

export const CHARACTERS = [
  {
    id: 'sakura',
    name: '绯樱',
    emoji: '🎤',
    color: 'pink',
    colorHex: '#FF69B4',
    colorName: '粉色',
    role: '旋律主唱',
    rarity: 5,
    stars: '★★★★★',
    forms: [
      { name: '甜蜜主唱', type: '输出型', icon: '🎤', unlockLv: 1,
        active: '暴击强化', activeDesc: '8秒内暴击率+20%（CD 30秒）',
        passive: '甜蜜氛围持续+50%', passiveDesc: '甜蜜氛围持续时间4秒→6秒' },
      { name: '热舞模式', type: '染色型', icon: '💃', unlockLv: 15,
        active: '范围染色弹幕', activeDesc: '8秒内弹幕AOE溅射范围+100%（CD 25秒）',
        passive: '染色减速+20%', passiveDesc: '命中减速+20%（与染色型被动叠加至40%）' },
      { name: '安可模式', type: '辅助型', icon: '🎵', unlockLv: 30,
        active: '团队应援', activeDesc: '8秒内全队伤害+15%（CD 40秒）',
        passive: '氛围共享', passiveDesc: '队友获得氛围效果时间+30%' },
    ],
    stats: { atk: 60, def: 10, spd: 30, crit: 10, hp: 5 },
    growth: { atk: 5.0, def: 1.0 },
    desc: '暴击主C · 玻璃大炮',
  },
  {
    id: 'kai',
    name: '苍海',
    emoji: '💫',
    color: 'blue',
    colorHex: '#00CED1',
    colorName: '蓝色',
    role: '舞蹈担当',
    rarity: 4,
    stars: '★★★★☆',
    forms: [
      { name: '节奏控制', type: '输出型', icon: '💫', unlockLv: 1,
        active: '冰晶弹幕', activeDesc: '6秒内弹幕附加减速20%（CD 20秒）',
        passive: '自身减伤', passiveDesc: '自身受伤-10%（抵消蓝色自伤代价）' },
      { name: '清爽舞者', type: '染色型', icon: '💃', unlockLv: 15,
        active: '水流溅射', activeDesc: '6秒内AOE溅射附带减速+额外2秒（CD 22秒）',
        passive: '减速破防', passiveDesc: '减速场内敌人DEF-10%' },
      { name: '应援支援', type: '辅助型', icon: '🎵', unlockLv: 30,
        active: '蓝色屏障', activeDesc: '5秒内全队受伤-20%（CD 35秒）',
        passive: '团队防御', passiveDesc: '团队DEF+10%（编队生效）' },
    ],
    stats: { atk: 48, def: 20, spd: 35, crit: 0, hp: 5 },
    growth: { atk: 4.2, def: 2.0 },
    desc: '控场坦克 · SPD最快',
  },
  {
    id: 'venus',
    name: '金星',
    emoji: '⭐',
    color: 'yellow',
    colorHex: '#FFD700',
    colorName: '黄色',
    role: '和声辅助',
    rarity: 4,
    stars: '★★★★☆',
    forms: [
      { name: '闪耀辅助', type: '辅助型', icon: '⭐', unlockLv: 1,
        active: '闪耀之光', activeDesc: '6秒内闪耀标记叠加上限+2（可叠5层）（CD 28秒）',
        passive: '团队氛围', passiveDesc: '团队氛围效果+30%' },
      { name: '增伤辅助', type: '染色型', icon: '💃', unlockLv: 15,
        active: '星光溅射', activeDesc: '8秒内AOE溅射命中附加闪耀标记效果（CD 30秒）',
        passive: '标记增伤', passiveDesc: '闪耀标记触发时伤害额外+5%/层' },
      { name: '团队增益', type: '辅助型', icon: '🎵', unlockLv: 30,
        active: '金色舞台', activeDesc: '10秒内全队暴击率+10%（CD 45秒）',
        passive: '团队暴击', passiveDesc: '团队暴击率+10%（编队生效）' },
    ],
    stats: { atk: 42, def: 24, spd: 25, crit: 0, hp: 5 },
    growth: { atk: 3.8, def: 2.5 },
    desc: '增伤辅助 · DEF最高',
  },
  {
    id: 'genya',
    name: '幻夜',
    emoji: '🌙',
    color: 'purple',
    colorHex: '#9370DB',
    colorName: '紫色',
    role: '神秘制作人',
    rarity: 3,
    stars: '★★★☆☆',
    forms: [
      { name: '腐蚀输出', type: '输出型', icon: '🌙', unlockLv: 1,
        active: '暗影弹幕', activeDesc: '6秒内弹幕附加腐蚀DOT 2%/秒（CD 22秒）',
        passive: '叠层加速', passiveDesc: '腐蚀叠层速度+50%（2层/2秒→3层/2秒）' },
      { name: 'DOT特化', type: '染色型', icon: '💃', unlockLv: 15,
        active: '紫雾扩散', activeDesc: '8秒内AOE溅射范围+80%（CD 28秒）',
        passive: 'DOT延长', passiveDesc: 'DOT持续时间+30%' },
      { name: '控场辅助', type: '辅助型', icon: '🎵', unlockLv: 30,
        active: '暗影领域', activeDesc: '8秒内全屏敌人移速-15%（CD 40秒）',
        passive: '腐蚀减速', passiveDesc: '腐蚀DOT触发时额外-5%移速/层' },
    ],
    stats: { atk: 54, def: 12, spd: 22, crit: 0, hp: 5 },
    growth: { atk: 4.5, def: 1.5 },
    desc: 'DOT特化 · 暗影操控',
  },
  {
    id: 'enjo',
    name: '炎上',
    emoji: '🔥',
    color: 'orange',
    colorHex: '#FF8C00',
    colorName: '橙色',
    role: 'Rap担当',
    rarity: 3,
    stars: '★★★☆☆',
    forms: [
      { name: '灼烧输出', type: '输出型', icon: '🔥', unlockLv: 1,
        active: '烈焰弹幕', activeDesc: '6秒内弹幕附加灼烧DOT 3%/秒（CD 22秒）',
        passive: '灼烧强化', passiveDesc: '灼烧伤害+20%' },
      { name: '弱点击破', type: '染色型', icon: '💃', unlockLv: 15,
        active: '精准打击', activeDesc: 'AOE命中弱点时灼烧伤害×1.5（CD 20秒）',
        passive: '弱点延时', passiveDesc: '弱点暴露时间+1秒' },
      { name: '爆发收割', type: '辅助型', icon: '🎵', unlockLv: 30,
        active: '火焰风暴', activeDesc: '5秒内全队伤害×1.3，自身受伤+30%（CD 50秒）',
        passive: '安可强化', passiveDesc: '安可回血额外+1HP（弱点击破回2HP）' },
    ],
    stats: { atk: 65, def: 8, spd: 28, crit: 5, hp: 5 },
    growth: { atk: 5.2, def: 0.8 },
    desc: '爆发收割 · ATK最高',
  },
];

/** 计算角色在指定等级的属性 */
export function calcStats(char, level) {
  return {
    atk: Math.floor(char.stats.atk + (level - 1) * char.growth.atk),
    def: Math.floor(char.stats.def + (level - 1) * char.growth.def),
    spd: char.stats.spd,
    crit: char.stats.crit,
    hp: char.stats.hp,
  };
}

/** 获取已解锁形态列表 */
export function getUnlockedForms(char, level) {
  return char.forms.filter(f => level >= f.unlockLv);
}

/** 筛选条件 */
export const FILTERS = {
  color: ['全部', '粉色', '蓝色', '黄色', '紫色', '橙色'],
  profession: ['全部', '输出型', '染色型', '辅助型'],
  rarity: ['全部', '5星', '4星', '3星'],
  level: ['全部', 'Lv.1-10', 'Lv.11-30', 'Lv.31-50'],
};

/** 排序方式 */
export const SORT_OPTIONS = [
  { key: 'default', label: '默认排序' },
  { key: 'level', label: '等级降序' },
  { key: 'atk', label: 'ATK降序' },
  { key: 'rarity', label: '稀有度降序' },
];
