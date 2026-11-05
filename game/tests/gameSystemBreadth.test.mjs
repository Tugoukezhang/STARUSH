import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';

function api(e){assert(fs.existsSync(new URL('../src/utils/publicRunGoals.mjs',import.meta.url)),'A finite personal-goal contract must exist');return e.loadRuntime('utils/publicRunGoals.mjs');}
const measured=(id,extra={})=>({runId:id,chapterId:'opening',performerId:'sakura',victory:true,durationMs:40000,performance:{hitCount:2,actions:3},...extra});

test('fresh profile exposes standard only; selecting a locked or invalid goal never writes progress',()=>{
 const e=loadScenes(),a=api(e),before=plain(e.profile.loadPublicProfile());
 const options=a.getPublicRunGoalOptions(before);assert.equal(options.length,3);assert.equal(options.filter(o=>o.available).length,1);
 assert.equal(a.selectPublicRunGoal(before,'steady'),false);assert.equal(a.selectPublicRunGoal(before,'__proto__'),false);
 assert.equal(a.capturePublicRunGoal(before),null);assert.deepEqual(plain(e.profile.loadPublicProfile()),before);
});

test('goals capture actual personal thresholds, are read-only and discard mismatched member context',()=>{
 const e=loadScenes(),a=api(e);e.profile.recordPublicRun(measured('actual'));e.profile.selectPublicChapter('opening');
 const profile=e.profile.loadPublicProfile(),raw=e.storage.getItem('starush.public-profile');assert(a.selectPublicRunGoal(profile,'pace'));
 const goal=a.capturePublicRunGoal(profile);assert.deepEqual(plain(goal),{version:1,kind:'pace',performerId:'sakura',chapterId:'opening',target:40000});assert(Object.isFrozen(goal));
 assert.equal(e.storage.getItem('starush.public-profile'),raw);e.profile.selectPublicPerformer('kai');assert.equal(a.capturePublicRunGoal(e.profile.loadPublicProfile()),null);
 e.profile.selectPublicPerformer('sakura');assert.equal(a.capturePublicRunGoal(e.profile.loadPublicProfile()),null);
});

test('goal verdict respects measured damage, strict improvement, failure and unknown telemetry',()=>{
 const e=loadScenes(),a=api(e),base={version:1,kind:'steady',performerId:'sakura',chapterId:'opening',target:2};
 assert.equal(a.evaluatePublicRunGoal(base,measured('met',{performance:{hitCount:1,actions:3}})).status,'met');
 assert.equal(a.evaluatePublicRunGoal(base,measured('equal')).status,'missed');
 assert.equal(a.evaluatePublicRunGoal({...base,target:0},measured('clean',{performance:{hitCount:0,actions:3}})).status,'met');
 assert.equal(a.evaluatePublicRunGoal(base,measured('lost',{victory:false,performance:{hitCount:0,actions:3}})).status,'missed');
 assert.equal(a.evaluatePublicRunGoal(base,measured('unknown',{performance:undefined})).status,'unmeasured');
 const pace={...base,kind:'pace',target:40000};assert.equal(a.evaluatePublicRunGoal(pace,measured('same')).status,'missed');
 assert.equal(a.evaluatePublicRunGoal(pace,measured('fast',{durationMs:39999})).status,'met');
 assert.equal(a.evaluatePublicRunGoal(base,measured('other',{performerId:'kai'})),null);
 assert.equal(a.normalizePublicRunGoal({...base,target:NaN},base),null);
});

test('real run freezes incoming goal; result evaluates it without extra rewards or persistent goal schema',()=>{
 const e=loadScenes(),a=api(e);e.profile.recordPublicRun(measured('baseline',{performerId:'kai'}));e.profile.selectPublicPerformer('kai');e.profile.selectPublicChapter('opening');
 a.selectPublicRunGoal(e.profile.loadPublicProfile(),'steady');const goal=plain(a.capturePublicRunGoal(e.profile.loadPublicProfile()));
 const {PublicStage1PerformerRun}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs');
 const s={battleData:{stageId:1,performerId:'kai',campaignChapterId:'opening',publicRunGoal:goal},time:{now:0},battleRecord:{playerHitCount:1}};
 const r=new PublicStage1PerformerRun(s);goal.target=0;s.time.now=35000;const result=r.finish(true);
 assert.equal(result.runGoal.target,2);assert.equal(result.goalOutcome.status,'met');assert.equal(result.reward.notes,3);
 assert.equal(r.finish(true),result);const saved=e.profile.loadPublicProfile();assert.equal(saved.clears,2);
 assert.equal(Object.hasOwn(saved,'runGoal'),false);assert.equal(Object.hasOwn(saved.lastRun,'runGoal'),false);
 const hidden=new PublicStage1PerformerRun({...s,battleData:{...s.battleData,practiceMode:true}});assert.equal(hidden.runGoal,null);
});

test('play hub has functional goal/library/training/archive routes; goal preparation passes snapshot into battle',()=>{
 const e=loadScenes();e.profile.recordPublicRun(measured('ready'));e.profile.selectPublicChapter('opening');const a=api(e),h=e.harness(e.TitleScene);h.scene.create();
 h.click('[data-action=play-hub]');assert.equal(h.root.dataset.page,'playhub');h.click('[data-action=hub-goals]');
 assert.equal(h.root.dataset.page,'goals');h.click('[data-goal=steady]');h.click('[data-action=confirm-goal]');
 assert.equal(h.root.dataset.page,'preflight');assert.match(h.query('.preflight-goal').textContent,/稳演/);
 const before=e.storage.getItem('starush.public-profile');h.click('[data-action=start]');assert.equal(h.starts[0][1].publicRunGoal.kind,'steady');
 assert.equal(e.storage.getItem('starush.public-profile'),before);a.selectPublicRunGoal(e.profile.loadPublicProfile(),'standard');h.shutdown();
});

test('arrangement library previews nine existing combinations without selecting actual run choices or spending',()=>{
 const e=loadScenes(),a=api(e),before=plain(e.profile.loadPublicProfile());const catalog=a.getArrangementCatalog();
 assert.equal(catalog.first.length,3);assert.equal(catalog.second.length,3);
 for(const first of catalog.first)for(const second of catalog.second){const result=a.previewPublicArrangement(first.id,second.id);assert.deepEqual(plain(result.choices),[first.id,second.id]);const real=new e.profile.PublicRunProgression({choices:[first.id,second.id]});assert.deepEqual(plain(result.effects),plain(real.effects()));}
 assert.equal(a.previewPublicArrangement('typo','echo'),null);
 const h=e.harness(e.TitleScene);h.scene.create();h.click('[data-action=play-hub]');h.click('[data-action=hub-library]');
 assert.equal(h.root.dataset.page,'library');h.click('[data-arrangement=tempo]');h.click('[data-arrangement=overdrive]');
 assert.match(h.query('.arrangement-effects').textContent,/1\.5/);assert.deepEqual(plain(e.profile.loadPublicProfile()),before);h.shutdown();
});

test('result surface shows measured goal separately and never invents a goal for standard runs',()=>{
 const e=loadScenes(),a=api(e),v=e.loadRuntime('systems/BattleSurfaceView.mjs');
 const scene={input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},events:{once(){},off(){}}};
 const goal={version:1,kind:'steady',performerId:'sakura',chapterId:'opening',target:2};
 const result={...measured('result',{performance:{hitCount:1,actions:2}}),runGoal:goal};result.goalOutcome=a.evaluatePublicRunGoal(goal,result);
 const view=new v.BattleSurfaceView(scene,{mode:'result',model:v.getPublicResultSurfaceModel({buttons:[]},result),onAction(){}},e.document);
 assert.match(view.root.querySelector('.battle-run-goal').textContent,/达成/);view.destroy();
 const normal=new v.BattleSurfaceView(scene,{mode:'result',model:v.getPublicResultSurfaceModel({buttons:[]},measured('normal')),onAction(){}},e.document);
 assert.equal(normal.root.querySelector('.battle-run-goal'),null);normal.destroy();
});
