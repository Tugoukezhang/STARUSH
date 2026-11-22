import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
const helper=new URL('../src/utils/chapterChaserContent.mjs',import.meta.url);
function api(){assert.ok(existsSync(helper),'Missing real chapter chaser behavior');return loadScenes().loadRuntime('utils/chapterChaserContent.mjs');}
const point={x:200,y:200},player={x:300,y:200};
const input=(now=0,extra={})=>({now,deltaMs:16,position:point,player,clearLine:()=>true,canCommit:true,...extra});
test('only current public later chapters opt in; existing opening and hidden stay unchanged',()=>{
 const {getChapterChaserProfile:get}=api();
 for(const id of ['opening','unknown',null])assert.equal(get(id),null);
 assert.equal(get('neon').id,'committed-rush');assert.equal(get('encore').id,'flank-rush');
 const src=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 assert.match(src,/_userCastPresentation[\s\S]*getChapterChaserProfile/);
 assert.match(src,/_updateChapterChaser\(e, time, delta\)/);
});
test('rush has stationary tell, captures once and cannot home after player moves',()=>{
 const {ChapterChaserMotion}=api(),m=new ChapterChaserMotion('neon');
 const a=m.advance(input());assert.equal(a.state,'windup');assert.equal(a.vx,0);assert.equal(a.path.radius,12);
 const frozen=plain(a.path);assert.equal(m.advance(input(599,{player:{x:200,y:400}})).state,'windup');
 const r=m.advance(input(600,{player:{x:200,y:400}}));
 assert.equal(r.state,'rush');assert.ok(r.vx>0);assert.equal(r.vy,0);assert.deepEqual(plain(r.path),frozen);
});
test('harbor flanks while neon approaches directly, blocked flank falls back to real direct path',()=>{
 const {ChapterChaserMotion}=api(),far={x:450,y:200};
 const a=new ChapterChaserMotion('neon').advance(input(0,{player:far,canCommit:false}));
 const b=new ChapterChaserMotion('encore').advance(input(0,{player:far,canCommit:false}));
 assert.equal(a.vy,0);assert.notEqual(b.vy,0);assert.ok(Math.abs(Math.hypot(b.vx,b.vy)-48)<1e-9);
 const blocked=new ChapterChaserMotion('encore').advance(input(0,{player:far,clearLine:(a,b)=>b.y===200,canCommit:false}));
 assert.equal(blocked.vy,0);
});
test('no extra immunity or contact damage; same unlit role remains paintable during every phase',()=>{
 const env=loadScenes(),roles=env.loadRuntime('systems/PublicStage1EnemyRoles.mjs');
 for(const state of ['approach','windup','rush','recovery']){
 const e={active:true,publicStage1EnemyRole:'unlit-chaser',publicStage1EnemyState:state};
 assert(roles.canEnemyBePublicStage1PaintTarget(e));assert(roles.canEnemyDealContactDamage({enemy:e,isPublicStage1:true}));
 }
});
test('commit admission serializes threats and rejects occluded or dangerously close targets',()=>{
 const {ChapterChaserMotion}=api();
 for(const patch of [{canCommit:false},{clearLine:()=>false},{player:{x:210,y:200}}])
 assert.equal(new ChapterChaserMotion('neon').advance(input(0,patch)).state,'approach');
});
test('rush never overshoots captured endpoint even with a long frame, then recovers',()=>{
 const {ChapterChaserMotion}=api(),m=new ChapterChaserMotion('neon');
 m.advance(input());m.advance(input(600));
 const r=m.advance(input(616,{deltaMs:1000}));
 assert.equal(r.state,'rush');assert.ok(Math.hypot(r.vx,r.vy)<=124);
 assert(Math.abs(r.vx*1-124)<.000001);
 const rest=m.advance(input(1616,{position:{x:324,y:200}}));assert.equal(rest.state,'recovery');assert.equal(rest.vx,0);
 assert.equal(m.advance(input(2335,{position:{x:324,y:200}})).state,'recovery');
 assert.equal(m.advance(input(2336,{position:{x:324,y:200},canCommit:false})).state,'approach');
});
test('a wall stops the real step before crossing; frozen route is never rerouted through cover',()=>{
 const {ChapterChaserMotion}=api(),m=new ChapterChaserMotion('neon');
 m.advance(input());m.advance(input(600));
 const r=m.advance(input(616,{clearLine:()=>false}));
 assert.equal(r.state,'recovery');assert.equal(r.vx,0);assert.equal(r.path,null);
});
test('invalid frame and disposal fail closed; no timer can revive a killed owner',()=>{
 const {ChapterChaserMotion}=api(),m=new ChapterChaserMotion('neon');
 m.advance(input());assert.equal(m.advance(input(1,{deltaMs:NaN})).vx,0);
 m.dispose();for(const n of [600,9000]){const r=m.advance(input(n));assert.equal(r.state,'cleared');assert.equal(r.path,null);assert.equal(r.vx,0);}
});
test('captured endpoint stays inside body-safe world bounds and can reach recovery',()=>{
 const {ChapterChaserMotion}=api(),m=new ChapterChaserMotion('neon');
 const frame=m.advance(input(0,{position:{x:100,y:200},player:{x:20,y:200}}));
 assert.equal(frame.path.end.x,12);
 assert.equal(m.advance(input(600,{position:{x:12,y:200},player:{x:20,y:200}})).state,'recovery');
});
test('chapter copy explains real counterplay without promising guaranteed enemy attacks',()=>{
 const env=loadScenes();const {getChapterEncounterSummary:get}=env.loadRuntime('utils/chapterEncounterContent.mjs');
 assert.match(get('neon'),/突进/);assert.match(get('encore'),/侧翼/);
 assert.match(get('neon'),/提前击败/);
});
test('new brace does not remove the old chaser travel pose',()=>{
 const {createEnemyMotion,advanceEnemyMotion}=loadScenes().loadRuntime('systems/EnemyEnsembleMotion.mjs');
 const old=createEnemyMotion('unlit-chaser',{state:'recovery'});
 assert.notEqual(advanceEnemyMotion(old,{now:100,x:3,y:0,state:'recovery'}).rotation,0);
 const fresh=createEnemyMotion('unlit-chaser',{state:'windup'});
 assert(advanceEnemyMotion(fresh,{now:200,x:0,y:0,state:'windup',chaserState:'windup'}).rotation<0);
});
test('real Scene spawn owns the new motion/cue and destruction; opening retains its timer',()=>{
 const env=loadScenes(),src=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 const block=src.slice(src.indexOf('  _spawnUnlitBlob() {'),src.indexOf('  _getPublicStage1EncounterCadence() {'));
 const deps={...env.loadRuntime('utils/chapterChaserContent.mjs'),
 ...env.loadRuntime('systems/PublicStage1EnemyRoles.mjs'),...env.loadRuntime('utils/stage1PaintRound.mjs'),
 getBattleChapter:env.campaign.getBattleChapter,getPublicStage1ReactionColor:()=> 'pink',
 GAME_WIDTH:375,GAME_HEIGHT:667,Phaser:{Math:{Between:a=>a,Clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}},
 drawCapturedAttackCue:(g,p)=>{g.path=plain(p);},
 drawChaserWindupTiming:env.loadRuntime('systems/EnemyAttackPresentation.mjs').drawChaserWindupTiming};
 const methods=new Function(...Object.keys(deps),'return class {'+block+'};')(...Object.values(deps)).prototype;
 function fixture(id){
  const nodes=[],timers=[];
  const node=(x=0,y=0)=>({active:true,x,y,body:{},setAlpha(){return this;},setDepth(){return this;},setPosition(){return this;},clear(){return this;},once(_event,fn){this.onDestroy=fn;},
   destroy(){this.active=false;this.onDestroy?.();}});
  const s={battleData:{campaignChapterId:id},_userCastPresentation:true,_isPublicStage1Round:()=>true,
   paintZone:{isComplete:()=>false,clampPlayerY:y=>y},player:{x:200,y:200},cameras:{main:{scrollX:0,scrollY:0}},
   _getPublicStage1EncounterCadence:()=>({unlitMax:4}),_countUnlitBlobs:()=>0,_configureCenteredArcadeCircle(){},
   _drawUnlitBlobGfx(){},_publicStage1ColorCueSequence:0,
   oldStreet:{freePoint:()=>({x:100,y:200}),clearLine:()=>true},enemies:{add:n=>nodes.push(n),getChildren:()=>nodes},
   add:{graphics:()=>node()},physics:{add:{sprite:node}},time:{addEvent:t=>{timers.push(t);return t;}}};
  Object.assign(s,{_deferUnlitSpawnForCue:methods._deferUnlitSpawnForCue,_usesOpeningStreetPursuit:methods._usesOpeningStreetPursuit,_updateChapterChaser:methods._updateChapterChaser,_drawChapterChaserCue:methods._drawChapterChaserCue});return {s,nodes,timers};
 }
 const {s,nodes,timers}=fixture('neon');methods._spawnUnlitBlob.call(s);
 const e=nodes[0];assert(e.chapterChaserMotion);assert.equal(timers.length,0);
 methods._updateChapterChaser.call(s,e,0,16);assert.equal(e.publicStage1EnemyState,'windup');assert(e.chapterChaserCue.active);
 const cue=e.chapterChaserCue;e.gfx.destroy();assert.equal(e.chapterChaserMotion.state,'cleared');assert.equal(cue.active,false);assert.equal(e.chapterChaserCue,null);
 const old=fixture('opening');methods._spawnUnlitBlob.call(old.s);assert.equal(old.nodes[0].chapterChaserMotion,undefined);assert.equal(old.timers.length,1);
});
