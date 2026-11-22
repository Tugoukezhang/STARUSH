import Phaser from 'phaser';
import { COLOR_HEX } from '../utils/config.js';
import { getBattleChapter, getChapterDeviceLabel, getCumulativeChapterPaintProgress, resolveChapterPaintHit } from '../utils/publicCampaign.mjs';
import { createStreetZoneGate } from './StreetZoneGate.mjs';
import { createDeviceSprite, drawDevicePresentation, layoutDeviceLabels, getDeviceLabelInk } from './ChapterScenePresentation.mjs';
import { StreetPaintSurface } from './StreetRestorationSurface.mjs';
import {PaintWorkQueue} from './PaintWorkQueue.mjs';
import { ChapterObjectiveContract } from '../utils/chapterObjectives.mjs';
import {ChapterSideSet} from '../utils/chapterSideSets.mjs';
import {normalizePublicRoutePlan} from '../utils/publicRoutePlan.mjs';
import {playFacilityCompletionFx} from './FacilityCompletionFx.mjs';
import {
  STAGE1_PAINT_BURST_AMOUNT,
  STAGE1_PAINT_BURST_HEAT,
  STAGE1_PAINT_BURST_RADIUS,
  STAGE1_PAINT_DANMAKU_INTERVAL_MS,
  STAGE1_PAINT_DEVICE_MAX,
  STAGE1_PAINT_FINALE_LAYER_ALPHA,
  STAGE1_PAINT_GATE_Y,
  STAGE1_PAINT_IMPACT_REACH,
  STAGE1_PAINT_PER_HIT,
  STAGE1_PAINT_SHOT_RANGE,
  STAGE1_PAINT_SPLAT_RADIUS,
  STAGE1_PAINT_TILE,
  STAGE1_PAINT_TILE_LAYER_ALPHA,
  STAGE1_PAINT_WORLD_HEIGHT,
  STAGE1_PAINT_WORLD_WIDTH,
  STAGE1_PAINT_ZONE_COUNT,
  createPaintTileGrid,
  getPaintHeatLevel,
  isPaintBurstReady,
  stampPaintTiles,
} from '../utils/stage1PaintRound.mjs';

const KIND_COLORS = {
  light: 0xFFE08A,
  speaker: 0x7AD7C4,
  poster: 0xFF8AB8,
  rail: 0x9BB0C9,
  crate: 0xC9B48A,
  booth: 0x8EC5FF,
  building: 0xF0C36A,
  marker: 0xFFD700,
};

export class PaintZoneSystem {
  constructor(scene, spawnDanmakuFn) {
    this.scene = scene;
    const data=scene.battleData||{};
    this.chapterObjectives=scene._userCastPresentation===true&&scene.oldStreet
      &&data.practiceMode!==true&&data.defenseMode!==true&&Number(data.stageId||1)===1
      ? new ChapterObjectiveContract(getBattleChapter(data).id) : null;
    this.sideSet=this.chapterObjectives?new ChapterSideSet(getBattleChapter(data).id,normalizePublicRoutePlan(data.publicRoutePlan,data)?.id):null;
    this.spawnDanmakuFn = spawnDanmakuFn;
    this.devices = [];
    this.currentZone = 0;
    this.heat = 0;
    this.burstUsed = 0;
    this.gateOpen = false;
    this.complete = false;
    this.gateGfx = null;
    this.danmakuTimer = null;
    this.tileGrid = createPaintTileGrid(
      STAGE1_PAINT_WORLD_WIDTH,
      STAGE1_PAINT_WORLD_HEIGHT,
      STAGE1_PAINT_TILE
    );
    this.tileLayer = null;
    this.tileStamp = null;
    this.paintWork = null;
    this.finaleMode = false;
    this.onProgress = null;
    this.onDeviceComplete = null;
    this.onZoneComplete = null;
    this.onAllComplete = null;
    this.onBurstReady = null;
  }

  start() {
    this._createTileLayer();
    this._drawGate();
    getBattleChapter(this.scene.battleData).devices.forEach((def) => this._spawnDevice(def));
    this.sideSet?.definitions.forEach(def=>this._spawnDevice(def));
    this._refreshLockVisuals();
    this._scheduleNextDanmaku(1100);
    this._emitProgress();
  }

  getPaintedCount() {
    return this.devices.filter((device) => device.required === true && device.complete).length;
  }

  updateDeviceLabels() {
    this.streetSurface?.flush({budgetMs:3});
    if (this.finaleMode) return;
    const guidance=this.chapterObjectives?.id==='homecoming'?this.scene._publicObjectiveGuidance:null;
    const guidedId=guidance&&!guidance.root.hidden?guidance.lastKey:null;
    const tag=guidance&&!guidance.root.hidden?guidance.tag?.style:null;
    if(tag){const x=parseFloat(tag.left),y=parseFloat(tag.top),w=parseFloat(tag.width),h=parseFloat(tag.height);
      if([x,y,w,h].every(Number.isFinite)&&w>0&&h>0)controls.push({x:x+w/2,y:y+h/2,radius:Math.hypot(w,h)/2});}
    const layout = layoutDeviceLabels(this.devices, this.currentZone, this.scene.player, this.scene.cameras?.main,guidedId);
    for (const device of this.devices) {
      if (!device.label) continue;
      const item = layout.find(label => label.id === device.id);
      device.label.setVisible(Boolean(item));
      if (item) {
        device.label.setScale?.(1/(this.scene.cameras?.main?.zoom||1));
        device.label.setPosition(item.x, item.y).setText(item.text);
      }
    }
  }

  getTotalCount() {
    return this.devices.filter((device) => device.required === true).length;
  }

  getAmbientPaintedCount() {
    return this.devices.filter((device) => device.required !== true && !device.chapterSideSet && device.complete).length;
  }

  getAmbientTotalCount() {
    return this.devices.filter((device) => device.required !== true && !device.chapterSideSet).length;
  }

  getObjectiveProgress() {
    return {
      completed: this.getPaintedCount(),
      total: this.getTotalCount(),
      ambientPainted: this.getAmbientPaintedCount(),
      ambientTotal: this.getAmbientTotalCount(),
      zone: this.currentZone,
      complete: this.complete,
    };
  }

  getHeat() {
    return this.heat;
  }

  getHeatLevel() {
    return getPaintHeatLevel(this.heat);
  }

  isComplete() {
    return this.complete === true;
  }

  isBurstReady() {
    return isPaintBurstReady(this.heat, this.burstUsed);
  }

  getNearestPaintable(x, y, canAim = null) {
    if (this.finaleMode) return null;
    const eligible = this.devices.filter((device) => !device.complete && device.zone <= this.currentZone
      && (!this.chapterObjectives||this.canReceivePaint(device))
      && this.scene.oldStreet?.clearLine({x,y},device)!==false && (!canAim || canAim(device)));
    const required = eligible.filter((device) => device.required === true||device.chapterSideSet===true);
    const candidates = required.length > 0 ? required : eligible;
    return candidates.reduce((nearest, device) => {
      if (!nearest) return device;
      const nextDist = Phaser.Math.Distance.Between(x, y, device.x, device.y);
      const nearestDist = Phaser.Math.Distance.Between(x, y, nearest.x, nearest.y);
      return nextDist < nearestDist ? device : nearest;
    }, null);
  }

  getNearestCurrentZonePaintable(x, y, includeCalibration = false) {
    let nearest = null;
    let nearestDist = Infinity;
    this.devices.forEach((device) => {
      const calibrationTarget = includeCalibration && this.chapterObjectives?.id === 'raincheck'
        && device.chapterAwaitingCalibration && !device.chapterLocked && !device.publicStage1Suppressed;
      if (device.complete || device.zone !== this.currentZone
        || (this.chapterObjectives&&!this.canReceivePaint(device)&&!calibrationTarget)) return;
      const dist = Math.hypot(device.x - x, device.y - y);
      if (dist < nearestDist) {
        nearest = device;
        nearestDist = dist;
      }
    });
    return nearest;
  }

  clampPlayerY(y) {
    if (this.gateOpen) return y;
    return Math.max(STAGE1_PAINT_GATE_Y + 18, y);
  }

  canReceivePaint(device) {
    return !!device&&!device.complete&&device.zone<=this.currentZone&&!device.publicStage1Suppressed
      &&(!device.chapterSideSet||this.sideSet?.canReceive(device,this.devices)===true)
      &&(!this.chapterObjectives||this.chapterObjectives.canReceive(device,this.devices));
  }

  getNearestObjective(x,y) {
    if(!this.chapterObjectives)return this.getNearestPaintable(x,y);
    if(this.finaleMode)return null;
    return this.devices.filter(d=>(d.required||d.chapterSideSet)&&!d.complete&&!d.publicStage1Suppressed&&d.zone<=this.currentZone&&!d.chapterLocked
      &&(!d.chapterSideSet||this.sideSet?.canReceive(d,this.devices)||d.chapterAwaitingCalibration&&!this.sideSet?.lockReason(d,this.devices)))
      .sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0]||null;
  }

  getObjectiveReach(device) {return device?.chapterAwaitingCalibration?device.chapterCalibrationRadius:STAGE1_PAINT_SHOT_RANGE;}

  updateChapterObjectives(now) {
    const owner=this.chapterObjectives;if(!owner)return;
    if(this.scene._battlePaused||this.scene._battleEnded||this.finaleMode||this.complete){owner.suspend();return;}
    const done=owner.advance(now,this.scene.player,this.devices,this.currentZone,
      (a,b)=>this.scene.oldStreet?.clearLine(a,b)!==false);
    for(const device of done)this._completeDevice(device);
    for(const d of this.devices)if(d.chapterAwaitingCalibration)this._redrawDevice(d);
  }

  setDeviceSuppressed(device, suppressed) {
    if (!device || !this.devices.includes(device)) return false;
    const next = suppressed === true;
    if (next && (device.complete || device.zone !== this.currentZone)) return false;
    if (device.publicStage1Suppressed === next) return false;
    device.publicStage1Suppressed = next;
    if (next && this.chapterObjectives?.id === 'raincheck' && device.chapterAwaitingCalibration) device.chapterCalibrationMs = 0;
    this._redrawDevice(device);
    return true;
  }

  applyPaint(device, amount = STAGE1_PAINT_PER_HIT, color = null) {
    if (
      !device
      || device.complete
      || device.zone > this.currentZone
      || device.publicStage1Suppressed === true
      || (this.chapterObjectives&&!this.canReceivePaint(device))
    ) return false;
    const result = resolveChapterPaintHit(device, amount, color);
    if (!result.accepted) return false;
    if (COLOR_HEX[color]) device.paintColor = color;
    device.paint = result.paint;
    device.sequenceIndex = result.sequenceIndex;
    this._redrawDevice(device);
    if (result.complete&&this.chapterObjectives?.requiresCalibration(device)) {
      device.chapterAwaitingCalibration=true;
      this._redrawDevice(device);this._emitProgress();
    }
    else if (result.complete) this._completeDevice(device);
    else this._emitProgress();
    return true;
  }

  applyPaintAt(x, y, amount = STAGE1_PAINT_PER_HIT, radius = STAGE1_PAINT_SPLAT_RADIUS, color = null, onContact = null) {
    let hit = false;
    this.devices.forEach((device) => {
      if (device.complete || device.zone > this.currentZone) return;
      if (this.scene.oldStreet?.clearLine({x,y},device)===false) return;
      if (Phaser.Math.Distance.Between(x, y, device.x, device.y) <= radius) {
        const contact = {x:device.x,y:device.y,kind:'fixture'};
        const accepted = this.applyPaint(device, amount, color);
        if (accepted) onContact?.(contact, device);
        hit = accepted || hit;
      }
    });
    return hit;
  }

  stampPaint(x, y, radius = STAGE1_PAINT_SPLAT_RADIUS, color = 'pink', amount = 180, chargeHeat = false, imprint = null, origin = null) {
    if (this.scene._battlePaused || this.scene._battleEnded
      || ![x, y, radius].every(Number.isFinite) || radius <= 0) return false;
    const source = origin || { x, y };
    if (origin && this.scene.oldStreet?.clearLine(source, { x, y }) === false) return false;
    const hex = COLOR_HEX[color] || 0xFF69B4;
    stampPaintTiles(this.tileGrid, x, y, radius, amount);
    if (this.streetSurface) {
      this.streetSurface.stamp(x, y, radius, hex, imprint, this.paintWork);
      // Radial impacts and skills share the same scene receiver, even with no target hit.
      if (this.scene._userCastPresentation === true) {
        this.scene.oldStreet?.paintSurfaceAt?.({ x, y }, Math.min(radius, 320), source, this.paintWork);
      }
    } else if (this.tileLayer && this.tileStamp) {
      const r = Math.max(8, Number(radius) || 8);
      this.tileStamp.clear();
      this.tileStamp.fillStyle(hex, 0.46);
      this.tileStamp.fillCircle(x, y, r * 0.82);
      this.tileStamp.fillStyle(hex, 0.32);
      this.tileStamp.fillCircle(x + r * 0.38, y + r * 0.16, r * 0.52);
      this.tileStamp.fillCircle(x - r * 0.4, y + r * 0.22, r * 0.44);
      this.tileStamp.fillCircle(x + r * 0.1, y - r * 0.34, r * 0.4);
      this.tileStamp.fillStyle(hex, 0.2);
      this.tileStamp.fillCircle(x + r * 0.52, y - r * 0.1, r * 0.26);
      this.tileStamp.fillCircle(x - r * 0.22, y + r * 0.48, r * 0.22);
      this.tileLayer.draw(this.tileStamp);
      this.tileStamp.clear();
      this.scene._keepPerformerAbovePaint?.();
    }
    if (chargeHeat) this._addHeat(1);
    return true;
  }

  paintAttackFan(fan) {
    if (this.scene._battleEnded || this.scene._battlePaused || !this.streetSurface) return false;
    const points=this.streetSurface.fan(fan, COLOR_HEX[fan.color] || 0xFF69B4,
      (from,to)=>this.scene.oldStreet?.clearLine(from,to)!==false, this.paintWork);
    // Coloring is presentation only: no heat, charge, damage or facility completion.
    const reached=fan.sweep===undefined?points.slice(1):points.slice(1,2+Math.floor(20*fan.sweep));
    for(const point of reached){
      if(fan.sweep===0||Math.hypot(point.x-fan.x,point.y-fan.y)<(fan.innerRadius??0))continue;
      this.scene.oldStreet?.paintSurfaceAt?.(point,24,fan,this.paintWork);
    }
    return points.length>0;
  }

  paintAttackTrail(from, to, color) {
    if (this.scene._battleEnded || this.scene._battlePaused || !this.streetSurface
      || ![from?.x,from?.y,to?.x,to?.y].every(Number.isFinite)) return false;
    const bonus=this.scene.publicPerformerRun?.effects().paintRadiusBonus||0;
    const radius=this.scene.publicPerformerRun?22+bonus:12;
    const dx=to.x-from.x,dy=to.y-from.y,distance=Math.hypot(dx,dy);
    if (!distance) return false;
    const clear=point=>this.scene.oldStreet?.clearLine(from,point)!==false;
    if (!clear(from)) return false;
    let end=1;
    if (!clear(to)) {
      let low=0,high=1;
      for(let i=0;i<12;i++){
        const mid=(low+high)/2;
        if(clear({x:from.x+dx*mid,y:from.y+dy*mid}))low=mid;else high=mid;
      }
      end=low;
    }
    const steps=Math.max(1,Math.min(32,Math.ceil(distance*end/12)));
    // Share the ground/building paint owner; no damage, heat or device progress.
    for(let i=0;i<=steps;i++){
      const t=end*i/steps,point={x:from.x+dx*t,y:from.y+dy*t};
      if(this.paintWork)this.streetSurface.stamp(point.x,point.y,radius,COLOR_HEX[color] || 0xFF69B4,null,this.paintWork);
      else this.streetSurface.stamp(point.x,point.y,radius,COLOR_HEX[color] || 0xFF69B4);
      this.scene.oldStreet?.paintSurfaceAt?.(point,Math.max(18,radius),from,this.paintWork);
    }
    return true;
  }

  burstRelight(x, y) {
    const originX = Number.isFinite(x) ? x : this.scene.player?.x || 0;
    const originY = Number.isFinite(y) ? y : this.scene.player?.y || 0;
    this.stampPaint(originX, originY, STAGE1_PAINT_BURST_RADIUS, 'yellow', 230, false);
    for (let i = 0; i < 10; i += 1) {
      const ang = (Math.PI * 2 * i) / 10;
      const dist = 70 + (i % 3) * 42;
      this.stampPaint(
        originX + Math.cos(ang) * dist,
        originY + Math.sin(ang) * dist,
        88,
        'yellow',
        200,
        false,
        null,
        { x: originX, y: originY }
      );
    }
    this.devices.forEach((device) => {
      if (device.complete || device.zone !== this.currentZone) return;
      const dist = Phaser.Math.Distance.Between(originX, originY, device.x, device.y);
      if (dist > STAGE1_PAINT_BURST_RADIUS) return;
      if (this.scene.oldStreet?.clearLine({x:originX,y:originY},device)===false) return;
      this.stampPaint(device.x, device.y, 56, 'yellow', 200, false);
      this.applyPaint(device, STAGE1_PAINT_BURST_AMOUNT, 'yellow');
    });
    return true;
  }

  hitTest(x, y) {
    if (this.finaleMode) return null;
    let hit = null;
    let nearest = STAGE1_PAINT_IMPACT_REACH;
    this.devices.forEach((device) => {
      if (device.complete || device.zone > this.currentZone
        || (this.chapterObjectives&&!this.canReceivePaint(device))) return;
      const dist = Phaser.Math.Distance.Between(x, y, device.x, device.y);
      if (dist < nearest) {
        hit = device;
        nearest = dist;
      }
    });
    return hit;
  }

  enterFinaleMode() {
    this.finaleMode = true;
    // Authored world pigment keeps its own appearance; only the legacy wash recedes.
    if (this.streetSurface?.material?.image?.worldAnchored !== true || this.streetSurface.image !== this.tileLayer)
      this.tileLayer?.setAlpha(STAGE1_PAINT_FINALE_LAYER_ALPHA);
    this.devices.forEach((device) => {
      device.gfx?.setVisible(false);
      device.barBg?.setVisible(false);
      device.barFill?.setVisible(false);
      device.label?.setVisible(false);
      if(!device.sceneArt)device.sprite?.setVisible(false);
    });
    this.clearGate();
    return true;
  }

  clearGate() {
    this.gateGfx?.destroy();
    this.gateGfx = null;
  }

  destroy() {
    this.paintWork?.destroy();this.paintWork=null;
    this.sideSet?.destroy();this.sideSet=null;
    this.chapterObjectives?.destroy();this.chapterObjectives=null;
    if (this.danmakuTimer) {
      this.danmakuTimer.remove(false);
      this.danmakuTimer = null;
    }
    this.devices.forEach((device) => {
      device.gfx?.destroy();
      device.barBg?.destroy();
      device.barFill?.destroy();
      device.label?.destroy();
      device.sprite?.destroy();
    });
    this.devices = [];
    this.clearGate();
    this.tileStamp?.destroy();
    this.tileStamp = null;
    if (this.streetSurface) {
      this.streetSurface.destroy();this.streetSurface = null;this.tileLayer = null;
    }
    this.tileLayer?.destroy();
    this.tileLayer = null;
  }

  settlePaint() {
    this.paintWork?.drain();
    this.streetSurface?.flush();
    this.scene.oldStreet?.flushPaintSurfaces();
  }

  _createTileLayer() {
    if (this.scene.oldStreet && (!this.scene.oldStreet.config || this.scene.oldStreet.config?.progressiveRestoration === true)) {
      this.paintWork?.destroy();
      this.paintWork = this.scene._userCastPresentation===true ? new PaintWorkQueue() : null;
      this.streetSurface = new StreetPaintSurface(this.scene, () => this.scene.oldStreet.state.blockers());
      this.tileLayer = this.streetSurface.image;
      this.scene._keepPerformerAbovePaint?.();
      return;
    }
    this.tileLayer = this.scene.add.renderTexture(
      0,
      0,
      STAGE1_PAINT_WORLD_WIDTH,
      STAGE1_PAINT_WORLD_HEIGHT
    ).setOrigin(0, 0).setDepth(0.4).setAlpha(STAGE1_PAINT_TILE_LAYER_ALPHA).setScrollFactor(1);
    this.tileStamp = this.scene.make.graphics({ x: 0, y: 0, add: false });
    this.tileStamp.setVisible(false);
    if (this.scene.player) {
      this.scene.children.moveBelow(this.tileLayer, this.scene.player);
    }
    this.scene._keepPerformerAbovePaint?.();
  }

  _addHeat(amount) {
    if (this.burstUsed > 0) return;
    const before = this.heat;
    this.heat = Math.min(STAGE1_PAINT_BURST_HEAT, this.heat + Math.max(0, Number(amount) || 0));
    if (before < STAGE1_PAINT_BURST_HEAT && this.heat >= STAGE1_PAINT_BURST_HEAT) {
      this.onBurstReady?.();
    }
  }

  _spawnDevice(def) {
    const device = {
      ...def,
      sprite: null,
      paintColor: null,
      paint: 0,
      paintMax: def.paintMax || STAGE1_PAINT_DEVICE_MAX,
      complete: false,
      publicStage1Suppressed: false,
      gfx: this.scene.add.graphics().setDepth(2.4),
      barBg: def.required === true||def.chapterSideSet===true
        ? this.scene.add.rectangle(def.x, def.y - 36, 42, 5, 0x111827, 0.9).setDepth(2.5)
        : null,
      barFill: def.required === true||def.chapterSideSet===true
        ? this.scene.add.rectangle(def.x - 19, def.y - 36, 0, 3, 0x7ADF7A, 1)
          .setOrigin(0, 0.5)
          .setDepth(2.6)
        : null,
      sourceLabel: def.label || '',
      sequenceIndex: 0,
      label: (def.required === true||def.chapterSideSet===true) && def.label
        ? this.scene.add.text(def.x, def.y + 30, getChapterDeviceLabel(def), {
          fontSize: '12px',
          align: 'center',
          color: def.sceneArt ? '#F6F9F8' : '#293B44',
          fontStyle: 'bold',
          strokeThickness: 0,
          backgroundColor: def.sceneArt ? '#26383C' : '#F7F9F9',
          padding: def.sceneArt ? { x: 3, y: 1 } : { x: 5, y: 3 },
        }).setOrigin(0.5).setDepth(2.6)
        : null,
    };
    device.sprite = createDeviceSprite(this.scene, device);
    this.devices.push(device);
    this._redrawDevice(device);
  }

  _paintFillColor(device, ratio) {
    const liveHex = COLOR_HEX[device.paintColor] || KIND_COLORS[device.kind] || 0xFF69B4;
    if (device.complete) return liveHex;
    const gray = 0x8A93A6;
    const t = Math.max(0, Math.min(1, Number(ratio) || 0));
    const mix = (from, to, ch) => {
      const shift = ch * 8;
      const a = (from >> shift) & 0xff;
      const b = (to >> shift) & 0xff;
      return Math.round(a + (b - a) * t);
    };
    return (mix(gray, liveHex, 2) << 16) | (mix(gray, liveHex, 1) << 8) | mix(gray, liveHex, 0);
  }

  _redrawDevice(device) {
    // Phaser may destroy the DisplayList before Scene shutdown releases suppression.
    if (device.gfx?.active === false || device.label?.active === false || device.sprite?.active === false) return;
    this.scene.oldStreet?.updateRestoration?.(device, this.devices);
    if (drawDevicePresentation(device, this.currentZone)) return;
    const accent = COLOR_HEX[device.paintPolicy==='performer' ? device.paintColor : device.colorSequence?.[device.sequenceIndex || 0]] || KIND_COLORS[device.kind] || 0xFFD700;
    const locked = device.zone > this.currentZone;
    const suppressed = device.publicStage1Suppressed === true;
    const ratio = device.paintPolicy === 'performer' ? getCumulativeChapterPaintProgress(device)
      : device.paintMax > 0 ? device.paint / device.paintMax : 0;
    const fill = locked || suppressed ? 0x2A3142 : this._paintFillColor(device, ratio);
    device.gfx.clear();
    if (locked) {
      device.gfx.fillStyle(fill, 0.7);
      device.gfx.lineStyle(1.4, 0x667089, 0.55);
    } else if (suppressed) {
      device.gfx.fillStyle(fill, 0.82);
      device.gfx.lineStyle(1.6, 0xA892FF, 0.78);
    } else if (device.complete) {
      device.gfx.fillStyle(fill, 0.96);
      device.gfx.lineStyle(2, 0xFFFFFF, 0.85);
    } else {
      device.gfx.fillStyle(fill, 0.62 + ratio * 0.32);
      device.gfx.lineStyle(1.6, accent, 0.9);
    }
    this._drawKindShape(device.gfx, device.kind, device.x, device.y);
    if (suppressed && !locked) {
      device.gfx.lineStyle(1.1, 0xF7D8E8, 0.5);
      device.gfx.lineBetween(device.x - 18, device.y - 26, device.x - 7, device.y - 26);
      device.gfx.lineBetween(device.x + 7, device.y - 26, device.x + 18, device.y - 26);
    }
    if (device.barFill && device.barBg) {
      device.barFill.width = 38 * ratio;
      const barColor = ratio > 0.66 ? 0x7ADF7A : ratio > 0.33 ? 0xE2D15A : 0xE36B6B;
      device.barFill.setFillStyle(device.complete ? fill : barColor, 1);
      device.barBg.setVisible(!device.complete && !locked && !suppressed);
      device.barFill.setVisible(!device.complete && !locked && !suppressed);
    }
    if (device.label) {
      device.label.setText(getChapterDeviceLabel(device));
      device.label.setColor(getDeviceLabelInk(device));
    }
  }

  _drawKindShape(gfx, kind, x, y) {
    switch (kind) {
      case 'building':
        gfx.fillRoundedRect(x - 30, y - 38, 60, 68, 6);
        gfx.strokeRoundedRect(x - 30, y - 38, 60, 68, 6);
        gfx.fillRect(x - 10, y - 14, 20, 14);
        gfx.fillRect(x - 22, y - 26, 12, 10);
        gfx.fillRect(x + 10, y - 26, 12, 10);
        break;
      case 'speaker':
        gfx.fillRoundedRect(x - 14, y - 16, 28, 32, 4);
        gfx.strokeRoundedRect(x - 14, y - 16, 28, 32, 4);
        break;
      case 'poster':
        gfx.fillRoundedRect(x - 12, y - 18, 24, 36, 3);
        gfx.strokeRoundedRect(x - 12, y - 18, 24, 36, 3);
        break;
      case 'rail':
        gfx.fillRoundedRect(x - 18, y - 8, 36, 16, 3);
        gfx.strokeRoundedRect(x - 18, y - 8, 36, 16, 3);
        break;
      case 'crate':
        gfx.fillRoundedRect(x - 12, y - 12, 24, 24, 3);
        gfx.strokeRoundedRect(x - 12, y - 12, 24, 24, 3);
        break;
      case 'booth':
        gfx.fillRoundedRect(x - 16, y - 14, 32, 28, 4);
        gfx.strokeRoundedRect(x - 16, y - 14, 32, 28, 4);
        break;
      case 'marker':
        gfx.fillCircle(x, y, 16);
        gfx.strokeCircle(x, y, 16);
        break;
      default:
        gfx.fillTriangle(x, y - 16, x + 14, y + 12, x - 14, y + 12);
        gfx.strokeTriangle(x, y - 16, x + 14, y + 12, x - 14, y + 12);
        break;
    }
  }

  _completeDevice(device) {
    if (device.complete) return;
    device.complete = true;
    device.paint = device.paintMax;
    if(device.chapterSideSet){
      this.sideSet.completed(device,this.devices);
      const state=this.sideSet.snapshot(this.devices).zones[device.zone];
      this.scene._showPublicBattleNotice?.((device.zone?'北区':'南区')+'串场 · '+(state.branch==='west'?'西线':'东线')+' '+state.completed+'/2',{duration:1800});
    }
    if(this.chapterObjectives)this._refreshLockVisuals();
    this.onDeviceComplete?.(device);
    this._redrawDevice(device);
    if (!playFacilityCompletionFx(this.scene, device)) {
      const flash = this.scene.add.circle(device.x, device.y, 10, KIND_COLORS[device.kind] || 0xFFD700, 0.7)
        .setDepth(2.8);
      this.scene.tweens.add({
        targets: flash,
        alpha: 0,
        scale: 2.4,
        duration: 420,
        onComplete: () => flash.destroy(),
      });
    }
    this._maybeAdvanceZone();
    this._emitProgress();
  }

  _maybeAdvanceZone() {
    const zoneDone = this.devices
      .filter((device) => device.required === true && device.zone === this.currentZone)
      .every((device) => device.complete);
    if (!zoneDone||this.sideSet&&!this.sideSet.zoneComplete(this.currentZone,this.devices)) return;
    if (this.currentZone + 1 < STAGE1_PAINT_ZONE_COUNT) {
      this.currentZone += 1;
      this.gateOpen = true;
      this.clearGate();
      this._refreshLockVisuals();
      this.onZoneComplete?.(this.currentZone);
      return;
    }
    this.complete = true;
    this.onAllComplete?.();
  }

  _refreshLockVisuals() {
    this.chapterObjectives?.sync(this.devices);
    for(const d of this.devices)if(d.chapterSideSet){
      d.sideSetLockedReason=this.sideSet?.lockReason(d,this.devices)||'';
      d.chapterLocked=!!d.sideSetLockedReason;
    }
    this.devices.forEach((device) => this._redrawDevice(device));
  }

  _drawGate() {
    if(this.scene.oldStreet) {
      this.gateGfx=createStreetZoneGate(this.scene,STAGE1_PAINT_GATE_Y,STAGE1_PAINT_WORLD_WIDTH);
      return;
    }
    const gfx = this.scene.add.graphics().setDepth(1.6);
    gfx.fillStyle(0x141826, 0.82);
    gfx.fillRect(0, STAGE1_PAINT_GATE_Y - 10, STAGE1_PAINT_WORLD_WIDTH, 20);
    gfx.lineStyle(2, 0x77D6C3, 0.7);
    gfx.lineBetween(16, STAGE1_PAINT_GATE_Y, STAGE1_PAINT_WORLD_WIDTH - 16, STAGE1_PAINT_GATE_Y);
    this.gateGfx = gfx;
  }

  _spawnDanmaku() {
    if (this.complete) return;
    this.spawnDanmakuFn?.();
  }

  _scheduleNextDanmaku(initialDelayMs = null) {
    if (this.complete) return;
    const cadence = this.scene?._getPublicStage1EncounterCadence?.();
    const requestedDelay = initialDelayMs ?? cadence?.danmakuIntervalMs ?? STAGE1_PAINT_DANMAKU_INTERVAL_MS;
    const delay = Math.max(250, Number(requestedDelay) || STAGE1_PAINT_DANMAKU_INTERVAL_MS);
    this.danmakuTimer = this.scene.time.delayedCall(delay, () => {
      this.danmakuTimer = null;
      if (this.complete) return;
      this._spawnDanmaku();
      this._scheduleNextDanmaku();
    });
  }

  _emitProgress() {
    const objective = this.getObjectiveProgress();
    this.onProgress?.({
      ...objective,
      painted: objective.completed,
      zone: this.currentZone,
      heat: this.heat,
      level: this.getHeatLevel(),
      complete: this.complete,
    });
  }
}
