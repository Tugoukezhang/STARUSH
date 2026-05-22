/**
 * ST☆RUSH 主线关卡选择（X1）
 * GDD v1.5 §5.4 - 4章33关，章节切换，关卡节点，三星评价，共鸣门槛
 * Phase 1: DOM UI方案
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/config.js';
import { CHAPTERS, RESONANCE_GATES, STAR_CRITERIA, getRewards } from '../data/stages.js';

export class StageScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StageScene' });
    this.chapterIndex = 0; // 默认第1章
    this.starData = {};    // { stageId: stars }
  }

  create() {
    this.cameras.main.setBackgroundColor('#0a0a1a');
    this._createUI();
    this._render();

    // Phaser场景切换时自动清理DOM
    this.events.on('shutdown', () => {
      ['stage-ui','stage-detail-overlay'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
    });
  }

  _createUI() {
    const old = document.getElementById('stage-ui');
    if (old) old.remove();
    const oldOverlay = document.getElementById('stage-detail-overlay');
    if (oldOverlay) oldOverlay.remove();

    const ui = document.createElement('div');
    ui.id = 'stage-ui';
    ui.innerHTML = this._getStageHTML();
    document.getElementById('game-container').appendChild(ui);

    const overlay = document.createElement('div');
    overlay.id = 'stage-detail-overlay';
    overlay.innerHTML = this._getOverlayHTML();
    document.getElementById('game-container').appendChild(overlay);

    this._bindEvents();
  }

  _getStageHTML() {
    return /*html*/`
<style>
#stage-ui {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  z-index: 100; color: #fff; font-family: 'Segoe UI', sans-serif;
  display: flex; flex-direction: column; overflow: hidden;
}
.stage-nav {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px;
  background: rgba(10,10,26,0.95); border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}
.stage-nav .back { color: #FF69B4; font-size: 16px; cursor: pointer; padding: 4px 8px; }
.stage-nav .title { font-size: 15px; font-weight: bold; color: #FF69B4; flex: 1; text-align: center; }
.stage-nav .chap-btn {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  color: #aaa; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer;
  transition: all 0.2s;
}
.stage-nav .chap-btn:hover, .stage-nav .chap-btn.active {
  border-color: #FF69B4; color: #FF69B4; background: rgba(255,105,180,0.1);
}

/* 章节信息 */
.chapter-info {
  padding: 10px 12px; background: rgba(255,255,255,0.02);
  border-bottom: 1px solid rgba(255,255,255,0.05); flex-shrink: 0;
  display: flex; gap: 12px; font-size: 11px; color: #888;
}
.chapter-info span { color: #ccc; }

/* 关卡路径 */
.stage-path {
  flex: 1; overflow-y: auto; padding: 16px 12px;
  display: flex; flex-direction: column; gap: 6px; align-items: center;
}
.stage-node {
  width: 52px; height: 52px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: bold; cursor: pointer;
  position: relative; transition: all 0.2s;
  border: 2px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.04);
  color: #aaa;
}
.stage-node:hover { transform: scale(1.1); }
.stage-node.boss {
  border-radius: 8px; width: 56px; height: 56px; font-size: 18px;
  background: rgba(255,105,180,0.05);
}
.stage-node.cleared { border-color: #888; color: #ccc; }
.stage-node.star3 { border-color: #FFD700; box-shadow: 0 0 8px rgba(255,215,0,0.3); color: #FFD700; }
.stage-node.current {
  border-color: #FF69B4; color: #FF69B4;
  animation: nodePulse 1.5s infinite;
  box-shadow: 0 0 12px rgba(255,105,180,0.4);
}
.stage-node.locked { opacity: 0.3; cursor: not-allowed; }
@keyframes nodePulse {
  0%, 100% { box-shadow: 0 0 8px rgba(255,105,180,0.3); }
  50% { box-shadow: 0 0 18px rgba(255,105,180,0.6); }
}
.stage-connector {
  width: 2px; height: 12px; background: rgba(255,255,255,0.1);
}
.stage-connector.done { background: rgba(255,255,255,0.3); }

/* 底部信息 */
.stage-footer {
  padding: 10px 12px; border-top: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0; display: flex; gap: 8px; font-size: 11px; color: #888;
  background: rgba(10,10,26,0.95);
}

/* 关卡详情浮层 */
#stage-detail-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 200;
  background: rgba(5,5,20,0.97); display: none; flex-direction: column;
}
#stage-detail-overlay.show { display: flex; }
.sd-nav {
  display: flex; align-items: center; padding: 10px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.sd-nav .back { color: #FF69B4; font-size: 16px; cursor: pointer; padding: 4px 8px; }
.sd-nav .sd-title { font-size: 15px; font-weight: bold; flex: 1; text-align: center; }

.sd-body {
  flex: 1; overflow-y: auto; padding: 16px;
}
.sd-section {
  margin-bottom: 16px; padding: 12px;
  background: rgba(255,255,255,0.02); border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.05);
}
.sd-section h3 { font-size: 13px; color: #FFD700; margin-bottom: 8px; }
.sd-row { display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0; color: #aaa; }
.sd-row span:last-child { color: #ccc; }
.sd-stars { display: flex; gap: 8px; justify-content: center; margin-top: 8px; }
.sd-star { font-size: 28px; opacity: 0.2; cursor: pointer; transition: opacity 0.2s; }
.sd-star.got { opacity: 1; }

.sd-footer {
  padding: 10px 12px; border-top: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0; display: flex; gap: 8px;
}
.sd-footer button {
  flex: 1; padding: 12px; border-radius: 8px; font-size: 14px; font-weight: bold;
  cursor: pointer; border: none;
}
.sd-footer .go-btn {
  background: linear-gradient(135deg, #FF69B4, #FF1493); color: #fff;
}
.sd-footer .cancel-btn {
  background: rgba(255,255,255,0.08); color: #ccc;
}
.gate-warning {
  font-size: 10px; color: #FF6B6B; margin-top: 6px; padding: 6px;
  background: rgba(255,0,0,0.1); border-radius: 4px;
}
</style>

<div id="stage-ui">
  <div class="stage-nav">
    <span class="back" data-action="back">← 选人</span>
    <span class="title" id="chap-title">🎪 主线关卡</span>
    <div style="display:flex;gap:4px;" id="chap-btns"></div>
  </div>
  <div class="chapter-info" id="chap-info"></div>
  <div class="stage-path" id="stage-path"></div>
  <div class="stage-footer">
    <span>💡 点击关卡查看详情 | Boss关=★</span>
  </div>
</div>`;
  }

  _getOverlayHTML() {
    return /*html*/`
<div>
  <div class="sd-nav">
    <span class="back" data-action="close-detail">← 返回</span>
    <span class="sd-title" id="sd-title"></span>
  </div>
  <div class="sd-body" id="sd-body"></div>
  <div class="sd-footer">
    <button class="cancel-btn" data-action="close-detail">取消</button>
    <button class="go-btn" data-action="go">▶ 出战</button>
  </div>
</div>`;
  }

  _bindEvents() {
    document.querySelector('#stage-ui .back').onclick = () => this.scene.start('CharacterScene');
    document.querySelector('#stage-detail-overlay .back').onclick = () => this._closeDetail();
    document.querySelector('#stage-detail-overlay .cancel-btn').onclick = () => this._closeDetail();
    document.querySelector('#stage-detail-overlay .go-btn').onclick = () => {
      ['char-ui','char-detail-overlay','stage-ui','stage-detail-overlay'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
      // B5防御关：章节2的关卡进入保卫战模式
      const isDefense = [8, 9, 10].includes(this.selectedStageId);
      this.scene.start('BattleScene', {
        stageId: this.selectedStageId || 1,
        defenseMode: isDefense,
      });
    };
  }

  _render() {
    const ch = CHAPTERS[this.chapterIndex];
    document.getElementById('chap-title').textContent = `${ch.icon} 主线关卡 — ${ch.name}`;
    document.getElementById('chap-info').innerHTML = `
      <span>解锁: ${ch.unlock}</span> <span>|</span>
      <span>推荐: ${ch.recLevel}</span> <span>|</span>
      <span>敌人: ${ch.enemyTheme}</span> <span>|</span>
      <span>共 ${ch.levelCount} 关</span>
    `;

    // 章节按钮
    const btns = CHAPTERS.map((c, i) =>
      `<button class="chap-btn ${i === this.chapterIndex ? 'active' : ''}" data-chap="${i}">${c.icon}${c.name}</button>`
    ).join('');
    document.getElementById('chap-btns').innerHTML = btns;
    document.querySelectorAll('.chap-btn').forEach(b => {
      b.onclick = () => {
        this.chapterIndex = parseInt(b.dataset.chap);
        this._render();
      };
    });

    // 关卡节点
    this._renderPath(ch);
  }

  _renderPath(ch) {
    const path = document.getElementById('stage-path');
    let html = '';

    // 模拟进度：当前章的前两关已通关
    const baseProgress = (this.chapterIndex) * 8; // 粗略进度

    ch.stages.forEach((s, i) => {
      // 进度模拟
      let status = 'locked';
      if (this.chapterIndex === 0) {
        if (i === 0) status = 'star3';
        else if (i === 1) status = 'cleared';
        else if (i === 2) status = 'current';
      } else {
        status = 'locked';
      }

      if (s.stars) status = s.stars >= 3 ? 'star3' : 'cleared';

      const isBoss = s.type === 'boss';
      const label = isBoss ? '★' : s.id;

      html += `<div class="stage-node ${status} ${isBoss ? 'boss' : ''}"
        data-stage="${s.id}" data-type="${s.type}">${label}</div>`;
      if (i < ch.stages.length - 1) {
        html += `<div class="stage-connector ${status === 'star3' || status === 'cleared' ? 'done' : ''}"></div>`;
      }
    });

    path.innerHTML = html;

    // 节点点击
    path.querySelectorAll('.stage-node').forEach(node => {
      node.onclick = () => {
        if (node.classList.contains('locked')) return;
        const s = ch.stages.find(s => s.id === parseInt(node.dataset.stage));
        if (s) this._openDetail(s);
      };
    });
  }

  _openDetail(stage) {
    this.selectedStageId = stage.id;
    const ch = CHAPTERS[this.chapterIndex];
    const isBoss = stage.type === 'boss';
    const gate = RESONANCE_GATES[stage.id];
    const reward1 = getRewards(stage.id, 1);
    const reward3 = getRewards(stage.id, 3);

    document.getElementById('sd-title').textContent = stage.name;
    document.getElementById('sd-body').innerHTML = /*html*/`
      <div class="sd-section">
        <h3>📋 关卡信息</h3>
        <div class="sd-row"><span>章节</span><span>${ch.icon} ${ch.name}</span></div>
        <div class="sd-row"><span>类型</span><span>${isBoss ? '⭐ Boss关' : '普通关'}</span></div>
        ${isBoss ? `<div class="sd-row"><span>Boss</span><span>${stage.bossName || '—'}</span></div>` : ''}
        <div class="sd-row"><span>波次</span><span>${stage.waves} 波</span></div>
        <div class="sd-row"><span>敌人主题</span><span>${ch.enemyTheme}</span></div>
        <div class="sd-row"><span>推荐等级</span><span>${ch.recLevel}</span></div>
      </div>

      <div class="sd-section">
        <h3>⭐ 三星标准</h3>
        <div class="sd-row"><span>★</span><span>${STAR_CRITERIA[1]}</span></div>
        <div class="sd-row"><span>★★</span><span>${STAR_CRITERIA[2]}</span></div>
        <div class="sd-row"><span>★★★</span><span>${STAR_CRITERIA[3]}</span></div>
        <div style="font-size:10px;color:#FFD700;margin-top:8px;">💡 三星引导玩家学习安可闭环</div>
      </div>

      <div class="sd-section">
        <h3>🎁 首通奖励</h3>
        <div class="sd-row"><span>一星首通</span><span>${reward1.xp} XP + ${reward1.star} 星粒</span></div>
        <div class="sd-row"><span>三星首通</span><span style="color:#FFD700;">${reward3.xp} XP + ${reward3.star} 星粒</span></div>
      </div>

      ${gate ? `
      <div class="sd-section">
        <h3>⚠️ 共鸣门槛</h3>
        <div class="sd-row"><span>门槛等级</span><span>Lv.${gate.gate}</span></div>
        <div class="sd-row"><span>推荐等级</span><span>Lv.${gate.rec}</span></div>
        <div class="gate-warning">低于门槛惩罚：${gate.penalty}</div>
      </div>` : ''}
    `;

    document.getElementById('stage-detail-overlay').classList.add('show');
  }

  _closeDetail() {
    document.getElementById('stage-detail-overlay').classList.remove('show');
  }
}
