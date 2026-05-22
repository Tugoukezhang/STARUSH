/**
 * ST☆RUSH 偶像弹幕射击 - 入口
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './utils/config.js';
import { TitleScene } from './scenes/TitleScene.js';
import { CharacterScene } from './scenes/CharacterScene.js';
import { StageScene } from './scenes/StageScene.js';
import { BattleScene } from './scenes/BattleScene.js';

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#0a0a1a',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [TitleScene, CharacterScene, StageScene, BattleScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(config);
