import test from 'node:test';import assert from 'node:assert/strict';
import {loadScenes,storageFixture,plain} from './helpers/publicShellHarness.mjs';
const prep=id=>({version:1,performerId:id,trainingLevel:1,equipmentId:null});
function environment(){const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);return e;}
function dto(ruleset,id='sakura'){return{kind:'starush.public-battle-checkpoint',version:1,rulesetId:ruleset,savedAt:1700000000000,runId:'fanfire-save',battle:{performerId:id,chapterId:'opening',preparation:prep(id),runGoal:null,routePlan:null,arrangementPlan:null},run:{elapsedMs:10000,choices:['fanfire','echo'],shotCount:4,checkpoints:2,actions:0,impacts:3,modificationReleases:0,choiceEffects:{relay:0,echo:0,tempo:0,recovery:0},encounterEvent:null,goalMissedNotice:false},player:{x:480,y:900,hp:3,specialCharge:40,encoreCharge:10,hitCount:2,feverActive:false,relightBurstPlayed:false},round:{remainingMs:70000},encounter:{elapsedMs:10000,currentPhaseId:null,phaseEnteredAtMs:0,northEntered:false,lastEmitterAtMs:null,lastEmitterPhaseId:null,lastDisruptorAtMs:null,lastDisruptorPhaseId:null,captainClaimed:false,roles:{},event:null},paint:{zone:0,heat:3,burstUsed:0,complete:false,sideSelected:[null,null],devices:[]},street:{opened:[],restored:[],finaleAnnounced:false,storyOffered:false,stationGuards:[]}};}

test('fanfire is a fourth first-segment option for owner rifle only; legacy and melee keep their pools',()=>{
 const e=environment(),{PublicRunProgression}=e.profile;
 const rifle=new PublicRunProgression({performerId:'sakura'});assert.equal(rifle.getOptions().length,4);assert.equal(rifle.getOptions().find(r=>r.id==='fanfire').performerId,'sakura');
 for(const performerId of [null,'kai','enjo']){const g=new PublicRunProgression({performerId});assert.equal(g.getOptions().length,3);assert.equal(g.choose('fanfire'),false);}
 assert.equal(rifle.choose('fanfire'),true);assert.deepEqual(plain(rifle.getOptions().map(r=>r.id)),['echo','overdrive','recovery']);assert.equal(rifle.choose('echo'),true);
 const restored=new PublicRunProgression({...rifle.snapshot(),performerId:'sakura'});assert.deepEqual(plain(restored.choices),['fanfire','echo']);assert.equal(restored.getOptions().length,0);
});

test('old six effects and all previous27 role plans keep exactly their old numeric semantics',()=>{
 const e=environment(),{PublicRunProgression}=e.profile;
 for(const performerId of ['sakura','kai','enjo'])for(const first of ['wide_brush','relay','tempo'])for(const second of ['echo','overdrive','recovery']){
  const g=new PublicRunProgression({performerId});assert(g.choose(first)&&g.choose(second));assert.deepEqual(plain(g.effects()),{paintRadiusBonus:first==='wide_brush'?40:0,relay:first==='relay',chargeMultiplier:first==='tempo'?1.5:1,echo:second==='echo',actionPower:second==='overdrive'?1.5:1,recoverOnAnchor:second==='recovery'});
 }
});

test('build model explains actual three-lane tradeoff and cannot grant the rifle choice to melee',()=>{
 const e=environment(),m=e.loadRuntime('utils/publicBuildContent.mjs'),base=m.getPublicBuildModel(prep('sakura'),'sakura',[]),option=m.getPublicBuildOption(base,'fanfire');assert(option);assert.match(option.delta,/3|三/);assert.match(option.detail,/60.*20/);
 const selected=m.getPublicBuildModel(prep('sakura'),'sakura',['fanfire','echo']);assert(selected);assert.match(selected.roleNote,/三|3/);assert(selected.tactic.length>12);
 for(const id of ['kai','enjo']){assert.equal(m.getPublicBuildModel(prep(id),id,['fanfire']),null);assert.equal(m.getPublicBuildOption(m.getPublicBuildModel(prep(id),id,[]),'fanfire'),null);}
});

test('member-aware catalogue and preview match actual choice availability',()=>{
 const e=environment(),m=e.loadRuntime('utils/publicRunGoals.mjs');assert.equal(m.getArrangementCatalog('sakura').first.length,4);assert.equal(m.getArrangementCatalog('kai').first.length,3);assert.equal(m.getArrangementCatalog().first.length,3);
 assert(m.previewPublicArrangement('fanfire','echo','sakura'));assert.equal(m.previewPublicArrangement('fanfire','echo','kai'),null);assert.equal(m.previewPublicArrangement('fanfire','echo'),null);
});

test('explicit preflight plans accept new rifle choice but reject a wrong-role plan rather than substituting',()=>{
 const e=environment(),m=e.loadRuntime('utils/publicArrangementPlan.mjs'),data={stageId:1,performerId:'sakura',campaignChapterId:'opening',practiceMode:false,defenseMode:false};
 const plan=m.createArrangementPlan(['fanfire','echo'],data);assert(plan);assert.deepEqual(plain(plan.choices),['fanfire','echo']);assert.equal(m.createArrangementPlan(['fanfire','echo'],{...data,performerId:'kai'}),null);
 const review=m.getArrangementPlanReview(plan,data,['fanfire']);assert.equal(review.matched,1);assert.equal(review.rows[0].actualId,'fanfire');
});

test('saved checkpoint preserves new choice without new DTO fields and rejects wrong actor',()=>{
 const e=environment(),m=e.loadRuntime('utils/publicBattleCheckpoint.mjs'),rules=e.loadRuntime('utils/releaseIdentity.mjs').PUBLIC_RULESET_ID,storage=storageFixture(),value=dto(rules);
 assert.equal(m.writePublicBattleCheckpoint(value,{storage}).status,'saved');const raw=storage.getItem(m.PUBLIC_BATTLE_CHECKPOINT_KEY),read=m.readPublicBattleCheckpoint({storage});assert.equal(read.status,'ok');assert.deepEqual(plain(read.checkpoint),value);assert.equal(storage.getItem(m.PUBLIC_BATTLE_CHECKPOINT_KEY),raw);
 assert.equal(m.writePublicBattleCheckpoint(dto(rules,'kai'),{storage}).status,'invalid');assert.equal(storage.getItem(m.PUBLIC_BATTLE_CHECKPOINT_KEY),raw);
});

test('finished profile records a legitimate fanfire run and rejects forged wrong-role selection',()=>{
 const e=environment(),p=e.profile,good=p.recordPublicRun({runId:'fanfire-profile',performerId:'sakura',chapterId:'opening',victory:false,choices:['fanfire','echo'],durationMs:1000});assert.deepEqual(plain(good.lastRun.choices),['fanfire','echo']);
 const before=e.storage.getItem('starush.public-profile');p.recordPublicRun({runId:'bad-role-profile',performerId:'kai',chapterId:'opening',victory:false,choices:['fanfire'],durationMs:1000});assert.equal(e.storage.getItem('starush.public-profile'),before);
});

test('actual owner run and checkpoint apply reconstruct role context rather than losing selected branch',()=>{
 const e=environment(),{PublicStage1PerformerRun}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs'),{applyPublicBattleCheckpointRun}=e.loadRuntime('systems/PublicBattleCheckpoint.mjs'),scene={_userCastPresentation:true,battleData:{stageId:1,performerId:'sakura',campaignChapterId:'opening',publicPreparation:prep('sakura')},time:{now:0},player:{hp:5,maxHp:5,setPosition(x,y){this.x=x;this.y=y;}}};
 const run=new PublicStage1PerformerRun(scene);scene.publicPerformerRun=run;assert.equal(run.growth.getOptions().length,4);assert(applyPublicBattleCheckpointRun(scene,dto(e.loadRuntime('utils/releaseIdentity.mjs').PUBLIC_RULESET_ID)));assert.deepEqual(plain(run.getBuildSnapshot().choices),['fanfire','echo']);assert.equal(scene.player.hp,3);run.destroy();
});
