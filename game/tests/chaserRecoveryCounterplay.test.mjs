import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {loadScenes} from './helpers/publicShellHarness.mjs';

const env=loadScenes(),api=env.loadRuntime('utils/chapterChaserContent.mjs');
const {BattleScene}=env.loadRuntime('scenes/BattleScene.js');
const view=env.loadRuntime('systems/EnemyAttackPresentation.mjs');
function graphics(){
 const g=Object.assign(new EventEmitter(),{active:true,calls:[],x:0,y:0});
 for(const m of ['lineStyle','lineBetween','fillStyle','fillCircle','fillTriangle'])g[m]=(...a)=>(g.calls.push([m,...a]),g);
 g.clear=()=>{g.calls=[];return g;};g.setDepth=d=>(g.depth=d,g);
 g.destroy=()=>{g.active=false;g.emit('destroy');};return g;
}
function fixture(chapter='neon'){
 const motion=new api.ChapterChaserMotion(chapter);motion.recover(1000);
 const e={active:true,x:500,y:500,hp:10,publicStage1EnemyRole:'unlit-chaser',publicStage1EnemyState:'recovery',chapterChaserMotion:motion,gfx:graphics()};
 let now=1000,hits=0,allocated=0,bounds=null;
 const s=Object.assign(Object.create(BattleScene.prototype),{_userCastPresentation:true,
  battleData:{stageId:1,campaignChapterId:chapter,performerId:'sakura'},_isPublicStage1Round:()=>true,
  publicPerformerRun:{now:()=>now},_onEnemyHitPlayer:()=>{hits++;},add:{graphics:()=>{allocated++;return graphics();}},
  actorPresentation:{userCastView:{cueExclusionBounds:()=>bounds}}});
 return {s,e,motion,setNow:n=>{now=n;},setBounds:b=>{bounds=b;},get hits(){return hits;},get allocated(){return allocated;}};
}

test('real Scene allows close-range counterattack only inside the actual recovery interval',()=>{
 const f=fixture();assert.equal(f.s._onEnemyContactPlayer(f.e),false);assert.equal(f.hits,0);
 f.setNow(1719.999);assert.equal(f.s._onEnemyContactPlayer(f.e),false);
 f.setNow(1720);assert.equal(f.s._onEnemyContactPlayer(f.e),true);assert.equal(f.hits,1);
});
test('authoritative recovery query uses actual matching motion and bounded action time',()=>{
 assert.equal(typeof api.getChapterChaserRecoveryRemaining,'function');const f=fixture(),get=api.getChapterChaserRecoveryRemaining;
 assert.equal(get(f.e,1000,'neon'),720);assert.equal(get(f.e,1719,'neon'),1);
 for(const now of [999,1720,Infinity,NaN])assert.equal(get(f.e,now,'neon'),0);
 assert.equal(get(f.e,1000,'encore'),0);assert.equal(get(f.e,1000,'opening'),0);
});
test('approach, tell, rush, guard and return keep their existing contact danger',()=>{
 for(const state of ['approach','windup','rush','guard','return']){const f=fixture();f.e.publicStage1EnemyState=f.motion.state=state;
  assert.equal(f.s._onEnemyContactPlayer(f.e),true,state);assert.equal(f.hits,1);}
});
test('opening, legacy presentation and a forged recovery label never gain immunity',()=>{
 for(const patch of [f=>{f.s.battleData.campaignChapterId='opening';},f=>{f.s._userCastPresentation=false;},
  f=>{f.e.chapterChaserMotion=null;},f=>{f.e.chapterChaserMotion={...f.motion};},f=>{f.motion.state='rush';}]){
  const f=fixture();patch(f);assert.equal(f.s._onEnemyContactPlayer(f.e),true);assert.equal(f.hits,1);}
});
test('encore flank uses the same safe recovery without changing paint eligibility',()=>{
 const f=fixture('encore');assert.equal(f.s._onEnemyContactPlayer(f.e),false);
 assert(env.loadRuntime('systems/PublicStage1EnemyRoles.mjs').canEnemyBePublicStage1PaintTarget(f.e));
 assert.equal(api.CHAPTER_CHASER_TUNING.recoveryMs,720);assert.equal(api.CHAPTER_CHASER_TUNING.rushSpeed,180);
});
test('other enemy roles and dead owners retain the previous role contract',()=>{
 for(const role of ['stage-cue-emitter','objective-disruptor','spotlight-captain','finale-boss','finale-weak-point']){
  const f=fixture();f.e.publicStage1EnemyRole=role;assert.equal(f.s._onEnemyContactPlayer(f.e),false);assert.equal(f.hits,0);}
 const f=fixture();f.e.active=false;assert.equal(f.s._onEnemyContactPlayer(f.e),false);
});
test('recovery cue reuses a single graphics owner, shrinks, and expires exactly with safe contact',()=>{
 const f=fixture();assert.equal(typeof f.s._syncChapterChaserRecoveryCue,'function');f.s._syncChapterChaserRecoveryCue(f.e);
 const g=f.e.chapterChaserRecoveryCue;assert(g?.active);const full=g.calls.filter(c=>c[0]==='lineBetween').at(-1);
 f.setNow(1360);f.s._syncChapterChaserRecoveryCue(f.e);assert.strictEqual(f.e.chapterChaserRecoveryCue,g);assert.equal(f.allocated,1);
 const half=g.calls.filter(c=>c[0]==='lineBetween').at(-1);assert(Math.hypot(half[3]-half[1],half[4]-half[2])<Math.hypot(full[3]-full[1],full[4]-full[2]));
 f.setNow(1720);f.s._syncChapterChaserRecoveryCue(f.e);assert.equal(f.e.chapterChaserRecoveryCue,null);assert.equal(g.active,false);
});
test('owner destruction cleans recovery marker, repeated recovery adds no destroy listener',()=>{
 const f=fixture();assert.equal(typeof f.s._syncChapterChaserRecoveryCue,'function');f.s._syncChapterChaserRecoveryCue(f.e);
 const first=f.e.chapterChaserRecoveryCue;f.setNow(1720);f.s._syncChapterChaserRecoveryCue(f.e);
 f.motion.recover(2000);f.setNow(2000);f.s._syncChapterChaserRecoveryCue(f.e);const second=f.e.chapterChaserRecoveryCue;
 assert.equal(first.active,false);assert.equal(f.e.gfx.listenerCount('destroy'),1);f.e.gfx.destroy();
 assert.equal(second.active,false);assert.equal(f.e.chapterChaserRecoveryCue,null);
});
test('pause freezes visible duration, resumed saved age does not renew safe time',()=>{
 const f=fixture();assert.equal(typeof f.s._syncChapterChaserRecoveryCue,'function');f.setNow(1500);f.s._syncChapterChaserRecoveryCue(f.e);
 const g=f.e.chapterChaserRecoveryCue,before=JSON.stringify(g.calls);f.s._battlePaused=true;f.setNow(1600);f.s._syncChapterChaserRecoveryCue(f.e);
 assert.equal(JSON.stringify(g.calls),before);f.s._battlePaused=false;f.s._syncChapterChaserRecoveryCue(f.e);
 assert.notEqual(JSON.stringify(g.calls),before);assert.equal(api.getChapterChaserRecoveryRemaining(f.e,1600,'neon'),120);
});
test('marker respects submitted character exclusion and has no artwork or text dependency',()=>{
 assert.equal(typeof view.drawChaserRecoveryCue,'function');const g=graphics(),box={x:480,y:460,right:520,bottom:510};
 view.drawChaserRecoveryCue(g,{x:500,y:500,remainingMs:720,durationMs:720},box);assert.equal(g.calls.length,0);
 view.drawChaserRecoveryCue(g,{x:500,y:500,remainingMs:720,durationMs:720});assert(g.calls.length>0);
 for(const c of g.calls.filter(c=>c[0]==='lineBetween'))assert(c.slice(1).every(Number.isFinite));
});

test('actual windup-rush-end transition opens the window without changing captured geometry',()=>{
 const f=fixture();f.motion.state='approach';f.e.publicStage1EnemyState='approach';f.e.maxHp=10;
 Object.assign(f.s,{player:{x:600,y:500},enemies:{getChildren:()=>[f.e]},oldStreet:{clearLine:()=>true},_drawUnlitBlobGfx(){}});
 const cue=()=>f.s._updateChapterChaser(f.e,0,16);
 f.setNow(0);cue();const path=JSON.stringify(f.motion.path);assert.equal(f.motion.state,'windup');assert.equal(f.e.chapterChaserRecoveryCue,null);
 f.setNow(600);cue();assert.equal(f.motion.state,'rush');assert.equal(JSON.stringify(f.motion.path),path);
 f.e.x=624;f.setNow(700);cue();assert.equal(f.motion.state,'recovery');assert(f.e.chapterChaserRecoveryCue.active);
 assert.equal(f.s._onEnemyContactPlayer(f.e),false);f.setNow(1420);cue();assert.equal(f.e.chapterChaserRecoveryCue,null);
 assert.equal(f.s._onEnemyContactPlayer(f.e),true);
});
test('invalid owner health and stale path cannot grant contact safety or a marker',()=>{
 assert.equal(typeof api.getChapterChaserRecoveryRemaining,'function');
 for(const hp of [0,-1,NaN,Infinity]){const f=fixture();f.e.hp=hp;assert.equal(api.getChapterChaserRecoveryRemaining(f.e,1000,'neon'),0);}
 const f=fixture();f.motion.path={};assert.equal(api.getChapterChaserRecoveryRemaining(f.e,1000,'neon'),0);
});
