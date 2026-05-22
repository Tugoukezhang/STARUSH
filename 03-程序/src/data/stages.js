/**
 * ST☆RUSH 主线关卡数据 - GDD v1.5 §5.4
 * 4章33关，共鸣门槛，三星标准，首通奖励
 */

export const CHAPTERS = [
  {
    id: 1, name: '初次登台', icon: '🎪', levelCount: 5, bossLevel: 5,
    unlock: '开局', recLevel: 'Lv.1-5', enemyTheme: '练习生', color: '#FF69B4',
    stages: [
      { id: 1, type: 'normal', name: '第1关·登台', waves: 2 },
      { id: 2, type: 'normal', name: '第2关·节奏', waves: 2 },
      { id: 3, type: 'normal', name: '第3关·应援', waves: 3 },
      { id: 4, type: 'normal', name: '第4关·闪耀', waves: 3 },
      { id: 5, type: 'boss', name: '第5关·初次公演', waves: 3, bossName: '练习生强化版' },
    ],
  },
  {
    id: 2, name: '应援风暴', icon: '🌊', levelCount: 8, bossLevel: 8,
    unlock: '第1章通关', recLevel: 'Lv.5-15', enemyTheme: '练习生+黑粉', color: '#00CED1',
    stages: [
      { id: 6, type: 'normal', name: '第6关·风暴前', waves: 3 },
      { id: 7, type: 'normal', name: '第7关·练习', waves: 3 },
      { id: 8, type: 'normal', name: '第8关·对抗', waves: 3 },
      { id: 9, type: 'normal', name: '第9关·黑粉', waves: 4 },
      { id: 10, type: 'normal', name: '第10关·节奏', waves: 4 },
      { id: 11, type: 'normal', name: '第11关·合奏', waves: 4 },
      { id: 12, type: 'normal', name: '第12关·高潮', waves: 4 },
      { id: 13, type: 'boss', name: '第13关·黑粉队长', waves: 4, bossName: '黑粉队长' },
    ],
  },
  {
    id: 3, name: '竞争对手', icon: '⚔️', levelCount: 10, bossLevel: 10,
    unlock: '第2章通关', recLevel: 'Lv.15-30', enemyTheme: '黑粉+竞争对手团', color: '#FFD700',
    stages: [
      { id: 14, type: 'normal', name: '第14关', waves: 4 },
      { id: 15, type: 'normal', name: '第15关', waves: 4 },
      { id: 16, type: 'normal', name: '第16关', waves: 4 },
      { id: 17, type: 'normal', name: '第17关', waves: 5 },
      { id: 18, type: 'normal', name: '第18关', waves: 5 },
      { id: 19, type: 'normal', name: '第19关', waves: 5 },
      { id: 20, type: 'normal', name: '第20关', waves: 5 },
      { id: 21, type: 'normal', name: '第21关', waves: 5 },
      { id: 22, type: 'normal', name: '第22关', waves: 5 },
      { id: 23, type: 'boss', name: '第23关·竞争团', waves: 5, bossName: '竞争对手团3人组' },
    ],
  },
  {
    id: 4, name: '黑化偶像', icon: '🌑', levelCount: 10, bossLevel: 10,
    unlock: '第3章通关', recLevel: 'Lv.30-50', enemyTheme: '竞争对手团+Boss', color: '#9370DB',
    stages: [
      { id: 24, type: 'normal', name: '第24关', waves: 5 },
      { id: 25, type: 'normal', name: '第25关', waves: 5 },
      { id: 26, type: 'normal', name: '第26关', waves: 5 },
      { id: 27, type: 'normal', name: '第27关', waves: 6 },
      { id: 28, type: 'normal', name: '第28关', waves: 6 },
      { id: 29, type: 'normal', name: '第29关', waves: 6 },
      { id: 30, type: 'normal', name: '第30关', waves: 6 },
      { id: 31, type: 'normal', name: '第31关', waves: 6 },
      { id: 32, type: 'normal', name: '第32关', waves: 6 },
      { id: 33, type: 'boss', name: '第33关·黑化绯樱', waves: 6, bossName: '黑化·绯樱' },
    ],
  },
];

/** 共鸣门槛表 (GDD §5.4.3) */
export const RESONANCE_GATES = {
  5:  { gate: 3,  rec: 5,  penalty: 'Boss HP+50%' },
  13: { gate: 12, rec: 15, penalty: 'Boss全属性+30%' },
  23: { gate: 25, rec: 30, penalty: 'Boss全属性+30%' },
  33: { gate: 42, rec: 50, penalty: 'Boss P2伤害×1.5' },
};

/** 三星标准 */
export const STAR_CRITERIA = {
  1: '通关（HP>0）',
  2: '通关 + HP≥3',
  3: '通关 + HP≥3 + 触发≥1次安可',
};

/** 首通奖励 */
export function getRewards(stageId, stars) {
  const isBoss = [5,13,23,33].includes(stageId);
  if (isBoss) {
    const tier = stageId === 5 ? 0 : stageId === 13 ? 1 : stageId === 23 ? 2 : 3;
    const base = [[200,100],[250,150],[300,200],[500,300]][tier];
    return stars === 1 ? { xp: base[0], star: base[1] }
                       : { xp: base[0] + Math.floor(base[0]/2), star: base[1] + Math.floor(base[1]/2) };
  }
  return stars === 1 ? { xp: 100, star: 50 } : { xp: 150, star: 75 };
}
