import test from 'node:test';import assert from 'node:assert/strict';
import {loadScenes,storageFixture,plain,createDocument} from './helpers/publicShellHarness.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
// B68 live: elites and the finale are closed halfway and resume at the same step. Real BattleScene role/finale methods,
// real Round/Encounter/Finale/PerformerRun controllers and PaintZone owner; only Phaser surfaces and the clock are fakes.
const Phaser={Scene:class{},Math:{Clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}};
const {BattleScene,PaintZoneSystem}=loadBattleScene({Phaser,document:createDocument(),includeOwners:true});
function env(){
  const storage=storageFixture(),e=loadScenes({storage});e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  const round=e.loadRuntime('utils/stage1PaintRound.mjs');
  return {e,storage,...e.loadRuntime('utils/publicBattleCheckpoint.mjs'),...e.loadRuntime('systems/PublicBattleCheckpoint.mjs'),
    PER_HIT:round.STAGE1_PAINT_PER_HIT,timer:round.STAGE1_PAINT_TIMER_MS};
}
function clock(now){
  const c={now,timers:[],
    delayedCall(ms,cb){const t={at:c.now+ms,cb,removed:false,fired:false,remove(){t.removed=true;},getRemaining:()=>Math.max(0,t.at-c.now)};
      c.timers.push(t);return t;},
    advance(ms){const end=c.now+ms;for(;;){const due=c.timers.filter(t=>!t.removed&&!t.fired&&t.at<=end).sort((x,y)=>x.at-y.at)[0];
      if(!due)break;c.now=due.at;due.fired=true;due.cb();}c.now=end;}};
  return c;
}
function graphics(){
  const o={active:true},chain=/^(set|fill|stroke|line|clear|begin|move|close|arc|translate|rotate|save|restore)/;
  const p=new Proxy(o,{get:(t,k)=>k==='destroy'?()=>{t.active=false;}:typeof k==='string'&&!(k in t)&&chain.test(k)?()=>p:t[k]});
  return p;
}
const sprite=(x,y)=>({x,y,active:true,scaleX:1,scaleY:1,body:{reset(){},updateFromGameObject(){}},
  setAlpha(){return this;},setDepth(){return this;},setPosition(x,y){this.x=x;this.y=y;return this;},destroy(){this.active=false;}});
const group=()=>({list:[],add(o){this.list.push(o);},getChildren(){return this.list.filter(o=>o.active);},
  children:{iterate(){}}});
function world(a,start,chapterId='opening',performerId='sakura'){
  const L=p=>a.e.loadRuntime(p),battleData={performerId,campaignChapterId:chapterId,stageId:1,practiceMode:false,defenseMode:false};
  const time=clock(start),awards=[],banners=[],completions=[];
  const scene=Object.assign(Object.create(BattleScene.prototype),{battleData,_userCastPresentation:true,_battleEnded:false,_battlePaused:false,
    time,oldStreet:null,actorPresentation:null,battleRecord:{playerHitCount:0},notices:[],_specialCharge:0,_encoreCharge:0,
    player:{x:500,y:900,hp:4,maxHp:5,active:true,body:{velocity:{x:0,y:0}},setPosition(x,y){this.x=x;this.y=y;return this;}},
    cameras:{main:{scrollX:312,scrollY:470,zoom:1,width:375,height:667,worldView:{x:312,y:470,width:375,height:667}}},
    physics:{add:{sprite}},add:{graphics},enemies:group(),enemyBullets:group(),
    _isPublicStage1Round:()=>true,_isFinaleTrialRound:()=>false,_configureCenteredArcadeCircle(){},_trackCombatObject:()=>true,
    _disposeEnemyProjectile(p){p.active=false;return true;},_awardPublicSakuraActionCharge(event){awards.push(event);},
    _showRoundBanner(text){banners.push(text);},_showPublicBattleNotice(text){this.notices.push(text);},_updateHUD(){},
    _removeFirstPlayHint(){},_getStage1WavePressureHorizontalVelocity:()=>0});
  scene.publicStage1Round=new (L('systems/PublicStage1RoundController.mjs').PublicStage1RoundController)(battleData);
  scene.publicStage1Encounter=new (L('systems/PublicStage1EncounterDirector.mjs').PublicStage1EncounterDirector)(battleData);
  scene.publicStage1Finale=new (L('systems/PublicStage1FinaleController.mjs').PublicStage1FinaleController)(battleData);
  scene.publicPerformerRun=new (L('systems/PublicStage1PerformerRun.mjs').PublicStage1PerformerRun)(scene);
  const side=new (L('utils/chapterSideSets.mjs').ChapterSideSet)(chapterId);
  const defs=[...a.e.campaign.getBattleChapter(battleData).devices,...side.definitions];
  scene.paintZone=Object.assign(Object.create(PaintZoneSystem.prototype),{scene,sideSet:side,chapterObjectives:null,currentZone:0,heat:0,
    burstUsed:0,gateOpen:false,complete:false,finaleMode:false,
    devices:defs.map(d=>({...d,label:null,paint:0,paintMax:d.paintMax||100,complete:false,paintColor:null,sequenceIndex:0,publicStage1Suppressed:false})),
    _redrawDevice(){},clearGate(){},onDeviceComplete:d=>completions.push(d.id),onProgress:()=>scene._updatePublicStage1Encounter()});
  return {scene,time,awards,banners,completions,run:scene.publicPerformerRun,zone:scene.paintZone,enc:scene.publicStage1Encounter,
    fin:scene.publicStage1Finale};
}
function begin(a,w){const now=w.run.now();
  assert.ok(w.scene.publicStage1Round.begin({now,durationMs:a.timer}));assert.ok(w.enc.begin({now}));}
// Paints the first `count` required facilities and resolves the roles that come before the wanted elite.
function progress(w,count,resolved){
  const required=w.zone.devices.filter(d=>d.required);
  for(const d of required.slice(0,count)){d.complete=true;d.paint=d.paintMax;}
  w.zone.currentZone=required[Math.min(count,required.length-1)].zone;w.zone.complete=count>=required.length;
  for(const role of resolved){w.enc.authoredRoles[role]={state:'resolved',outcome:'painted'};}
  w.enc.advance(w.run.now(),w.zone.getObjectiveProgress());
}
function roundTrip(a,dto,w){
  assert.equal(a.writePublicBattleCheckpoint(dto).status,'saved');
  const read=a.resolvePublicBattleResume({...w.scene.battleData,publicBattleResume:{runId:w.run.runId}});
  assert.equal(read.status,'ok');return read.checkpoint;
}
// BattleScene order: run state at create, 3-2-1 countdown (safety pause), round start, round state, round clock, live combat.
function resume(a,cp,start=60000){
  const b=world(a,start,cp.battle.chapterId,cp.battle.performerId);assert.ok(a.applyPublicBattleCheckpointRun(b.scene,cp));b.time.advance(3000);begin(a,b);
  assert.ok(a.applyPublicBattleCheckpointRound(b.scene,cp));b.scene._paintRoundEndsAt=b.scene.publicStage1Round.endsAt;
  return {...b,result:a.applyPublicBattleCheckpointCombat(b.scene,cp)};
}
const live=(w,role)=>w.scene.enemies.getChildren().filter(e=>e.publicStage1EnemyRole===role);

test('spotlight captain closed halfway through objective disruption resumes that step with HP, device and remaining time',()=>{
  const a=env(),w=world(a,1000);begin(a,w);progress(w,8,['stage-cue-emitter','objective-disruptor']);
  w.scene._updatePublicStage1Encounter();
  const captain=w.scene._publicStage1SpotlightCaptain;assert.ok(captain?.active,'real pending-role path spawns the captain');
  w.time.advance(900);assert.equal(captain.publicStage1CaptainSubphase,'objective-disruption');
  const device=captain.publicStage1ObjectiveDevice;assert.equal(device.publicStage1Suppressed,true);
  w.time.advance(700);captain.hp-=a.PER_HIT;Object.assign(w.scene.player,{x:520,y:880,hp:3});
  const dto=a.capturePublicBattleCheckpoint(w.scene,{savedAt:7});assert.ok(dto,'a live elite must not block the checkpoint');
  assert.deepEqual(plain(dto.combat.elites.map(e=>[e.role,e.state,e.subphase,e.stepMs,e.hp,e.deviceId])),
    [['spotlight-captain','disrupting','objective-disruption',800,captain.hp,device.id]]);
  assert.equal(Object.hasOwn(dto.encounter.roles,'spotlight-captain'),false);
  const b=resume(a,roundTrip(a,dto,w));
  assert.deepEqual(plain(b.result),{restored:['spotlight-captain'],respawn:[]});
  const restored=b.scene._publicStage1SpotlightCaptain;assert.deepEqual(live(b,'spotlight-captain'),[restored]);
  assert.deepEqual([restored.x,restored.y,restored.hp,restored.publicStage1CaptainSubphase],[captain.x,captain.y,captain.hp,'objective-disruption']);
  assert.equal(restored.publicStage1ObjectiveDevice.id,device.id);assert.equal(restored.publicStage1ObjectiveDevice.publicStage1Suppressed,true);
  assert.deepEqual([b.scene.player.x,b.scene.player.y,b.scene.player.hp],[520,880,3],'no free heal');
  assert.equal(b.enc.authoredRoles['spotlight-captain'].state,'active');assert.deepEqual(plain(b.enc.getPendingAuthoredRoles()),[]);
  b.scene._updatePublicStage1Encounter();assert.equal(live(b,'spotlight-captain').length,1,'no second captain from the pending-role path');
  assert.equal(b.banners.includes('聚光领舞'),false,'quiet reconstruction');
  b.time.advance(799);assert.equal(restored.publicStage1CaptainSubphase,'objective-disruption','remaining time, not a restarted step');
  b.time.advance(1);assert.equal(restored.publicStage1CaptainSubphase,'captured-cue');
  b.time.advance(800);assert.equal(restored.publicStage1CaptainSubphase,'recovery');assert.equal(b.scene.enemyBullets.getChildren().length,1);
  b.time.advance(2600);assert.equal(restored.active,false);
  assert.deepEqual(plain(b.enc.authoredRoles['spotlight-captain']),{state:'resolved',outcome:'encounter-complete'});
  assert.deepEqual([b.awards,b.completions],[[],[]],'restored progress never re-runs rewards');
});

test('finale closed halfway resumes at the same beat, weak points, boss and finale time without duplicate rewards',()=>{
  const a=env(),w=world(a,1000);begin(a,w);
  progress(w,10,['stage-cue-emitter','objective-disruptor','spotlight-captain']);
  for(const id of ['relay','echo'])if(w.run.pendingCheckpoint())w.run.growth.choose(id);
  assert.equal(w.scene._beginPublicStage1Finale(),true,'real finale entry');
  w.time.advance(800);const pulse=w.scene._publicStage1StageCuePulse;assert.ok(pulse?.active);
  w.scene._consumePublicStage1StageCuePulse(pulse,'timeout');w.time.advance(360);
  const weak=w.scene._publicStage1FinaleWeakPoint;assert.ok(weak?.active);weak.hp=0;w.scene._resolvePublicStage1FinaleWeakPoint(weak);
  w.time.advance(360);w.time.advance(400);
  assert.equal(w.awards.length,2);const boss=w.scene._publicStage1FinaleBoss;
  const dto=a.capturePublicBattleCheckpoint(w.scene);assert.ok(dto,'the finale must not block the checkpoint');
  const saved=dto.combat.finale;
  assert.deepEqual([saved.phase,saved.weakPointsResolved,saved.attackIndex,saved.responses.length,saved.boss.x,saved.boss.y],
    ['attack',1,1,1,boss.x,boss.y]);
  assert.equal(saved.remainingMs,w.fin.endsAt-w.run.now());
  const cp=roundTrip(a,dto,w),b=resume(a,cp);
  assert.deepEqual(plain(b.result),{restored:['finale'],respawn:[]});
  const state=b.fin.snapshot(b.run.now());
  assert.deepEqual([state.active,state.phase,state.weakPointsResolved,state.attackIndex,state.remainingMs],
    [true,'attack',1,1,saved.remainingMs],'finale time is rebased; closed time and the countdown are not spent');
  assert.deepEqual(plain(b.run.finaleResponses),plain(w.run.finaleResponses));
  assert.equal(b.enc.active,false);assert.equal(b.zone.finaleMode,true);assert.equal(b.scene._paintRoundEndsAt,null);
  assert.equal(live(b,'finale-boss').length,1);assert.equal(b.scene._beginPublicStage1Finale(),false,'no second finale entry');
  assert.equal(live(b,'finale-boss').length,1);assert.deepEqual(b.awards,[]);
  b.time.advance(800);const next=b.scene._publicStage1StageCuePulse;assert.ok(next?.active,'the current beat is re-telegraphed');
  b.scene._consumePublicStage1StageCuePulse(next,'timeout');
  assert.equal(b.awards.length,1);assert.deepEqual(plain(b.run.finaleResponses.map(r=>r.index)),[0,1],'no duplicate finale row');
  const recovery=JSON.parse(JSON.stringify(cp));
  Object.assign(recovery.combat.finale,{phase:'boss-recovery',weakPointsResolved:3,boss:{...saved.boss,hp:3*a.PER_HIT}});
  const c=resume(a,roundTrip(a,recovery,w)),cboss=c.scene._publicStage1FinaleBoss;
  assert.deepEqual([cboss.publicStage1EnemyState,cboss.hp,c.fin.snapshot(c.run.now()).phase],['recovery',3*a.PER_HIT,'boss-recovery']);
  assert.equal(c.scene._publicStage1FinaleWeakPoint??null,null);assert.deepEqual(c.awards,[]);
});

test('stage pulse and pending action beats do not block saving; bullets clear and telegraphs keep a safety window',()=>{
  const a=env(),w=world(a,1000);begin(a,w);progress(w,2,[]);
  w.scene._updatePublicStage1Encounter();const emitter=w.scene._publicStage1StageCueEmitter;assert.ok(emitter?.active);
  w.time.advance(800);assert.ok(w.scene._publicStage1StageCuePulse?.active);w.time.advance(1000);
  w.run.timers.add(w.time.delayedCall(300,()=>{}));w.run.dash={x:0,y:-1,endsAt:w.run.now()+100,lastX:500,lastY:900,power:1};
  const autosave=new a.PublicBattleCheckpointAutosave({scene:w.scene,clock:()=>w.time.now,documentTarget:null,windowTarget:null});
  assert.equal(autosave.tick(),'saved','saving continues during pulses and action beats');autosave.destroy();
  const dto=a.capturePublicBattleCheckpoint(w.scene);
  assert.deepEqual(plain(dto.combat.elites.map(e=>[e.role,e.state,e.stepMs])),[['stage-cue-emitter','recovery',1600]]);
  const cp=roundTrip(a,dto,w),b=resume(a,cp);
  assert.equal(b.scene.enemyBullets.getChildren().length,0);assert.equal(b.scene._publicStage1StageCuePulse??null,null);
  assert.deepEqual([b.run.timers.size,b.run.dash],[0,null],'beats in flight are dropped, never replayed');
  const restored=b.scene._publicStage1StageCueEmitter;assert.equal(restored.publicStage1EnemyState,'recovery');
  b.time.advance(1599);assert.equal(restored.active,true);b.time.advance(1);assert.equal(restored.active,false);
  assert.equal(b.enc.authoredRoles['stage-cue-emitter'].outcome,'recovery-complete');assert.deepEqual(b.awards,[]);
  const windup=JSON.parse(JSON.stringify(cp));Object.assign(windup.combat.elites[0],{state:'windup',stepMs:100});
  const c=resume(a,roundTrip(a,windup,w)),cue=c.scene._publicStage1StageCueEmitter;
  assert.equal(cue.publicStage1CueWindupTimer.getRemaining(),a.PUBLIC_BATTLE_RESUME_TELEGRAPH_MIN_MS);
  assert.ok(a.PUBLIC_BATTLE_RESUME_TELEGRAPH_MIN_MS>=600);assert.equal(c.scene.enemyBullets.getChildren().length,0);
});

test('v1 stays readable, unknown versions are explicit, tampered combat is corrupt and an unbuildable elite respawns once',()=>{
  const a=env(),w=world(a,1000);begin(a,w);progress(w,8,['stage-cue-emitter','objective-disruptor']);
  w.scene._updatePublicStage1Encounter();w.time.advance(900);
  const dto=a.capturePublicBattleCheckpoint(w.scene),KEY='starush.public-battle-checkpoint.v1';
  assert.equal(dto.version,3);
  const legacy={...JSON.parse(JSON.stringify(dto)),version:1};delete legacy.combat;
  delete legacy.player.encoreRemainingMs;
  a.storage.setItem(KEY,JSON.stringify(legacy));const read=a.readPublicBattleCheckpoint();
  assert.equal(read.status,'ok');assert.equal(read.summary.live,null);
  assert.deepEqual(plain(a.applyPublicBattleCheckpointCombat(w.scene,read.checkpoint)),{restored:[],respawn:[]});
  const elite=dto.combat.elites[0];
  for(const [value,status] of [[{...dto,version:4},'incompatible'],[{...legacy,combat:dto.combat},'corrupt'],
    [{...dto,combat:{...dto.combat,elites:[elite,elite]}},'corrupt'],[{...dto,combat:{...dto.combat,elites:[{...elite,hp:0}]}},'corrupt'],
    [{...dto,combat:{...dto.combat,elites:[{...elite,subphase:'recovery'}]}},'corrupt'],
    [{...dto,combat:{...dto.combat,elites:[{...elite,bullets:[]}]}},'corrupt'],
    [{...dto,encounter:{...dto.encounter,roles:{...dto.encounter.roles,'spotlight-captain':'painted'}}},'corrupt']]){
    const raw=JSON.stringify(value);a.storage.setItem(KEY,raw);
    assert.equal(a.readPublicBattleCheckpoint().status,status);assert.equal(a.storage.getItem(KEY),raw,'reading never deletes');
  }
  const cp=roundTrip(a,dto,w),b=world(a,60000);
  assert.ok(a.applyPublicBattleCheckpointRun(b.scene,cp));begin(a,b);
  b.scene._spawnPublicStage1SpotlightCaptain=()=>null;
  assert.ok(a.applyPublicBattleCheckpointRound(b.scene,cp));
  assert.deepEqual(plain(a.applyPublicBattleCheckpointCombat(b.scene,cp)),{restored:[],respawn:['spotlight-captain']});
  assert.equal(b.enc.authoredRoles['spotlight-captain'],undefined,'the role is pending again instead of stalling the finale gate');
  delete b.scene._spawnPublicStage1SpotlightCaptain;b.scene._updatePublicStage1Encounter();b.scene._updatePublicStage1Encounter();
  assert.equal(live(b,'spotlight-captain').length,1);assert.equal(b.enc.authoredRoles['spotlight-captain'].state,'active');
});

test('resumed Sakura from a Kai lobby gets the same combat member data as a fresh Sakura start',()=>{
  const a=env(),w=world(a,1000);begin(a,w);progress(w,2,[]);
  const dto=a.capturePublicBattleCheckpoint(w.scene);a.writePublicBattleCheckpoint(dto);
  const h=a.e.harness(a.e.TitleScene);h.scene.create();
  a.e.profile.selectPublicPerformer('sakura');const fresh=h.scene._buildRecommendedBattleData(new URLSearchParams());
  a.e.profile.selectPublicPerformer('kai');const lobby=h.scene._buildRecommendedBattleData(new URLSearchParams());
  assert.equal(lobby.team[0].id,'kai');
  assert.equal(h.scene._resumePublicBattle(),'ok');const data=h.starts.at(-1)[1];
  assert.deepEqual(plain(data.team[0]),plain(fresh.team[0]),'no Kai field leaks into the resumed Sakura member');
  for(const key of ['performerId','characterId','name','color','colorHex','level','atk'])assert.deepEqual(data[key],fresh[key],key);
  h.shutdown();
});

test('live ordinary chasers retain HP, position and a station guard instead of vanishing after reopening',()=>{
 const a=env();a.e.profile.recordPublicRun({runId:'unlock-neon-fixture',performerId:'sakura',chapterId:'opening',victory:true,choices:[],durationMs:20000});
 const w=world(a,1000,'neon');begin(a,w);progress(w,2,[]);
 const Motion=a.e.loadRuntime('utils/chapterChaserContent.mjs').ChapterChaserMotion;
 const enemy=sprite(580,960);Object.assign(enemy,{unlitBlob:true,hp:19,maxHp:36,publicStage1ReactionColor:'blue',moveVx:0,moveVy:0,
  chapterChaserMotion:new Motion('neon',-1,{x:620,y:960}),chapterStationGuard:w.zone.devices.find(d=>d.chapterSideSet)});
 Object.assign(enemy.chapterChaserMotion,{state:'recovery',stateAt:700});w.scene.enemies.add(enemy);
 const dto=a.capturePublicBattleCheckpoint(w.scene);assert.equal(dto.combat.chasers.length,1);
 assert.deepEqual(plain(dto.combat.chasers[0].motion),{side:-1,anchor:{x:620,y:960},state:'recovery',ageMs:300,path:null});
 const b=resume(a,roundTrip(a,dto,w));const restored=b.scene.enemies.getChildren().find(e=>e.unlitBlob);
 assert(restored,'a live guard must not silently disappear');assert.deepEqual([restored.x,restored.y,restored.hp],[580,960,19]);
 assert.equal(restored.chapterStationGuard.id,enemy.chapterStationGuard.id);assert.equal(restored.chapterChaserMotion.state,'recovery');
 assert.equal(b.run.now()-restored.chapterChaserMotion.stateAt,300);
});

test('BattleScene restores live combat after the round clock is set and before chasers are scheduled',async()=>{
  const {readFileSync}=await import('node:fs'),src=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
  const start=src.indexOf('\n  _beginPublicPaintRound('),body=src.slice(start,src.indexOf('\n  }\n',start));
  const at=body.indexOf('applyPublicBattleCheckpointCombat(');
  assert.ok(at>body.indexOf('this._paintRoundEndsAt =')&&at<body.indexOf('this._scheduleNextUnlitSpawn(700)'));
  assert.ok(body.indexOf('applyPublicBattleCheckpointRound(')<body.indexOf('this._paintRoundEndsAt ='));
});

function releaseEncore(w){
  const effects=[];
  w.scene._battlePerformerContract={publicActionOwnerId:w.run.member.id};w.scene._encoreCharge=100;
  w.scene.paintZone.burstRelight=()=>effects.push('paint');
  w.scene._spawnPaintEncoreBurst=()=>effects.push('cutin');
  w.scene.p17Audio={playEncore:()=>effects.push('audio')};
  assert.equal(w.scene._triggerPublicRelightBurst(),true,'real guarded release, not an injected buff');
  assert.deepEqual(effects,['audio','paint','cutin']);return effects;
}

test('Encore capture/storage/post-countdown resume preserves only remaining boost, for all three members',()=>{
 for(const id of ['sakura','kai','enjo']){
  const a=env(),w=world(a,1000,'opening',id);begin(a,w);const effects=releaseEncore(w);
  w.time.advance(1250);w.run.pauseClock();w.scene._battlePaused=true;
  w.time.advance(60000);
  const dto=a.capturePublicBattleCheckpoint(w.scene,{savedAt:1});
  assert.equal(dto.version,3);assert.equal(dto.player.encoreRemainingMs,3750,'paused time is not spent');
  assert.equal(dto.player.encoreCharge,0);const cp=roundTrip(a,dto,w),b=world(a,50,'opening',id);
  w.run.resumeClock();w.scene._battlePaused=false;w.time.advance(3749);assert(w.scene._updatePublicSakuraEncoreWindow());
  w.time.advance(1);assert.equal(w.scene._updatePublicSakuraEncoreWindow(),false,'same paused run expires after its remaining game time');
  b.scene._publicSakuraEncoreEndsAt=999999;
  assert(a.applyPublicBattleCheckpointRun(b.scene,cp));assert.equal(b.scene._publicSakuraEncoreEndsAt,null,'no stale or early boost during countdown');
  b.time.advance(3000);begin(a,b);assert(a.applyPublicBattleCheckpointRound(b.scene,cp));
  assert.equal(b.scene._publicSakuraEncoreEndsAt-b.run.now(),3750);
  assert(b.scene._isPublicSakuraEncoreWindowActive());assert.equal(b.scene._triggerPublicRelightBurst(),false,'no free release');
  assert.equal(b.run.runId,w.run.runId);assert.equal(b.scene.player.hp,w.scene.player.hp);assert.equal(b.scene._encoreCharge,0);
  assert.deepEqual(b.banners,[],'resume never replays Encore/banner/audio/paint/cutin');assert.deepEqual(effects,['audio','paint','cutin']);
  assert.deepEqual(b.awards,[]);assert.deepEqual(b.completions,[]);
  b.time.advance(1000);b.run.pauseClock();b.time.advance(30000);
  const again=a.capturePublicBattleCheckpoint(b.scene);assert.equal(again.player.encoreRemainingMs,2750);
  const c=resume(a,roundTrip(a,again,b),90000);assert.equal(c.scene._publicSakuraEncoreEndsAt-c.run.now(),2750,'second close never restarts five seconds');
  c.time.advance(2749);assert(c.scene._updatePublicSakuraEncoreWindow());c.time.advance(1);
  assert.equal(c.scene._updatePublicSakuraEncoreWindow(),false);assert.equal(c.scene._publicSakuraEncoreEndsAt,null);
  assert.equal(a.capturePublicBattleCheckpoint(c.scene).player.encoreRemainingMs,0);
 }
});

test('v3 duration is required, finite and bounded; malformed reads/writes preserve existing storage',()=>{
 const a=env(),w=world(a,1000);begin(a,w);releaseEncore(w);const dto=a.capturePublicBattleCheckpoint(w.scene);
 assert.equal(a.writePublicBattleCheckpoint(dto).status,'saved');const key='starush.public-battle-checkpoint.v1',good=a.storage.getItem(key);
 for(const value of [-1,5000.01,Infinity,NaN,'5000',null,undefined]){
  const bad={...dto,version:3,player:{...dto.player,encoreRemainingMs:value}};
  assert.equal(a.writePublicBattleCheckpoint(bad).status,'invalid');assert.equal(a.storage.getItem(key),good);
  const raw=JSON.stringify(bad);a.storage.setItem(key,raw);assert.equal(a.readPublicBattleCheckpoint().status,'corrupt');
  assert.equal(a.storage.getItem(key),raw);a.storage.setItem(key,good);
 }
 for(const value of [0,0.5,5000])assert.equal(a.writePublicBattleCheckpoint({...dto,version:3,player:{...dto.player,encoreRemainingMs:value}}).status,'saved');
});

test('strict legacy v1/v2 reads keep their raw bytes and live combat without inventing a boost',()=>{
 const a=env(),w=world(a,1000);begin(a,w);releaseEncore(w);const dto=a.capturePublicBattleCheckpoint(w.scene),key='starush.public-battle-checkpoint.v1';
 for(const version of [1,2]){
  const old=JSON.parse(JSON.stringify(dto));old.version=version;delete old.player.encoreRemainingMs;if(version===1)delete old.combat;
  const raw=JSON.stringify(old);a.storage.setItem(key,raw);const read=a.readPublicBattleCheckpoint();assert.equal(read.status,'ok');
  assert.equal(a.storage.getItem(key),raw);assert.equal(Object.hasOwn(read.checkpoint,'combat'),version===2);
  const b=world(a,90000);b.scene._publicSakuraEncoreEndsAt=999999;assert(a.applyPublicBattleCheckpointRun(b.scene,read.checkpoint));
  assert.equal(b.scene._publicSakuraEncoreEndsAt,null);begin(a,b);assert(a.applyPublicBattleCheckpointRound(b.scene,read.checkpoint));
  assert.equal(b.scene._isPublicSakuraEncoreWindowActive(),false);assert.equal(b.scene._publicSakuraEncoreEndsAt,null);
  old.player.encoreRemainingMs=5000;a.storage.setItem(key,JSON.stringify(old));assert.equal(a.readPublicBattleCheckpoint().status,'corrupt','old schema cannot smuggle a new field');
 }
});

test('capture clamps stale or nonfinite expiry and restore does not replay expired Encore',()=>{
 const a=env(),w=world(a,1000);begin(a,w);
 for(const [ends,remaining]of [[null,0],[undefined,0],[NaN,0],[Infinity,0],[999,0],[1000,0],[1000.5,0.5],[6000,5000],[999999,5000]]){
  w.scene._publicSakuraEncoreEndsAt=ends;assert.equal(a.capturePublicBattleCheckpoint(w.scene).player.encoreRemainingMs,remaining);
 }
 w.scene._publicSakuraEncoreEndsAt=1000;const cp=roundTrip(a,a.capturePublicBattleCheckpoint(w.scene),w),b=resume(a,cp);
 assert.equal(b.scene._publicSakuraEncoreEndsAt,null);assert.equal(b.scene._isPublicSakuraEncoreWindowActive(),false);
});

test('legacy v2 restores a real active elite and active finale, not just an empty combat block',()=>{
 for(const kind of ['elite','finale']){
  const a=env(),w=world(a,1000);begin(a,w);
  if(kind==='elite'){
   progress(w,8,['stage-cue-emitter','objective-disruptor']);w.scene._updatePublicStage1Encounter();w.time.advance(900);
   assert(w.scene._publicStage1SpotlightCaptain?.active);
  }else{
   progress(w,10,['stage-cue-emitter','objective-disruptor','spotlight-captain']);
   for(const id of ['relay','echo'])if(w.run.pendingCheckpoint())w.run.growth.choose(id);
   assert(w.scene._beginPublicStage1Finale());w.time.advance(800);assert(w.scene._publicStage1FinaleBoss?.active);
  }
  const old=JSON.parse(JSON.stringify(a.capturePublicBattleCheckpoint(w.scene)));old.version=2;delete old.player.encoreRemainingMs;
  const cp=roundTrip(a,old,w),b=resume(a,cp);
  if(kind==='elite'){
   const saved=old.combat.elites[0],enemy=b.scene._publicStage1SpotlightCaptain;
   assert.deepEqual(plain(b.result),{restored:['spotlight-captain'],respawn:[]});assert.equal(enemy.hp,saved.hp);
   assert.equal(enemy.publicStage1CaptainSubphase,saved.subphase);assert.equal(enemy.publicStage1CaptainDisruptionTimer.getRemaining(),saved.stepMs);
  }else{
   assert.deepEqual(plain(b.result),{restored:['finale'],respawn:[]});assert.equal(b.scene._publicStage1FinaleBoss.hp,old.combat.finale.boss.hp);
   assert.equal(b.fin.snapshot(b.run.now()).remainingMs,old.combat.finale.remainingMs);
   assert.equal(b.fin.phase,old.combat.finale.phase);
  }
  assert.equal(b.scene._isPublicSakuraEncoreWindowActive(),false);assert.deepEqual(b.awards,[]);
 }
});
