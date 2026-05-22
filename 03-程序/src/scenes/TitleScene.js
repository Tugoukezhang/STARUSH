/**
 * ST☆RUSH 启动场景 - 标题画面
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLOR_HEX, COLORS } from '../utils/config.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    // 🔧 DEBUG: URL加 ?debug 可跳过标题直接进战斗
    if (new URLSearchParams(window.location.search).has('debug')) {
      this.scene.start('BattleScene');
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
    
    // 开始按钮
    const startBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.65, 
      '▶ 开始公演', {
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
}
