import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
const setup=()=>{const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);return e;};
const summary=(e,extra={})=>({runId:'actual-clear',performerId:'sakura',chapterId:'opening',victory:true,durationMs:40000,choices:[],
 performance:{hitCount:2,actions:1},rulesetId:e.loadRuntime('utils/releaseIdentity.mjs').PUBLIC_RULESET_ID,...extra});
function accepted(){const e=setup(),run=summary(e);e.profile.recordPublicRun(run);return {e,run:{...run,recorded:true,persisted:true}};}
function resultScene(e,run){const {BattleScene}=e.loadRuntime('scenes/BattleScene.js'),starts=[],releases=[];
 const s={_userCastPresentation:true,_publicRunResult:run,battleData:{stageId:1,campaignChapterId:run.chapterId,performerId:run.performerId},
 _publicBattleDialog:{rejectNextChapter(options){s.rejectOptions=options;s.rejected=(s.rejected||0)+1;},rejectResultSave(){s.saveRejected=true;}},
 _releaseBattleRuntimeObjects:why=>releases.push(why),_showBattleResultPanel:type=>{s.refreshed=type;},
 scene:{restart:data=>starts.push(data),start:(...args)=>starts.push(args)}};
 return {s,starts,releases,action:a=>BattleScene.prototype._handleBattleResultAction.call(s,a)};}
function pending(){const e=setup(),{PublicStage1PerformerRun:Run}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs');e.profile.selectPublicPerformer('sakura');
 const s={_userCastPresentation:true,battleData:{stageId:1,campaignChapterId:'opening',performerId:'sakura'},time:{now:0},battleRecord:{playerHitCount:2}};
 const owner=new Run(s);s.time.now=40000;const set=e.storage.setItem;e.storage.setItem=()=>{throw Error('Synthetic quota');};
 const run=owner.finish(true);return {e,run,restore:()=>{e.storage.setItem=set;},owner};}
test('real next action cannot enter next preparation before its selected chapter is durably saved, then recovers in-place',()=>{
 const {e,run}=accepted(),h=resultScene(e,run),before=e.storage.getItem('starush.public-profile'),set=e.storage.setItem;
 e.storage.setItem=()=>{throw Error('Synthetic quota');};assert.equal(h.action('campaign-next'),false);
 assert.equal(h.starts.length,0);assert.equal(h.releases.length,0);assert.equal(e.storage.getItem('starush.public-profile'),before);
 assert.equal(h.s.rejectOptions.retryable,true);e.storage.setItem=set;h.action('campaign-next');
 assert.equal(h.starts.length,1);assert.equal(h.starts[0][0],'TitleScene');assert.deepEqual(plain(h.starts[0][1]),{suppressDebugAutoStart:true,openPage:'preflight'});assert.equal(e.profile.loadPublicProfile().campaign.selectedChapterId,'neon');
 assert.equal(e.profile.loadPublicProfile().attempts,1);h.action('campaign-next');assert.equal(h.starts.length,1);
});
test('current-cast next action rejects an unrelated or stale result even if the chapter is unlocked',()=>{
 for(const patch of [{runId:'invented'},{persisted:false},{recorded:false},{rulesetId:'owner-three-chapter-v5'},{performerId:'kai'}]){
  const {e,run}=accepted(),h=resultScene(e,{...run,...patch});assert.equal(h.action('campaign-next'),false);assert.equal(h.starts.length,0);
 }
});
test('continuation proof requires original data owner/current saved member and never rewrites selection',()=>{
 const {e,run}=accepted(),api=e.loadRuntime('utils/publicCampaignResult.mjs');assert.equal(typeof api.getSavedCampaignContinuation,'function');
 const data={stageId:1,performerId:'sakura',campaignChapterId:'opening'},p=e.profile.loadPublicProfile();
 assert.equal(api.getSavedCampaignContinuation(run,data,p).campaignChapterId,'neon');
 for(const d of [{...data,performerId:'kai'},{...data,practiceMode:true},{...data,defenseMode:true}])assert.equal(api.getSavedCampaignContinuation(run,d,p),null);
 assert.equal(api.getSavedCampaignContinuation(run,data,{...p,selectedId:'kai'}),null);
 assert.equal(api.getSavedCampaignContinuation(run,data,{...p,persisted:false}),null);
});
test('result retry saves only queued real settlement without duplicate clears/notes and refreshes the surface',()=>{
 const {e,run,restore,owner}=pending(),h=resultScene(e,run);assert.equal(run.persisted,false);
 assert.equal(h.action('retry-save-result'),false);assert(h.s.saveRejected);assert.equal(h.s.refreshed,undefined);
 restore();h.action('retry-save-result');assert.equal(run.persisted,true);assert.equal(h.s.refreshed,'victory');
 const p=e.profile.loadPublicProfile();assert.equal(p.attempts,1);assert.equal(p.clears,1);const raw=e.storage.getItem('starush.public-profile');
 h.action('retry-save-result');assert.equal(e.storage.getItem('starush.public-profile'),raw);assert.equal(h.starts.length,0);owner.destroy();
});
test('result retry never resurrects an externally removed or unsupported save',()=>{
 for(const raw of [null,'{"version":99}']){
  const {e,run,restore,owner}=pending(),h=resultScene(e,run);restore();
  if(raw===null)e.storage.removeItem('starush.public-profile');else e.storage.setItem('starush.public-profile',raw);
  assert.equal(h.action('retry-save-result'),false);assert.equal(h.s.refreshed,undefined);assert.equal(e.storage.getItem('starush.public-profile'),raw);owner.destroy();
 }
});
test('pending result has a reachable nonterminal save action; retryable next rejection remains usable and visible',()=>{
 const {e,run}=accepted(),v=e.loadRuntime('systems/BattleSurfaceView.mjs'),c=e.loadRuntime('utils/publicCampaignResult.mjs');
 const h=e.harness(e.TitleScene),pending={...run,persisted:false};
 const view=new v.BattleSurfaceView(h.scene,{mode:'result',model:v.getPublicResultSurfaceModel(c.getPublicCampaignResult({},pending),pending),onAction:()=>false},e.document);
 assert(view.root.querySelector('[data-result-action=retry-save-result]'));let scrolled=false;view.resultStatus.scrollIntoView=()=>{scrolled=true;};
 view.rejectNextChapter({retryable:true});assert.equal(view.root.querySelector('[data-result-action=campaign-next]').disabled,false);assert(scrolled);
 view.rejectResultSave();assert.equal(view.resultStatus.dataset.saveState,'pending');assert.match(view.resultStatus.textContent,/未.*保存|保存.*失败/);view.destroy();h.shutdown();
});
const objective=(completed,total=10,finaleReached=false)=>({completed,total,finaleReached});
const sides=(completed=2)=>({chapterId:'opening',total:4,completed,zones:[{zone:0,branch:'west',completed:2},{zone:1,branch:completed===2?null:'east',completed:completed-2}]});
test('attempt summary distinguishes remaining facilities, side route, finale entry and missing measurements',()=>{
 const e=setup(),a=e.loadRuntime('utils/publicAttemptProgress.mjs');assert.equal(typeof a.getPublicAttemptProgress,'function');
 assert.equal(a.getPublicAttemptProgress({chapterId:'unknown',objectiveProgress:objective(4)}),null);
 assert.equal(a.getPublicAttemptProgress({chapterId:'opening',objectiveProgress:objective(11)}),null);
 const review=(o,s)=>a.getPublicAttemptProgress({chapterId:'opening',objectiveProgress:o,chapterSideSet:s});
 assert.equal(review(objective(4),sides()).phase,'facilities');assert.match(review(objective(4),sides()).next,/6/);
 assert.equal(review(objective(10),sides()).phase,'side-set');assert.match(review(objective(10),sides()).next,/2/);
 assert.equal(review(objective(10),sides(4)).phase,'finale-entry');
 assert.equal(review(objective(10,10,true),sides(4)).phase,'finale');
 assert.equal(review(objective(10),null).phase,'unmeasured');assert.match(review(objective(10),null).next,/未记录/);
});
test('attempt view reads real existing counters without mutating progress or pretending a victory',()=>{
 const e=setup(),{PublicStage1PerformerRun:Run}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs');
 const devices=[],side=sides(),o=objective(10),s={_userCastPresentation:true,battleData:{stageId:1,campaignChapterId:'opening',performerId:'sakura'},time:{now:400},
 paintZone:{getObjectiveProgress:()=>o,sideSet:{snapshot:()=>side},devices,finaleMode:false}};
 const r=new Run(s);assert.equal(typeof r.getAttemptProgress,'function');const before=JSON.stringify([o,side]);
 assert.equal(r.getAttemptProgress().phase,'side-set');assert.equal(JSON.stringify([o,side]),before);assert.equal(e.profile.loadPublicProfile().attempts,0);
 r.destroy();assert.equal(r.getAttemptProgress(),null);
});
test('pause and failed result show measured same-chapter progress; unknown and hidden do not invent data',()=>{
 const e=setup(),v=e.loadRuntime('systems/BattleSurfaceView.mjs'),a=e.loadRuntime('utils/publicAttemptProgress.mjs'),h=e.harness(e.TitleScene);
 const data={...summary(e),victory:false,recorded:true,persisted:true,objectiveProgress:objective(10),chapterSideSet:sides()};
 const m=v.getPublicResultSurfaceModel({buttons:[]},data);assert.equal(m.attemptReview.phase,'side-set');
 const result=new v.BattleSurfaceView(h.scene,{mode:'result',model:m,onAction(){}},e.document);
 assert.match(result.root.querySelector('[data-attempt-progress]').textContent,/串场/);result.destroy();
 h.scene.publicPerformerRun={getAttemptProgress:()=>a.getPublicAttemptProgress(data)};
 const pause=new v.BattleSurfaceView(h.scene,{mode:'pause'},e.document);assert(pause.root.querySelector('[data-attempt-progress]'));pause.destroy();h.shutdown();
});
test('beginning a new battle clears next-save recovery, not just previous goal recovery',()=>{
 const {e}=accepted(),{BattleScene}=e.loadRuntime('scenes/BattleScene.js'),s={_nextChapterSavePending:true};
 BattleScene.prototype.init.call(s,{stageId:1});assert.equal(s._nextChapterSavePending,false);
});
test('live region gate and harbor calibration take priority over unreachable later facilities',()=>{
 const e=setup(),a=e.loadRuntime('utils/publicAttemptProgress.mjs'),base={chapterId:'opening',objectiveProgress:objective(4),chapterSideSet:sides(),
   activeZone:{index:0,completed:4,total:4},calibrationCount:0};
 const side={...sides(),completed:0,zones:[{zone:0,branch:null,completed:0},{zone:1,branch:null,completed:0}]};
 const blocked=a.getPublicAttemptProgress({...base,chapterSideSet:side});assert.equal(blocked.phase,'side-set');assert.match(blocked.next,/南区.*2/);
 const harbor=a.getPublicAttemptProgress({...base,chapterId:'encore',chapterSideSet:{...side,chapterId:'encore'},calibrationCount:1});
 assert.equal(harbor.phase,'calibration');assert.match(harbor.next,/靠近.*校准/);
 assert.equal(a.getPublicAttemptProgress({...base,activeZone:{index:0,completed:9,total:4}}).phase,'facilities');
});
