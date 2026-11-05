import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
const profile={version:1,clears:3,campaign:{version:1,selectedChapterId:'opening',chapterClears:{opening:1,neon:1,encore:1},completed:true}};
const base={stageId:1,practiceMode:false,defenseMode:false,performerId:'enjo',characterId:'enjo',team:[{characterId:'enjo'}],campaignChapterId:'opening'};
const setup=()=>{const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);return e;};
const api=e=>fs.existsSync(new URL('../src/utils/publicRunContext.mjs',import.meta.url))?e.loadRuntime('utils/publicRunContext.mjs'):{};
function scene(data){return{battleData:data,_userCastPresentation:false,_isFinaleTrialRound:()=>!!data.publicFinaleTrial,time:{now:100},player:{hp:5},battleRecord:{playerHitCount:0}};}
test('all three existing modes resolve one immutable policy and content identity',()=>{
 const e=setup(),a=api(e);assert.equal(typeof a.resolvePublicRunContext,'function');const f=e.loadRuntime('utils/publicFinaleTrial.mjs');
 const trial=f.createFinaleTrialData(base,['wide_brush','echo'],profile),rehearsal=f.createRehearsalData(base,['tempo','overdrive'],profile,{chapterId:'neon',focus:'clean'});
 for(const[data,id,save,record,rounds]of[[base,'campaign',true,true,1],[trial,'finale-trial',false,false,3],[rehearsal,'rehearsal',false,false,1]]){const c=a.resolvePublicRunContext(data);assert.equal(c.modeId,id);assert.equal(c.contentId,data.campaignChapterId);assert.equal(c.contentRevision,1);assert.equal(c.performerId,'enjo');assert.equal(c.policy.checkpoint,save);assert.equal(c.policy.profileResult,record);assert.equal(c.roundCount,rounds);assert(Object.isFrozen(c));assert(Object.isFrozen(c.policy));}
 const result=f.finishFinaleTrialRound(trial,{victory:true,hp:3,durationMs:1000,hitCount:2,actions:1}),next=f.nextFinaleTrialData(trial,result),context=a.resolvePublicRunContext(next);assert.equal(context.startHp,3);assert.equal(context.roundIndex,1);assert.equal(context.contentId,'neon');
});
test('malformed explicit trial markers and unsupported modes never become campaign',()=>{
 const a=api(setup());assert.equal(typeof a.resolvePublicRunContext,'function');
 for(const marker of [null,false,undefined,{},[],{version:1,rehearsal:null}])assert.equal(a.resolvePublicRunContext({...base,publicFinaleTrial:marker}),null);
 for(const change of [{practiceMode:true},{defenseMode:true},{stageId:2},{campaignChapterId:'missing'},{p15SetlistCueExperiment:true}])assert.equal(a.resolvePublicRunContext({...base,...change}),null);
});
test('actual performer result owner refuses a malformed mode before any profile write',()=>{
 const e=setup(),{PublicStage1PerformerRun:R}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs');
 for(const marker of [null,false,{},[]]){const s=scene({...base,publicFinaleTrial:marker});s._isFinaleTrialRound=()=>false;const r=new R(s),before=e.storage.getItem('starush.public-profile');assert.equal(r.finish(false),null);assert.equal(e.storage.getItem('starush.public-profile'),before);r.destroy();}
});
test('actual checkpoint owner rejects invalid markers even when a caller incorrectly reports ordinary mode',()=>{
 const e=setup(),{canCapturePublicBattleCheckpoint:can}=e.loadRuntime('systems/PublicBattleCheckpoint.mjs'),{PUBLIC_RULESET_ID}=e.loadRuntime('utils/releaseIdentity.mjs');
 const s={...scene(base),publicPerformerRun:{rulesetId:PUBLIC_RULESET_ID},_userCastPresentation:true,_isPublicStage1Round:()=>true,_isFinaleTrialRound:()=>false,paintZone:{},publicStage1Round:{phase:'active'},publicStage1Encounter:{active:true}};
 assert(can(s));for(const marker of [null,false,{},[]])assert.equal(can({...s,battleData:{...base,publicFinaleTrial:marker}}),false);
});
test('live context reads the restored runId and current choices rather than a stale copied save',()=>{
 const e=setup(),{PublicStage1PerformerRun:R}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs'),r=new R(scene(base));assert.equal(typeof r.getContext,'function');const first=r.getContext();r.runId='resumed-id';r.growth.choose('relay');const next=r.getContext();assert.equal(next.runId,'resumed-id');assert.deepEqual(plain(next.choices),['relay']);assert.deepEqual(plain(first.choices),[]);assert(Object.isFrozen(next.choices));r.destroy();
});
test('campaign continuation cannot advance or rewrite a challenge context',()=>{
 const e=setup(),f=e.loadRuntime('utils/publicFinaleTrial.mjs'),c=e.loadRuntime('utils/publicCampaignResult.mjs'),trial=f.createFinaleTrialData(base,['wide_brush','echo'],profile);
 assert.equal(c.getNextCampaignBattleData({victory:true,recorded:true,chapterId:'opening'},trial,profile),null);assert.equal(c.getRetryCampaignBattleData(trial,profile),trial);
});
test('real trial finish remains ephemeral and idempotent, with no campaign reward write',()=>{
 const e=setup(),f=e.loadRuntime('utils/publicFinaleTrial.mjs'),{PublicStage1PerformerRun:R}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs'),trial=f.createFinaleTrialData(base,['wide_brush','echo'],profile),r=new R(scene(trial)),before=e.storage.getItem('starush.public-profile');
 const first=r.finish(true);assert.equal(first.trial,true);assert.equal(first.recorded,false);assert.equal(first.persisted,false);assert.equal(r.finish(true),first);assert.equal(e.storage.getItem('starush.public-profile'),before);r.destroy();
});
