import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';
import {ChapterChaserMotion} from '../src/utils/chapterChaserContent.mjs';
const {BattleScene}=loadScenes().loadRuntime('scenes/BattleScene.js');
function fixture(){
 let now=1000,bounds=null;
 const gfx={active:true,calls:[],clear(){this.calls=[];return this;},setDepth(){return this;}};
 for(const m of ['lineStyle','lineBetween','fillStyle','fillTriangle','fillCircle'])gfx[m]=(...a)=>(gfx.calls.push([m,...a]),gfx);
 const motion=new ChapterChaserMotion('encore');
 motion.advance({now:1000,deltaMs:16,position:{x:300,y:500},player:{x:400,y:500},canCommit:true,clearLine:()=>true});
 const enemy={active:true,x:300,y:500,hp:36,chapterChaserCue:gfx,chapterChaserMotion:motion};
 const scene={publicPerformerRun:{now:()=>now},actorPresentation:{userCastView:{cueExclusionBounds:()=>bounds}}};
 const draw=()=>{BattleScene.prototype._drawChapterChaserCue.call(scene,enemy);return JSON.parse(JSON.stringify(gfx.calls));};
 return{scene,enemy,gfx,draw,at:t=>{now=t;},exclude:b=>{bounds=b;}};
}
test('actual chaser caller exposes different charge beats over its real600ms windup without recapturing the path',()=>{
 const f=fixture(),p=f.enemy.chapterChaserMotion.path,before=JSON.stringify(p),early=f.draw();
 f.at(1250);const middle=f.draw();f.at(1450);const late=f.draw();
 assert.notDeepEqual(early,middle,'Static lane has no visible windup timing');assert.notDeepEqual(middle,late);
 assert.strictEqual(f.enemy.chapterChaserMotion.path,p);assert.equal(JSON.stringify(p),before);
 assert(early.length<=100&&middle.length===early.length&&late.length===early.length);
});
test('frozen run time leaves charge rendering frozen, while negative/nonfinite/out-of-window ages add nothing',()=>{
 const f=fixture();f.at(1300);assert.deepEqual(f.draw(),f.draw());
 for(const t of [999,NaN,1600,5000]){f.at(t);const a=f.draw();f.scene.publicPerformerRun=null;assert.deepEqual(a,f.draw());f.scene.publicPerformerRun={now:()=>t};}
});
test('charge glyphs remain whole outside player body exclusion, and never change existing lane clipping',()=>{
 const f=fixture();f.at(1500);f.exclude({x:200,y:480,right:400,bottom:520});const a=f.draw();
 f.scene.publicPerformerRun=null;assert.deepEqual(a,f.draw(),'Hidden charge must not bridge the player exclusion');
});
test('a close character covering the full forward tell keeps source-rear timing visible without bridging the body',()=>{
 const f=fixture();f.exclude({x:312,y:480,right:450,bottom:520});const early=f.draw();f.at(1450);const late=f.draw();
 assert.notDeepEqual(early,late,'Forward body exclusion erased every charge beat');
 f.scene.publicPerformerRun=null;const base=f.draw(),extra=late.slice(base.length).filter(c=>c[0]==='lineBetween');
 assert(extra.length>0);assert(extra.every(c=>Math.max(c[1],c[3])<300),'Rear marker cannot bridge back through the player');
});
test('only windup owns charge timing; rush/recovery/inactive/missing paths never retain extra glyphs',()=>{
 for(const state of ['rush','recovery']){const f=fixture();f.at(1450);f.enemy.chapterChaserMotion.state=state;const a=f.draw();f.scene.publicPerformerRun=null;assert.deepEqual(a,f.draw());}
 for(const mode of ['inactive','missing']){const f=fixture();if(mode==='inactive')f.enemy.active=false;else f.enemy.chapterChaserMotion.path=null;assert.deepEqual(f.draw(),[]);}
});
