import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
test('a new battle clears only its previous goal-context retry marker',()=>{
 const source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 const init=source.slice(source.indexOf('  init(data = {}) {'),source.indexOf('  preload() {'));
 const method=new Function('normalizeBattleData','getStageById','return class {'+init+'}.prototype.init;')(data=>data,()=>null);
 const scene={_goalContextSavePending:true},data={stageId:1};method.call(scene,data);
 assert.equal(scene._goalContextSavePending,false);assert.equal(scene.initialBattleData,data);
});
const setup=()=>{const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);return e;};
const rules=e=>e.loadRuntime('utils/releaseIdentity.mjs').PUBLIC_RULESET_ID;
const sample=(e,id='baseline',extra={})=>({runId:id,chapterId:'opening',performerId:'sakura',victory:true,durationMs:45003,
 performance:{hitCount:3,actions:3},rulesetId:rules(e),choices:['wide_brush','recovery'],...extra});
const api=e=>e.loadRuntime('utils/publicRunGoals.mjs');
function goal(e,kind='steady',target=3){return {version:1,kind,target,performerId:'sakura',chapterId:'opening',rulesetId:rules(e)};}
test('confirmed threshold is frozen across new records until an explicit reconfirmation',()=>{
 const e=setup(),a=api(e);e.profile.recordPublicRun(sample(e));e.profile.selectPublicChapter('opening');
 assert(a.selectPublicRunGoal(e.profile.loadPublicProfile(),'pace'));const first=a.capturePublicRunGoal(e.profile.loadPublicProfile());
 e.profile.recordPublicRun(sample(e,'faster',{durationMs:40001}));e.profile.selectPublicChapter('opening');
 assert.equal(a.capturePublicRunGoal(e.profile.loadPublicProfile()).target,45003);
 assert(Object.isFrozen(first));assert(a.selectPublicRunGoal(e.profile.loadPublicProfile(),'pace'));assert.equal(a.capturePublicRunGoal(e.profile.loadPublicProfile()).target,40001);
});
test('strict goal time is shown without centisecond rounding ambiguity',()=>{
 const e=setup(),a=api(e);assert.match(a.describePublicRunGoal(goal(e,'pace',45003)),/45\.003/);
});
test('live steady threshold preserves zero-hit and strict-less semantics without claiming a win',()=>{
 const e=setup(),a=api(e);assert.equal(typeof a.getPublicRunGoalProgress,'function');
 const run={...sample(e),victory:undefined,durationMs:10000};
 assert.equal(a.getPublicRunGoalProgress(goal(e),{...run,performance:{hitCount:2}}).status,'active');
 assert.equal(a.getPublicRunGoalProgress(goal(e),run).status,'missed');
 assert.equal(a.getPublicRunGoalProgress(goal(e,'steady',0),{...run,performance:{hitCount:0}}).status,'active');
 assert.equal(a.getPublicRunGoalProgress(goal(e,'steady',0),{...run,performance:{hitCount:1}}).status,'missed');
 assert.equal(a.getPublicRunGoalProgress(goal(e),{...run,performance:{}}).status,'unmeasured');
});
test('pace clock fails exactly at threshold, pause is owned by run clock and unknown duration stays unknown',()=>{
 const e=setup(),a=api(e);assert.equal(typeof a.getPublicRunGoalProgress,'function');
 const g=goal(e,'pace',45003);
 assert.equal(a.getPublicRunGoalProgress(g,{...sample(e),victory:undefined,durationMs:45002}).remainingMs,1);
 assert.equal(a.getPublicRunGoalProgress(g,{...sample(e),victory:undefined,durationMs:45003}).status,'missed');
 assert.equal(a.getPublicRunGoalProgress(g,{...sample(e),victory:undefined,durationMs:NaN}).status,'unmeasured');
 assert.equal(a.getPublicRunGoalProgress(g,{...sample(e),chapterId:'neon'}),null);
});
test('real run live status sends one nonterminal warning, does not fail the battle or grant anything',()=>{
 const e=setup(),{PublicStage1PerformerRun:Run}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs'),notices=[];
 const s={_userCastPresentation:true,battleData:{stageId:1,performerId:'sakura',campaignChapterId:'opening',publicRunGoal:goal(e)},time:{now:0},battleRecord:{playerHitCount:0},_showPublicBattleNotice:(...a)=>notices.push(a)};
 const r=new Run(s);assert.equal(typeof r.getGoalProgress,'function');s.time.now=100;r.update();
 s.battleRecord.playerHitCount=3;r.update();r.update();assert.equal(notices.length,1);assert.equal(s._battleEnded,undefined);assert.equal(r.result,undefined);
 r.pauseClock();s.time.now=5100;assert.equal(r.getGoalProgress().elapsedMs,100);r.resumeClock();assert.equal(r.getGoalProgress().elapsedMs,100);
 assert.equal(e.profile.loadPublicProfile().attempts,0);r.destroy();
});
test('result handoff requires durable exact evidence/current rules/current member, not just a label',()=>{
 const e=setup(),a=api(e);assert.equal(typeof a.getPublicRunGoalHandoff,'function');
 e.profile.recordPublicRun(sample(e));const profile=e.profile.loadPublicProfile(),run={...sample(e),recorded:true,persisted:true};
 assert.deepEqual(plain(a.getPublicRunGoalHandoff(run,profile)),{memberId:'sakura',chapterId:'opening'});
 for(const patch of [{persisted:false},{recorded:false},{runId:'invented'},{rulesetId:'owner-three-chapter-v5'}])assert.equal(a.getPublicRunGoalHandoff({...run,...patch},profile),null);
 assert.equal(a.getPublicRunGoalHandoff(run,{...profile,persisted:false}),null);
 assert.equal(a.getPublicRunGoalHandoff(run,{...profile,selectedId:'kai'}),null);
});
test('result offers goals only for durable actual record and never blocks standard continuation',()=>{
 const e=setup(),v=e.loadRuntime('systems/BattleSurfaceView.mjs');e.profile.recordPublicRun(sample(e));
 const run={...sample(e),recorded:true,persisted:true};
 const scene={input:{enabled:true},events:{once(){},off(){}}};
 const view=new v.BattleSurfaceView(scene,{mode:'result',model:v.getPublicResultSurfaceModel({buttons:[]},run),onAction(){}},e.document);
 assert(view.root.querySelector('[data-result-action=goals]'));view.destroy();
 const rejected=new v.BattleSurfaceView(scene,{mode:'result',model:v.getPublicResultSurfaceModel({buttons:[]},run),onAction(){}},e.document);
 let errorVisible=false;rejected.resultStatus.scrollIntoView=()=>{errorVisible=true;};rejected.rejectGoalHandoff();assert(errorVisible);rejected.destroy();
 const pending=new v.BattleSurfaceView(scene,{mode:'result',model:v.getPublicResultSurfaceModel({buttons:[]},{...run,persisted:false}),onAction(){}},e.document);
 assert.equal(pending.root.querySelector('[data-result-action=goals]'),null);pending.destroy();
});
test('HUD progress is conditional and clears on standard run; uses the existing bitmap frame',()=>{
 const e=setup(),v=e.loadRuntime('systems/BattleSurfaceView.mjs'),a=api(e),doc=e.document;
 const hud=doc.getElementById('hud')||doc.createElement('div');hud.id='hud';if(!hud.parentNode)doc.body.append(hud);
 const row=doc.createElement('div');row.id='run-goal';hud.append(row);
 const s={_isPublicStage1Round:()=>true,_userCastPresentation:true,battleData:{performerId:'sakura'},publicPerformerRun:{member:e.profile.getPublicPerformer('sakura'),canAct:()=>false,getGoalProgress:()=>a.getPublicRunGoalProgress(goal(e),{...sample(e),victory:undefined,performance:{hitCount:1}})}};
 v.syncPublicBattleHud(s,doc);assert.equal(row.hidden,false);assert.match(row.textContent,/稳演/);assert.equal(hud.dataset.runGoal,'true');
 s.publicPerformerRun.getGoalProgress=()=>null;v.syncPublicBattleHud(s,doc);assert.equal(row.hidden,true);assert.equal(row.textContent,'');assert.equal(hud.dataset.runGoal,'false');
 const css=fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8');assert.match(css,/\[data-run-goal=true\]::before/);
 assert.match(css,/#hud\[data-run-goal=true\]\s*~\s*#battle-notice\s*\{top:158px;/);
});
test('real result action saves the original chapter, fails in-place and retries only its own pending write',()=>{
 const e=setup(),a=api(e);e.profile.recordPublicRun(sample(e));
 const source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 const block=source.slice(source.indexOf('  _handleBattleResultAction(action) {'),source.indexOf('  // ===================== 形态切换'));
 const deps={getPublicRunGoalHandoff:a.getPublicRunGoalHandoff,loadPublicProfile:e.profile.loadPublicProfile,
  selectPublicChapter:e.profile.selectPublicChapter,retryPublicProfileSave:e.profile.retryPublicProfileSave,
  setBattleHudVisible(){},BATTLE_RESULT_ACTIONS:{RETRY:'retry',TITLE:'title'}};
 const method=new Function(...Object.keys(deps),'return class {'+block+'}.prototype._handleBattleResultAction;')(...Object.values(deps));
 const starts=[],releases=[],s={_publicRunResult:{...sample(e),persisted:true,recorded:true},
  _publicBattleDialog:{rejectGoalHandoff(){s.rejected=(s.rejected||0)+1;}},
  _releaseBattleRuntimeObjects:r=>releases.push(r),scene:{start:(...args)=>starts.push(args)}};
 const before=e.storage.getItem('starush.public-profile'),set=e.storage.setItem;e.storage.setItem=()=>{throw Error('Synthetic quota failure');};
 assert.equal(method.call(s,'goals'),false);assert.equal(starts.length,0);assert.equal(releases.length,0);assert.equal(s.rejected,1);
 assert.equal(s._battleResultNavigating,undefined);assert.equal(e.storage.getItem('starush.public-profile'),before);
 e.storage.setItem=set;method.call(s,'goals');assert.equal(starts.length,1);assert.equal(starts[0][0],'TitleScene');
 assert.equal(starts[0][1].openPage,'goals');assert.equal(e.profile.loadPublicProfile().campaign.selectedChapterId,'opening');assert.deepEqual(releases,['goals']);
 method.call(s,'goals');assert.equal(starts.length,1);
});
test('goal progress at result agrees with final evaluation for every exact boundary',()=>{
 const e=setup(),a=api(e);
 for(const kind of ['steady','pace'])for(const target of kind==='steady'?[0,1,3]:[1,45003])
 for(const value of kind==='steady'?[0,1,2,3,4]:[1,45002,45003,45004])for(const victory of [false,true]){
  const g=goal(e,kind,target),r={...sample(e),victory,...(kind==='pace'?{durationMs:value}:{performance:{hitCount:value}})};
  assert.equal(a.getPublicRunGoalProgress(g,r).status,a.evaluatePublicRunGoal(g,r).status);
 }
});
