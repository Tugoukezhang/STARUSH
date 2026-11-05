import {PUBLIC_RULESET_ID} from '../utils/releaseIdentity.mjs';
import {resolvePublicRunContext} from '../utils/publicRunContext.mjs';
import {isPublicSettlementSaved} from './PublicRunSettlement.mjs';
import {PublicRunProgression} from '../utils/publicRunProgression.mjs';
import {getBattleChapter} from '../utils/publicCampaign.mjs';
import {capturePublicBattleCombat} from './PublicBattleCombatCheckpoint.mjs';
import {capturePublicBattleWorld,applyPublicBattleWorld} from './PublicBattleWorldCheckpoint.mjs';
import {encodePublicBattleVisualAsync} from '../utils/publicBattleVisual.mjs';
import {PUBLIC_STAGE1_SAKURA_ENCORE_WINDOW_MS} from './PublicStage1SakuraActionContract.mjs';
export {applyPublicBattleCheckpointCombat,PUBLIC_BATTLE_RESUME_TELEGRAPH_MIN_MS} from './PublicBattleCombatCheckpoint.mjs';
import {PUBLIC_BATTLE_CHECKPOINT_KIND,PUBLIC_BATTLE_CHECKPOINT_VERSION,writePublicBattleCheckpoint,discardPublicBattleCheckpoint}
  from '../utils/publicBattleCheckpoint.mjs';

export const PUBLIC_BATTLE_CHECKPOINT_INTERVAL_MS=2000;
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const nullable=value=>Number.isFinite(value)?value:null;

// Durable logical state is independent of transient bullets and action animation beats.
export function canCapturePublicBattleCheckpoint(scene){
  const run=scene?.publicPerformerRun,zone=scene?.paintZone,encounter=scene?.publicStage1Encounter;
  return resolvePublicRunContext(scene?.battleData)?.policy.checkpoint===true
    &&!!run&&!run.destroyed&&run.rulesetId===PUBLIC_RULESET_ID&&scene._userCastPresentation===true
    &&scene._isPublicStage1Round?.()===true&&scene._isFinaleTrialRound?.()!==true&&scene._battleEnded!==true
    &&!!zone&&scene.publicStage1Round?.phase==='active'&&(encounter?.active===true||scene.publicStage1Finale?.active===true)
    &&(!zone.finaleMode||scene.publicStage1Finale?.active===true)
    &&(!scene.publicStage1Finale?.active||scene._publicStage1FinaleBoss?.active===true)
    &&scene.player?.active!==false&&scene.player?.hp>0;
}

export function capturePublicBattleCheckpoint(scene,{savedAt=Date.now()}={}){
  if(!canCapturePublicBattleCheckpoint(scene))return null;
  const run=scene.publicPerformerRun,zone=scene.paintZone,encounter=scene.publicStage1Encounter,street=scene.oldStreet;
  const now=run.now(),data=scene.battleData,event=encounter.chapterEvent;
  const combat=capturePublicBattleCombat(scene);
  if(Object.entries(encounter.authoredRoles).some(([role,row])=>row.state==='active'&&!combat.elites.some(e=>e.role===role)))return null;
  const roles=Object.fromEntries(Object.entries(encounter.authoredRoles).filter(([,row])=>row.state==='resolved').map(([role,row])=>[role,row.outcome]));
  const checkpoint={kind:PUBLIC_BATTLE_CHECKPOINT_KIND,version:PUBLIC_BATTLE_CHECKPOINT_VERSION,rulesetId:run.rulesetId,
    savedAt:Math.floor(savedAt),runId:run.runId,
    battle:{performerId:run.member.id,chapterId:getBattleChapter(data).id,preparation:data.publicPreparation??null,
      runGoal:data.publicRunGoal??null,routePlan:data.publicRoutePlan??null,arrangementPlan:data.publicArrangementPlan??null},
    run:{elapsedMs:Math.max(0,now-run.startedAt),choices:run.growth.choices,shotCount:run.growth.shotCount,
      checkpoints:run.growth.checkpoints,actions:run.actions,impacts:run.impacts,modificationReleases:run.modificationReleases,
      choiceEffects:{...run.choiceEffects},encounterEvent:run.encounterEvent?{...run.encounterEvent}:null,
      goalMissedNotice:run.goalMissedNotice===true},
    player:{x:scene.player.x,y:scene.player.y,hp:scene.player.hp,specialCharge:finite(scene._specialCharge),
      encoreCharge:finite(scene._encoreCharge),hitCount:scene.battleRecord?.playerHitCount||0,
      encoreRemainingMs:Math.min(PUBLIC_STAGE1_SAKURA_ENCORE_WINDOW_MS,Math.max(0,finite(scene._publicSakuraEncoreEndsAt,now)-now)),
      feverActive:scene._publicFeverActive===true,relightBurstPlayed:scene._publicRelightBurstPlayed===true},
    round:{remainingMs:Math.max(0,scene.publicStage1Round.endsAt-now)},
    encounter:{elapsedMs:Math.max(0,now-encounter.startedAt),currentPhaseId:encounter.currentPhaseId,
      phaseEnteredAtMs:encounter.phaseEnteredAtMs,northEntered:encounter.chapterNorthEntered===true,
      lastEmitterAtMs:nullable(encounter.lastStageCueEmitterAtMs),lastEmitterPhaseId:encounter.lastStageCueEmitterPhaseId,
      lastDisruptorAtMs:nullable(encounter.lastObjectiveDisruptorAtMs),lastDisruptorPhaseId:encounter.lastObjectiveDisruptorPhaseId,
      captainClaimed:encounter.spotlightCaptainClaimed===true,roles,
      event:event?{row:event.row?{id:event.row.id,status:event.row.status}:null,wasLinked:event.wasLinked===true}:null},
    paint:{zone:zone.currentZone,heat:finite(zone.heat),burstUsed:zone.burstUsed?1:0,complete:zone.complete===true,
      sideSelected:zone.sideSet?[...zone.sideSet.selected]:[null,null],
      devices:zone.devices.filter(d=>typeof d.id==='string').map(d=>({id:d.id,paint:finite(d.paint),color:d.paintColor??null,
        sequenceIndex:d.sequenceIndex||0,complete:d.complete===true,calibrating:d.chapterAwaitingCalibration===true,
        calibrationMs:finite(d.chapterCalibrationMs)}))},
    street:{opened:street?[...street.state.opened]:[],restored:street?[...street.state.restored]:[],
      finaleAnnounced:street?.finaleAnnounced===true,storyOffered:street?.storyOffered===true,
      stationGuards:[...(scene._chapterStationGuards||[])]},combat};
  Object.defineProperty(checkpoint,'worldVisual',{value:capturePublicBattleWorld(scene)});
  return checkpoint;
}

// Step 1, at create after the public world reset: run identity, growth, counters and the player's saved body state.
export function applyPublicBattleCheckpointRun(scene,checkpoint){
  const run=scene.publicPerformerRun,c=checkpoint.run,p=checkpoint.player;
  if(!run||run.member.id!==checkpoint.battle.performerId)return false;
  run.runId=checkpoint.runId;
  run.growth=new PublicRunProgression({choices:c.choices,shotCount:c.shotCount,checkpoints:c.checkpoints,performerId:run.member.id});
  Object.assign(run,{actions:c.actions,impacts:c.impacts,modificationReleases:c.modificationReleases,
    choiceEffects:{...c.choiceEffects},goalMissedNotice:c.goalMissedNotice});
  run.encounterEvent=c.encounterEvent?Object.freeze({...c.encounterEvent}):null;
  scene.player.setPosition(p.x,p.y);
  // Saved HP only; a resume never heals above what the player had.
  scene.player.hp=Math.min(p.hp,scene.player.maxHp||5);
  scene._specialCharge=p.specialCharge;scene._encoreCharge=p.encoreCharge;
  scene._publicSakuraEncoreEndsAt=null;
  if(scene.battleRecord)scene.battleRecord.playerHitCount=p.hitCount;
  scene._publicRelightBurstPlayed=p.relightBurstPlayed;
  return true;
}

// Step 2, after round activation and paintZone.start(): clocks, encounter claims, surfaces and street, applied silently.
export function applyPublicBattleCheckpointRound(scene,checkpoint){
  const run=scene.publicPerformerRun,zone=scene.paintZone,encounter=scene.publicStage1Encounter;
  if(!run||!zone||!encounter?.active||scene.publicStage1Round?.phase!=='active')return false;
  const now=run.now(),e=checkpoint.encounter,paint=checkpoint.paint,street=scene.oldStreet;
  // Rebase only after round activation. Never replay release effects or spend closed time.
  scene._publicSakuraEncoreEndsAt=checkpoint.player.encoreRemainingMs>0?now+checkpoint.player.encoreRemainingMs:null;
  scene.publicStage1Round.endsAt=now+checkpoint.round.remainingMs;
  Object.assign(encounter,{startedAt:now-e.elapsedMs,currentPhaseId:e.currentPhaseId,phaseEnteredAtMs:e.phaseEnteredAtMs,
    chapterNorthEntered:e.northEntered,lastStageCueEmitterAtMs:e.lastEmitterAtMs,lastStageCueEmitterPhaseId:e.lastEmitterPhaseId,
    lastObjectiveDisruptorAtMs:e.lastDisruptorAtMs,lastObjectiveDisruptorPhaseId:e.lastDisruptorPhaseId,
    spotlightCaptainClaimed:e.captainClaimed,
    authoredRoles:Object.fromEntries(Object.entries(e.roles).map(([role,outcome])=>[role,{state:'resolved',outcome}]))});
  if(encounter.chapterEvent&&e.event){
    encounter.chapterEvent.row=e.event.row?{...e.event.row}:null;encounter.chapterEvent.wasLinked=e.event.wasLinked;
  }
  for(const saved of paint.devices){
    const device=zone.devices.find(d=>d.id===saved.id);
    if(!device)continue;
    Object.assign(device,{paint:Math.min(saved.paint,device.paintMax),paintColor:saved.color,sequenceIndex:saved.sequenceIndex,
      complete:saved.complete,chapterCalibrationMs:saved.calibrationMs});
    if(saved.calibrating)device.chapterAwaitingCalibration=true;
    if(saved.complete)device.paint=device.paintMax;
  }
  if(zone.sideSet)zone.sideSet.selected=[...paint.sideSelected];
  Object.assign(zone,{currentZone:paint.zone,heat:paint.heat,burstUsed:paint.burstUsed,complete:paint.complete});
  if(paint.zone>0){zone.gateOpen=true;zone.clearGate();}
  zone._refreshLockVisuals();
  if(street){
    for(const device of zone.devices)if(device.complete)street.restore(device);
    for(const id of checkpoint.street.restored)street.state.restore(id);
    for(const id of checkpoint.street.opened){
      street.state.opened.add(id);const item=street.items.get(id);if(item)street.showOpened(item);
    }
    street.finaleAnnounced=checkpoint.street.finaleAnnounced;street.storyOffered=checkpoint.street.storyOffered;
  }
  // Station guards already met stay met; a resume never adds an extra guard.
  scene._chapterStationGuards=new Set(checkpoint.street.stationGuards);
  applyPublicBattleWorld(scene,checkpoint.worldVisual);
  run.startedAt=now-checkpoint.run.elapsedMs;
  if(checkpoint.player.feverActive)scene._beginPublicFever?.();
  scene._restoringPublicBattleCheckpoint=true;
  try{zone._emitProgress();}finally{scene._restoringPublicBattleCheckpoint=false;}
  scene._showPublicBattleNotice?.('已从中途暂存继续',{kind:'guidance',duration:2000});
  scene._updateHUD?.();
  return true;
}

// Autosave owner: bounded ticks, explicit flushes, one failure notice per streak, discard only after a persisted result.
export class PublicBattleCheckpointAutosave {
  constructor({scene=null,capture=()=>capturePublicBattleCheckpoint(scene),write=writePublicBattleCheckpoint,
    clock=()=>Date.now(),documentTarget=globalThis.document,windowTarget=globalThis.window,onFailure=null,
    encodeVisual=typeof globalThis.Worker==='function'?encodePublicBattleVisualAsync:null}={}){
    Object.assign(this,{scene,capture,write,clock,documentTarget,windowTarget,encodeVisual,pending:null,paintWaitAt:null,stopped:false,lastAt:-Infinity,failing:false});
    this.onFailure=onFailure||(()=>scene?._showPublicBattleNotice?.('本场暂存失败，已保留上一次暂存',{kind:'guidance',duration:2400}));
    this.onVisibility=()=>{if(this.documentTarget?.visibilityState==='hidden')this.flush('hidden');};
    this.onPageHide=()=>this.flush('pagehide');
    this.documentTarget?.addEventListener?.('visibilitychange',this.onVisibility);
    this.windowTarget?.addEventListener?.('pagehide',this.onPageHide);
  }
  tick(){
    if(this.stopped)return 'stopped';
    if(this.pending){if(this.clock()-this.lastAt<4000)return 'saving';this.cancelPending();this.encodeVisual=null;this.lastAt=-Infinity;return this.backgroundSave();}
    if(this.clock()-this.lastAt<PUBLIC_BATTLE_CHECKPOINT_INTERVAL_MS)return 'throttled';
    return this.backgroundSave();
  }
  backgroundSave(){
    const work=this.scene?.paintZone?.paintWork;
    if(work?.pending){
      this.paintWaitAt??=this.clock();
      if(this.clock()-this.paintWaitAt<4000)return 'painting';
      // Progress must not starve forever on an overloaded device; this safety drain can cost a frame.
      work.drain();
    }
    this.paintWaitAt=null;
    return this.save(true);
  }
  cancelPending(){const job=this.pending;this.pending=null;job?.cancel?.();}
  flush(){this.cancelPending();return this.stopped?'stopped':this.save();}
  save(background=false){
    this.paintWaitAt=null;
    const checkpoint=this.capture();
    if(!checkpoint)return 'unstable';
    this.lastAt=this.clock();
    if(background&&this.encodeVisual&&checkpoint.worldVisual){
      const job={};this.pending=job;
      try{job.cancel=this.encodeVisual(checkpoint.worldVisual,(error,visualEncoded)=>{
        if(this.stopped||this.pending!==job)return;this.pending=null;
        if(error){this.encodeVisual=null;this.lastAt=-Infinity;this.backgroundSave();return;}
        this.handleStatus(this.write(checkpoint,{visualEncoded})?.status||'failed');
      });return 'saving';}catch{this.pending=null;this.encodeVisual=null;}
    }
    const status=this.write(checkpoint)?.status||'failed';
    return this.handleStatus(status);
  }
  handleStatus(status){
    if(status==='failed'||status==='invalid'){
      if(!this.failing)this.onFailure?.(status);
      this.failing=true;return 'failed';
    }
    if(status==='saved')this.failing=false;
    return status;
  }
  finish(result){
    this.destroy();
    if(isPublicSettlementSaved(result)&&result.runId)discardPublicBattleCheckpoint({expectedRunId:result.runId});
  }
  destroy(){
    this.stopped=true;
    this.cancelPending();
    this.documentTarget?.removeEventListener?.('visibilitychange',this.onVisibility);
    this.windowTarget?.removeEventListener?.('pagehide',this.onPageHide);
  }
}
