/**
 * ST☆RUSH 角色管理中枢（G0）
 * GDD v1.5 §4.4 完整实现
 * 角色列表 + 筛选排序 + 详情页（属性/形态/技能）
 * Phase 1：DOM UI方案，纯CSS布局
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/config.js';
import { CHARACTERS, calcStats, getUnlockedForms, FILTERS, SORT_OPTIONS } from '../data/characters.js';

export class CharacterScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CharacterScene' });
    this.selectedChar = null;
    this.activeFilters = { color: '全部', profession: '全部', rarity: '全部', level: '全部' };
    this.activeSort = 'default';
    this.selectedLevel = 1;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0a0a1a');
    this._createUI();
    this._renderCardList();

    // Phaser场景切换时自动清理DOM
    this.events.on('shutdown', () => {
      ['char-ui','char-detail-overlay'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
    });
  }

  // ===================== UI 创建 =====================

  _createUI() {
    const existing = document.getElementById('char-ui');
    if (existing) existing.remove();

    const ui = document.createElement('div');
    ui.id = 'char-ui';
    ui.innerHTML = this._getHTML();
    document.getElementById('game-container').appendChild(ui);

    // 绑定事件
    this._bindEvents();
  }

  _getHTML() {
    return /*html*/`
<style>
#char-ui {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  z-index: 100; color: #fff; font-family: 'Segoe UI', sans-serif;
  display: flex; flex-direction: column; overflow: hidden;
}
#char-ui.hidden { display: none; }

/* 顶部导航 */
.char-nav {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; background: rgba(10,10,26,0.95);
  border-bottom: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;
}
.char-nav .back-btn {
  color: #FF69B4; font-size: 16px; cursor: pointer; padding: 4px 8px;
}
.char-nav .title {
  font-size: 15px; font-weight: bold; color: #FF69B4;
}
.char-nav .toolbar { display: flex; gap: 6px; }
.char-nav select {
  background: rgba(255,255,255,0.08); color: #ccc; border: 1px solid rgba(255,255,255,0.15);
  border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer;
}

/* 卡片列表 */
.char-list {
  flex: 1; overflow-y: auto; padding: 8px 12px;
  display: flex; flex-direction: column; gap: 8px;
}
.char-card {
  background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
  border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
  padding: 12px; display: flex; gap: 12px; cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  position: relative; overflow: hidden;
}
.char-card:hover, .char-card:active {
  border-color: rgba(255,105,180,0.4); background: rgba(255,105,180,0.08);
}
.char-card .avatar {
  width: 56px; height: 56px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; flex-shrink: 0;
  border: 2px solid rgba(255,255,255,0.15);
}
.char-card .info { flex: 1; display: flex; flex-direction: column; gap: 3px; }
.char-card .name-row { display: flex; align-items: center; gap: 6px; }
.char-card .name { font-size: 15px; font-weight: bold; }
.char-card .stars { font-size: 11px; color: #FFD700; }
.char-card .tag-row { display: flex; gap: 4px; flex-wrap: wrap; }
.char-card .tag {
  font-size: 9px; padding: 2px 6px; border-radius: 3px; opacity: 0.9;
}
.char-card .stats-row { display: flex; gap: 10px; font-size: 11px; color: #aaa; margin-top: 2px; }
.char-card .form-info { font-size: 10px; color: #888; }
.char-card .arrow { position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  font-size: 18px; color: #666; }

/* Empty state */
.empty-state { text-align: center; padding: 40px 20px; color: #666; }

/* 底部Tab */
.char-tabs {
  display: flex; border-top: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;
  background: rgba(10,10,26,0.95);
}
.char-tabs .tab-btn {
  flex: 1; text-align: center; padding: 10px 4px; font-size: 10px; color: #888;
  cursor: pointer; border: none; background: none; transition: color 0.2s;
}
.char-tabs .tab-btn.active { color: #FF69B4; font-weight: bold; }

/* 详情浮层 */
#char-detail-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 200;
  background: rgba(5,5,20,0.97); display: none; flex-direction: column;
  overflow: hidden;
}
#char-detail-overlay.show { display: flex; }
.detail-nav {
  display: flex; align-items: center; padding: 10px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0;
}
.detail-nav .back-btn { color: #FF69B4; font-size: 16px; cursor: pointer; padding: 4px 8px; }
.detail-nav .detail-name { font-size: 16px; font-weight: bold; flex: 1; text-align: center; }
.detail-nav .detail-actions { display: flex; gap: 6px; }
.detail-nav .action-btn {
  padding: 4px 10px; border-radius: 4px; font-size: 11px; border: 1px solid rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.05); color: #ccc; cursor: pointer;
}
.detail-nav .action-btn.primary {
  background: #FF69B4; color: #fff; border-color: #FF69B4; font-weight: bold;
}

.detail-header {
  display: flex; align-items: center; gap: 12px; padding: 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
}
.detail-header .avatar-lg {
  width: 72px; height: 72px; border-radius: 50%; font-size: 36px;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid rgba(255,255,255,0.15); flex-shrink: 0;
}
.detail-header .header-info { flex: 1; }
.detail-header .header-name { font-size: 20px; font-weight: bold; }
.detail-header .header-meta { font-size: 12px; color: #aaa; margin-top: 2px; }
.detail-header .level-selector { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
.detail-header .level-selector input {
  width: 50px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
  color: #fff; padding: 2px 6px; border-radius: 3px; font-size: 13px; text-align: center;
}

.detail-tabs {
  display: flex; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
}
.detail-tabs .dt-btn {
  flex: 1; text-align: center; padding: 10px 4px; font-size: 12px; color: #888;
  cursor: pointer; border: none; background: none;
  border-bottom: 2px solid transparent; transition: all 0.2s;
}
.detail-tabs .dt-btn.active { color: #FF69B4; border-bottom-color: #FF69B4; }

.detail-body {
  flex: 1; overflow-y: auto; padding: 12px;
}
.stat-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.stat-table td { padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.stat-table td:first-child { color: #888; width: 100px; }
.stat-table td:last-child { font-weight: bold; text-align: right; }

.skill-card {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px; padding: 12px; margin-bottom: 10px;
}
.skill-card .skill-name { font-size: 14px; font-weight: bold; color: #FFD700; }
.skill-card .skill-desc { font-size: 11px; color: #aaa; margin-top: 4px; line-height: 1.5; }
.skill-card .skill-tag {
  display: inline-block; font-size: 9px; padding: 2px 6px; border-radius: 3px;
  margin-right: 4px; margin-bottom: 4px;
}
.locked { opacity: 0.4; }
.locked .skill-name { color: #666; }

/* 出战按钮 */
.detail-footer {
  padding: 10px 12px; border-top: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0; display: flex; gap: 8px;
}
.detail-footer button {
  flex: 1; padding: 12px; border-radius: 8px; font-size: 14px; font-weight: bold;
  cursor: pointer; border: none; transition: opacity 0.2s;
}
.detail-footer .deploy-btn {
  background: linear-gradient(135deg, #FF69B4, #FF1493); color: #fff;
}
.detail-footer .cancel-btn {
  background: rgba(255,255,255,0.08); color: #ccc;
}
</style>

<div id="char-ui">
  <div class="char-nav">
    <span class="back-btn" data-action="back">← 返回</span>
    <span class="title">🎤 ST☆RUSH 成员管理</span>
    <div class="toolbar">
      <select id="filter-color" data-filter="color">
        ${FILTERS.color.map(c => `<option>${c}</option>`).join('')}
      </select>
      <select id="filter-profession" data-filter="profession">
        ${FILTERS.profession.map(p => `<option>${p}</option>`).join('')}
      </select>
      <select id="sort-by">
        ${SORT_OPTIONS.map(s => `<option value="${s.key}">${s.label}</option>`).join('')}
      </select>
    </div>
  </div>

  <div class="char-list" id="char-list"></div>

  <div class="char-tabs">
    <button class="tab-btn active">📋 成员</button>
    <button class="tab-btn">🎒 应援物</button>
    <button class="tab-btn">👗 服装</button>
    <button class="tab-btn">🏋 特训</button>
    <button class="tab-btn">💎 应援值</button>
  </div>
</div>

<div id="char-detail-overlay">
  <div class="detail-nav">
    <span class="back-btn" data-action="close-detail">← 返回</span>
    <span class="detail-name" id="detail-name"></span>
    <div class="detail-actions">
      <button class="action-btn">换装</button>
      <button class="action-btn">升级</button>
      <button class="action-btn">突破</button>
    </div>
  </div>

  <div class="detail-header">
    <div class="avatar-lg" id="detail-avatar"></div>
    <div class="header-info">
      <div class="header-name" id="detail-header-name"></div>
      <div class="header-meta" id="detail-header-meta"></div>
      <div class="level-selector">
        <span style="font-size:11px;color:#888;">Lv.</span>
        <input type="number" id="level-input" value="1" min="1" max="50">
        <span style="font-size:10px;color:#666;">/50</span>
      </div>
    </div>
  </div>

  <div class="detail-tabs">
    <button class="dt-btn active" data-dtab="stats">📊 属性</button>
    <button class="dt-btn" data-dtab="forms">🎭 形态</button>
    <button class="dt-btn" data-dtab="skills">⚔️ 技能</button>
    <button class="dt-btn" data-dtab="support">💖 应援</button>
    <button class="dt-btn" data-dtab="skins">👗 皮肤</button>
  </div>

  <div class="detail-body" id="detail-body"></div>

  <div class="detail-footer">
    <button class="cancel-btn" data-action="close-detail">取消</button>
    <button class="deploy-btn" data-action="deploy">▶ 开始公演</button>
  </div>
</div>`;
  }

  // ===================== 事件绑定 =====================

  _bindEvents() {
    const ui = document.getElementById('char-ui');

    // 返回
    ui.querySelector('[data-action="back"]').onclick = () => {
      this.scene.start('TitleScene');
    };

    // 筛选
    ui.querySelector('#filter-color').onchange = (e) => {
      this.activeFilters.color = e.target.value;
      this._renderCardList();
    };
    ui.querySelector('#filter-profession').onchange = (e) => {
      this.activeFilters.profession = e.target.value;
      this._renderCardList();
    };

    // 排序
    ui.querySelector('#sort-by').onchange = (e) => {
      this.activeSort = e.target.value;
      this._renderCardList();
    };

    // 详情浮层事件
    const overlay = document.getElementById('char-detail-overlay');
    overlay.querySelector('[data-action="close-detail"]').onclick = () => this._closeDetail();
    overlay.querySelector('.cancel-btn').onclick = () => this._closeDetail();
    overlay.querySelector('.deploy-btn').onclick = () => {
      this._closeDetail();
      this.scene.start('StageScene');
    };

    // 等级输入
    overlay.querySelector('#level-input').onchange = (e) => {
      let lv = parseInt(e.target.value) || 1;
      lv = Math.max(1, Math.min(50, lv));
      this.selectedLevel = lv;
      e.target.value = lv;
      this._renderDetailBody();
    };

    // 详情Tab切换
    overlay.querySelectorAll('.dt-btn').forEach(btn => {
      btn.onclick = () => {
        overlay.querySelectorAll('.dt-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._renderDetailBody();
      };
    });
  }

  // ===================== 卡片列表渲染 =====================

  _getFilteredChars() {
    let chars = [...CHARACTERS];

    // 色系筛选
    if (this.activeFilters.color !== '全部') {
      const colorMap = { '粉色': 'pink', '蓝色': 'blue', '黄色': 'yellow', '紫色': 'purple', '橙色': 'orange' };
      chars = chars.filter(c => c.color === colorMap[this.activeFilters.color]);
    }

    // 职业筛选（按已解锁形态的类型）
    if (this.activeFilters.profession !== '全部') {
      chars = chars.filter(c =>
        c.forms.some(f => f.type === this.activeFilters.profession)
      );
    }

    // 稀有度筛选
    if (this.activeFilters.rarity !== '全部') {
      const rarityMap = { '5星': 5, '4星': 4, '3星': 3 };
      chars = chars.filter(c => c.rarity === rarityMap[this.activeFilters.rarity]);
    }

    // 等级筛选
    if (this.activeFilters.level !== '全部') {
      const lv = this.selectedLevel;
      if (this.activeFilters.level === 'Lv.1-10') chars = chars.filter(() => lv <= 10);
      else if (this.activeFilters.level === 'Lv.11-30') chars = chars.filter(() => lv >= 11 && lv <= 30);
      else if (this.activeFilters.level === 'Lv.31-50') chars = chars.filter(() => lv >= 31);
    }

    // 排序
    switch (this.activeSort) {
      case 'level':
        chars.sort((a, b) => this.selectedLevel - this.selectedLevel); // 简化: 按ID
        break;
      case 'atk':
        chars.sort((a, b) => calcStats(b, 50).atk - calcStats(a, 50).atk);
        break;
      case 'rarity':
        chars.sort((a, b) => b.rarity - a.rarity);
        break;
    }

    return chars;
  }

  _renderCardList() {
    const listEl = document.getElementById('char-list');
    const chars = this._getFilteredChars();

    if (chars.length === 0) {
      listEl.innerHTML = '<div class="empty-state">没有符合条件的成员 ╮(╯_╰)╭</div>';
      return;
    }

    listEl.innerHTML = chars.map(c => {
      const s50 = calcStats(c, 50);
      const unlocked = getUnlockedForms(c, this.selectedLevel);
      const currentForm = unlocked.length > 0 ? unlocked[0] : c.forms[0];
      return /*html*/`
      <div class="char-card" data-char="${c.id}">
        <div class="avatar" style="background:${c.colorHex}22;">
          ${c.emoji}
        </div>
        <div class="info">
          <div class="name-row">
            <span class="name" style="color:${c.colorHex}">${c.emoji} ${c.name}</span>
            <span class="stars">${c.stars}</span>
          </div>
          <div class="tag-row">
            <span class="tag" style="background:${c.colorHex}33;color:${c.colorHex};">${c.colorName}</span>
            <span class="tag" style="background:rgba(255,255,255,0.06);">${c.desc}</span>
          </div>
          <div class="stats-row">
            <span>ATK:${s50.atk}</span>
            <span>DEF:${s50.def}</span>
            <span>SPD:${c.stats.spd}</span>
            <span>★${c.rarity}</span>
          </div>
          <div class="form-info">当前形态: ${currentForm.icon} ${currentForm.name}</div>
        </div>
        <span class="arrow">▸</span>
      </div>`;
    }).join('');

    // 卡片点击
    listEl.querySelectorAll('.char-card').forEach(card => {
      card.onclick = () => {
        const id = card.dataset.char;
        this._openDetail(id);
      };
    });
  }

  // ===================== 详情浮层 =====================

  _openDetail(charId) {
    this.selectedChar = CHARACTERS.find(c => c.id === charId);
    this.selectedLevel = 1;
    document.getElementById('level-input').value = 1;
    document.getElementById('detail-avatar').textContent = this.selectedChar.emoji;
    document.getElementById('detail-avatar').style.background = this.selectedChar.colorHex + '22';
    document.getElementById('detail-name').textContent = this.selectedChar.emoji + ' ' + this.selectedChar.name;
    document.getElementById('detail-header-name').textContent = this.selectedChar.name;
    document.getElementById('detail-header-name').style.color = this.selectedChar.colorHex;
    document.getElementById('detail-header-meta').textContent =
      `${this.selectedChar.colorName} / ${this.selectedChar.desc} / ${this.selectedChar.stars}`;

    // 重置Tab
    const overlay = document.getElementById('char-detail-overlay');
    overlay.querySelectorAll('.dt-btn').forEach((b, i) => b.classList.toggle('active', i === 0));

    this._renderDetailBody();
    overlay.classList.add('show');
  }

  _closeDetail() {
    document.getElementById('char-detail-overlay').classList.remove('show');
    this.selectedChar = null;
  }

  _renderDetailBody() {
    const body = document.getElementById('detail-body');
    const overlay = document.getElementById('char-detail-overlay');
    const activeTab = overlay.querySelector('.dt-btn.active')?.dataset?.dtab || 'stats';

    switch (activeTab) {
      case 'stats': this._renderStatsTab(body); break;
      case 'forms': this._renderFormsTab(body); break;
      case 'skills': this._renderSkillsTab(body); break;
      case 'support': this._renderSupportTab(body); break;
      case 'skins': this._renderSkinsTab(body); break;
    }
  }

  _renderStatsTab(body) {
    const c = this.selectedChar;
    const lv = this.selectedLevel;
    const s = calcStats(c, lv);
    const s50 = calcStats(c, 50);
    body.innerHTML = /*html*/`
      <table class="stat-table">
        <tr><td>ATK</td><td style="color:#FF6B6B;">${s.atk} <span style="font-size:10px;color:#666;">(+${c.growth.atk}/级 → Lv.50: ${s50.atk})</span></td></tr>
        <tr><td>DEF</td><td style="color:#6BCB77;">${s.def} <span style="font-size:10px;color:#666;">(+${c.growth.def}/级 → Lv.50: ${s50.def})</span></td></tr>
        <tr><td>SPD</td><td style="color:#4FC3F7;">${s.spd} <span style="font-size:10px;color:#666;">(固定)</span></td></tr>
        <tr><td>CRIT+</td><td style="color:#FFD700;">${s.crit > 0 ? '+' + s.crit + '%' : '—'}</td></tr>
        <tr><td>HP</td><td style="color:#FF4444;">${s.hp} <span style="font-size:10px;color:#666;">(固定)</span></td></tr>
        <tr><td>应援值</td><td style="color:#FFD700;">2,450</td></tr>
        <tr><td>历史最高Combo</td><td>47</td></tr>
      </table>
      <div style="margin-top:12px;font-size:10px;color:#666;line-height:1.6;">
        <b>DEF减伤公式：</b><br/>
        实际伤害 = 敌方攻击 × (1 - DEF/(DEF+200))<br/>
        当前减伤：<span style="color:#6BCB77;">${(s.def/(s.def+200)*100).toFixed(0)}%</span>（DEF=${s.def}）<br/>
        Lv.50减伤：<span style="color:#6BCB77;">${(s50.def/(s50.def+200)*100).toFixed(0)}%</span>（DEF=${s50.def}）
      </div>
    `;
  }

  _renderFormsTab(body) {
    const c = this.selectedChar;
    const lv = this.selectedLevel;
    const typeColors = { '输出型': '#FF6B6B', '染色型': '#00CED1', '辅助型': '#FFD700' };
    body.innerHTML = c.forms.map((f, i) => {
      const unlocked = lv >= f.unlockLv;
      const isCurrent = unlocked && (i === 0 || c.forms.slice(0, i).some(ff => lv >= ff.unlockLv));
      return /*html*/`
        <div class="skill-card ${unlocked ? '' : 'locked'}">
          <div class="skill-name">
            ${f.icon} ${f.name}
            <span class="skill-tag" style="background:${typeColors[f.type]}33;color:${typeColors[f.type]};${unlocked ? '' : 'opacity:0.5'}">
              ${f.type}
            </span>
            ${unlocked ? '<span style="color:#4CAF50;font-size:10px;">● 已解锁</span>'
              : `<span style="color:#666;font-size:10px;">🔒 Lv.${f.unlockLv}解锁</span>`}
          </div>
          ${unlocked ? /*html*/`
            <div class="skill-desc">
              <b>主动：</b>${f.activeDesc}<br/>
              <b>被动：</b>${f.passiveDesc}
            </div>
          ` : ''}
        </div>`;
    }).join('');
  }

  _renderSkillsTab(body) {
    const c = this.selectedChar;
    const lv = this.selectedLevel;
    const typeColors = { '输出型': '#FF6B6B', '染色型': '#00CED1', '辅助型': '#FFD700' };
    body.innerHTML = c.forms.map((f, i) => {
      const unlocked = lv >= f.unlockLv;
      return /*html*/`
        <div class="skill-card ${unlocked ? '' : 'locked'}">
          <div class="skill-name" style="font-size:13px;">
            ${f.icon} ${f.name}
            <span class="skill-tag" style="background:${typeColors[f.type]}33;color:${typeColors[f.type]};">
              ${f.type}
            </span>
            ${unlocked ? '' : '<span style="color:#666;font-size:10px;">🔒</span>'}
          </div>
          ${unlocked ? /*html*/`
            <div class="skill-desc">
              <div style="margin-bottom:6px;">
                <span class="skill-tag" style="background:rgba(255,255,255,0.08);">主动技能</span>
                <b>${f.active}</b>
              </div>
              <div style="color:#aaa;font-size:10px;margin-bottom:8px;">${f.activeDesc}</div>
              <div style="margin-bottom:4px;">
                <span class="skill-tag" style="background:rgba(255,255,255,0.05);">被动技能</span>
                <b>${f.passive}</b>
              </div>
              <div style="color:#aaa;font-size:10px;">${f.passiveDesc}</div>
            </div>
          ` : '<div class="skill-desc" style="color:#666;">Lv.' + f.unlockLv + ' 解锁此形态技能</div>'}
        </div>`;
    }).join('');
  }

  _renderSupportTab(body) {
    body.innerHTML = /*html*/`
      <div style="text-align:center;padding:40px 20px;color:#aaa;">
        <div style="font-size:48px;margin-bottom:16px;">📊</div>
        <div style="font-size:14px;margin-bottom:8px;">应援数据统计</div>
        <table class="stat-table" style="margin-top:16px;">
          <tr><td>累计应援值</td><td style="color:#FFD700;">2,450</td></tr>
          <tr><td>最高Combo</td><td style="color:#FF69B4;">47</td></tr>
          <tr><td>甜蜜氛围触发</td><td>128 次</td></tr>
          <tr><td>清爽氛围触发</td><td>96 次</td></tr>
          <tr><td>闪耀氛围触发</td><td>84 次</td></tr>
          <tr><td>神秘氛围触发</td><td>53 次</td></tr>
          <tr><td>热烈氛围触发</td><td>71 次</td></tr>
        </table>
        <div style="font-size:10px;color:#666;margin-top:12px;">Phase 2 接入实时数据</div>
      </div>
    `;
  }

  _renderSkinsTab(body) {
    body.innerHTML = /*html*/`
      <div style="text-align:center;padding:40px 20px;color:#aaa;">
        <div style="font-size:48px;margin-bottom:16px;">👗</div>
        <div style="font-size:14px;margin-bottom:8px;">皮肤画廊</div>
        <div style="font-size:11px;color:#666;margin-top:8px;">Phase 2 解锁 · 限定皮肤将在此展示</div>
      </div>
    `;
  }
}
