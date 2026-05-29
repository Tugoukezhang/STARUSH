/**
 * ST☆RUSH 启动场景 - 标题画面
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLOR_HEX, COLORS } from '../utils/config.js';
import { setBattleHudVisible } from '../utils/ui.js';
import { CHARACTERS, calcStats, getUnlockedForms } from '../data/characters.js';
import { getStageById } from '../data/stages.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    setBattleHudVisible(false);

    // 🔧 DEBUG: URL加 ?debug 可跳过标题直接进战斗
    if (new URLSearchParams(window.location.search).has('debug')) {
      this.scene.start('BattleScene', this._buildRecommendedBattleData());
      return;
    }

    // 背景
    this.cameras.main.setBackgroundColor('#0a0a1a');
    
    // 标题
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.3, 'ST☆RUSH', {
      fontSize: '42px',
      color: '#FF69B4',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    
    // 副标题
    const sub = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.3 + 50, 
      '偶像弹幕射击 · Phase 1 原型', {
      fontSize: '14px',
      color: '#FFD700',
    });
    sub.setOrigin(0.5);
    
    // 5色圆点
    const colors = [COLORS.PINK, COLORS.BLUE, COLORS.YELLOW, COLORS.PURPLE, COLORS.ORANGE];
    colors.forEach((c, i) => {
      const dot = this.add.circle(
        GAME_WIDTH / 2 - 50 + i * 25,
        GAME_HEIGHT * 0.45,
        8, COLOR_HEX[c]
      );
      this.tweens.add({
        targets: dot,
        y: dot.y - 10,
        duration: 600,
        yoyo: true,
        delay: i * 100,
        repeat: -1,
      });
    });
    
    // 推荐开演：首玩最快路径
    const startBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.65, 
      '▶ 立即开演', {
      fontSize: '20px',
      color: '#FFFFFF',
      backgroundColor: '#FF69B4',
      padding: { x: 24, y: 12 },
    });
    startBtn.setOrigin(0.5);
    startBtn.setInteractive({ useHandCursor: true });
    
    startBtn.on('pointerover', () => {
      startBtn.setStyle({ backgroundColor: '#FF1493' });
    });
    startBtn.on('pointerout', () => {
      startBtn.setStyle({ backgroundColor: '#FF69B4' });
    });
    startBtn.on('pointerdown', () => {
      this.scene.start('BattleScene', this._buildRecommendedBattleData());
    });

    const memberBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.74,
      '成员管理', {
      fontSize: '13px',
      color: '#FFB6D9',
      backgroundColor: 'rgba(255,255,255,0.08)',
      padding: { x: 14, y: 7 },
    });
    memberBtn.setOrigin(0.5);
    memberBtn.setInteractive({ useHandCursor: true });
    memberBtn.on('pointerover', () => memberBtn.setStyle({ color: '#FFFFFF' }));
    memberBtn.on('pointerout', () => memberBtn.setStyle({ color: '#FFB6D9' }));
    memberBtn.on('pointerdown', () => {
      this.scene.start('CharacterScene');
    });
    
    // 操作提示
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.82, 
      'WASD/方向键 移动 | Q 切换弹幕颜色 | 自动射击', {
      fontSize: '11px',
      color: '#888888',
    }).setOrigin(0.5);
    
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.86,
      '移动→蓝色 | 站定→紫色 | Combo≥5→黄色 | 击杀→对应色', {
      fontSize: '10px',
      color: '#666666',
    }).setOrigin(0.5);
  }

  _buildRecommendedBattleData() {
    const character = CHARACTERS.find((item) => item.id === 'sakura') || CHARACTERS[0];
    const level = 1;
    const stats = calcStats(character, level);
    const form = getUnlockedForms(character, level)[0] || character.forms[0];
    const stage = getStageById(1);
    const member = {
      characterId: character.id,
      id: character.id,
      name: character.name,
      color: character.color,
      colorHex: character.colorHex,
      level,
      atk: stats.atk,
      form: form?.type || '输出型',
      formName: form?.name || '',
    };

    return {
      characterId: member.characterId,
      name: member.name,
      color: member.color,
      colorHex: member.colorHex,
      level: member.level,
      atk: member.atk,
      team: [member],
      stageId: stage?.id || 1,
      stageName: stage?.name || '第1关·登台',
      stageWaves: stage?.waves || 2,
      defenseMode: false,
    };
  }
}
