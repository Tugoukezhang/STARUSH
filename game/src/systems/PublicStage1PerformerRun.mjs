import { getPublicPerformer, getRunChoice, PublicRunProgression } from '../utils/publicRunProgression.mjs';
import { getPreparationEffects } from '../utils/publicPreparation.mjs';
import { canEnemyBePublicStage1PaintTarget } from './PublicStage1EnemyRoles.mjs';
import { getBattleChapter } from '../utils/publicCampaign.mjs';
import { BattleSurfaceView } from './BattleSurfaceView.mjs';
import { SakuraCombat } from './SakuraCombat.mjs';
import { PerformerMeleeCombat } from './PerformerMeleeCombat.mjs';
import { coherentFacing } from './SakuraFootMotion.mjs';
import { PerformerActionFeedback } from './PerformerActionFeedback.mjs';
import {PublicRunSettlement} from './PublicRunSettlement.mjs';
import { normalizePublicRunGoal, evaluatePublicRunGoal, getPublicRunGoalProgress } from '../utils/publicRunGoals.mjs';
import {getDisplayPerformer} from '../utils/userCast.mjs';
import {PUBLIC_RULESET_ID} from '../utils/releaseIdentity.mjs';
import {combinePublicBuildEffects,getPublicBuildModel} from '../utils/publicBuildContent.mjs';
import {getFinaleResponseSummary} from '../utils/chapterFinaleContent.mjs';
import {normalizeChapterEvent} from '../utils/chapterEncounterEvents.mjs';
import {getPublicAttemptProgress} from '../utils/publicAttemptProgress.mjs';
import {normalizePublicRoutePlan} from '../utils/publicRoutePlan.mjs';
import {createFinaleTrialProgression,finishFinaleTrialRound} from '../utils/publicFinaleTrial.mjs';
import {normalizeArrangementPlan} from '../utils/publicArrangementPlan.mjs';
import {captureChapterFieldReport} from '../utils/publicChapterReports.mjs';
import {isPublicTargetFocusEnabled} from '../utils/publicTargetFocus.mjs';
import {resolvePublicRunContext} from '../utils/publicRunContext.mjs';
import {PublicPaintContactReceipt} from './PublicPaintContactReceipt.mjs';
import {getPublicPerformerAction,samplePublicPerformerAction} from '../utils/publicPerformerAction.mjs';
import {getPublicBattleAbilityState} from '../utils/publicBattleAbilities.mjs';
import {GroundEchoField} from './GroundEchoField278.mjs';
import {SwordEchoField} from './SwordEchoField291.mjs';
import {HarborReturnField} from './HarborReturnField.mjs';

// Public run ownership only. Hidden diagnostic kits and Setlist never enter here.
export class PublicStage1PerformerRun {
  constructor(scene) {
    this.scene = scene;
    this.lastPaintReceipt=null;
    this.lastPaintFeedback=null;
    this.context = resolvePublicRunContext(scene.battleData);
    this.member = getPublicPerformer(scene.battleData?.performerId);
    if(scene._userCastPresentation)this.member=getDisplayPerformer(this.member.id);
    this.growth = (scene._isFinaleTrialRound?.() ? createFinaleTrialProgression(scene.battleData) : null) || new PublicRunProgression({performerId:scene._userCastPresentation?this.member.id:null});
    const publicEntry = scene.battleData?.practiceMode !== true && scene.battleData?.defenseMode !== true
      && Number(scene.battleData?.stageId || 1) === 1;
    this.rulesetId=publicEntry&&scene._userCastPresentation ? PUBLIC_RULESET_ID : null;
    this.arrangementPlan=publicEntry&&scene._userCastPresentation?normalizeArrangementPlan(scene.battleData?.publicArrangementPlan,scene.battleData):null;
    this.routePlan=scene._userCastPresentation?normalizePublicRoutePlan(scene.battleData?.publicRoutePlan,scene.battleData):null;
    this.preparationEffects = Object.freeze(getPreparationEffects(publicEntry ? scene.battleData?.publicPreparation : null, this.member.id));
    this.buildContext=publicEntry&&scene._userCastPresentation
      ? getPublicBuildModel(scene.battleData?.publicPreparation,this.member.id) : null;
    this.runGoal = publicEntry && scene.battleData?.publicRunGoal ? normalizePublicRunGoal(scene.battleData.publicRunGoal,
      {performerId:this.member.id,chapterId:getBattleChapter(scene.battleData).id,...(this.rulesetId?{rulesetId:this.rulesetId}:{})}) : null;
    this.timers = new Set();
    this.destroyed = false;
    this.choiceOpen = false;
    this.dash = null;
    this.impacts = 0;
    this.actions = 0;
    this.modificationReleases=0;
    this.choiceEffects={relay:0,echo:0,tempo:0,recovery:0};
    this.finaleResponses=[];
    this.encounterEvent=null;
    this.actionPresentation = null;
    this.actionStartedAt = null;
    this.actionFeedback = null;
    this.pausedAt = null;
    this.pausedMs = 0;
    this.startedAt = Number(scene.time?.now) || 0;
    this.runId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    this.sakuraCombat = publicEntry && this.member.id === 'sakura' && !scene._userCastPresentation ? new SakuraCombat(scene, this) : null;
    this.meleeCombat = publicEntry && scene._userCastPresentation && ['kai','enjo'].includes(this.member.id) ? new PerformerMeleeCombat(scene,this) : null;
  }

  effects() {
    const run=this.growth.effects(), prepared=this.preparationEffects;
    return combinePublicBuildEffects(run,prepared);
  }
  getBuildSnapshot() {
    return this.buildContext ? getPublicBuildModel(this.buildContext.preparation,this.member.id,this.growth.choices) : null;
  }
  getContext() {
    return this.context ? Object.freeze({...this.context,runId:this.runId,
      choices:Object.freeze([...this.growth.choices]),preparation:this.getBuildSnapshot()?.preparation??null}) : null;
  }
  getModificationReview() {
    const item=this.buildContext?.modification;
    return item?{id:item.id,releases:this.modificationReleases}:null;
  }
  getChoiceReview() {
    if(!this.buildContext)return null;
    const entries=this.growth.choices.filter(id=>Object.hasOwn(this.choiceEffects,id)).map(id=>[id,this.choiceEffects[id]]);
    return entries.length?Object.fromEntries(entries):null;
  }
  paintChoice(id,callback) {
    if(!this.alive())return false;
    if(!this.buildContext||!this.growth.choices.includes(id))return callback();
    // An accepted paint may synchronously settle the run.
    this.choiceEffects[id]++;let accepted=false;
    try{accepted=callback()===true;return accepted;}
    finally{if(!accepted)this.choiceEffects[id]--;}
  }
  paintModification(x,y,amount,radius,release) {
    if(!this.buildContext?.modification)return false;
    // Paint may synchronously finish the run; its receipt must already include this release.
    this.modificationReleases++;
    if(!this.paint(x,y,amount,radius,this.member.color,null,release)){this.modificationReleases--;return false;}
    if(this.alive()&&(release.beat===0||this.member.id!=='sakura'))this.scene._showPublicBattleNotice?.(
      this.buildContext.modification.name+' · 已释放',{kind:'action',duration:1000});
    return true;
  }
  releaseRainRelay(origin) {
    const targets=this.fixtureTargets(origin.x,origin.y,380);
    let accepted=0;
    for(const target of targets){
      if(!this.alive()||accepted===2)break;
      // Completion can settle synchronously; the saved receipt must include this contact.
      this.modificationReleases++;
      if(!this.paint(target.x,target.y,20,36,this.member.color,target)){this.modificationReleases--;continue;}
      accepted++;
      if(this.alive())this.scene.actorPresentation?.userCastView?.weaponFx?.choice?.('relay',{
        x:target.x,y:target.y,from:origin,color:this.member.color});
    }
    if(accepted&&this.alive())this.scene._showPublicBattleNotice?.(`雨后继电 · 补色 ${accepted} 处`,{kind:'action',duration:1400});
    return accepted;
  }
  now() { return (this.pausedAt ?? this.scene.time.now) - this.pausedMs; }
  getActionPresentation(now=this.now()) {
    if(!this.alive()||!this.scene._userCastPresentation)return null;
    return samplePublicPerformerAction(this.member.id,this.actionPresentation,this.actionStartedAt,now);
  }
  getGoalProgress() {
    if(!this.runGoal||this.destroyed)return null;
    return getPublicRunGoalProgress(this.runGoal,{performerId:this.member.id,
      chapterId:getBattleChapter(this.scene.battleData).id,...(this.rulesetId?{rulesetId:this.rulesetId}:{}),
      durationMs:Math.max(0,this.now()-this.startedAt),
      performance:{hitCount:this.scene.battleRecord?.playerHitCount}});
  }
  pauseClock() { if(this.pausedAt===null)this.pausedAt=this.scene.time.now; }
  getAttemptProgress() {
    if(this.scene._isFinaleTrialRound?.())return null;
    if(this.destroyed||!this.scene._userCastPresentation||!this.scene.paintZone)return null;
    const zone=this.scene.paintZone,devices=zone.devices||[];
    const required=devices.filter(d=>d.required===true&&d.zone===zone.currentZone);
    return getPublicAttemptProgress({chapterId:getBattleChapter(this.scene.battleData).id,
      objectiveProgress:{...zone.getObjectiveProgress?.(),finaleReached:zone.finaleMode===true},
      chapterSideSet:zone.sideSet?.snapshot(devices),finaleResponses:this.finaleResponses,
      activeZone:{index:zone.currentZone,total:required.length,completed:required.filter(d=>d.complete).length},
      calibrationCount:devices.filter(d=>d.zone===zone.currentZone&&d.chapterAwaitingCalibration
        &&!d.chapterLocked&&!d.complete&&!d.publicStage1Suppressed).length});
  }
  resumeClock() {
    if(this.pausedAt!==null){this.pausedMs+=Math.max(0,this.scene.time.now-this.pausedAt);this.pausedAt=null;}
  }
  alive() { return !this.destroyed && !this.scene._battleEnded
    && !(this.scene._userCastPresentation&&(this.scene.player?.active===false||this.scene.player?.hp<=0)); }
  getAbilityState() { return getPublicBattleAbilityState(this.scene, this); }
  canAct() { return this.getAbilityState().action.canRelease; }
  isActionEnemyTarget(e, x, y, range = 340) {
    return canEnemyBePublicStage1PaintTarget(e) && Math.hypot(e.x - x, e.y - y) <= range
      && this.scene.oldStreet?.clearLine({x,y},e)!==false;
  }
  targets(x, y, range = 340) {
    return (this.scene.enemies?.getChildren?.() || []).filter(e => this.isActionEnemyTarget(e,x,y,range))
      .sort((a,b) => Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y));
  }
  isActionFixtureTarget(d, x, y, range = 340) {
    const s=this.scene, zone=s.paintZone;
    if (!this.alive() || !zone || zone.finaleMode) return false;
    return !d.complete && d.zone<=zone.currentZone
      && (!zone.canReceivePaint||zone.canReceivePaint(d))
      && d.publicStage1Suppressed!==true && Math.hypot(d.x-x,d.y-y)<=range
      && s.oldStreet?.clearLine(s.player,d)!==false
      && s.oldStreet?.clearLine({x,y},d)!==false;
  }
  fixtureTargets(x, y, range = 340) {
    return (this.scene.paintZone?.devices || []).filter(d => this.isActionFixtureTarget(d,x,y,range))
      .sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y));
  }
  later(delay, callback) {
    if (!this.alive()) return;
    let timer;
    timer = this.scene.time.delayedCall(delay, () => {
      this.timers.delete(timer);
      if (this.alive()) callback();
    });
    this.timers.add(timer);
  }
  // Ordinary focus wins only while it is still one of the original legal candidates.
  barrageTarget(x, y) {
    const enemies=this.targets(x,y);
    const focus=isPublicTargetFocusEnabled(this.scene) ? this.scene.publicTargetFocus?.getTarget?.() : null;
    if(focus && (enemies.includes(focus)||this.fixtureTargets(x,y).includes(focus)))return focus;
    return enemies[0]||this.fixtureTargets(x,y)[0];
  }
  paint(x, y, amount, radius, color = this.member.color, exactTarget = null, release = null) {
    if (!this.alive()) return false;
    if(this.scene._userCastPresentation){radius+=this.effects().paintRadiusBonus;if(release)radius*=Math.sqrt(this.effects().actionPower);}
    const s = this.scene;
    if(s.oldStreet?.clearLine(s.player,{x,y})===false)return false;
    const exactFixture=s.paintZone?.devices?.includes(exactTarget)===true;
    if(exactFixture && !this.fixtureTargets(x,y,0).includes(exactTarget))return false;
    const receipt=new PublicPaintContactReceipt({source:'action',x,y,color});
    const appearance=release ? [{performer:this.member.id,angle:release.angle}] : [];
    const observer=release||s._userCastPresentation ? [(contact,target)=>receipt.record(contact,target)] : [];
    if(!exactFixture)s._stampGroundSplat(x, y, color, radius, false, ...appearance);
    // Fixture casts are exact; enemy casts preserve their existing surface footprint.
    const surfaceHit=exactFixture ? s.paintZone.applyPaint(exactTarget,amount,color)
      : s.paintZone?.applyPaintAt(x, y, amount, radius, color, ...observer);
    if(exactFixture&&surfaceHit&&this.alive())s._stampGroundSplat(x,y,color,radius,false,...appearance);
    if(exactFixture && surfaceHit)receipt.record({x,y,kind:'fixture'},exactTarget);
    const enemyHit=exactFixture || !this.alive() ? false
      : s._paintPublicStage1TargetsAt(x, y, amount, radius, color, exactTarget, ...observer, ...appearance);
    const feedback=s._userCastPresentation===true?receipt.feedback({radius,start:this.now(),
      angle:Number.isFinite(release?.angle)?release.angle:-Math.PI/2,deposition:true,
      successfulPaint:surfaceHit===true||enemyHit===true,sequence:release?.sequence,beat:release?.beat}):null;
    const paintReceipt=feedback?.receipt||receipt.snapshot();
    const currentOwner=s._userCastPresentation!==true||s.publicPerformerRun===this;
    this.lastPaintReceipt=s._userCastPresentation===true&&currentOwner&&this.alive()?paintReceipt:null;
    this.lastPaintFeedback=s._userCastPresentation===true&&currentOwner&&this.alive()?feedback:null;
    const contacts=paintReceipt?.contacts||[];
    if(release && currentOwner && this.alive() && (this.member.id!=='sakura'||s._userCastPresentation) && s.add?.graphics){
      this.actionFeedback ||= new PerformerActionFeedback(s,this.member.id);
      this.actionFeedback.queue(feedback||{...release,x,y,radius,color,start:this.now(),contacts,successfulPaint:surfaceHit===true||enemyHit===true});
    }
    return exactFixture ? surfaceHit===true : true;
  }
  triggerAction() {
    if (!this.canAct()) return false;
    const s=this.scene, {x,y}=s.player, power=this.effects().actionPower;
    if (this.member.id === 'sakura' && !s._userCastPresentation) {
      const accepted = s._triggerPublicSakuraLeadCue();
      if (accepted) this.actions += 1;
      return accepted;
    }
    s._specialCharge = 0;
    this.actions += 1;
    const sequence=this.actions;
    const actionStartedAt=this.now(),actionDefinition=getPublicPerformerAction(this.member.id);
    let direction=s.actorPresentation?.direction || 'down';
    if(this.member.id==='sakura'){
      const target=this.barrageTarget(x,y);
      const angle=target?Math.atan2(target.y-y,target.x-x):-Math.PI/2;
      // Current cast art is two-sided; diagonal aim selects its side, vertical aim keeps the previous side.
      const horizontal=Math.cos(angle);
      if(Math.abs(horizontal)>1e-6)direction=horizontal<0?'left':'right';
      for(const [beat,delay] of actionDefinition.releaseBeats.entries())this.later(delay,()=>{
        const travelling=this.buildContext?.modification?.id==='travelling_nozzle';
        const origin=travelling?s.player:{x,y};
        if(travelling)this.modificationReleases++;
        let released=false;
        for(const offset of [-.3,0,.3]){
          const a=angle+offset,r=95+beat*70;
          released=this.paint(origin.x+Math.cos(a)*r,origin.y+Math.sin(a)*r,24*power,60,
            this.member.color,null,{sequence,beat,angle:a})||released;
        }
        if(travelling&&!released)this.modificationReleases--;
        if(travelling&&released&&beat===0&&this.alive())
          s._showPublicBattleNotice?.('随行喷头 · 已释放',{kind:'action',duration:1000});
      });
    } else if (this.member.id === 'kai') {
      const v=s.player.body?.velocity || {x:0,y:0};
      const len=Math.hypot(v.x,v.y);
      let dashX=len?v.x/len:0,dashY=len?v.y/len:-1;
      // Explicit focus only steers a stationary cast; moving input and old no-focus aim stay authoritative.
      if(!len&&isPublicTargetFocusEnabled(s)){
        const focus=s.publicTargetFocus?.getTarget?.();
        if(focus&&(this.targets(x,y).includes(focus)||this.fixtureTargets(x,y).includes(focus))){
          const dx=focus.x-x,dy=focus.y-y,distance=Math.hypot(dx,dy);
          if(distance>0){dashX=dx/distance;dashY=dy/distance;}
        }
      }
      this.dash={x:dashX,y:dashY,endsAt:this.now()+actionDefinition.dashMs,lastX:x,lastY:y,power};
      direction=coherentFacing(direction,this.dash.x,this.dash.y);
      this.dash.actionSequence=sequence;
      this.paint(x,y,20*power,72,this.member.color,null,{sequence,beat:0,angle:Math.atan2(this.dash.y,this.dash.x)});
      if(this.buildContext?.modification?.id==='return_edge'){
        const angle=Math.atan2(-this.dash.y,-this.dash.x);
        this.later(actionDefinition.dashMs,()=>this.paintModification(x,y,20*power,72,{sequence,beat:1,angle}));
      }
    } else if (this.member.id === 'venus') {
      const targets=[...this.targets(x,y),...this.fixtureTargets(x,y)]
        .sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y)).slice(0,3);
      direction=coherentFacing(direction,(targets[0]?.x ?? x)-x,(targets[0]?.y ?? y-100)-y);
      if (!targets.length) this.paint(x,y-100,42*power,110,this.member.color,null,{sequence,beat:0,angle:-Math.PI/2});
      let beat=0;
      for (const target of targets) this.paint(target.x,target.y,42*power,36,this.member.color,target,
        {sequence,beat:beat++,angle:Math.atan2(target.y-y,target.x-x)});
    } else if (this.member.id === 'genya') {
      const target=s._selectPublicSakuraLeadCueTarget() || this.fixtureTargets(x,y)[0];
      const tx=target?.x ?? x, ty=target?.y ?? y-100;
      direction=coherentFacing(direction,tx-x,ty-y);
      let beatIndex=0;
      const beat=()=>this.paint(tx,ty,22*power,120,this.member.color,null,
        {sequence,beat:beatIndex++,angle:Math.atan2(ty-y,tx-x)});
      beat(); this.later(350,beat); this.later(700,beat);
    } else if (this.member.id === 'enjo') {
      this.paint(x,y,52*power,190,this.member.color,null,{sequence,beat:0,angle:-Math.PI/2});
      if(this.buildContext?.modification?.id==='delayed_hammer')
        this.later(350,()=>this.paintModification(x,y,52*power,190,{sequence,beat:1,angle:-Math.PI/2}));
    }
    // Read-only presentation snapshot; never reselect targets or schedule combat work.
    if (!this.alive()) return true;
    this.actionPresentation=Object.freeze({sequence:this.actions,direction});
    this.actionStartedAt=actionStartedAt;
    s._showRoundBanner(this.member.actionName);
    s._updateHUD();
    return true;
  }
  movement(vx,vy) {
    if (!this.dash || !this.alive() || this.now() >= this.dash.endsAt) {
      this.dash=null;return {vx,vy};
    }
    const p=this.scene.player;
    if(Math.hypot(p.x-this.dash.lastX,p.y-this.dash.lastY)>=36) {
      this.dash.lastX=p.x;this.dash.lastY=p.y;
      this.paint(p.x,p.y,20*this.dash.power,72,this.member.color,null,
        {sequence:this.dash.actionSequence,beat:0,angle:Math.atan2(this.dash.y,this.dash.x)});
    }
    return {vx:this.dash.x*700,vy:this.dash.y*700};
  }
  onImpact(x,y,color,target,acceptedTargets=[],meleeFrame) {
    if (!this.alive()) return;
    const excluded=new Set([target,...(this.buildContext&&Array.isArray(acceptedTargets)?acceptedTargets:[])]);
    const effects=this.effects();this.impacts+=1;
    if (effects.relay) {
      const other=this.targets(x,y,160).find(e=>!excluded.has(e));
      if(other) {
        const receipt={x:other.x,y:other.y,from:{x,y},color};
        this.scene._stampGroundSplat(receipt.x,receipt.y,color,24,false);
        const applied=this.paintChoice('relay',()=>this.scene._paintPublicStage1TargetsAt(receipt.x,receipt.y,8,24,null,other));
        if(applied===true)this.choiceFeedback?.('relay',receipt);
      } else {
        // Preserve enemy priority; a fixture fallback is one non-recursive transfer.
        const fixture=this.fixtureTargets(x,y,160).find(d=>!excluded.has(d) && Math.hypot(d.x-x,d.y-y)>0.001);
        if(fixture){
          const receipt={x:fixture.x,y:fixture.y,from:{x,y},color};
          if(this.paintChoice('relay',()=>this.paint(receipt.x,receipt.y,8,24,color,fixture))===true)this.choiceFeedback?.('relay',receipt);
        }
      }
    }
    if(effects.echo && this.impacts%3===0){
      if(this.scene._userCastPresentation&&this.member.id==='enjo'){
        this.groundEcho ||= new GroundEchoField(this);
        this.groundEcho.queue(x,y,color,this.now());
      }else if(this.scene._userCastPresentation&&this.member.id==='kai'){
        this.swordEcho ||= new SwordEchoField(this);
        this.swordEcho.queue({x:meleeFrame.x,y:meleeFrame.y,angle:meleeFrame.angle,color,start:this.now()});
      }else this.later(200,()=>{if(this.paintChoice('echo',()=>this.paint(x,y,14,80,color))===true)this.choiceFeedback?.('echo',{x,y});});
    }
  }
  choiceFeedback(id,point){
    if(!this.scene._userCastPresentation)return;
    if(point)this.scene.actorPresentation?.userCastView?.weaponFx?.choice?.(id,point);
    this.feedbackAt||={};const now=this.now();
    if(now-(this.feedbackAt[id]??-Infinity)<1800)return;
    this.feedbackAt[id]=now;
    this.scene._showPublicBattleNotice?.(getRunChoice(id,this.member.id).label,{kind:'action',duration:800});
  }
  onChargeAward(before,after,baseAmount){
    if(!this.alive()||!this.scene._userCastPresentation||!this.growth.choices.includes('tempo')
      ||![before,after,baseAmount].every(Number.isFinite)||baseAmount<=0)return;
    const normalGain=Math.min(Math.max(0,100-before),baseAmount*this.preparationEffects.chargeMultiplier);
    if(after-before-normalGain>1e-8){
      if(this.buildContext)this.choiceEffects.tempo+=after-before-normalGain;
      this.choiceFeedback('tempo',this.scene.player);
    }
  }
  onAnchor(device) {
    const s=this.scene;
    if(s._userCastPresentation && getBattleChapter(s.battleData).id === 'homecoming' && !s._restoringPublicBattleCheckpoint){
      this.harborReturn ??= new HarborReturnField(this);
      this.harborReturn.complete(device);
    }
    if(this.effects().recoverOnAnchor && s.player.hp>0){
      const before=s.player.hp;s.player.hp=Math.min(s.player.maxHp || 5,s.player.hp+1);
      if(s.player.hp>before){
        if(this.buildContext)this.choiceEffects.recovery+=s.player.hp-before;
        this.choiceFeedback?.('recovery',s.player);
      }
    }
  }
  pendingCheckpoint() { return this.growth.checkpointFor(this.scene.paintZone?.getPaintedCount?.() || 0); }
  update() {
    this.sakuraCombat?.update();
    this.meleeCombat?.update();
    this.groundEcho?.update(this.now());
    this.swordEcho?.update(this.now());
    this.harborReturn?.update(this.now());
    if(this.alive()&&!this.scene._battlePaused&&this.runGoal&&!this.result){
      const progress=this.getGoalProgress();
      if(progress?.status==='missed'&&!this.goalMissedNotice){
        this.goalMissedNotice=true;
        this.scene._showPublicBattleNotice?.('本场目标已错过，仍可继续通关',{kind:'guidance',duration:1800});
      }
    }
    if(!this.alive() || this.scene._battlePaused || !this.pendingCheckpoint()) return;
    this.openChoice();
  }
  openChoice() {
    if(this.choiceOpen || !this.alive()) return false;
    const s=this.scene, host=document.getElementById('game-container');
    if(!host) return false;
    this.choiceOpen=true;
    this.dash=null;
    s._setBattlePaused(true);
    s._clearBattlePauseOverlay();
    this.choiceView=new BattleSurfaceView(s,{mode:'choice',member:this.member,number:this.growth.choices.length+1,
      choices:this.growth.choices,options:this.growth.getOptions(),plannedChoice:this.arrangementPlan?.choices[this.growth.choices.length],onChoice:id=>this.choose(id),
      onLeave:()=>{this.closeChoice();s._setBattlePaused(false);s._handleBattleResultAction('title');}});
    this.choiceRoot=this.choiceView.root;return true;
  }
  choose(id) {
    if(!this.choiceOpen || !this.alive() || this.scene._sessionExperience?.isBlocking() || !this.growth.choose(id)) return false;
    this.closeChoice();this.scene._setBattlePaused(false);
    this.syncBuildHud();this.scene._updateHUD();
    const option=getRunChoice(id,this.member.id);
    if(this.scene._userCastPresentation)this.scene._showPublicBattleNotice?.(`${option.label} · 已生效`,{kind:'action',duration:1800});
    return true;
  }
  syncBuildHud() {
    const el=document.getElementById('run-build');
    if(el) el.textContent=this.growth.choices.map(id=>this.growthLabel(id)).join(' · ');
  }
  growthLabel(id) {
    return getRunChoice(id,this.member.id)?.label || id;
  }
  recordFinaleResponse(row){
    if(!this.alive()||this.result||!this.scene._userCastPresentation||row?.index!==this.finaleResponses.length)return false;
    const next=[...this.finaleResponses,{index:row.index,pattern:row.pattern,outcome:row.outcome,
      ...(row.travelMode!==undefined?{travelMode:row.travelMode}:{})}];
    if(!getFinaleResponseSummary(next))return false;
    this.finaleResponses=next;return true;
  }
  recordEncounterEvent(row,{terminal=false}={}){
    // A terminal capture may follow the lethal hit; it still cannot replace captured result data.
    if((terminal?this.destroyed:!this.alive())||this.result||!this.scene._userCastPresentation)return false;
    const valid=normalizeChapterEvent(row,getBattleChapter(this.scene.battleData).id);
    if(!valid)return false;
    this.encounterEvent=Object.freeze(valid);return true;
  }
  closeChoice() { this.choiceView?.destroy();this.choiceView=null;this.choiceRoot=null;this.choiceOpen=false; }
  finish(victory) {
    if(Object.hasOwn(this.scene.battleData||{},'publicFinaleTrial')||this.scene._isFinaleTrialRound?.()){
      if(!this.context||this.context.policy.profileResult)return null;
      this.result ||= finishFinaleTrialRound(this.scene.battleData,{
        victory,hp:Math.max(0,this.scene.player.hp),durationMs:Math.max(0,this.now()-this.startedAt),
        hitCount:this.scene.battleRecord?.playerHitCount||0,actions:this.actions});
      return this.result;
    }
    if(this.settlement)return this.result=this.settlement.commit();
    // Same-frame releases reach the Director before the Scene's next sync; read only, never advance it.
    if(this.scene._userCastPresentation&&!this.result)
      this.recordEncounterEvent(this.scene.publicStage1Encounter?.getChapterEventSnapshot?.(),{terminal:true});
    const objective=this.scene.paintZone?.getObjectiveProgress?.();
    const objectiveProgress=Number.isInteger(objective?.total) && objective.total>0
      && Number.isInteger(objective.completed) && objective.completed>=0 && objective.completed<=objective.total
      ? {completed:objective.completed,total:objective.total,finaleReached:this.scene.paintZone.finaleMode===true} : undefined;
    // Capture before battle-end cleanup; this is result context, not saved partial progress.
    const data=this.result || {runId:this.runId,performerId:this.member.id,chapterId:getBattleChapter(this.scene.battleData).id,victory,choices:[...this.growth.choices],durationMs:Math.max(0,this.now()-this.startedAt),
      ...(this.routePlan?{publicRoutePlan:this.routePlan}:{}),
      ...(this.finaleResponses.length?{finaleResponses:this.finaleResponses.map(row=>({...row}))}:{}),
      ...(this.encounterEvent?{encounterEvent:{...this.encounterEvent}}:{}),
      ...(this.scene.paintZone?.sideSet?{chapterSideSet:this.scene.paintZone.sideSet.snapshot(this.scene.paintZone.devices)}:{}),
      ...(this.buildContext?{build:this.getBuildSnapshot()}:{}),
      ...(this.getModificationReview()?{modificationReview:this.getModificationReview()}:{}),
      ...(this.getChoiceReview()?{choiceReview:this.getChoiceReview()}:{}),
      ...(this.rulesetId?{rulesetId:this.rulesetId}:{}),
      ...(Number.isSafeInteger(this.scene.battleRecord?.playerHitCount) ? {performance:{
        hitCount:this.scene.battleRecord.playerHitCount,actions:this.actions}} : {}),
      ...(objectiveProgress ? {objectiveProgress} : {})};
    if(!this.result&&this.scene._userCastPresentation&&this.scene._isPublicStage1Round?.()===true){
      const fieldReport=captureChapterFieldReport(data);
      if(fieldReport)data.fieldReport=fieldReport;
    }
    this.settlement=new PublicRunSettlement(data,{actions:this.actions,
      ...(this.arrangementPlan?{arrangementPlan:this.arrangementPlan}:{}),
      ...(this.runGoal?{runGoal:{...this.runGoal},goalOutcome:evaluatePublicRunGoal(this.runGoal,data)}:{})});
    return this.result=this.settlement.commit();
  }
  destroy() {
    this.groundEcho?.destroy();
    this.swordEcho?.destroy();
    this.harborReturn?.destroy();
    this.lastPaintReceipt=null;
    this.lastPaintFeedback=null;
    this.sakuraCombat?.destroy();
    this.meleeCombat?.destroy();
    this.actionFeedback?.destroy();this.actionFeedback=null;
    this.destroyed=true;this.closeChoice();this.dash=null;this.actionPresentation=null;this.actionStartedAt=null;
    this.finaleResponses=[];
    this.encounterEvent=null;
    for(const timer of this.timers) timer.remove(false);
    this.timers.clear();
    const el=globalThis.document?.getElementById?.('run-build');if(el)el.textContent='';
    const goal=globalThis.document?.getElementById?.('run-goal');if(goal){goal.textContent='';goal.hidden=true;}
    const hud=globalThis.document?.getElementById?.('hud');if(hud?.dataset)hud.dataset.runGoal='false';
  }
}
