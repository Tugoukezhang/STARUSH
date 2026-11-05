import test from 'node:test';import assert from 'node:assert/strict';
import {loadScenes,storageFixture,plain} from './helpers/publicShellHarness.mjs';
// B68: separate mid-battle checkpoint storage; the completed profile stays authoritative and untouched.
const KEY='starush.public-battle-checkpoint.v1',PROFILE='starush.public-profile';
function api(storage=storageFixture()){
  const e=loadScenes({storage});
  return {e,storage,...e.loadRuntime('utils/publicBattleCheckpoint.mjs'),ruleset:e.loadRuntime('utils/releaseIdentity.mjs').PUBLIC_RULESET_ID};
}
function checkpoint(ruleset,over={}){return {kind:'starush.public-battle-checkpoint',version:1,rulesetId:ruleset,savedAt:1700000000000,runId:'run-b68',
  battle:{performerId:'sakura',chapterId:'opening',preparation:null,runGoal:null,routePlan:null,arrangementPlan:null},
  run:{elapsedMs:20000,choices:[],shotCount:0,checkpoints:0,actions:2,impacts:5,modificationReleases:0,
    choiceEffects:{relay:0,echo:0,tempo:0,recovery:0},encounterEvent:null,goalMissedNotice:false},
  player:{x:480,y:900,hp:3,specialCharge:40,encoreCharge:10,hitCount:2,feverActive:false,relightBurstPlayed:false},
  round:{remainingMs:70000},
  encounter:{elapsedMs:20000,currentPhaseId:'movement-build',phaseEnteredAtMs:12000,northEntered:false,lastEmitterAtMs:18000,
    lastEmitterPhaseId:'movement-build',lastDisruptorAtMs:null,lastDisruptorPhaseId:null,captainClaimed:false,
    roles:{'stage-cue-emitter':'painted'},event:null},
  paint:{zone:0,heat:3,burstUsed:0,complete:false,sideSelected:[null,null],
    devices:[{id:'oldstreet-welcome',paint:52,color:'pink',sequenceIndex:0,complete:true,calibrating:false,calibrationMs:0}]},
  street:{opened:[],restored:[],finaleAnnounced:false,storyOffered:false,stationGuards:[]},...over};}
function eventTarget(extra={}){const l=new Map();return Object.assign(extra,{
  addEventListener(t,f){if(!l.has(t))l.set(t,new Set());l.get(t).add(f);},removeEventListener(t,f){l.get(t)?.delete(f);},
  fire(t){for(const f of [...(l.get(t)||[])])f({type:t});},count(t){return l.get(t)?.size||0;}});}

test('resume rejects every explicit trial marker without rewriting a valid campaign checkpoint',()=>{
 const a=api(),dto=checkpoint(a.ruleset);assert.equal(a.writePublicBattleCheckpoint(dto).status,'saved');
 const raw=a.storage.getItem(KEY),data=a.withPublicBattleCheckpointData({stageId:1},dto,{});
 assert.equal(a.resolvePublicBattleResume(data).status,'ok');
 for(const marker of [null,false,undefined,{},[]]){
  assert.equal(a.resolvePublicBattleResume({...data,publicFinaleTrial:marker}).reason,'not-public');
  assert.equal(a.storage.getItem(KEY),raw);
 }
});

test('rules16 reads validated rules13/14/15 checkpoints without rewriting original bytes',()=>{
 const a=api();a.e.profile.selectPublicPerformer('kai');const profile=a.storage.getItem(PROFILE);
 for(const [oldRules,version] of ['owner-three-chapter-v13','owner-three-chapter-v14','owner-three-chapter-v15','owner-three-chapter-v16'].flatMap(id=>[1,2].map(v=>[id,v]))){
  const dto=checkpoint(oldRules,{version,...(version===2?{combat:{elites:[],finale:null}}:{})});
  const raw=JSON.stringify(dto);a.storage.setItem(KEY,raw);
  const read=a.readPublicBattleCheckpoint();assert.equal(read.status,'ok');assert.equal(read.checkpoint.rulesetId,oldRules);
  assert.deepEqual(plain(read.checkpoint),dto);assert.equal(a.getPublicBattleCheckpointAvailability().available,true);
  assert.equal(a.storage.getItem(KEY),raw);assert.equal(a.storage.getItem(PROFILE),profile);
  assert.equal(a.writePublicBattleCheckpoint(read.checkpoint).status,'invalid','only a current runtime capture may write rules14');
  assert.equal(a.storage.getItem(KEY),raw);
  const next={...dto,rulesetId:a.ruleset};assert.equal(a.writePublicBattleCheckpoint(next).status,'saved');
  assert.equal(JSON.parse(a.storage.getItem(KEY)).rulesetId,a.ruleset);assert.equal(a.storage.getItem(PROFILE),profile);
 }
});

test('previous-rules compatibility never accepts corrupted, foreign or already-recorded runs',()=>{
 const a=api(),old=checkpoint('owner-three-chapter-v13');
 for(const [dto,status]of [[{...old,extra:1},'corrupt'],[{...old,player:{...old.player,hp:0}},'corrupt'],
  [{...old,rulesetId:'owner-three-chapter-v12'},'incompatible'],[{...old,version:4},'incompatible']]){
  const raw=JSON.stringify(dto);a.storage.setItem(KEY,raw);assert.equal(a.readPublicBattleCheckpoint().status,status);assert.equal(a.storage.getItem(KEY),raw);
 }
 a.storage.setItem(KEY,JSON.stringify(old));a.e.profile.recordPublicRun({runId:old.runId,performerId:'sakura',chapterId:'opening',victory:false,choices:[],durationMs:20000});
 assert.equal(a.readPublicBattleCheckpoint().status,'already-recorded');
});

test('rules13 handoff preserves east route, planned choices and goal in actual current run and Boss owners',()=>{
 const a=api();a.e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 const bind={version:1,performerId:'sakura',chapterId:'opening',rulesetId:'owner-three-chapter-v13'};
 const old=checkpoint(bind.rulesetId);Object.assign(old.battle,{routePlan:{...bind,id:'east'},
  arrangementPlan:{...bind,choices:['relay','echo']},runGoal:{...bind,kind:'steady',target:2}});
 const raw=JSON.stringify(old);a.storage.setItem(KEY,raw);const cp=a.readPublicBattleCheckpoint().checkpoint;
 const data=a.withPublicBattleCheckpointData({stageId:1},cp,{});
 const Run=a.e.loadRuntime('systems/PublicStage1PerformerRun.mjs').PublicStage1PerformerRun;
 const run=new Run({_userCastPresentation:true,battleData:data,time:{now:1}});
 assert.equal(run.routePlan?.id,'east');assert.deepEqual(plain(run.arrangementPlan?.choices),['relay','echo']);
 assert.equal(run.runGoal?.target,2);assert.equal(run.runGoal?.kind,'steady');
 for(const value of [run.routePlan,run.arrangementPlan,run.runGoal])assert.equal(value.rulesetId,a.ruleset);
 const Finale=a.e.loadRuntime('systems/PublicStage1FinaleController.mjs').PublicStage1FinaleController;
 const east=new Finale(data),normal=new Finale({...data,publicRoutePlan:null});
 assert.equal(east.attackPatterns[0],normal.attackPatterns[1]);
 assert.equal(a.resolvePublicBattleResume(data).status,'ok');assert.equal(a.storage.getItem(KEY),raw);
 assert.equal(cp.battle.routePlan.rulesetId,bind.rulesetId,'never rewrite the original DTO or sidecar hash input');
 for(const field of ['routePlan','arrangementPlan','runGoal']){
  const bad=structuredClone(old);bad.battle[field].performerId='kai';
  const h=a.withPublicBattleCheckpointData({stageId:1},bad,{});
  const r=new Run({_userCastPresentation:true,battleData:h,time:{now:1}});
  assert.equal(r[field],null,'foreign member binding cannot be upgraded');
 }
});

test('rules13 compatibility keeps the visual sidecar bound to the exact original checkpoint text',()=>{
 const a=api(),old=checkpoint('owner-three-chapter-v13',{version:2,combat:{elites:[],finale:null}}),raw=JSON.stringify(old);
 const pixels=new Uint8Array([10,20,30,255,40,50,60,255,70,80,90,255,100,110,120,255]);
 a.e.loadRuntime('utils/publicBattleVisual.mjs').stagePublicBattleVisual(a.storage,raw,[{id:'ground:pixels',width:2,height:2,bytes:pixels}],KEY);
 a.storage.setItem(KEY,raw);const slots=['starush.public-battle-visual.0','starush.public-battle-visual.1'].map(k=>a.storage.getItem(k));
 const read=a.readPublicBattleCheckpoint();assert.equal(read.status,'ok');
 assert.deepEqual([...read.checkpoint.worldVisual[0].bytes],[...pixels]);
 a.withPublicBattleCheckpointData({stageId:1},read.checkpoint,{});
 assert.equal(a.storage.getItem(KEY),raw);assert.deepEqual(['starush.public-battle-visual.0','starush.public-battle-visual.1'].map(k=>a.storage.getItem(k)),slots);
 assert.deepEqual([...a.readPublicBattleCheckpoint().checkpoint.worldVisual[0].bytes],[...pixels]);
});

test('write uses its own key, leaves the completed profile byte-identical and reads back the same DTO',()=>{
  const a=api();a.e.profile.selectPublicPerformer('kai');const before=a.storage.getItem(PROFILE);assert.ok(before);
  const dto=checkpoint(a.ruleset);
  assert.equal(a.writePublicBattleCheckpoint(dto).status,'saved');
  assert.equal(a.storage.getItem(PROFILE),before);
  const read=a.readPublicBattleCheckpoint();assert.equal(read.status,'ok');assert.deepEqual(plain(read.checkpoint),dto);
  const total=a.e.campaign.getPublicChapter('opening').devices.filter(d=>d.required===true).length;
  assert.deepEqual(plain(read.summary),{runId:'run-b68',performerId:'sakura',chapterId:'opening',savedAt:1700000000000,elapsedMs:20000,hp:3,completed:1,total,live:null});
  assert.deepEqual(plain(a.getPublicBattleCheckpointAvailability()),{available:true,status:'ok',summary:plain(read.summary)});
  assert.equal(a.getPublicBattleCheckpointStatus().state,'saved');
});

test('actual checkpoint finish requires a consistent new settlement receipt before discarding the matching run',()=>{
 const a=api(),dto=checkpoint(a.ruleset);assert.equal(a.writePublicBattleCheckpoint(dto).status,'saved');const raw=a.storage.getItem(KEY),Auto=a.e.loadRuntime('systems/PublicBattleCheckpoint.mjs').PublicBattleCheckpointAutosave;
 const receipt={version:1,modeId:'campaign',runId:dto.runId,performerId:'sakura',chapterId:'opening',status:'saved'};
 const result={runId:dto.runId,performerId:'sakura',chapterId:'opening',persisted:true,recorded:true,settlement:receipt};
 for(const patch of [{status:'pending'},{runId:'foreign'},{chapterId:'neon'}]){const auto=new Auto({scene:{},documentTarget:null,windowTarget:null});auto.finish({...result,settlement:{...receipt,...patch}});assert.equal(a.storage.getItem(KEY),raw);}
 const auto=new Auto({scene:{},documentTarget:null,windowTarget:null});auto.finish(result);assert.equal(a.readPublicBattleCheckpoint().status,'none');assert.equal(a.storage.getItem(KEY),null);
});

test('a failed write keeps the previous checkpoint and reports failure through the status seam',()=>{
  const a=api(),seen=[];a.subscribePublicBattleCheckpointStatus(s=>seen.push(s.state));
  a.writePublicBattleCheckpoint(checkpoint(a.ruleset));const old=a.storage.getItem(KEY);
  const set=a.storage.setItem;a.storage.setItem=(k,v)=>{if(k===KEY)throw new Error('QuotaExceededError');return set(k,v);};
  const r=a.writePublicBattleCheckpoint(checkpoint(a.ruleset,{round:{remainingMs:1000}}));
  assert.equal(r.status,'failed');assert.equal(a.storage.getItem(KEY),old);
  assert.equal(a.getPublicBattleCheckpointStatus().state,'failed');assert.deepEqual(seen,['saved','failed']);
  assert.equal(plain(a.readPublicBattleCheckpoint().checkpoint).round.remainingMs,70000);
});

test('oversized or invalid DTOs are refused without touching the stored checkpoint',()=>{
  const a=api();a.writePublicBattleCheckpoint(checkpoint(a.ruleset));const old=a.storage.getItem(KEY);
  const big=checkpoint(a.ruleset);big.battle.preparation={blob:'x'.repeat(70000)};
  assert.equal(a.writePublicBattleCheckpoint(big).status,'failed');
  assert.equal(a.writePublicBattleCheckpoint(checkpoint(a.ruleset,{player:{...checkpoint(a.ruleset).player,hp:-1}})).status,'invalid');
  assert.equal(a.writePublicBattleCheckpoint({...checkpoint(a.ruleset),scene:{}}).status,'invalid');
  assert.equal(a.storage.getItem(KEY),old);
});

test('corrupt, incompatible and tampered checkpoints are rejected and nothing is deleted',()=>{
  const a=api();a.e.profile.selectPublicPerformer('kai');const profile=a.storage.getItem(PROFILE),base=checkpoint(a.ruleset);
  const cases=[['{bad','corrupt'],[JSON.stringify(checkpoint('owner-three-chapter-v12')),'incompatible'],
    [JSON.stringify({...base,version:4}),'incompatible'],[JSON.stringify({...base,version:2}),'corrupt'],[JSON.stringify({...base,version:3}),'corrupt'],[JSON.stringify({...base,extra:1}),'corrupt'],
    [JSON.stringify({...base,battle:{...base.battle,chapterId:'nowhere'}}),'corrupt'],
    [JSON.stringify({...base,battle:{...base.battle,performerId:'ghost'}}),'corrupt'],
    [JSON.stringify({...base,run:{...base.run,choices:['nope']}}),'corrupt'],
    [JSON.stringify({...base,paint:{...base.paint,devices:[{...base.paint.devices[0],paint:-5}]}}),'corrupt']];
  for(const [raw,status] of cases){a.storage.setItem(KEY,raw);
    assert.equal(a.readPublicBattleCheckpoint().status,status,raw.slice(0,80));
    assert.equal(a.getPublicBattleCheckpointAvailability().available,false);
    assert.equal(a.storage.getItem(KEY),raw);assert.equal(a.storage.getItem(PROFILE),profile);}
  a.storage.removeItem(KEY);assert.equal(a.readPublicBattleCheckpoint().status,'none');
});

test('a run already recorded in the completed profile is never offered again; discard is runId-guarded',()=>{
  const a=api();a.writePublicBattleCheckpoint(checkpoint(a.ruleset));
  a.e.profile.recordPublicRun({runId:'run-b68',performerId:'sakura',chapterId:'opening',victory:false,choices:[],durationMs:20000});
  assert.equal(a.readPublicBattleCheckpoint().status,'already-recorded');
  assert.equal(a.getPublicBattleCheckpointAvailability().available,false);assert.ok(a.storage.getItem(KEY));
  assert.equal(a.discardPublicBattleCheckpoint({expectedRunId:'someone-else'}).status,'kept');assert.ok(a.storage.getItem(KEY));
  assert.equal(a.discardPublicBattleCheckpoint({expectedRunId:'run-b68'}).status,'discarded');assert.equal(a.storage.getItem(KEY),null);
});

test('checkpoint writes and discards obey the existing single-writer lock',()=>{
  const a=api();a.e.profile.configurePublicProfileWriteAuthority(()=>false);
  try{
    assert.equal(a.writePublicBattleCheckpoint(checkpoint(a.ruleset)).status,'write-denied');assert.equal(a.storage.getItem(KEY),null);
    assert.equal(a.getPublicBattleCheckpointStatus().state,'denied');
    a.storage.setItem(KEY,JSON.stringify(checkpoint(a.ruleset)));
    assert.equal(a.discardPublicBattleCheckpoint({expectedRunId:'run-b68'}).status,'write-denied');assert.ok(a.storage.getItem(KEY));
  }finally{a.e.profile.configurePublicProfileWriteAuthority(()=>true);}
});

test('autosave writes at most once per 2 s, flushes on pause/hidden/pagehide, skips unstable moments and stops on destroy',()=>{
  const a=api(),{PublicBattleCheckpointAutosave:Autosave}=a.e.loadRuntime('systems/PublicBattleCheckpoint.mjs');
  let t=0,stable=true,result='saved';const writes=[],failures=[],doc=eventTarget({visibilityState:'visible'}),win=eventTarget();
  const auto=new Autosave({capture:()=>stable?{n:writes.length}:null,write:d=>{writes.push(d);return {status:result};},
    clock:()=>t,documentTarget:doc,windowTarget:win,onFailure:()=>failures.push(t)});
  assert.equal(auto.tick(),'saved');t=1999;assert.equal(auto.tick(),'throttled');t=2000;assert.equal(auto.tick(),'saved');
  t=2100;assert.equal(auto.flush('pause'),'saved');assert.equal(writes.length,3);
  doc.fire('visibilitychange');assert.equal(writes.length,3,'visible tab does not flush');
  doc.visibilityState='hidden';doc.fire('visibilitychange');win.fire('pagehide');assert.equal(writes.length,5);
  stable=false;t=10000;assert.equal(auto.tick(),'unstable');assert.equal(auto.flush('pause'),'unstable');assert.equal(writes.length,5);
  stable=true;result='failed';t=20000;auto.tick();t=22000;auto.tick();assert.deepEqual(failures,[20000],'one notice per failure streak');
  result='saved';t=24000;auto.tick();result='failed';t=26000;auto.tick();assert.deepEqual(failures,[20000,26000]);
  auto.destroy();assert.equal(doc.count('visibilitychange'),0);assert.equal(win.count('pagehide'),0);
  t=40000;assert.equal(auto.tick(),'stopped');assert.equal(auto.flush('hidden'),'stopped');
});
