import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
function setup(){const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);return e;}
function api(e=setup()){assert(existsSync(new URL('../src/utils/chapterFinaleContent.mjs',import.meta.url)),'chapter finale content helper must exist');return {e,...e.loadRuntime('utils/chapterFinaleContent.mjs')};}
const input={pattern:'momentum-vector',origin:{x:500,y:100},player:{x:500,y:300},motion:{x:40,y:60},windupMs:800,speed:180,width:1000,height:1778};
test('current three chapter finale grammar has a real two-axis final chapter, legacy remains unchanged',()=>{
 const e=setup(),{PublicStage1FinaleController:C}=e.loadRuntime('systems/PublicStage1FinaleController.mjs');
 const c=new C({stageId:1,campaignChapterId:'encore'});assert(c.begin({now:1000}));assert.equal(c.snapshot(1001).attackPattern,'momentum-vector');
 c.recordAttackResolved(1100);c.recordWeakPointResolved(1200);assert.equal(c.snapshot(1201).attackPattern,'captured-line');
 c.recordAttackResolved(1300);c.recordWeakPointResolved(1400);assert.equal(c.snapshot(1401).attackPattern,'momentum-vector');
 e.loadRuntime('utils/userCast.mjs').configureUserCast(false);const old=new C({stageId:1,campaignChapterId:'encore'});old.begin();assert.equal(old.snapshot().attackPattern,'momentum-cutoff');
 for(const data of [{practiceMode:true,stageId:1},{stageId:2}])assert.equal(new C(data).begin(),false);
 e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const defense=new C({defenseMode:true,stageId:1,campaignChapterId:'encore'});assert(defense.begin());assert.equal(defense.snapshot().attackPattern,'momentum-cutoff');
});
test('captured vector uses completed physics motion on both axes and never retargets or mutates inputs',()=>{
 const {resolveChapterFinalePlan:resolve}=api(),before=plain(input),plan=resolve(input),seconds=.8+200/180;
 assert.equal(plan.capture.capturedX,500+40*seconds);assert.equal(plan.capture.capturedY,300+60*seconds);assert.equal(plan.projectionSeconds,seconds);
 assert.deepEqual(plain(input),before);assert(Object.isFrozen(plan.capture));input.player.x=600;assert.equal(plan.playerAtCapture.x,500);input.player.x=500;
 assert.deepEqual(plain(resolve({...input,pattern:'captured-line'}).capture),{capturedX:500,capturedY:300});
 assert.equal(resolve({...input,pattern:'momentum-cutoff'}).capture.capturedY,300);
 assert.deepEqual(plain(resolve({...input,motion:{x:1e6,y:-1e6}}).capture),{capturedX:986,capturedY:14});
 for(const patch of [{speed:0},{windupMs:-1},{player:{x:NaN,y:300}},{pattern:'homing'},{width:10}])assert.equal(resolve({...input,...patch}),null);
});
test('realized motion rejects disabled/missing/bad timing and does not read desired velocity',()=>{
 const {getCompletedFinaleMotion:read}=api();const p={active:true,body:{enable:true,velocity:{x:9999,y:9999},deltaXFinal:()=>2,deltaYFinal:()=>-3}};
 assert.deepEqual(plain(read(p,20)),{x:100,y:-150});
 assert.deepEqual(plain(read({...p,body:{...p.body,deltaXFinal:()=>0,deltaYFinal:()=>0}},20)),{x:0,y:0});
 for(const [player,dt] of [[p,0],[p,NaN],[{...p,active:false},20],[{...p,body:{...p.body,enable:false}},20],[null,20]])assert.deepEqual(plain(read(player,dt)),{x:0,y:0});
 assert.deepEqual(plain(read({...p,body:{...p.body,deltaYFinal:()=>NaN}},20)),{x:100,y:0});
 assert.deepEqual(plain(read({...p,body:{...p.body,deltaYFinal:123}},20)),{x:100,y:0});
});
test('run records at most three validated actual responses, freezes result context and never persists it',()=>{
 const e=setup(),{PublicStage1PerformerRun:R}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs');
 const scene={_userCastPresentation:true,battleData:{stageId:1,performerId:'sakura',campaignChapterId:'encore'},time:{now:0},player:{hp:5,maxHp:5},battleRecord:{playerHitCount:1},paintZone:{getObjectiveProgress:()=>({completed:10,total:10}),finaleMode:true}};
 const r=new R(scene);assert.equal(typeof r.recordFinaleResponse,'function');
 assert.equal(r.recordFinaleResponse({index:0,pattern:'momentum-vector',outcome:'hit'}),true);assert.equal(r.recordFinaleResponse({index:0,pattern:'momentum-vector',outcome:'evaded'}),false);
 for(const row of [{index:-1,pattern:'captured-line',outcome:'hit'},{index:1,pattern:'homing',outcome:'hit'},{index:1,pattern:'captured-line',outcome:'timeout'}])assert.equal(r.recordFinaleResponse(row),false);
 r.recordFinaleResponse({index:1,pattern:'captured-line',outcome:'evaded'});r.recordFinaleResponse({index:2,pattern:'momentum-vector',outcome:'evaded'});scene.time.now=40000;
 const result=r.finish(true);assert.equal(result.finaleResponses.length,3);assert.equal(result.rulesetId,e.loadRuntime('utils/releaseIdentity.mjs').PUBLIC_RULESET_ID);
 assert.equal(JSON.stringify(e.profile.loadPublicProfile()).includes('finaleResponses'),false);
 assert.equal(r.recordFinaleResponse({index:2,pattern:'captured-line',outcome:'hit'}),false);
 const model=e.loadRuntime('systems/BattleSurfaceView.mjs').getPublicResultSurfaceModel({buttons:[]},result);assert.equal(model.finaleReview.resolved,3);assert.equal(model.finaleReview.contacts,1);assert.equal(model.finaleReview.uncontacted,2);
});
test('rules v1 progression and gear survive but never become v2 scores or ready-made challenges',()=>{
 const e=setup(),p=e.profile,goals=e.loadRuntime('utils/publicRunGoals.mjs');
 const old=p.recordPublicRun({runId:'v1',performerId:'sakura',chapterId:'opening',victory:true,choices:['wide_brush','recovery'],durationMs:1000,performance:{hitCount:0,actions:1},rulesetId:'owner-three-chapter-v1'});
 p.selectPublicChapter('opening');const bytes=e.storage.getItem('starush.public-profile'),resources=e.loadRuntime('utils/publicPreparation.mjs').getPreparationResources(old);
 assert.equal(goals.getPublicRunGoalOptions(old).find(g=>g.id==='pace').available,false);assert.equal(e.storage.getItem('starush.public-profile'),bytes);
 assert(old.campaign.clearedChapterIds.includes('opening'));assert.equal(resources.earned,6);
 const current=p.recordPublicRun({runId:'v2',performerId:'sakura',chapterId:'opening',victory:true,choices:['wide_brush','recovery'],durationMs:40000,performance:{hitCount:2,actions:4},rulesetId:e.loadRuntime('utils/releaseIdentity.mjs').PUBLIC_RULESET_ID});
 assert.equal(current.performance.rulesets['owner-three-chapter-v1']['opening:sakura'].bestTime.durationMs,1000);assert.equal(current.performance.rulesets[e.loadRuntime('utils/releaseIdentity.mjs').PUBLIC_RULESET_ID]['opening:sakura'].bestTime.durationMs,40000);
 p.selectPublicChapter('opening');assert.equal(goals.getPublicRunGoalOptions(p.loadPublicProfile()).find(g=>g.id==='pace').available,true);
});
test('archive keeps prior versioned scores readable without enabling current challenges or writing',()=>{
 const e=setup();e.profile.recordPublicRun({runId:'old-versioned',performerId:'sakura',chapterId:'opening',victory:true,choices:[],durationMs:10000,performance:{hitCount:1,actions:2},rulesetId:'owner-three-chapter-v1'});
 e.profile.selectPublicChapter('opening');const before=e.storage.getItem('starush.public-profile'),h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'records'});h.scene.create();
 assert.match(h.text,/历史纪录/);assert.match(h.text,/规则 1/);assert.match(h.text,/10\.00秒/);assert.match(h.text,/实测纪录 0 \/ 12/);assert.equal(e.storage.getItem('starush.public-profile'),before);h.shutdown();
});
test('actual Scene windup, cue and release share a frozen vector; actual resolve forwards only once',()=>{
 const {e,getCompletedFinaleMotion,resolveChapterFinalePlan}=api(),source=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 const block=source.slice(source.indexOf('  _startPublicStage1FinaleAttack() {'),source.indexOf('  _openPublicStage1FinaleBossRecovery() {'));
 const constants=[...source.matchAll(/^const (?:P16_024_FINALE_\w+|P16_013_STAGE_CUE_EMITTER_\w+|P16_018_FINALE_CUE_DEPTH) = [^;]+;/gm)].map(m=>m[0]).join('\n');
 const phases=e.loadRuntime('systems/PublicStage1FinaleController.mjs'),roles=e.loadRuntime('systems/PublicStage1EnemyRoles.mjs');
 const deps={Phaser:{Math:{Clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}},...phases,...roles,...e.loadRuntime('utils/stage1PaintRound.mjs'),getCompletedFinaleMotion,resolveChapterFinalePlan,
  STAGE1_PAINT_WORLD_WIDTH:1000,STAGE1_PAINT_WORLD_HEIGHT:1778,PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS:{FINALE_ATTACK_RESPONSE:'response'}};
 const C=new Function(...Object.keys(deps),constants+'\nreturn class {'+block+'};')(...Object.values(deps));
 const timers=[],captures=[],responses=[],boss={active:true,x:500,y:100,gfx:{clear(){}}};let resolved=false;
 const s={_userCastPresentation:true,_publicStage1FinaleBoss:boss,_lastPlayerMotionFrameDeltaMs:20,
  player:{active:true,x:500,y:300,body:{enable:true,deltaXFinal:()=>2,deltaYFinal:()=>-1}},
  publicStage1Finale:{snapshot:()=>({active:true,phase:'attack',attackPattern:'momentum-vector',attackIndex:0}),recordAttackResolved(){if(resolved)return false;resolved=true;return true;}},
  publicPerformerRun:{now:()=>1000,recordFinaleResponse:r=>responses.push(r)},
  time:{delayedCall(ms,fn){timers.push({ms,fn});return {remove(){}};}},add:{graphics:()=>({active:true,setDepth(){return this;},destroy(){this.active=false;}})},
  _drawPublicStage1FinaleBossGfx(){},_drawPublicStage1AttackCue(g,b){captures.push(plain(b.publicStage1CueCapture));},_showRoundBanner(){},_awardPublicSakuraActionCharge(){},
  _spawnPublicStage1StageCuePulse:b=>{captures.push(plain(b.publicStage1CueCapture));return {active:true};},_spawnPublicStage1FinaleWeakPoint(){}};
 assert(C.prototype._startPublicStage1FinaleAttack.call(s));assert.notEqual(captures[0].capturedY,300);s.player.y=500;timers[0].fn();assert.deepEqual(captures[0],captures[1]);assert.equal(boss.publicStage1CuePulse.publicStage1FinaleAttack,true);
 assert(C.prototype._resolvePublicStage1FinaleAttack.call(s,boss.publicStage1CuePulse,'hit'));assert.equal(C.prototype._resolvePublicStage1FinaleAttack.call(s,boss.publicStage1CuePulse,'hit'),false);
 assert.deepEqual(plain(responses),[{index:0,pattern:'momentum-vector',outcome:'hit'}]);
});
