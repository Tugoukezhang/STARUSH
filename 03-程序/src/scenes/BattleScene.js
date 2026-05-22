/**
 * 主战斗场景 - Phase 1核心
 * 整合：5色弹幕射击 + 应援系统 + 安可 + C位模式
 * 
 * 操作：WASD移动 | Q切颜色 | 自动射击
 * 5色触发：击杀=对应色 | 移动=蓝 | 站定1秒=紫 | Combo≥5=黄
 */

import Phaser from 'phaser';
import { 
  GAME_WIDTH, GAME_HEIGHT, 
  SHOOT_CONFIG, PLAYER, ENEMY_TYPES, 
  COLOR_HEX, COLORS,
  ATMOSPHERE, ENCORE, CENTER_STAGE, DAMAGE_ZONES,
} from '../utils/config.js';
import { AtmosphereSystem } from '../systems/AtmosphereSystem.js';
import { SupportSystem } from '../systems/SupportSystem.js';
import { EncoreSystem } from '../systems/EncoreSystem.js';
import { DamageCalculator, FORM_TYPE } from '../systems/DamageCalculator.js';
import { WaveSystem, WAVE_DEFS } from '../systems/WaveSystem.js';
import { CPComboHandler } from '../systems/CPComboHandler.js';
import { ResonanceSystem } from '../systems/ResonanceSystem.js';

export class BattleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BattleScene' });
  }

  preload() {
    this.load.atlas('sakura', 'sakura-spritesheet-v2.png', 'sakura-spritesheet-v1.json');
    this.load.atlas('particles-impact', 'particles-impact-atlas.png', 'particles-impact-atlas.json');
    this.load.image('particles-burst', 'particles-burst-v1-clear.png');
    this.load.image('particles-trail', 'particles-trail-v1-clear.png');
    this.load.image('bullets-sheet', 'bullets-v4-clear.png');
  }

  create() {
    // 清理所有前序场景DOM（CharacterScene/StageScene）
    ['char-ui','char-detail-overlay','stage-ui','stage-detail-overlay'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    // 背景
    this.cameras.main.setBackgroundColor('#0a0a1a');

    // 预生成敌人纹理（Canvas2D方式，兼容性最佳）
    this._generateEnemyTextures();
    // 创建绯樱动画
    this._createSakuraAnims();

    // === 系统初始化 ===
    this.atmosphere = new AtmosphereSystem(this);
    this.support = new SupportSystem(this);
    this.encore = new EncoreSystem(this);
    this.dmgCalc = new DamageCalculator(this.atmosphere, this.encore, this.support);

    // === CP应援处理器 ===
    this.cpHandler = new CPComboHandler(this);
    this.cpHandler.onCPComboName = (name, colors) => this._showCPName(name, colors);
    this.cpHandler.onSlowField = (radius, slowRate, duration) => this._showSlowFieldFx(radius, slowRate, duration);
    this.cpHandler.onCritBurst = (critBonus, duration) => this._showCritBurstFx(duration);
    this.cpHandler.onFrostShine = (radius, slowRate, dmgMulti, duration) => this._showFrostShineFx(radius, slowRate, dmgMulti, duration);
    this.cpHandler.onBurnSpread = (spreadRadius, duration) => this._showBurnSpreadFx(spreadRadius);
    this.cpHandler.onDotChain = (chainCount, duration) => this._showDotChainFx(duration);

    // === G1 共鸣等级系统 ===
    this.resonance = new ResonanceSystem();
    // 从场景数据读取队伍信息（由CharacterScene传入）
    const sceneData = this.scene.settings.data || {};
    this.battleData = sceneData;
    this.resonance.setTeam(sceneData.team || [{ name: '绯樱', level: 1, atk: 60, color: 'pink' }]);
    // B5 颜料保卫战模式
    this.defenseMode = sceneData.defenseMode || false;
    // CP 甜蜜五重奏（v1.5 §3.2.3c）：粉=5层进阶效果
    this.cpHandler.onSweetBloom = null;      // 甜蜜绽放：暴击率+30%
    this.cpHandler.onSweetWish = null;       // 甜蜜心愿：安可+3s+回血
    this.cpHandler.onSweetPhantom = null;    // 甜蜜幻影：幻影弹幕
    this.cpHandler.onSweetGuard = null;      // 甜蜜守护：护盾
    this.cpHandler.onSweetResonance = null;  // 甜蜜共鸣：合击
    this._sweetBloomActive = false;
    this._shieldHits = 0;
    this.playerShield = false;
    this._lastComboName = '';
    this._lastComboTime = 0;

    // === 玩家 ===
    this.player = this.physics.add.sprite(
      GAME_WIDTH / 2, GAME_HEIGHT - 80, 'sakura', 'down_idle_0'
    );
    if (this.player.texture.key === '__MISSING') {
      // fallback: atlas未加载成功，用占位符
      this.player.setTexture('__DEFAULT');
      this.playerGfx = this.add.graphics().setDepth(10);
    } else {
      this.player.setDisplaySize(48, 60);
      this.playerGfx = null;
      // 彩世界色环：形态+弹幕色指示
      this._colorOverlay = this.add.graphics().setDepth(9);
    }
    this.player.play('sakura-down-idle');

    this.player.body.setCircle(PLAYER.HITBOX_RADIUS,
      PLAYER.HITBOX_RADIUS, PLAYER.HITBOX_RADIUS);
    this.player.body.setCollideWorldBounds(true);
    this.player.setDepth(10);
    this.player.hp = PLAYER.BASE_HP;
    this.player.invulnerable = false;

    // === 弹幕组 ===
    this.playerBullets = this.physics.add.group({
      runChildUpdate: true,
    });
    this.enemyBullets = this.physics.add.group();
    this.enemies = this.physics.add.group();

    // === 分数 & 状态 ===
    this.score = 0;
    this.currentColor = COLORS.PINK;
    this.colorOrder = [COLORS.PINK, COLORS.BLUE, COLORS.YELLOW, COLORS.PURPLE, COLORS.ORANGE];
    this.colorIndex = 0;

    // === 形态 ===
    this.currentForm = FORM_TYPE.ATTACK;
    this.formColors = {
      attack:  0xFF4466,  // 输出型=红粉
      stain:   0x00CED1,  // 染色型=青蓝
      support: 0xFFD700,  // 辅助型=金黄
    };
    this.formNames = {
      attack:  '🎤 输出',
      stain:   '💃 染色',
      support: '🎵 辅助',
    };

    // === 射击计时器 ===
    this.lastShotTime = 0;
    this.isMoving = false;
    this.standTime = 0;
    this.wasMoving = false;
    this.enemyIdCounter = 0;

    // 减速场列表（甜蜜清爽CP）
    this.slowFields = [];
    // 冰晶闪耀场列表（冰晶闪耀CP）
    this.frostShineFields = [];
    // 闪耀标记层（甜蜜闪耀CP，独立于Combo）
    this.shiningMarkStacks = 0;
    // 辅助型被动标记
    this.supportFormActive = false;  // 独立标记层数

    // === 输入 ===
    this._setupInput();

    // === 碰撞检测 ===
    this._setupCollisions();

    // === 波次系统 ===
    this.waveSystem = new WaveSystem(this, (type) => this._spawnEnemyByType(type));
    this.waveSystem.onWaveStart = (idx, label) => this._showWaveLabel(label);
    this.waveSystem.onWaveClear = (idx) => { /* 波次清空提示 */ };
    this.waveSystem.onAllClear = () => this._onAllWavesClear();

    // 首波3秒后开始
    this.time.delayedCall(3000, () => {
      this.waveSystem.startNextWave();
    });

    // === 舞台视觉 ===
    this._drawStageFloor();

    // B5 颜料保卫战：3个颜料罐
    if (this.defenseMode) this._createPaintJars();

    // === HUD ===
    this._setupHUD();
    this._setupSystemCallbacks();
  }
  /**
   * 用纯Canvas 2D生成敌人纹理
   * Phaser的make.graphics().generateTexture()在此环境下静默失败
   * 改用Canvas2D画布 + textures.addCanvas绑定
   */
  _generateEnemyTextures() {
    const defs = [
      { key: 'texTrainee', r: 10 },
      { key: 'texAnti', r: 12 },
      { key: 'texMiniboss', r: 18 },
      { key: 'texBoss', r: 24 },
    ];
    for (const d of defs) {
      // Phaser纹理全局共享，已存在则跳过（避免二次创建抛异常→黑屏）
      if (this.textures.exists(d.key)) continue;
      const r = d.r;
      const size = r * 2;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      // 白色填充圆（后续用setTint着色）
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(r, r, r, 0, Math.PI * 2);
      ctx.fill();
      // 白色描边增加可见度
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(r, r, r - 1, 0, Math.PI * 2);
      ctx.stroke();
      // 绑定到Phaser纹理管理器
      this.textures.addCanvas(d.key, canvas);
    }
  }

  _createSakuraAnims() {
    const dirs = ['down', 'left', 'right'];
    for (const dir of dirs) {
      this.anims.create({
        key: `sakura-${dir}-idle`,
        frames: this.anims.generateFrameNames('sakura', {
          prefix: `${dir}_idle_`, start: 0, end: 3, zeroPad: 0,
        }),
        frameRate: 8, repeat: -1,
      });
      this.anims.create({
        key: `sakura-${dir}-move`,
        frames: this.anims.generateFrameNames('sakura', {
          prefix: `${dir}_move_`, start: 0, end: 3, zeroPad: 0,
        }),
        frameRate: 10, repeat: -1,
      });
      this.anims.create({
        key: `sakura-${dir}-shoot`,
        frames: this.anims.generateFrameNames('sakura', {
          prefix: `${dir}_shoot_`, start: 0, end: 1, zeroPad: 0,
        }),
        frameRate: 12, repeat: 0,
      });
    }
  }

  // ===================== 输入 =====================
  
  _setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.colorSwitchKey = this.input.keyboard.addKey('Q');
    
    // Q键切换颜色
    this.colorSwitchKey.on('down', () => {
      this.colorIndex = (this.colorIndex + 1) % this.colorOrder.length;
      this.currentColor = this.colorOrder[this.colorIndex];
    });

    // E键切换形态
    this.formSwitchKey = this.input.keyboard.addKey('E');
    this.formSwitchKey.on('down', () => {
      this._switchForm();
    });

    // 数字键1/2/3直接选形态
    this.input.keyboard.on('keydown-ONE', () => this._setForm(FORM_TYPE.ATTACK));
    this.input.keyboard.on('keydown-TWO', () => this._setForm(FORM_TYPE.STAIN));
    this.input.keyboard.on('keydown-THREE', () => this._setForm(FORM_TYPE.SUPPORT));
  }

  // ===================== 射击 =====================
  
  _tryShoot(time) {
    const fireRate = SHOOT_CONFIG.FIRE_RATE / this.support.getCenterStageFireRateMultiplier();
    if (time - this.lastShotTime < fireRate) return;
    this.lastShotTime = time;
    
    const colorHex = COLOR_HEX[this.currentColor] || 0xFFFFFF;
    
    // 用Graphics画弹幕（5色特色形状）
    const bGfx = this.add.graphics();
    this._drawBulletShape(bGfx, this.currentColor, colorHex);
    
    // 自动瞄准：找最近敌人方向（加预判偏移，补偿敌人移动）
    let aimVx = 0, aimVy = -1;  // 默认向上
    let nearestDist = Infinity;
    let nearestEnemy = null;
    this.enemies.children.iterate(e => {
      if (!e || !e.active) return;
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestEnemy = e;
      }
    });
    if (nearestEnemy) {
      // 迭代求解拦截点：第一次用当前位置算时间，第二次用预判位置修正
      let predX = nearestEnemy.x;
      let predY = nearestEnemy.y;
      for (let i = 0; i < 2; i++) {
        const dx = predX - this.player.x;
        const dy = predY - this.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const time = dist / SHOOT_CONFIG.BULLET_SPEED;
        predX = nearestEnemy.x + (nearestEnemy.moveVx || 0) * time;
        predY = nearestEnemy.y + (nearestEnemy.moveVy || 0) * time;
      }
      const dx = predX - this.player.x;
      const dy = predY - this.player.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      aimVx = dx / len;
      aimVy = dy / len;
    }

    // 创建physics sprite作为碰撞体
    const bullet = this.physics.add.sprite(
      this.player.x, this.player.y - 10, '__DEFAULT'
    );
    bullet.setAlpha(0); // 隐藏默认纹理
    bullet.body.moves = false;               // 不用物理驱动，改手动移动
    bullet.body.allowGravity = false;
    bullet.moveVx = aimVx * SHOOT_CONFIG.BULLET_SPEED;
    bullet.moveVy = aimVy * SHOOT_CONFIG.BULLET_SPEED;
    bullet.body.setCircle(7, 0, 0);  // 半径7，最大命中判定
    bullet.setDepth(5);
    bullet.color = this.currentColor;
    bullet.isCrit = this.dmgCalc.rollCrit();
    bullet.gfx = bGfx; // 关联视觉
    
    this.playerBullets.add(bullet);
    
    if (bullet.isCrit) {
      this._spawnCritFx(bullet.x, bullet.y, bullet.color);
    }
    
    this.time.delayedCall(2000, () => {
      if (bullet.active) {
        if (bullet.gfx) bullet.gfx.destroy();
        bullet.destroy();
      }
    });
  }

  // ===================== 碰撞 =====================
  
  _setupCollisions() {
    this.physics.add.overlap(this.playerBullets, this.enemies, 
      (bullet, enemy) => this._onBulletHitEnemy(bullet, enemy)
    );
    this.physics.add.overlap(this.enemyBullets, this.player,
      (_bullet, _player) => this._onEnemyHitPlayer()
    );
    this.physics.add.overlap(this.enemies, this.player,
      (_enemy, _player) => this._onEnemyHitPlayer()
    );
  }

  _onBulletHitEnemy(bullet, enemy) {
    if (!bullet.active || !enemy.active) return;
    
    // 基础伤害（闪耀标记加成由DamageCalculator统一处理，避免双重叠加）
    const baseDmg = 10;
    
    const result = this.dmgCalc.calculate(baseDmg, enemy, bullet.isCrit);
    
    // 命中震动反馈
    this.cameras.main.shake(bullet.isCrit ? 80 : 40, bullet.isCrit ? 0.005 : 0.002);
    
    enemy.hp -= result.total;
    
    if (result.isTrueDamage) {
      enemy.hp -= result.trueDamageAmount;
      this._spawnRainbowFx(enemy.x, enemy.y);
    }
    
    // B3 弱点击破（v1.5）：任意色弹幕命中灼烧目标弱点判定区（20px）触发
    const wasBurning = enemy.hasBurn;
    if (bullet.color === COLORS.ORANGE) {
      this._applyBurn(enemy, bullet.isCrit);
    }
    // 紫色弹幕累加腐蚀层数（甜蜜幻影前置条件）
    if (bullet.color === COLORS.PURPLE) {
      enemy.corrosionStacks = (enemy.corrosionStacks || 0) + 1;
      // 紫色腐蚀DOT：首次染紫时启动1秒timer，每层2%HP/秒
      if (!enemy.corrosionTimer) {
        enemy.corrosionTimer = this.time.addEvent({
          delay: 1000, loop: true,
          callback: () => {
            if (!enemy.active) { if (enemy.corrosionTimer) enemy.corrosionTimer.remove(false); return; }
            const dotDmg = Math.ceil(enemy.maxHp * 0.02 * (enemy.corrosionStacks || 1));
            enemy.hp -= dotDmg;
            this._spawnDamageNumber(enemy.x, enemy.y - 8, dotDmg, false, 0x9370DB);
            if (enemy.hp <= 0) this._onEnemyKilled(enemy, COLORS.PURPLE);
          },
        });
      }
    }
    // 灼烧中的目标：弹幕命中敌人中心20px内 = 弱点击破
    if (wasBurning) {
      const distToCenter = Math.sqrt(
        (bullet.x - enemy.x) ** 2 + (bullet.y - enemy.y) ** 2
      );
      if (distToCenter <= 20) {
        this._tryWeakPointBreak(enemy);
      }
    }

    this.atmosphere.triggerFromHit();

    // 染色型AOE溅射（GDD v1.4 §4.2.1b）
    if (this.currentForm === FORM_TYPE.STAIN) {
      this._applyStainSplash(enemy.x, enemy.y, bullet, result.total);
    }

    this._spawnDamageNumber(enemy.x, enemy.y - 10, result.total, bullet.isCrit);

    if (enemy.hp <= 0) {
      this._onEnemyKilled(enemy, bullet.color);
      // CP甜蜜五重奏①：暴击击杀
      this._trySweetBloom(enemy, bullet.isCrit);
    }

    // CP甜蜜五重奏③：幻影弹幕（粉5+紫腐蚀≥3+暴击）
    this._trySweetPhantom(enemy, bullet);

    if (bullet.gfx) bullet.gfx.destroy();
    bullet.destroy();
  }

  _onEnemyKilled(enemy, killColor) {
    if (!enemy.active) return;  // 防止重复击杀（双弹命中/burn计时器竞态）
    this.score += enemy.score || 100;
    this.atmosphere.triggerFromKill(killColor);

    if (enemy.type === 'trainee') this.support.gainFromKillSmall();
    else if (enemy.type === 'anti') this.support.gainFromKillMedium();
    else this.support.gainFromKillMedium(); // miniboss/boss同黑粉档

    // 通知波次系统
    this.waveSystem.onEnemyKilled();

    this._spawnKillFx(enemy.x, enemy.y, killColor);

    // 清理射击timer
    if (enemy.shootTimer) { enemy.shootTimer.remove(false); enemy.shootTimer = null; }
    // 清理灼烧timer（防止泄露）
    if (enemy.burnTimer) { enemy.burnTimer.remove(false); enemy.burnTimer = null; }
    // 清理腐蚀timer
    if (enemy.corrosionTimer) { enemy.corrosionTimer.remove(false); enemy.corrosionTimer = null; }
    // 清理Boss血条
    if (enemy.hpBarBg) { enemy.hpBarBg.destroy(); enemy.hpBarBg = null; }
    if (enemy.hpBarFill) { enemy.hpBarFill.destroy(); enemy.hpBarFill = null; }
    // 清理灼烧/安可视觉圈
    if (enemy.burnRing) { enemy.burnRing.destroy(); enemy.burnRing = null; }
    if (enemy.encoreRing) { enemy.encoreRing.destroy(); enemy.encoreRing = null; }
    // 清理外圈装饰
    if (enemy.outerRing1) { enemy.outerRing1.destroy(); enemy.outerRing1 = null; }
    if (enemy.outerRing2) { enemy.outerRing2.destroy(); enemy.outerRing2 = null; }
    // 清理溅射减速环
    if (enemy.slowRing) { enemy.slowRing.destroy(); enemy.slowRing = null; }

    enemy.destroy();
  }

  _onEnemyHitPlayer() {
    if (this.player.invulnerable) return;
    // CP甜蜜五重奏④：护盾吸收
    if (this.playerShield && this._shieldHits > 0) {
      this._shieldHits--;
      if (this._shieldHits <= 0) {
        this.playerShield = false;
        if (this.shieldRing) { this.shieldRing.destroy(); this.shieldRing = null; }
      }
      return;
    }
    // CP甜蜜五重奏④：粉5+HP≤2触发守护
    this._trySweetGuard();

    // 蓝色自伤：蓝氛围激活时15%概率额外扣1HP
    if (this.atmosphere.isSlowActive() && Math.random() < 0.15) {
      this.player.hp--;
    }
    this.player.hp--;
    this.cameras.main.shake(100, 0.005);  // 受击震屏
    this.player.invulnerable = true;
    this.support.gainFromTakeDamage();
    
    this.tweens.add({
      targets: this.playerGfx,
      alpha: 0.3,
      duration: 100,
      yoyo: true,
      repeat: 5,
      onComplete: () => { this.playerGfx.setAlpha(1); this.player.invulnerable = false; }
    });
    
    if (this.player.hp <= 0) this._onPlayerDeath();
  }

  // ===================== 回血 =====================

  /**
   * 玩家回血（GDD v1.4 §3.1.3）
   */
  _healPlayer(amount, source) {
    if (this.player.hp >= PLAYER.BASE_HP) return;
    this.player.hp = Math.min(this.player.hp + amount, PLAYER.BASE_HP);
    this._spawnHealFx(this.player.x, this.player.y, amount, source);
  }

  _spawnHealFx(x, y, amount, source) {
    const text = this.add.text(x, y - 15, `+${amount} ${source}`, {
      fontSize: '14px', color: '#00FF88', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({
      targets: text, y: y - 45, alpha: 0, duration: 800,
      onComplete: () => text.destroy(),
    });
    const ring = this.add.circle(x, y, 8, 0x00FF88, 0.3).setDepth(9);
    this.tweens.add({
      targets: ring, scaleX: 2, scaleY: 2, alpha: 0, duration: 500,
      onComplete: () => ring.destroy(),
    });
  }

  // ===================== 灼烧 =====================
  
  _applyBurn(enemy, isCrit) {
    enemy.hasBurn = true;
    const burnMult = isCrit ? ATMOSPHERE.orange.weakPointBonus : 1.0;
    
    // 灼烧视觉——circle对象
    if (!enemy.burnRing) {
      const r = enemy.drawRadius || 10;
      enemy.burnRing = this.add.circle(enemy.x, enemy.y, r + 2, 0xFF8C00, 0.0)
        .setStrokeStyle(2, 0xFF8C00, 0.6).setDepth(4);
    }
    
    if (enemy.burnTimer) enemy.burnTimer.remove(false);
    enemy.burnTimer = this.time.addEvent({
      delay: 500, repeat: 5,
      callback: () => {
        if (!enemy.active) return;
        enemy.hp -= enemy.maxHp * 0.015 * burnMult;
        this._spawnBurnFx(enemy.x, enemy.y);
        if (enemy.hp <= 0) this._onEnemyKilled(enemy, COLORS.ORANGE);
      }
    });
    this.time.delayedCall(ATMOSPHERE.orange.duration, () => {
      if (enemy.active) {
        enemy.hasBurn = false;
        if (enemy.burnRing) { enemy.burnRing.destroy(); enemy.burnRing = null; }
      }
    });
  }

  // ===================== 染色型AOE溅射 =====================

  /**
   * 染色型AOE溅射（GDD v1.4 §4.2.1b）
   * 3被动：
   *   - 溅射范围+50% → baseRadius*1.5
   *   - 命中减速+20% → slowFromHit
   *   - 溅射持续+1秒 → slowDuration延长
   */
  _applyStainSplash(hitX, hitY, bullet, dmgAmount) {
    const baseRadius = 40;
    const splashRadius = baseRadius * (1 + DAMAGE_ZONES.FORM.STAIN_RANGE); // +50%
    const slowRate = DAMAGE_ZONES.FORM.STAIN_SLOW;  // +20%
    const slowDuration = 1500 + DAMAGE_ZONES.FORM.STAIN_DUR; // 1.5s+1s
    const splashDmg = Math.floor(dmgAmount * 0.4); // 溅射伤害=主伤害40%

    // 视觉：溅射圈
    const splashCircle = this.add.circle(hitX, hitY, 5, 0x00CED1, 0.25).setDepth(4);
    this.tweens.add({
      targets: splashCircle,
      scaleX: splashRadius / 5, scaleY: splashRadius / 5, alpha: 0,
      duration: 400,
      onComplete: () => splashCircle.destroy(),
    });

    // 收集溅射击杀列表（避免迭代中修改group）
    const toKill = [];
    this.enemies.children.iterate(e => {
      if (!e || !e.active) return;
      // 跳过主目标（已在_onBulletHitEnemy中处理）
      if (e.x === hitX && e.y === hitY) return;
      const dist = Phaser.Math.Distance.Between(e.x, e.y, hitX, hitY);
      if (dist <= splashRadius) {
        e.hp -= splashDmg;
        this._spawnDamageNumber(e.x, e.y - 5, splashDmg, false);
        e.slowFromHit = slowRate;
        this.time.delayedCall(slowDuration, () => {
          if (e.active) e.slowFromHit = 0;
        });
        if (!e.slowRing) {
          const r = e.drawRadius || 10;
          e.slowRing = this.add.circle(e.x, e.y, r + 3, undefined, 0)
            .setStrokeStyle(1.5, 0x00CED1, 0.5).setDepth(2);
        }
        this.time.delayedCall(slowDuration, () => {
          if (e.slowRing) { e.slowRing.destroy(); e.slowRing = null; }
        });
        if (e.hp <= 0) toKill.push({ enemy: e, color: bullet.color });
      }
    });
    // 统一处理击杀（避免迭代中destroy）
    for (const k of toKill) {
      this._onEnemyKilled(k.enemy, k.color);
    }
  }

  // ===================== 敌人（波次驱动） =====================

  _spawnEnemyByType(type) {
    const x = Phaser.Math.Between(30, GAME_WIDTH - 30);
    let texKey, radius, hp, speed, enemyType, fillColor, strokeColor;

    switch (type) {
      case 'anti':
        texKey = 'texAnti'; radius = 12; hp = ENEMY_TYPES.ANTI.hp; speed = ENEMY_TYPES.ANTI.speed;
        enemyType = 'anti'; fillColor = 0xFF4444; strokeColor = 0xFF0000;
        break;
      case 'miniboss':
        texKey = 'texMiniboss'; radius = 18; hp = 200; speed = 40;
        enemyType = 'miniboss'; fillColor = 0x9370DB; strokeColor = 0x9370DB;
        break;
      case 'boss':
        texKey = 'texBoss'; radius = 24; hp = 500; speed = 30;
        enemyType = 'boss'; fillColor = 0xFF1493; strokeColor = 0xFF69B4;
        break;
      default: // trainee
        texKey = 'texTrainee'; radius = 10; hp = ENEMY_TYPES.TRAINEE.hp; speed = ENEMY_TYPES.TRAINEE.speed;
        enemyType = 'trainee'; fillColor = 0xCCCCCC; strokeColor = 0xFFFFFF;
    }

    // G1 共鸣门槛惩罚：低于关卡门槛时敌人HP×1.3、伤害×1.2
    const stageId = this.battleData.stageId || 1;
    const gates = { 5:3, 13:12, 23:25, 33:42 };
    const requiredGate = gates[stageId];
    if (requiredGate && this.resonance.getTeamLevel() < requiredGate) {
      hp = Math.floor(hp * 1.3);
    }

    // 从屏幕顶部入场
    const enemy = this.physics.add.sprite(x, 0, texKey);
    enemy.setTint(fillColor);
    enemy.body.setCircle(radius, 0, 0);
    enemy.body.moves = false;           // 不用物理引擎驱动移动，手动控制
    enemy.body.allowGravity = false;
    enemy.setDepth(3);
    // 存储移动速度，在update中手动驱动
    enemy.moveVx = Phaser.Math.Between(-30, 30);
    enemy.moveVy = speed;

    // 外圈装饰（Boss双圈，Anti/MiniBoss单圈）
    if (enemyType === 'boss') {
      enemy.outerRing1 = this.add.circle(x, -radius, radius + 6, undefined, 0)
        .setStrokeStyle(2, strokeColor, 0.4).setDepth(2);
      enemy.outerRing2 = this.add.circle(x, -radius, radius + 3, undefined, 0)
        .setStrokeStyle(1, 0xFF69B4, 0.3).setDepth(2);
    } else if (enemyType === 'anti' || enemyType === 'miniboss') {
      enemy.outerRing1 = this.add.circle(x, -radius, radius + 4, undefined, 0)
        .setStrokeStyle(1.5, strokeColor, 0.35).setDepth(2);
      enemy.outerRing2 = null;
    } else {
      enemy.outerRing1 = null;
      enemy.outerRing2 = null;
    }

    // 存储属性
    enemy.drawRadius = radius;
    enemy.hp = hp;
    enemy.maxHp = hp;
    enemy.type = enemyType;
    enemy.score = enemyType === 'boss' ? 2000 : enemyType === 'miniboss' ? 800 : enemyType === 'anti' ? ENEMY_TYPES.ANTI.score : ENEMY_TYPES.TRAINEE.score;
    enemy.hasBurn = false;
    enemy.isEncore = false;
    enemy.encoreDmgBonus = 0;
    enemy.burnRing = null;
    enemy.encoreRing = null;
    enemy.id = ++this.enemyIdCounter;
    // Boss AI阶段追踪（v1.5 §3.8.6）
    if (enemyType === 'boss') {
      enemy.bossPhase = 1;
      enemy.bossMaxHp = hp;
      enemy.bossPhaseChanging = false;
    }

    this.enemies.add(enemy);

    // Boss/MiniBoss 血条
    if (enemyType === 'boss' || enemyType === 'miniboss') {
      this._createBossHpBar(enemy, radius);
    }

    // 射击timer
    if (enemyType === 'anti' || enemyType === 'boss' || enemyType === 'miniboss') {
      const shootDelay = enemyType === 'boss' ? 1200 : enemyType === 'miniboss' ? 1500 : 2000;
      enemy.shootTimer = this.time.addEvent({
        delay: shootDelay, callback: () => this._enemyShoot(enemy),
        callbackScope: this, loop: true,
      });
    }

    // 120秒安全兜底（防止极端卡死，正常流程敌人会被击杀）
    this.time.delayedCall(120000, () => {
      if (enemy.active) {
        if (enemy.shootTimer) { enemy.shootTimer.remove(false); enemy.shootTimer = null; }
        if (enemy.burnTimer) { enemy.burnTimer.remove(false); enemy.burnTimer = null; }
        this.waveSystem.onEnemyKilled();
        if (enemy.hpBarBg) { enemy.hpBarBg.destroy(); enemy.hpBarBg = null; }
        if (enemy.hpBarFill) { enemy.hpBarFill.destroy(); enemy.hpBarFill = null; }
        if (enemy.burnRing) { enemy.burnRing.destroy(); enemy.burnRing = null; }
        if (enemy.encoreRing) { enemy.encoreRing.destroy(); enemy.encoreRing = null; }
        if (enemy.outerRing1) { enemy.outerRing1.destroy(); enemy.outerRing1 = null; }
        if (enemy.outerRing2) { enemy.outerRing2.destroy(); enemy.outerRing2 = null; }
        enemy.destroy();
      }
    });
  }

  _createBossHpBar(enemy, radius) {
    const barWidth = radius * 3;
    const barHeight = 4;
    const bg = this.add.graphics().setDepth(4);
    const fill = this.add.graphics().setDepth(4);
    enemy.hpBarBg = bg;
    enemy.hpBarFill = fill;
    enemy.hpBarWidth = barWidth;
    enemy.hpBarHeight = barHeight;
  }

  _updateBossHpBar(enemy) {
    if (!enemy.hpBarBg) return;
    const x = enemy.x - enemy.hpBarWidth / 2;
    const y = enemy.y - 20;
    const ratio = Math.max(enemy.hp / enemy.maxHp, 0);

    enemy.hpBarBg.clear();
    enemy.hpBarBg.fillStyle(0x333333, 0.6);
    enemy.hpBarBg.fillRect(x, y, enemy.hpBarWidth, enemy.hpBarHeight);

    enemy.hpBarFill.clear();
    const hpColor = ratio > 0.5 ? 0x00FF00 : ratio > 0.25 ? 0xFFD700 : 0xFF0000;
    enemy.hpBarFill.fillStyle(hpColor, 0.8);
    enemy.hpBarFill.fillRect(x, y, enemy.hpBarWidth * ratio, enemy.hpBarHeight);
  }

  _bossPhaseChange(boss, newPhase, name, flashColor) {
    boss.bossPhaseChanging = true;
    boss.bossPhase = newPhase;
    // 阶段切换视觉
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.3,
      `⭐ ${name}`, { fontSize: '20px', color: '#FFD700', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: text, alpha: 0, y: text.y - 50, duration: 2000, onComplete: () => text.destroy() });
    // Boss闪烁
    boss.setTint(0xFFFFFF);
    this.time.delayedCall(200, () => { if (boss.active) boss.setTint(flashColor); });
    this.time.delayedCall(400, () => { if (boss.active) boss.setTint(0xFFFFFF); });
    this.time.delayedCall(600, () => {
      if (boss.active) {
        boss.setTint(flashColor);
        boss.bossPhaseChanging = false;
        // P3弱点色切换为蓝色
        if (newPhase === 3) {
          boss.weaknessColor = COLORS.BLUE;
          const notice = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.5,
            '弱点色切换→🔵蓝', { fontSize: '13px', color: '#00CED1', fontStyle: 'bold',
          }).setOrigin(0.5).setDepth(30);
          this.tweens.add({ targets: notice, alpha: 0, duration: 2000, onComplete: () => notice.destroy() });
        }
      }
    });
    // P2后射击更密集
    if (boss.shootTimer) {
      boss.shootTimer.remove(false);
      const newDelay = newPhase === 3 ? 800 : newPhase === 2 ? 1200 : 2000;
      boss.shootTimer = this.time.addEvent({
        delay: newDelay, callback: () => this._enemyShoot(boss),
        callbackScope: this, loop: true,
      });
    }
  }

  _enemyShoot(enemy) {
    if (!enemy.active) return;
    // Boss多弹幕（v1.5 §3.8.6）
    const isBossTarget = enemy.type === 'boss';
    const burstCount = isBossTarget ? (enemy.bossPhase === 3 ? 12 : enemy.bossPhase === 2 ? 8 : 6) : 1;
    const angles = isBossTarget ? Array.from({length: burstCount}, (_, i) => (i * Math.PI * 2 / burstCount)) : [0];
    for (const angle of angles) {
      const bullet = this.physics.add.sprite(enemy.x, enemy.y + 10, '__DEFAULT');
      bullet.setAlpha(0);
      bullet.body.moves = false;
      bullet.body.allowGravity = false;
      if (isBossTarget) {
        const spd = enemy.bossPhase === 3 ? 200 : 150;
        bullet.moveVx = Math.cos(angle) * spd;
        bullet.moveVy = Math.sin(angle) * spd + 40;
      } else {
        bullet.moveVx = Phaser.Math.Between(-40, 40);
        bullet.moveVy = 150;
      }
      bullet.body.setCircle(3, 0, 0);
      bullet.setDepth(2);

      // 视觉 + 暗色外轮廓（提高可见度）
      const bGfx = this.add.graphics();
      bGfx.lineStyle(1, 0x111111, 0.5);
      bGfx.strokeCircle(4, 4, 4);
      const isBossVisual = enemy.type === 'boss' || enemy.type === 'miniboss';
      if (isBossVisual) {
        bGfx.fillStyle(0xFF1493, 0.9);
        bGfx.fillCircle(3, 2, 2);
        bGfx.fillCircle(6, 2, 2);
        bGfx.fillStyle(0x8B0000, 0.7);
        bGfx.fillTriangle(1, 4, 7, 4, 4, 8);
      } else {
        bGfx.fillStyle(0xFF4444, 0.8);
        bGfx.fillTriangle(0, 0, 4, 0, 2, 3);
        bGfx.fillStyle(0x8B0000, 0.6);
        bGfx.fillTriangle(2, 3, 6, 3, 4, 6);
      }
      bullet.gfx = bGfx;
      
      this.enemyBullets.add(bullet);
      this.time.delayedCall(4000, () => {
        if (bullet.active) {
          if (bullet.gfx) bullet.gfx.destroy();
          bullet.destroy();
        }
      });
    }
  }

  // ===================== HUD =====================
  
  _setupHUD() {
    this.scoreText = document.getElementById('score-text');
    this.supportText = document.getElementById('support-text');
    this.supportFill = document.getElementById('support-gauge-fill');
    this.comboDisplay = document.getElementById('combo-display');
    this.encoreIndicator = document.getElementById('encore-indicator');
    this.centerStageIndicator = document.getElementById('center-stage-indicator');
    this.atmoDots = {
      pink: document.getElementById('atmo-pink'),
      blue: document.getElementById('atmo-blue'),
      yellow: document.getElementById('atmo-yellow'),
      purple: document.getElementById('atmo-purple'),
      orange: document.getElementById('atmo-orange'),
    };
    this.hpPips = [];
    for (let i = 1; i <= 5; i++) {
      this.hpPips.push(document.getElementById(`hp-${i}`));
    }
  }

  _setupSystemCallbacks() {
    // 氛围名映射
    this.atmoNames = { pink: '甜蜜', blue: '清爽', yellow: '闪耀', purple: '神秘', orange: '热烈' };
    this._prevCombo = 0;
    this._lastAtmoTime = 0;
    this._playerDir = 'down';
    // 氛围文字单例（避免叠加）
    this.atmoLabel = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.35, '', {
      fontSize: '36px', fontFamily: '"Microsoft YaHei", "PingFang SC", Arial, sans-serif',
      fontStyle: 'bold', stroke: '#111', strokeThickness: 4, shadow: { blur: 8, color: '#000', fill: true },
    }).setOrigin(0.5).setDepth(60).setAlpha(0).setScale(0.5);
    this.atmoRing = this.add.circle(GAME_WIDTH / 2, GAME_HEIGHT * 0.35, 15, 0, 0).setDepth(55).setAlpha(0);

    this.atmosphere.onAtmosphereChange = (color, active) => {
      const dot = this.atmoDots[color];
      if (dot) dot.classList.toggle('active', active);
      // 氛围名文字（2秒冷却）
      if (active && this.atmoNames[color] && Date.now() - this._lastAtmoTime > 2000) {
        this._showAtmoName(color);
        this._lastAtmoTime = Date.now();
      }
    };
    this.atmosphere.onComboChange = (combo) => {
      if (this.comboDisplay) {
        this.comboDisplay.textContent = `${combo} COMBO`;
        this.comboDisplay.style.opacity = combo > 0 ? '1' : '0';
      }
      // Combo断裂反馈：从≥5掉到0
      if (this._prevCombo >= 5 && combo === 0) {
        this._showComboBreak();
      }
      this._prevCombo = combo;
    };
    this.atmosphere.onCPCombo = (name, colors) => {
      this.cpHandler.tryTrigger(colors);
    };
    this.atmosphere.onTripleCombo = (name, colors) => {
      this._showTripleName(name, colors);
    };
    this.atmosphere.onRainbow = () => this._spawnRainbowScreenFx();
    this.support.onCenterStageStart = () => {
      if (this.centerStageIndicator) this.centerStageIndicator.style.opacity = '1';
      this._spawnCenterStageFx();
      this._healPlayer(1, 'C位回血');
    };
    this.support.onCenterStageEnd = () => {
      if (this.centerStageIndicator) this.centerStageIndicator.style.opacity = '0';
    };
    this.encore.onEncoreStart = () => {
      if (this.encoreIndicator) {
        this.encoreIndicator.style.opacity = '1';
        this.time.delayedCall(1500, () => {
          if (this.encoreIndicator) this.encoreIndicator.style.opacity = '0';
        });
      }
    };
    this.encore.onEncoreEnd = (enemy) => {
      // 色彩恢复：灰色灼烧标记5秒渐消
      if (enemy.active) {
        const grayRing = this.add.circle(enemy.x, enemy.y, (enemy.drawRadius || 10) + 2, undefined, 0)
          .setStrokeStyle(2, 0x888888, 0.5).setDepth(2);
        this.tweens.add({
          targets: grayRing, alpha: 0, duration: 5000,
          onComplete: () => grayRing.destroy(),
        });
      }
    };
    this.encore.onWeakPointBreak = () => this.support.gainFromWeakPoint();
  }

  _updateHUD() {
    if (this.scoreText) this.scoreText.textContent = `SCORE: ${this.score}`;
    if (this.supportText) this.supportText.textContent = `${this.support.value}`;
    if (this.supportFill) this.supportFill.style.width = `${this.support.getPercent() * 100}%`;

    const waveEl = document.getElementById('wave-text');
    if (waveEl && this.waveSystem) {
      waveEl.textContent = `WAVE ${this.waveSystem.getWaveNumber()}/${WAVE_DEFS.length}`;
    }
    // Combo数字显示
    if (this.comboDisplay) {
      const c = this.atmosphere.combo;
      if (c >= 5) {
        this.comboDisplay.textContent = `${c} COMBO`;
        this.comboDisplay.style.opacity = '1';
      } else {
        this.comboDisplay.style.opacity = '0';
      }
    }

    if (this.hpPips.length > 0) {
      for (let i = 0; i < 5; i++) {
        if (this.hpPips[i]) {
          this.hpPips[i].style.opacity = (i < this.player.hp) ? '1' : '0.15';
        }
      }
    }
  }

  // ===================== 特效 =====================
  
  _spawnCritFx(x, y, color) {
    const hex = COLOR_HEX[color] || 0xFFFFFF;
    // 爆散粒子
    if (this.textures.exists('particles-burst')) {
      const burst = this.add.image(x, y, 'particles-burst').setDepth(15)
        .setScale(0.015).setAlpha(0.7).setTint(hex);
      this.tweens.add({ targets: burst, alpha: 0, scaleX: 0.035, scaleY: 0.035, duration: 300,
        onComplete: () => burst.destroy() });
    } else {
      const flash = this.add.circle(x, y, 6, hex, 0.6);
      this.tweens.add({ targets: flash, alpha: 0, scaleX: 2, scaleY: 2, duration: 200, onComplete: () => flash.destroy() });
    }
    // GDD §3.1.2: 暴击额外产3颗星粒
    for (let i = 0; i < 3; i++) {
      const s = this.add.circle(x, y, 2, 0xFFD700, 0.9).setDepth(20);
      this.tweens.add({
        targets: s,
        x: x + Phaser.Math.Between(-15, 15),
        y: y + Phaser.Math.Between(-15, 15),
        alpha: 0, duration: 400, delay: i * 50,
        onComplete: () => s.destroy(),
      });
    }
  }

  _spawnKillFx(x, y, color) {
    const hex = COLOR_HEX[color] || 0xFFFFFF;
    // 同形碎裂：弹幕击中 → 炸开一堆同形小弹幕
    for (let i = 0; i < 10; i++) {
      const shard = this.add.graphics().setDepth(15);
      this._drawBulletShape(shard, color, hex);
      shard.x = x - 4; shard.y = y - 4;
      const dx = Phaser.Math.Between(-35, 35);
      const dy = Phaser.Math.Between(-35, 35);
      this.tweens.add({
        targets: shard, x: x + dx, y: y + dy,
        alpha: 0, scaleX: 0.15, scaleY: 0.15,
        duration: 400 + Math.random() * 200, delay: i * 8,
        onComplete: () => shard.destroy(),
      });
    }
  }

  _spawnDamageNumber(x, y, amount, isCrit) {
    const text = this.add.text(x, y, `${amount}`, {
      fontSize: isCrit ? '16px' : '12px',
      color: isCrit ? '#FFD700' : '#FFFFFF',
      fontStyle: isCrit ? 'bold' : 'normal',
    });
    text.setDepth(20).setOrigin(0.5);
    this.tweens.add({
      targets: text, y: y - 30, alpha: 0, duration: 600,
      onComplete: () => text.destroy(),
    });
  }

  _spawnBurnFx(x, y) {
    const p = this.add.circle(x + Phaser.Math.Between(-5, 5), y, 2, 0xFF8C00, 0.5);
    this.tweens.add({
      targets: p, y: y - 10, alpha: 0, duration: 300,
      onComplete: () => p.destroy(),
    });
  }

  _spawnRainbowFx(x, y) {
    [0xFF69B4, 0x00CED1, 0xFFD700, 0x9370DB, 0xFF8C00].forEach(c => {
      const p = this.add.circle(x, y, 4, c, 0.9);
      this.tweens.add({
        targets: p,
        x: x + Phaser.Math.Between(-40, 40),
        y: y + Phaser.Math.Between(-40, 40),
        alpha: 0, duration: 500,
        onComplete: () => p.destroy(),
      });
    });
  }

  _spawnRainbowScreenFx() {
    const flash = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT,
      0xFFFFFF, 0.15
    ).setDepth(50);
    this.tweens.add({
      targets: flash, alpha: 0, duration: 400,
      onComplete: () => flash.destroy(),
    });
  }

  _spawnCenterStageFx() {
    // 边框
    const border = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH - 4, GAME_HEIGHT - 4,
      0x000000, 0
    ).setStrokeStyle(3, 0xFF69B4, 0.8).setDepth(50);
    this.tweens.add({
      targets: border, alpha: 0, duration: CENTER_STAGE.DURATION,
      onComplete: () => border.destroy(),
    });
    // 聚光灯柱动画（3道强光）
    for (let i = 0; i < 3; i++) {
      const col = this.add.graphics().setDepth(49);
      col.fillStyle(0xFF69B4, 0.15);
      col.fillRect(GAME_WIDTH * (0.2 + i * 0.3) - 30, 0, 60, GAME_HEIGHT);
      this.tweens.add({
        targets: col, alpha: 0, duration: CENTER_STAGE.DURATION,
        onComplete: () => col.destroy(),
      });
    }
  }

  // ===================== CP/三色视觉 =====================

  _showCPName(name, colors) {
    // 频率限制：同名CP 3秒内不重复显示
    if (name === this._lastComboName && Date.now() - this._lastComboTime < 3000) return;
    this._lastComboName = name;
    this._lastComboTime = Date.now();
    this.support.gainFromCPCombo();
    const text = this.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30,
      `✦ ${name} ✦`,
      { fontSize: '18px', color: '#FFD700', fontStyle: 'bold', align: 'center' }
    ).setOrigin(0.5).setDepth(60).setAlpha(0);
    this.tweens.add({
      targets: text, alpha: 1, y: GAME_HEIGHT / 2, duration: 300,
      hold: 800, yoyo: true,
      onComplete: () => text.destroy(),
    });
  }

  _showTripleName(name, colors) {
    if (name === this._lastComboName && Date.now() - this._lastComboTime < 3000) return;
    this._lastComboName = name;
    this._lastComboTime = Date.now();
    this.support.gainFromTripleCombo();
    const text = this.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50,
      `★ ${name} ★`,
      { fontSize: '20px', color: '#FF69B4', fontStyle: 'bold', align: 'center' }
    ).setOrigin(0.5).setDepth(60).setAlpha(0);
    this.tweens.add({
      targets: text, alpha: 1, y: GAME_HEIGHT / 2 + 20, duration: 300,
      hold: 1000, yoyo: true,
      onComplete: () => text.destroy(),
    });
  }

  _showAtmoName(color) {
    const hex = COLOR_HEX[color] || 0xFFFFFF;
    const css = '#' + hex.toString(16).padStart(6, '0');
    this.tweens.killTweensOf(this.atmoLabel);
    this.tweens.killTweensOf(this.atmoRing);
    this.atmoLabel.setText(this.atmoNames[color]).setColor(css).setAlpha(0).setScale(0.3);
    this.atmoRing.setFillStyle(hex, 0.5).setScale(1).setAlpha(0);
    // 缩放弹入 → 淡入 → 停留 → 淡出
    this.tweens.add({
      targets: this.atmoLabel,
      scaleX: 1, scaleY: 1, alpha: 1,
      duration: 400, ease: 'Back.easeOut',
      hold: 800,
      yoyo: true,
      onComplete: () => { this.atmoLabel.setAlpha(0).setScale(0.01); },
    });
    this.tweens.add({
      targets: this.atmoRing, scaleX: 6, scaleY: 6, alpha: 0.01, duration: 1000,
      onComplete: () => { this.atmoRing.setAlpha(0).setScale(1); },
    });
  }

  _showComboBreak() {
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.3,
      'COMBO BREAK', {
        fontSize: '16px', color: '#888', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(60).setAlpha(0);
    this.tweens.add({
      targets: text, alpha: 0.8, duration: 200, hold: 500, yoyo: true,
      onComplete: () => text.destroy(),
    });
  }

  _showSlowFieldFx(radius, slowRate, duration) {
    const px = this.player.x;
    const py = this.player.y;
    // 减速场视觉
    const field = this.add.circle(
      px, py, radius, 0x00CED1, 0.1
    ).setDepth(1).setStrokeStyle(2, 0x00CED1, 0.3);
    this.tweens.add({
      targets: field, alpha: 0, duration,
      onComplete: () => {
        field.destroy();
        // 移除减速场
        const idx = this.slowFields.indexOf(sf);
        if (idx >= 0) this.slowFields.splice(idx, 1);
      },
    });
    // 注册减速场数据（供update检查）
    const sf = { x: px, y: py, radius, slowRate, active: true };
    this.slowFields.push(sf);
    // duration后标记失效
    this.time.delayedCall(duration, () => { sf.active = false; });
  }

  _showCritBurstFx(critBonus, duration) {
    // 甜蜜闪耀：标记层独立于Combo，累积3层
    this.shiningMarkStacks = Math.min(this.shiningMarkStacks + 1, 3);
    const aura = this.add.circle(
      this.player.x, this.player.y, 20, 0xFF69B4, 0.15
    ).setDepth(9).setStrokeStyle(1, 0xFFD700, 0.5);
    // 显示当前层数
    const stackText = this.add.text(
      this.player.x, this.player.y - 25,
      `✦×${this.shiningMarkStacks}`,
      { fontSize: '12px', color: '#FFD700', fontStyle: 'bold' }
    ).setOrigin(0.5).setDepth(20).setAlpha(0.9);
    this.tweens.add({
      targets: stackText, y: this.player.y - 45, alpha: 0, duration: 800,
      onComplete: () => stackText.destroy(),
    });
    this.tweens.add({
      targets: aura, scaleX: 1.5, scaleY: 1.5, alpha: 0, duration,
      onComplete: () => aura.destroy(),
    });
    // 暴击率临时增加critBonus
    this.atmosphere.tempCritBonus = (this.atmosphere.tempCritBonus || 0) + critBonus;
    this.time.delayedCall(duration, () => {
      this.atmosphere.tempCritBonus = Math.max(0, (this.atmosphere.tempCritBonus || 0) - critBonus);
    });
  }

  _showFrostShineFx(radius, slowRate, dmgMultiplier, duration) {
    const px = this.player.x;
    const py = this.player.y;
    // 冰晶闪耀视觉
    const field = this.add.circle(
      px, py, radius, 0x00CED1, 0.08
    ).setDepth(1).setStrokeStyle(2, 0xFFD700, 0.4);
    this.tweens.add({
      targets: field, alpha: 0, duration,
      onComplete: () => {
        field.destroy();
        const idx = this.frostShineFields.indexOf(fsf);
        if (idx >= 0) this.frostShineFields.splice(idx, 1);
      },
    });
    // 冰晶闪耀=减速+伤害加成
    const fsf = { x: px, y: py, radius, slowRate, dmgMultiplier, active: true };
    this.frostShineFields.push(fsf);
    this.time.delayedCall(duration, () => { fsf.active = false; });
  }

  _showBurnSpreadFx(spreadRadius) {
    const px = this.player.x;
    const py = this.player.y;
    // 视觉：橙色扩散圈
    const ring = this.add.circle(
      px, py, 5, 0xFF8C00, 0.4
    ).setDepth(1);
    this.tweens.add({
      targets: ring, scaleX: spreadRadius / 5, scaleY: spreadRadius / 5, alpha: 0, duration: 600,
      onComplete: () => ring.destroy(),
    });
    // 热恋灼烧：将灼烧状态传播给附近最多3个未灼烧的敌人
    let spreadCount = 0;
    this.enemies.children.iterate(e => {
      if (!e || !e.active || e.hasBurn || spreadCount >= 3) return;
      const dist = Phaser.Math.Distance.Between(e.x, e.y, px, py);
      if (dist <= spreadRadius) {
        this._applyBurn(e, false); // 非暴击灼烧
        spreadCount++;
      }
    });
  }

  _showDotChainFx(duration) {
    const flash = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT,
      0x9370DB, 0.05
    ).setDepth(50);
    this.tweens.add({
      targets: flash, alpha: 0, duration: 400,
      onComplete: () => flash.destroy(),
    });
  }

  // ===================== CP甜蜜五重奏（v1.5 §3.2.3c） =====================

  /** 检查粉=5层前置条件 */
  _hasPink5() {
    const pinkLayer = this.atmosphere.getLayer(COLORS.PINK);
    return pinkLayer >= 5;
  }

  /** 甜蜜绽放：粉5+暴击击杀 → 全队暴击率+30% 5秒 */
  _trySweetBloom(enemy, wasCrit) {
    if (!this._hasPink5() || !wasCrit || this._sweetBloomActive) return;
    this._sweetBloomActive = true;
    // 视觉
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.4, '🌸 甜蜜绽放!\n暴击率+30%', {
      fontSize: '16px', color: '#FF69B4', align: 'center', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: text, alpha: 0, y: text.y - 40, duration: 1500, onComplete: () => text.destroy() });
    // 效果：临时暴击加成
    this.atmosphere.tempCritBonus = (this.atmosphere.tempCritBonus || 0) + 0.3;
    this.time.delayedCall(5000, () => {
      this.atmosphere.tempCritBonus = Math.max(0, (this.atmosphere.tempCritBonus || 0) - 0.3);
      this._sweetBloomActive = false;
    });
  }

  /** 甜蜜心愿：粉5+安可爆发 → 安可+3s + 全队回1HP */
  _trySweetWish() {
    if (!this._hasPink5()) return;
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.35, '💖 甜蜜心愿!\n安可延长+3秒', {
      fontSize: '14px', color: '#FF69B4', align: 'center', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: text, alpha: 0, y: text.y - 40, duration: 1500, onComplete: () => text.destroy() });
    this._healPlayer(1, '甜蜜心愿');
    // 安可延长通过EncoreSystem处理
  }

  /** 甜蜜幻影：粉5+紫腐蚀≥3层+暴击 → 幻影弹幕50%伤害追踪 */
  _trySweetPhantom(hitEnemy, bullet) {
    if (!this._hasPink5() || !bullet.isCrit) return;
    const corrosionStacks = hitEnemy.corrosionStacks || 0;
    if (corrosionStacks < 3) return;
    // 生成幻影弹幕：找最近的其他敌人造成50%伤害
    const phantomDmg = 5;
    let nearestDist = Infinity;
    let nearest = null;
    this.enemies.children.iterate(e => {
      if (!e || !e.active || e === hitEnemy) return;
      const d = Phaser.Math.Distance.Between(hitEnemy.x, hitEnemy.y, e.x, e.y);
      if (d < nearestDist) { nearestDist = d; nearest = e; }
    });
    if (nearest) {
      nearest.hp -= phantomDmg;
      this._spawnDamageNumber(nearest.x, nearest.y - 5, phantomDmg, false);
      // 幻影视觉
      const ghost = this.add.circle(hitEnemy.x, hitEnemy.y, 4, 0xFF69B4, 0.6).setDepth(15);
      this.tweens.add({
        targets: ghost, x: nearest.x, y: nearest.y, alpha: 0, duration: 300,
        onComplete: () => ghost.destroy(),
      });
    }
  }

  /** 甜蜜守护：粉5+HP≤2 → 护盾吸收3次伤害 8秒 */
  _trySweetGuard(dmgAmount) {
    if (!this._hasPink5() || this.player.hp > 2) return;
    if (this.playerShield) return;
    this.playerShield = true;
    this._shieldHits = 3;
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.5, '🛡️ 甜蜜守护!\n吸收3次伤害', {
      fontSize: '16px', color: '#FF69B4', align: 'center', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: text, alpha: 0, y: text.y - 40, duration: 1500, onComplete: () => text.destroy() });
    // 护盾视觉环
    if (this.shieldRing) this.shieldRing.destroy();
    this.shieldRing = this.add.circle(this.player.x, this.player.y, 14, undefined, 0)
      .setStrokeStyle(2, 0xFF69B4, 0.6).setDepth(9);
    this.time.delayedCall(8000, () => {
      this.playerShield = false;
      if (this.shieldRing) { this.shieldRing.destroy(); this.shieldRing = null; }
    });
  }

  /** 甜蜜共鸣：粉5+5色全激活 → 合击伤害 */
  _trySweetResonance() {
    if (!this._hasPink5()) return;
    const allActive = this.atmosphere.areAllColorsActive ? this.atmosphere.areAllColorsActive() : false;
    if (!allActive) return;
    // 对场上所有敌人造成合击伤害
    this.enemies.children.iterate(e => {
      if (!e || !e.active) return;
      e.hp -= 15;
      this._spawnDamageNumber(e.x, e.y - 5, 15, true);
    });
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.45, '🎶 甜蜜共鸣!\n全场合击', {
      fontSize: '16px', color: '#FF69B4', align: 'center', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: text, alpha: 0, y: text.y - 40, duration: 2000, onComplete: () => text.destroy() });
  }

  // ===================== 弹幕视觉 =====================

  /** 5色弹幕特色形状 */
  _drawBulletShape(gfx, color, hex) {
    gfx.fillStyle(hex, 1);
    switch (color) {
      case COLORS.PINK: // 心形
        gfx.fillCircle(2, 1.5, 2);
        gfx.fillCircle(5, 1.5, 2);
        gfx.fillTriangle(0, 3, 7, 3, 3.5, 7);
        break;
      case COLORS.BLUE: // 水滴
        gfx.fillCircle(3, 4, 3);
        gfx.fillTriangle(0, 3, 6, 3, 3, 0);
        break;
      case COLORS.YELLOW: // 星星（5角）
        for (let i = 0; i < 5; i++) {
          const angle = (i * 72 - 90) * Math.PI / 180;
          const ix = 3 + Math.cos(angle) * 3;
          const iy = 3 + Math.sin(angle) * 3;
          gfx.fillCircle(ix, iy, 1.5);
        }
        break;
      case COLORS.PURPLE: // 菱形
        gfx.fillTriangle(3, 0, 6, 3.5, 3, 7);
        gfx.fillTriangle(3, 0, 0, 3.5, 3, 7);
        break;
      case COLORS.ORANGE: // 火焰
        gfx.fillCircle(3, 4, 3);
        gfx.fillTriangle(1, 2, 5, 2, 3, -1);
        gfx.fillStyle(0xFFAA00, 0.7);
        gfx.fillCircle(3, 4, 1.5);
        break;
      default:
        gfx.fillCircle(3, 3, 3);
    }
  }

  // ===================== 波次UI =====================

  _drawStageFloor() {
    const y = GAME_HEIGHT - 60;
    const gfx = this.add.graphics().setDepth(0);
    // 地板线
    gfx.lineStyle(2, 0xFF69B4, 0.3);
    gfx.lineBetween(0, y, GAME_WIDTH, y);
    // 渐变光带
    for (let x = 0; x < GAME_WIDTH; x += 10) {
      gfx.fillStyle(0xFF69B4, 0.05 + Math.sin(x * 0.05) * 0.03);
      gfx.fillRect(x, y, 8, 60);
    }
    // 舞台边缘聚光灯指示
    const dots = [GAME_WIDTH * 0.25, GAME_WIDTH * 0.5, GAME_WIDTH * 0.75];
    for (const dx of dots) {
      const dot = this.add.circle(dx, y, 3, 0xFF69B4, 0.4).setDepth(1);
      this.tweens.add({ targets: dot, alpha: 0.2, duration: 1500, yoyo: true, repeat: -1 });
    }
  }

  _showWaveLabel(label) {
    const text = this.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60,
      label,
      { fontSize: '24px', color: '#FFD700', fontStyle: 'bold', align: 'center' }
    ).setOrigin(0.5).setDepth(100).setAlpha(0);

    this.tweens.add({
      targets: text,
      alpha: 1, duration: 400,
      hold: 1200,
      yoyo: true,
      onComplete: () => text.destroy(),
    });
  }

  _onAllWavesClear() {
    let textStr = `🌟 全波次通关！\n\nSCORE: ${this.score}`;
    // B5评级
    if (this.defenseMode) {
      const rating = this._getJarRating();
      textStr += `\n评级: ${rating}`;
    }
    const text = this.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      textStr,
      { fontSize: '22px', color: '#FFD700', fontStyle: 'bold', align: 'center' }
    ).setOrigin(0.5).setDepth(100);

    this.time.delayedCall(3000, () => {
      if (text.active) text.destroy();
      this.time.delayedCall(1000, () => this.scene.start('StageScene'));
    });
  }

  _onJarDefeat() {
    this.physics.pause();
    this.playerGfx.setAlpha(0);
    const text = this.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      '💔 颜料罐全毁！\n\n点击返回',
      { fontSize: '20px', color: '#FF4444', align: 'center' }
    ).setOrigin(0.5).setDepth(100);
    this.input.once('pointerdown', () => this.scene.start('StageScene'));
  }

  // ===================== 形态切换 =====================

  _switchForm() {
    const order = [FORM_TYPE.ATTACK, FORM_TYPE.STAIN, FORM_TYPE.SUPPORT];
    const idx = order.indexOf(this.currentForm);
    this._setForm(order[(idx + 1) % order.length]);
  }

  _setForm(formType) {
    if (this.currentForm === formType) return;
    this.currentForm = formType;
    this.dmgCalc.setForm(formType);
    // 辅助型被动标记
    this.supportFormActive = (formType === FORM_TYPE.SUPPORT);
    // 辅助型被动1：团队氛围效果+30%（应援值获取×1.3）
    this.support.gainMultiplier = this.supportFormActive
      ? 1 + DAMAGE_ZONES.FORM.TEAM_ATMO
      : 1.0;
    // 辅助型被动2：团队暴击率+10%
    this.atmosphere.teamCritBonus = this.supportFormActive
      ? DAMAGE_ZONES.FORM.TEAM_CRIT
      : 0;
    // 辅助型被动3：安可状态+1秒
    this.encore.extraDuration = this.supportFormActive
      ? DAMAGE_ZONES.FORM.ENCORE_EXTRA
      : 0;

    const color = this.formColors[formType];
    const flash = this.add.circle(this.player.x, this.player.y, 30, color, 0.3).setDepth(9);
    this.tweens.add({
      targets: flash, scaleX: 2, scaleY: 2, alpha: 0, duration: 400,
      onComplete: () => flash.destroy(),
    });

    const formEl = document.getElementById('form-text');
    if (formEl) formEl.textContent = this.formNames[formType];
  }

  // ===================== 弱点击破 → 安可链 =====================
  _tryWeakPointBreak(enemy) {
    if (!enemy.active) return;
    if (!enemy.hasBurn) return;
    if (enemy.isEncore) return;

    const broke = this.encore.tryWeakPointBreak(enemy);
    if (broke) {
      this.cameras.main.shake(150, 0.01);  // 弱点击破重震
      this._spawnWeakPointBreakFx(enemy.x, enemy.y);
      this._healPlayer(1, '安可回血');
      // CP甜蜜五重奏②：安可爆发
      this._trySweetWish();
    }
  }

  _spawnWeakPointBreakFx(x, y) {
    const ring = this.add.circle(x, y, 5, 0xFF8C00, 0.8).setDepth(15);
    this.tweens.add({
      targets: ring,
      scaleX: 6, scaleY: 6, alpha: 0, duration: 500,
      onComplete: () => ring.destroy(),
    });
    const text = this.add.text(x, y - 20, '弱点击破!', {
      fontSize: '14px', color: '#FF8C00', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({
      targets: text, y: y - 50, alpha: 0, duration: 800,
      onComplete: () => text.destroy(),
    });
  }

  // ===================== 主循环 =====================
  
  update(time, delta) {
    if (!this.player || !this.player.active) return;

    // 移动
    let vx = 0, vy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -PLAYER.SPEED;
    else if (this.cursors.right.isDown || this.wasd.D.isDown) vx = PLAYER.SPEED;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -PLAYER.SPEED;
    else if (this.cursors.down.isDown || this.wasd.S.isDown) vy = PLAYER.SPEED;
    
    this.isMoving = (vx !== 0 || vy !== 0);
    this.player.body.setVelocity(vx, vy);
    
    // 更新玩家视觉
    if (this.playerGfx) {
      // fallback: 无atlas时用graphics画圆
      const formColor = this.formColors[this.currentForm];
      const bulletColor = COLOR_HEX[this.currentColor] || 0xFFFFFF;
      this.playerGfx.clear();
      this.playerGfx.fillStyle(0xFFFFFF, 1);
      this.playerGfx.fillCircle(this.player.x, this.player.y, 8);
      this.playerGfx.fillStyle(formColor, 0.6);
      this.playerGfx.fillCircle(this.player.x, this.player.y, 6);
      this.playerGfx.fillStyle(bulletColor, 0.8);
      this.playerGfx.fillCircle(this.player.x, this.player.y, 3);
      if (this.player.hp <= 2) {
        const pulse = 0.3 + Math.sin(time * 0.01) * 0.3;
        this.playerGfx.lineStyle(2, 0xFF0000, pulse);
        this.playerGfx.strokeCircle(this.player.x, this.player.y, 10);
      }
    } else {
      // atlas模式：方向追踪+动画
      if (vx < 0) this._playerDir = 'left';
      else if (vx > 0) this._playerDir = 'right';
      else if (vy !== 0) this._playerDir = 'down';
      const animKey = this.isMoving ? `sakura-${this._playerDir}-move` : `sakura-${this._playerDir}-idle`;
      if (this.player.anims && this.player.anims.currentAnim?.key !== animKey) {
        this.player.play(animKey);
      }
      // 彩世界色环叠加
      if (this._colorOverlay) {
        const formColor = this.formColors[this.currentForm];
        const bulletColor = COLOR_HEX[this.currentColor] || 0xFFFFFF;
        this._colorOverlay.clear();
        this._colorOverlay.fillStyle(formColor, 0.4);
        this._colorOverlay.fillCircle(this.player.x, this.player.y + 30, 8);
        this._colorOverlay.fillStyle(bulletColor, 0.9);
        this._colorOverlay.fillCircle(this.player.x, this.player.y + 30, 4);
      }
      // HP脉冲边框（用简单circle叠加）
      if (this.player.hp <= 2) {
        const pulse = 0.3 + Math.sin(time * 0.01) * 0.3;
        if (!this._hpPulseRing) this._hpPulseRing = this.add.circle(this.player.x, this.player.y, 12, 0, 0).setDepth(9);
        this._hpPulseRing.x = this.player.x;
        this._hpPulseRing.y = this.player.y;
        this._hpPulseRing.setStrokeStyle(2, 0xFF0000, pulse);
      } else {
        if (this._hpPulseRing) { this._hpPulseRing.destroy(); this._hpPulseRing = null; }
      }
    }
    // 护盾光环跟随
    if (this.shieldRing && this.playerShield) {
      this.shieldRing.x = this.player.x;
      this.shieldRing.y = this.player.y;
    }
    // CP甜蜜五重奏⑤：全五色合击
    this._trySweetResonance();
    
    // 弹幕手动移动 + 视觉同步（setVelocity不可靠，统一改手动驱动）
    const dt = delta / 1000;
    this.playerBullets.children.iterate(b => {
      if (!b || !b.active) return;
      if (b.moveVy !== undefined) {
        b.x += (b.moveVx || 0) * dt;
        b.y += b.moveVy * dt;
        b.body.reset(b.x, b.y);
      }
      if (b.gfx) b.gfx.setPosition(b.x - 3, b.y - 3);
      // 弹幕拖尾粒子
      if (this.textures.exists('particles-trail') && (!b._lastTrail || time - b._lastTrail > 80)) {
        b._lastTrail = time;
        const hex = COLOR_HEX[b.color] || 0xFFFFFF;
        const trail = this.add.image(b.x, b.y, 'particles-trail')
          .setDepth(4).setScale(0.03).setAlpha(0.4).setTint(hex);
        this.tweens.add({ targets: trail, alpha: 0, scaleX: 0.01, scaleY: 0.01, duration: 300, onComplete: () => trail.destroy() });
      }
      // 手动碰撞兜底
      this.enemies.children.iterate(e => {
        if (!e || !e.active || !b.active) return;
        if (Phaser.Math.Distance.Between(b.x, b.y, e.x, e.y) < (e.drawRadius || 10) + 7) {
          this._onBulletHitEnemy(b, e);
        }
      });
    });
    this.enemyBullets.children.iterate(b => {
      if (!b || !b.active) return;
      if (b.moveVy !== undefined) {
        b.x += (b.moveVx || 0) * dt;
        b.y += b.moveVy * dt;
        b.body.reset(b.x, b.y);
      }
      if (b.gfx) b.gfx.setPosition(b.x - 3, b.y - 3);
    });
    
    // 敌人移动 + 视觉同步
    this.enemies.children.iterate(e => {
      if (!e || !e.active) return;
      // 手动驱动移动（物理velocity不可靠，改用手动位移）
      if (e.moveVx !== undefined) {
        // 减速场检查：计算最慢的减速率
        let slowMultiplier = 1.0;
        for (const sf of this.slowFields) {
          if (!sf.active) continue;
          const dist = Phaser.Math.Distance.Between(e.x, e.y, sf.x, sf.y);
          if (dist <= sf.radius) {
            slowMultiplier = Math.min(slowMultiplier, 1.0 - sf.slowRate);
          }
        }
        // 染色型命中减速（e.slowFromHit由_onBulletHitEnemy设置）
        if (e.slowFromHit && e.slowFromHit > 0) {
          slowMultiplier = Math.min(slowMultiplier, 1.0 - e.slowFromHit);
        }
        e.x += e.moveVx * slowMultiplier * dt;
        e.y += e.moveVy * slowMultiplier * dt;
        // 水平边界反弹（防止敌人飘出屏幕）
        const margin = e.drawRadius || 10;
        if (e.x < margin) { e.x = margin; e.moveVx = Math.abs(e.moveVx); }
        if (e.x > GAME_WIDTH - margin) { e.x = GAME_WIDTH - margin; e.moveVx = -Math.abs(e.moveVx); }
        // 同步物理体位置（碰撞检测需要）
        e.body.reset(e.x, e.y);
      }
      // 外圈跟随
      if (e.outerRing1) {
        e.outerRing1.x = e.x;
        e.outerRing1.y = e.y;
      }
      if (e.outerRing2) {
        e.outerRing2.x = e.x;
        e.outerRing2.y = e.y;
      }
      // 灼烧环跟随
      if (e.burnRing) {
        e.burnRing.x = e.x;
        e.burnRing.y = e.y;
        // 闪烁效果
        e.burnRing.setStrokeStyle(2, 0xFF8C00, 0.4 + Math.sin(time * 0.01) * 0.3);
      }
      // 安可环跟随
      if (e.encoreRing) {
        e.encoreRing.x = e.x;
        e.encoreRing.y = e.y;
      }
      // Boss血条
      if (e.hpBarBg) this._updateBossHpBar(e);
      // Boss AI阶段切换（v1.5 §3.8.6）
      if (e.type === 'boss' && !e.bossPhaseChanging) {
        const hpPct = e.hp / e.bossMaxHp;
        if (e.bossPhase === 1 && hpPct <= 0.7) {
          this._bossPhaseChange(e, 2, '甜蜜之舞', 0xFF69B4);
        } else if (e.bossPhase === 2 && hpPct <= 0.4) {
          this._bossPhaseChange(e, 3, '安可预兆', 0x00CED1);
        }
      }
    });
    
    // 移动→蓝色（仅战斗中有敌人时触发）
    if (this.isMoving && !this.wasMoving && this.enemies && this.enemies.countActive() > 0) {
      this.atmosphere.triggerBlueFromMove();
    }
    this.wasMoving = this.isMoving;
    
    // 站定→紫色（仅战斗中有敌人时触发）
    if (!this.isMoving && this.enemies && this.enemies.countActive() > 0) {
      this.standTime += delta;
      if (this.standTime >= ATMOSPHERE.purple.standTime) {
        this.atmosphere.triggerPurpleFromStand();
        this.standTime = 0;
      }
    } else {
      this.standTime = 0;
    }
    
    // 自动射击
    this._tryShoot(time);
    
    // 清理出界（全方向）
    this.playerBullets.children.iterate(b => {
      if (b && (b.y < -20 || b.y > GAME_HEIGHT + 20 || b.x < -20 || b.x > GAME_WIDTH + 20)) {
        if (b.gfx) b.gfx.destroy();
        b.destroy();
      }
    });
    this.enemyBullets.children.iterate(b => {
      if (b && (b.y > GAME_HEIGHT + 20 || b.y < -20 || b.x < -20 || b.x > GAME_WIDTH + 20)) {
        if (b.gfx) b.gfx.destroy();
        b.destroy();
      }
    });
    // 底部边界 + 敌人AI：到达底部后主动接近玩家，不停留
    const BATTLE_FLOOR = GAME_HEIGHT - 60;
    this.enemies.children.iterate(e => {
      if (!e || !e.active) return;
      // 抵达底部：停止下移，切换为追击模式
      if (e.y > BATTLE_FLOOR && e.moveVy > 0) {
        e.moveVy = 0;
        e.y = BATTLE_FLOOR;
        e.body.reset(e.x, e.y);
        e.atBottom = true;
      }
      // AI：每0.8-2秒重新决策移动方向
      if (!e.aiTimer) e.aiTimer = Phaser.Math.Between(500, 1500);
      e.aiTimer -= delta;
      if (e.aiTimer <= 0) {
        e.aiTimer = Phaser.Math.Between(800, 2000);
        // B5防御模式：朝最近罐子移动
        if (this.defenseMode && this.paintJars) {
          let nearestJar = null, nearestJarDist = Infinity;
          for (const jar of this.paintJars) {
            if (!jar.alive) continue;
            const d = Math.abs(jar.x - e.x);
            if (d < nearestJarDist) { nearestJarDist = d; nearestJar = jar; }
          }
          if (nearestJar) {
            const toJar = nearestJar.x - e.x;
            e.moveVx = Math.sign(toJar) * Phaser.Math.Between(40, 70);
          }
        } else {
          const toPlayer = this.player.x - e.x;
          const distToPlayer = Math.abs(toPlayer);
          if (Math.random() < 0.8) {
            e.moveVx = Math.sign(toPlayer) * Phaser.Math.Between(30, 60);
            if (e.atBottom && distToPlayer > 80 && Math.random() < 0.3) {
              e.moveVy = -Phaser.Math.Between(20, 40);
              e.atBottom = false;
            }
          } else {
            e.moveVx = Phaser.Math.Between(-50, 50);
          }
        }
      }
      // 上浮后如果又掉回底部，重新停车
      if (e.moveVy > 0 && e.y > BATTLE_FLOOR) {
        e.moveVy = 0;
        e.y = BATTLE_FLOOR;
        e.body.reset(e.x, e.y);
        e.atBottom = true;
      }
    });
    
    // BPM灯光脉冲 + 聚光灯呼吸
    if (this.bpmBar) {
      this.bpmBar.clear();
      const pulse = 0.02 + Math.sin(time * 0.005) * 0.015;
      this.bpmBar.fillStyle(0xFF69B4, pulse);
      this.bpmBar.fillRect(0, 0, GAME_WIDTH, 4);
    }
    if (this.spotlights) {
      this.spotlights.forEach((s, i) => {
        s.clear();
        const alpha = 0.03 + Math.sin(time * 0.003 + i) * 0.02;
        s.fillStyle(0xFF69B4, alpha);
        s.fillRect(GAME_WIDTH * (0.2 + i * 0.3) - 20, 0, 40, GAME_HEIGHT);
      });
    }
    // B5 颜料罐绘制+伤害+失败判定
    if (this.defenseMode) {
      this._drawJars();
      this._updateJarDamage();
      if (this._checkJarDefeat()) {
        this._onJarDefeat();
      }
    }

    this._updateHUD();
  }

  _onPlayerDeath() {
    this.physics.pause();
    this.playerGfx.setAlpha(0);
    
    const gameOver = this.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      'GAME OVER\n\nSCORE: ' + this.score + '\n\n点击重新开始',
      { fontSize: '20px', color: '#fff', align: 'center' }
    ).setOrigin(0.5).setDepth(100);
    
    this.input.once('pointerdown', () => this.scene.restart());
  }

  // ===================== B5 颜料保卫战 =====================

  _createPaintJars() {
    this.paintJars = [];
    const jarColors = [0xFF69B4, 0x00CED1, 0xFFD700];
    const jx = [0.2, 0.5, 0.8];
    for (let i = 0; i < 3; i++) {
      const jar = {
        hp: 100, maxHp: 100,
        x: GAME_WIDTH * jx[i], y: GAME_HEIGHT - 30,
        color: jarColors[i], alive: true,
      };
      jar.gfx = this.add.graphics().setDepth(4);
      jar.hpBar = this.add.graphics().setDepth(5);
      this.paintJars.push(jar);
    }
  }

  _drawJars() {
    if (!this.paintJars) return;
    for (const jar of this.paintJars) {
      if (!jar.alive) continue;
      jar.gfx.clear();
      jar.gfx.fillStyle(jar.color, 0.7);
      jar.gfx.fillRoundedRect(jar.x - 12, jar.y - 16, 24, 32, 4);
      jar.gfx.lineStyle(2, 0xFFFFFF, 0.5);
      jar.gfx.strokeRoundedRect(jar.x - 12, jar.y - 16, 24, 32, 4);
      const hpPct = jar.hp / jar.maxHp;
      jar.hpBar.clear();
      jar.hpBar.fillStyle(0x333333, 0.8);
      jar.hpBar.fillRect(jar.x - 15, jar.y - 24, 30, 4);
      const hpColor = hpPct > 0.9 ? 0x4CAF50 : hpPct > 0.5 ? 0xFFD700 : 0xFF4444;
      jar.hpBar.fillStyle(hpColor, 0.9);
      jar.hpBar.fillRect(jar.x - 15, jar.y - 24, 30 * hpPct, 4);
    }
  }

  _updateJarDamage() {
    if (!this.defenseMode || !this.paintJars) return;
    this.enemies.children.iterate(e => {
      if (!e || !e.active) return;
      for (const jar of this.paintJars) {
        if (!jar.alive) continue;
        if (Phaser.Math.Distance.Between(e.x, e.y, jar.x, jar.y) < 20) {
          jar.hp -= 2;
          if (jar.hp <= 0) { jar.alive = false; jar.hp = 0; this._spawnKillFx(jar.x, jar.y, jar.color); }
          break;
        }
      }
    });
  }

  _checkJarDefeat() {
    return this.defenseMode && this.paintJars && this.paintJars.every(j => !j.alive);
  }

  _getJarRating() {
    if (!this.defenseMode || !this.paintJars) return null;
    const alive = this.paintJars.filter(j => j.alive);
    if (alive.length === 0) return 'C';
    const minHpPct = Math.min(...alive.map(j => j.hp / j.maxHp));
    if (this.paintJars.every(j => j.alive && j.hp / j.maxHp >= 0.9)) return 'S';
    if (minHpPct >= 0.7) return 'A';
    if (minHpPct >= 0.5) return 'B';
    return 'C';
  }
}
