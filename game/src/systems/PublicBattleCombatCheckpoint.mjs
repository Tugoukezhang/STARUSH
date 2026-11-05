import {ChapterChaserMotion} from '../utils/chapterChaserContent.mjs';
import {STAGE1_UNLIT_HP} from '../utils/stage1PaintRound.mjs';
export const PUBLIC_BATTLE_RESUME_TELEGRAPH_MIN_MS=600;
const OWNERS={
 'spotlight-captain':['_publicStage1SpotlightCaptain','_spawnPublicStage1SpotlightCaptain'],
 'stage-cue-emitter':['_publicStage1StageCueEmitter','_spawnPublicStage1StageCueEmitter'],
 'objective-disruptor':['_publicStage1ObjectiveDisruptor','_spawnPublicStage1ObjectiveDisruptor'],
};
const TIMERS={
 'spotlight-captain':{entrance:'publicStage1CaptainIntroTimer','objective-disruption':'publicStage1CaptainDisruptionTimer','captured-cue':'publicStage1CaptainCueTimer',recovery:'publicStage1CaptainRecoveryTimer'},
 'stage-cue-emitter':{windup:'publicStage1CueWindupTimer',recovery:'publicStage1CueRecoveryTimer'},
 'objective-disruptor':{windup:'publicStage1ObjectiveWindupTimer',disrupting:'publicStage1ObjectiveSuppressionTimer'},
};
const remaining=timer=>Math.max(0,Number(timer?.getRemaining?.())||0);
const pendingSpawnTimers=new WeakMap();
const capturePoint=e=>Number.isFinite(e?.capturedX+e?.capturedY)?{x:e.capturedX,y:e.capturedY}:null;
export function capturePublicBattleCombat(scene){
 const elites=[];
 for(const [role,[owner]]of Object.entries(OWNERS)){
  const enemy=scene[owner];if(!enemy?.active)continue;
  const subphase=enemy.publicStage1CaptainSubphase||null,state=enemy.publicStage1EnemyState;
  elites.push({role,x:enemy.x,y:enemy.y,hp:enemy.hp,state,subphase,
   deviceId:enemy.publicStage1ObjectiveDevice?.id??null,remote:enemy.publicChapterRemoteRelay===true,
   cueInterrupted:enemy.publicStage1ChapterCueInterrupted===true,capture:capturePoint(enemy.publicStage1CueCapture),
   pattern:enemy.publicStage1EncounterPattern??null,stepMs:remaining(enemy[TIMERS[role][subphase||state]])});
 }
 const fin=scene.publicStage1Finale,boss=scene._publicStage1FinaleBoss;
 const finale=fin?.active&&boss?.active?{phase:fin.phase,remainingMs:Math.max(0,fin.endsAt-scene.publicPerformerRun.now()),
  weakPointCount:fin.weakPointCount,weakPointsResolved:fin.weakPointsResolved,attackIndex:fin.attackIndex,
  lastAttackOutcome:fin.lastAttackOutcome,boss:{x:boss.x,y:boss.y,hp:boss.hp},
  weakPointHp:scene._publicStage1FinaleWeakPoint?.active?scene._publicStage1FinaleWeakPoint.hp:null,
  responses:scene.publicPerformerRun.finaleResponses.map(row=>({...row}))}:null;
 const chasers=finale?[]:(scene.enemies?.getChildren?.()||[]).filter(e=>e.active&&e.unlitBlob).map(e=>{
  const m=e.chapterChaserMotion;
  return {x:e.x,y:e.y,hp:e.hp,color:e.publicStage1ReactionColor??null,vx:e.moveVx||0,vy:e.moveVy||0,
   guardId:e.chapterStationGuard?.id??null,motion:m?{side:m.side,anchor:m.anchor?{...m.anchor}:null,state:m.state,
    ageMs:Math.max(0,scene.publicPerformerRun.now()-m.stateAt),path:m.path?JSON.parse(JSON.stringify(m.path)):null}:null};
 });
 return {elites,finale,chasers,spawnTimers:pendingSpawnTimers.get(scene)||{
  unlitMs:scene._unlitSpawnTimer?.getRemaining?remaining(scene._unlitSpawnTimer):null,
  danmakuMs:scene.paintZone?.danmakuTimer?.getRemaining?remaining(scene.paintZone.danmakuTimer):null,
 }};
}
function restoreSpawnTimers(scene,saved){
 const events=scene.events;if(!events?.once)return;
 pendingSpawnTimers.set(scene,saved);
 const cancel=()=>{events.off('preupdate',restore);pendingSpawnTimers.delete(scene);};
 const restore=()=>{
  events.off('shutdown',cancel);
  pendingSpawnTimers.delete(scene);
  if(scene._battleEnded||scene.paintZone?.finaleMode)return;
  for(const [parent,key,ms]of [[scene,'_unlitSpawnTimer',saved.unlitMs],[scene.paintZone,'danmakuTimer',saved.danmakuMs]]){
   const timer=parent?.[key];if(!timer)continue;
   if(ms===null){timer.remove(false);parent[key]=null;}
   else timer.elapsed=timer.delay-ms;
  }
 };
 // BattleScene schedules unlit after this restore call; preupdate runs before Clock.update.
 // Keep delay/callback/repeat intact, including when a saved wait exceeds the startup delay.
 events.once('preupdate',restore);events.once('shutdown',cancel);
}
function restoreChaser(scene,saved){
 const e=scene.physics.add.sprite(saved.x,saved.y,'__DEFAULT');e.setAlpha(0);e.setDepth(3);
 e.body.moves=false;e.body.allowGravity=false;scene._configureCenteredArcadeCircle(e,12);
 Object.assign(e,{unlitBlob:true,type:'unlit',publicStage1EnemyRole:'unlit-chaser',drawRadius:12,hp:saved.hp,maxHp:STAGE1_UNLIT_HP,
  score:40,supportValueOverride:4,publicStage1ReactionColor:saved.color,moveVx:saved.vx,moveVy:saved.vy});
 e.gfx=scene.add.graphics().setDepth(3.2);e.gfx.setPosition(e.x-12,e.y-12);
 scene._drawUnlitBlobGfx(e.gfx,0xc9cdd6,1-e.hp/e.maxHp,saved.color);
 if(saved.motion){
  const m=saved.motion;e.chapterChaserMotion=new ChapterChaserMotion(scene.battleData.campaignChapterId,m.side,m.anchor);
  Object.assign(e.chapterChaserMotion,{state:m.state,stateAt:scene.publicPerformerRun.now()-m.ageMs,path:m.path});
  if(['windup','rush'].includes(m.state)){e.chapterChaserMotion.state='windup';e.chapterChaserMotion.stateAt=scene.publicPerformerRun.now();}
  e.publicStage1EnemyState=e.chapterChaserMotion.state;e.gfx.chapterChaserState=e.publicStage1EnemyState;
  e.chapterStationGuard=scene.paintZone.devices.find(d=>d.id===saved.guardId)||null;
  e.gfx.once?.('destroy',()=>{e.chapterChaserMotion.dispose();e.chapterChaserCue?.destroy?.();e.chapterChaserCue=null;});
 }else{
  e.chaseTimer=scene.time.addEvent({delay:720,loop:true,callback:()=>{
   if(!e.active||!scene.player)return;const dx=scene.player.x-e.x,dy=scene.player.y-e.y,n=Math.hypot(dx,dy)||1;
   e.moveVx=dx/n*48;e.moveVy=dy/n*48;
  }});
 }
 scene.enemies.add(e);return e;
}
function replaceTimer(scene,enemy,key,ms,callback){
 enemy[key]?.remove?.(false);enemy[key]=scene.time.delayedCall(Math.max(0,ms),callback);
}
function restoreElite(scene,saved){
 const [owner,spawn]=OWNERS[saved.role],enemy=scene[spawn]?.(saved);if(!enemy)return false;
 for(const timer of Object.values(TIMERS[saved.role])){enemy[timer]?.remove?.(false);enemy[timer]=null;}
 enemy.setPosition(saved.x,saved.y);enemy.body?.updateFromGameObject?.();enemy.gfx?.setPosition(saved.x,saved.y);
 enemy.hp=Math.min(enemy.maxHp,saved.hp);enemy.publicChapterRemoteRelay=saved.remote;
 enemy.publicStage1ChapterCueInterrupted=saved.cueInterrupted;
 enemy.publicStage1ObjectiveDevice=scene.paintZone.devices.find(d=>d.id===saved.deviceId)||null;
 if(saved.capture)enemy.publicStage1CueCapture={capturedX:saved.capture.x,capturedY:saved.capture.y};
 enemy.publicStage1EncounterPattern=saved.pattern;
 const safe=saved.state==='windup'?Math.max(PUBLIC_BATTLE_RESUME_TELEGRAPH_MIN_MS,saved.stepMs):saved.stepMs;
 if(saved.role==='spotlight-captain'){
  if(saved.subphase==='objective-disruption'){
   scene._beginPublicStage1SpotlightCaptainDisruption(enemy);
   replaceTimer(scene,enemy,'publicStage1CaptainDisruptionTimer',safe,()=>scene._beginPublicStage1SpotlightCaptainCue(enemy));
  }else if(saved.subphase==='captured-cue'){
   scene._beginPublicStage1SpotlightCaptainCue(enemy,enemy.publicStage1CueCapture);
   replaceTimer(scene,enemy,'publicStage1CaptainCueTimer',safe,()=>scene._releasePublicStage1SpotlightCaptainCue(enemy));
  }else if(saved.subphase==='recovery'){
   replaceTimer(scene,enemy,'publicStage1CaptainRecoveryTimer',safe,()=>scene._clearPublicStage1SpotlightCaptain('encounter-complete',{preservePulse:true}));
  }else replaceTimer(scene,enemy,'publicStage1CaptainIntroTimer',safe,()=>scene._beginPublicStage1SpotlightCaptainDisruption(enemy));
  enemy.publicStage1CaptainSubphase=saved.subphase;
 }else if(saved.role==='objective-disruptor'){
  if(saved.state==='disrupting'){
   scene._activatePublicStage1ObjectiveDisruptor(enemy);
   replaceTimer(scene,enemy,'publicStage1ObjectiveSuppressionTimer',safe,()=>scene._clearPublicStage1ObjectiveDisruptor('window-expired'));
  }else replaceTimer(scene,enemy,'publicStage1ObjectiveWindupTimer',safe,()=>scene._activatePublicStage1ObjectiveDisruptor(enemy));
 }else if(saved.state==='recovery'){
  enemy.publicStage1CueLine?.destroy?.();enemy.publicStage1CueLine=null;
  replaceTimer(scene,enemy,'publicStage1CueRecoveryTimer',safe,()=>scene._clearPublicStage1StageCueEmitter('recovery-complete',{preservePulse:true}));
 }else{
  if(enemy.publicStage1CueLine){delete enemy.publicStage1CueLine.publicAttackCapture;scene._drawPublicStage1AttackCue(enemy.publicStage1CueLine,enemy);}
  replaceTimer(scene,enemy,'publicStage1CueWindupTimer',safe,()=>scene._releasePublicStage1StageCueEmitter(enemy));
 }
 enemy.publicStage1EnemyState=saved.state;enemy.gfx?.clear?.();
 const ratio=1-enemy.hp/enemy.maxHp;
 if(saved.role==='spotlight-captain')scene._drawPublicStage1SpotlightCaptainGfx(enemy.gfx,saved.state,ratio,saved.subphase);
 else if(saved.role==='objective-disruptor')scene._drawPublicStage1ObjectiveDisruptorGfx(enemy.gfx,saved.state,ratio);
 else scene._drawPublicStage1StageCueEmitterGfx(enemy.gfx,saved.state,ratio);
 scene.publicStage1Encounter.authoredRoles[saved.role]={state:'active',outcome:null};return true;
}
function restoreFinale(scene,saved){
 const run=scene.publicPerformerRun,fin=scene.publicStage1Finale,now=run.now();
 if(!fin.begin({now,durationMs:Math.max(1,saved.remainingMs),weakPointCount:saved.weakPointCount}))return false;
 Object.assign(fin,{phase:saved.phase,weakPointsResolved:saved.weakPointsResolved,attackIndex:saved.attackIndex,lastAttackOutcome:saved.lastAttackOutcome});
 scene.publicStage1Encounter.reset();scene.paintZone.enterFinaleMode();scene._paintRoundEndsAt=null;
 for(const [parent,key]of [[scene,'_unlitSpawnTimer'],[scene.paintZone,'danmakuTimer']]){parent[key]?.remove?.(false);parent[key]=null;}
 scene._clearUnlitBlobs?.();scene._publicStage1FinaleOutcome='active';
 run.finaleResponses=saved.responses.map(r=>({...r}));
 const boss=scene._spawnPublicStage1FinaleBoss();if(!boss)return false;
 boss.setPosition(saved.boss.x,saved.boss.y);boss.body?.updateFromGameObject?.();boss.gfx?.setPosition(boss.x,boss.y);boss.hp=Math.min(boss.maxHp,saved.boss.hp);
 if(saved.phase==='attack')scene._startPublicStage1FinaleAttack();
 else if(saved.phase==='weak-point'){
  const weak=scene._spawnPublicStage1FinaleWeakPoint(saved.weakPointsResolved);
  if(weak&&saved.weakPointHp!==null)weak.hp=Math.min(weak.maxHp,saved.weakPointHp);
 }else scene._openPublicStage1FinaleBossRecovery();
 scene._syncPublicStage1FinaleHud?.();return true;
}
export function applyPublicBattleCheckpointCombat(scene,checkpoint){
 const result={restored:[],respawn:[]},combat=checkpoint.combat;if(!combat)return result;
 if(combat.finale){if(restoreFinale(scene,combat.finale))result.restored.push('finale');return result;}
 for(const saved of combat.elites){
  if(restoreElite(scene,saved))result.restored.push(saved.role);
  else{delete scene.publicStage1Encounter.authoredRoles[saved.role];result.respawn.push(saved.role);}
 }
 for(const saved of combat.chasers||[])restoreChaser(scene,saved);
 if(combat.chasers?.length)result.restored.push('chasers');
 if(combat.spawnTimers)restoreSpawnTimers(scene,combat.spawnTimers);
 return result;
}
