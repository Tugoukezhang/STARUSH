import test from 'node:test';import assert from 'node:assert/strict';import {existsSync,readFileSync} from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
function api(){assert(existsSync(new URL('../src/utils/chapterSideSets.mjs',import.meta.url)),'Authored chapter branch content must exist');const e=loadScenes();return {e,...e.loadRuntime('utils/chapterSideSets.mjs')};}
function setup(chapter='opening'){const a=api(),s=new a.ChapterSideSet(chapter),devices=s.definitions.map(d=>({...d,complete:false,paint:0}));return {...a,s,devices};}
function finish(s,d,devices){assert(s.canReceive(d,devices));d.complete=true;s.completed(d,devices);}
test('three chapters have two zones, two two-stop branches and actual walkable signal geometry',()=>{
 const {e,ChapterSideSet:C}=api(),{OldStreetState:W}=e.loadRuntime('utils/oldStreetMap.mjs');
 for(const id of ['opening','neon','encore']){
  const s=new C(id),m=id==='opening'?e.loadRuntime('utils/oldStreetMap.mjs'):e.loadRuntime(id==='neon'?'utils/neonStreetMap.mjs':'utils/harborStageMap.mjs');
  const w=new W(m[id==='opening'?'OLD_STREET_PROPS':id==='neon'?'NEON_STREET_PROPS':'HARBOR_STAGE_PROPS'],m.HARBOR_STAGE_CONFIG?.terrain||[]);
  assert.equal(s.definitions.length,8);assert.equal(new Set(s.definitions.map(d=>d.id)).size,8);
  for(const d of s.definitions){assert(w.clearLine(d,d,12),id+' stop inside blocker '+d.id);assert(d.sceneArt&&d.paintPolicy==='performer'&&d.required===false);assert(d.zone===0?d.y>=960:d.y<940);}
 }
});
test('first completed branch wins, partial paint does not commit, other branch cannot advance or receive',()=>{
 const {s,devices}=setup(),a=devices.find(d=>d.zone===0&&d.sideBranch==='west'),b=devices.find(d=>d.zone===0&&d.sideBranch==='east');
 a.paint=1;assert(s.canReceive(b,devices));finish(s,a,devices);assert(!s.canReceive(b,devices));assert.equal(s.snapshot(devices).zones[0].branch,'west');assert(!s.zoneComplete(0,devices));
 finish(s,devices.find(d=>d.zone===0&&d.sideBranch==='west'&&d!==a),devices);assert(s.zoneComplete(0,devices));assert(!b.complete);assert(!s.zoneComplete(1,devices));
});
test('opening allows either stop first; neon enforces actual first-to-second handoff',()=>{
 for(const id of ['opening','neon']){const {s,devices}=setup(id),first=devices.find(d=>d.zone===0&&d.sideBranch==='east'&&d.sideIndex===0),second=devices.find(d=>d.zone===0&&d.sideBranch==='east'&&d.sideIndex===1);
  assert.equal(s.canReceive(second,devices),id==='opening');finish(s,first,devices);assert(s.canReceive(second,devices));}
});
test('harbor side stops use original near calibration, not instant remote paint completion',()=>{
 const {e,s}=setup('encore'),{ChapterObjectiveContract:C}=e.loadRuntime('utils/chapterObjectives.mjs'),c=new C('encore');
 for(const d of s.definitions)assert(c.requiresCalibration(d));assert(!new C('neon').requiresCalibration(s.definitions[0]));
});
test('snapshots count chosen actual completions only, validate IDs and cannot mutate live branch state',()=>{
 const {s,devices,getChapterSideSetReview:review}=setup('neon');const d=devices.find(d=>d.zone===0&&d.sideBranch==='west');finish(s,d,devices);
 const snap=s.snapshot(devices);assert.equal(snap.completed,1);assert.equal(snap.total,4);assert.equal(review(snap,'neon').completed,1);
 snap.zones[0].branch='east';assert.equal(s.snapshot(devices).zones[0].branch,'west');
 for(const bad of [{...snap,chapterId:'encore'},{...snap,completed:99},{...snap,zones:[{zone:0,branch:'fake',completed:2}]}])assert.equal(review(bad,'neon'),null);
 s.destroy();assert(!s.canReceive(d,devices));assert(!s.zoneComplete(0,devices));
});
test('real PaintZone counts main facilities separately and blocks zone advance until chosen branch done',()=>{
 const {e,s,devices}=setup(),{PaintZoneSystem:P}=e.loadRuntime('systems/PaintZoneSystem.js');
 const main=Array.from({length:10},(_,i)=>({id:'base'+i,required:true,zone:i<5?0:1,complete:i<5}));
 let advanced=0;const z=Object.assign(Object.create(P.prototype),{devices:[...main,...devices],currentZone:0,sideSet:s,complete:false,clearGate(){},_refreshLockVisuals(){},onZoneComplete(){advanced++;}});
 assert.equal(z.getPaintedCount(),5);assert.equal(z.getTotalCount(),10);z._maybeAdvanceZone();assert.equal(advanced,0);
  assert.equal(z.getAmbientTotalCount(),0);assert.equal(z.getAmbientPaintedCount(),0);
 for(const d of devices.filter(d=>d.zone===0&&d.sideBranch==='east'))finish(s,d,devices);z._maybeAdvanceZone();assert.equal(advanced,1);assert.equal(z.currentZone,1);assert.equal(z.getPaintedCount(),5);
});
test('real target owner includes active branch and excludes rejected branch even after all primary paint',()=>{
 const {e,s,devices}=setup(),{PaintZoneSystem:P}=e.loadRuntime('systems/PaintZoneSystem.js');
 const a=devices.find(d=>d.zone===0&&d.sideBranch==='west');finish(s,a,devices);
 const z=Object.assign(Object.create(P.prototype),{devices,currentZone:0,sideSet:s,chapterObjectives:{canReceive:()=>true},scene:{oldStreet:{clearLine:()=>true}},finaleMode:false});
 const rejected=devices.find(d=>d.zone===0&&d.sideBranch==='east');assert(!z.canReceivePaint(rejected));
 const target=z.getNearestObjective(rejected.x,rejected.y);assert(target?.sideBranch==='west');assert.equal(z.getNearestPaintable(rejected.x,rejected.y)?.sideBranch,'west');
});
test('new branch rendering uses existing bitmap and has honest lock/route labels',()=>{
 const {e,s,devices}=setup('neon'),p=e.loadRuntime('systems/ChapterScenePresentation.mjs'),d=devices[0];d.sourceLabel=d.label;
 assert(p.getDevicePresentation(d,0).showProgress);assert(p.getCompactDeviceLabel(d,0).includes('串场'));
 d.chapterLocked=true;d.sideSetLockedReason='先接前站';assert.equal(p.getCompactDeviceLabel(d,0),'先接前站');
});
test('fresh retry has no branch state; unknown chapter does not create a public route',()=>{
 const {s,devices,ChapterSideSet:C}=setup();finish(s,devices[0],devices);assert.equal(new C('opening').snapshot([]).completed,0);assert.equal(new C('bad').definitions.length,0);
});
test('live rules17 keeps rules3 profile history without opening current score challenge',()=>{
 const {e}=api();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const p=e.profile;
 p.recordPublicRun({runId:'r3',performerId:'sakura',chapterId:'opening',victory:true,choices:[],durationMs:1000,performance:{hitCount:0,actions:1},rulesetId:'owner-three-chapter-v3'});
 assert.equal(e.loadRuntime('utils/releaseIdentity.mjs').PUBLIC_RULESET_ID,'owner-three-chapter-v17');
 assert(!e.loadRuntime('utils/publicRunGoals.mjs').getPublicRunGoalOptions(p.loadPublicProfile()).find(g=>g.id==='pace').available);
 assert(p.loadPublicProfile().performance.rulesets['owner-three-chapter-v3']['opening:sakura']);assert(p.loadPublicProfile().campaign.clearedChapterIds.includes('opening'));
});
test('locked harbor opposite route cannot continue previously started calibration',()=>{
 const {e}=api(),{ChapterObjectiveContract:C}=e.loadRuntime('utils/chapterObjectives.mjs'),c=new C('encore');
 const d={id:'locked',chapterSideSet:true,zone:0,x:0,y:0,chapterLocked:true,chapterAwaitingCalibration:true,chapterCalibrationMs:900};
 c.advance(0,{x:0,y:0,hp:5},[d],0,()=>true);assert.deepEqual(plain(c.advance(100,{x:0,y:0,hp:5},[d],0,()=>true)),[]);assert.equal(d.chapterCalibrationMs,900);
});
test('real paint path rejects unchosen branch and never changes its meter',()=>{
 const {e,s,devices}=setup(),{PaintZoneSystem:P}=e.loadRuntime('systems/PaintZoneSystem.js');finish(s,devices[0],devices);
 const z=Object.assign(Object.create(P.prototype),{devices,currentZone:0,sideSet:s,chapterObjectives:{canReceive:()=>true},_redrawDevice(){throw Error('Must not draw rejected paint');}});
 const rejected=devices.find(d=>d.zone===0&&d.sideBranch==='east');assert.equal(z.applyPaint(rejected,52,'pink'),false);assert.equal(rejected.paint,0);assert.equal(rejected.complete,false);
});
test('actual run captures validated route review before cleanup without permanent profile additions',()=>{
 const {e,s,devices}=setup(),{PublicStage1PerformerRun:R}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs');
 e.loadRuntime('utils/userCast.mjs').configureUserCast(true);for(const d of devices.filter(d=>d.sideBranch==='west'))finish(s,d,devices);
 const scene={_userCastPresentation:true,battleData:{stageId:1,performerId:'sakura',campaignChapterId:'opening'},time:{now:0},player:{hp:5,maxHp:5},battleRecord:{playerHitCount:0},paintZone:{sideSet:s,devices,getObjectiveProgress:()=>({completed:10,total:10}),finaleMode:true}};
 const r=new R(scene);scene.time.now=50000;const result=r.finish(true);s.destroy();assert.equal(result.chapterSideSet.completed,4);
 const model=e.loadRuntime('systems/BattleSurfaceView.mjs').getPublicResultSurfaceModel({buttons:[]},result);assert.equal(model.sideSetReview.completed,4);
 assert(!JSON.stringify(e.profile.loadPublicProfile()).includes('chapterSideSet'));assert.equal(e.loadRuntime('systems/BattleSurfaceView.mjs').getPublicResultSurfaceModel({buttons:[]},{...result,chapterSideSet:{...result.chapterSideSet,completed:99}}).sideSetReview,null);
});
test('actual emitter settles its authored origin before capturing telegraph, not after creation',()=>{
 const {e}=api(),source=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 const block=source.slice(source.indexOf('  _spawnPublicStage1StageCueEmitter(restore=null)'),source.indexOf('  _drawPublicStage1AttackCue('));
 const fixture={Phaser:{Math:{Clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}},GAME_WIDTH:375,STAGE1_PAINT_WORLD_HEIGHT:1778,STAGE1_PAINT_WORLD_WIDTH:1000,
  P16_013_STAGE_CUE_EMITTER_WINDUP_MS:800,P16_013_STAGE_CUE_EMITTER_PULSE_SPEED:180,P16_013_STAGE_CUE_EMITTER_DEPTH:2,P16_013_STAGE_CUE_EMITTER_CUE_DEPTH:2,P16_013_STAGE_CUE_EMITTER_PAINT_HP:3,
  PUBLIC_STAGE1_ENEMY_ROLES:{STAGE_CUE_EMITTER:'stage-cue-emitter'},PUBLIC_STAGE1_ENEMY_STATES:{WINDUP:'windup'},COLORS:{BLUE:'blue'},getBattleChapter:d=>({id:d.campaignChapterId}),
  resolveChapterEmitterPlan:e.loadRuntime('utils/chapterEncounterContent.mjs').resolveChapterEmitterPlan};
 const B=new Function(...Object.keys(fixture),'return class {'+block+'}').call(null,...Object.values(fixture));
 const gfx=()=>({setDepth(){return this;},setPosition(){return this;}});
 const spawned=[],s={_isPublicStage1Round:()=>true,_userCastPresentation:true,paintZone:{},player:{x:814,y:1578},battleData:{stageId:1,campaignChapterId:'neon'},
  cameras:{main:{scrollX:627,scrollY:1158}},oldStreet:{freePoint:p=>({x:p.x,y:1229}),clearLine:()=>true},
  physics:{add:{sprite(x,y){const host={x,y,active:true,body:{},setAlpha(){return this;},setDepth(){return this;}};spawned.push(host);return host;}}},
  _configureCenteredArcadeCircle(){},_drawPublicStage1StageCueEmitterGfx(){},_drawPublicStage1AttackCue(){},add:{graphics:gfx},enemies:{add(){}},time:{delayedCall(){return {};}}};
 const enemy=B.prototype._spawnPublicStage1StageCueEmitter.call(s);assert(enemy);assert.equal(enemy.y,1229);assert.equal(enemy.publicStage1EncounterPlan.origin.y,1229);
 assert.equal(enemy.publicStage1CueCapture.capturedY,1578);assert.equal(spawned.length,1);
 for(const point of [null,{x:NaN,y:1229},{x:814,y:1578}]){
  s._publicStage1StageCueEmitter=null;s.oldStreet.freePoint=()=>point;assert.equal(B.prototype._spawnPublicStage1StageCueEmitter.call(s),null);assert.equal(spawned.length,1);
 }
});
