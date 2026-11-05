import test from 'node:test';import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';
import {ChapterChaserMotion} from '../src/utils/chapterChaserContent.mjs';
import {drawCapturedAttackCue} from '../src/systems/EnemyAttackPresentation.mjs';
import {OldStreetState} from '../src/utils/oldStreetMap.mjs';
import {NEON_STREET_PROPS} from '../src/utils/neonStreetMap.mjs';
import {HARBOR_STAGE_PROPS,HARBOR_STAGE_TERRAIN} from '../src/utils/harborStageMap.mjs';
const {BattleScene}=loadScenes().loadRuntime('scenes/BattleScene.js');
function graphics(){const g={active:true,calls:[],depth:0,destroyed:0};for(const name of ['lineStyle','lineBetween','fillStyle','fillTriangle','fillCircle'])g[name]=(...a)=>(g.calls.push([name,...a]),g);g.clear=()=>{g.calls=[];return g;};g.setDepth=d=>(g.depth=d,g);g.destroy=()=>{if(g.active){g.active=false;g.destroyed++;}};return g;}
function fixture(chapter='neon'){
 const enemy={active:true,x:270,y:1540,gfx:{},chapterChaserMotion:new ChapterChaserMotion(chapter),publicStage1EnemyState:'approach'};let allocations=0,bounds=null;
 const state=new OldStreetState(chapter==='neon'?NEON_STREET_PROPS:HARBOR_STAGE_PROPS,chapter==='encore'?HARBOR_STAGE_TERRAIN:[]);
 const s=Object.assign(Object.create(BattleScene.prototype),{player:{x:390,y:1540},oldStreet:{clearLine:(a,b,p)=>state.clearLine(a,b,p)},enemies:{getChildren:()=>[enemy]},actorPresentation:{userCastView:{cueExclusionBounds:()=>bounds}},add:{graphics:()=>{allocations++;return graphics();}},_drawUnlitBlobGfx(){}});
 return {s,enemy,setBounds:v=>bounds=v,get allocations(){return allocations;}};
}
test('real legal neon/harbor roof-overhang rushes own the existing10.4 tactical warning layer',()=>{
 for(const id of ['neon','encore']){const f=fixture(id);f.s._updateChapterChaser(f.enemy,0,16);assert.equal(f.enemy.chapterChaserMotion.state,'windup');assert.equal(f.enemy.chapterChaserCue.depth,10.4);assert(f.enemy.chapterChaserCue.depth>9.4);assert.equal(f.allocations,1);assert.equal(f.enemy.chapterChaserMotion.path.length,144);assert(f.s.oldStreet.clearLine(f.enemy,f.enemy.chapterChaserMotion.path.end,12));}
});
test('every final-pose redraw repairs a stale display depth without recapturing or allocating',()=>{
 const f=fixture();f.s._updateChapterChaser(f.enemy,0,16);const g=f.enemy.chapterChaserCue,path=f.enemy.chapterChaserMotion.path,before=JSON.stringify(path),commands=JSON.stringify(g.calls);g.depth=3.1;
 for(let i=0;i<20;i++)f.s._updatePublicStage1AttackCues(true);assert.equal(g.depth,10.4);assert.equal(f.allocations,1);assert.strictEqual(path,f.enemy.chapterChaserMotion.path);assert.equal(JSON.stringify(path),before);assert.equal(JSON.stringify(g.calls),commands);
});
test('raised warning reuses exact authored commands and final character exclusion',()=>{
 const f=fixture(),box={x:330,y:1510,right:370,bottom:1570};f.setBounds(box);f.s._updateChapterChaser(f.enemy,0,16);const g=f.enemy.chapterChaserCue,expected=graphics();drawCapturedAttackCue(expected,f.enemy.chapterChaserMotion.path,null,box);assert.deepEqual(g.calls,expected.calls);assert.equal(g.depth,10.4);
 for(const c of g.calls.filter(x=>x[0]==='lineBetween'))assert(!(Math.min(c[1],c[3])<box.right&&Math.max(c[1],c[3])>box.x&&Math.min(c[2],c[4])<=box.bottom&&Math.max(c[2],c[4])>=box.y));
});
test('occluding geometry does not gain a path through the existing wall or change collision tuning',()=>{
 const f=fixture();f.enemy.x=450;f.enemy.y=1560;f.s.player={x:390,y:1650};assert.equal(f.s.oldStreet.clearLine(f.enemy,f.s.player,12),false);f.s._updateChapterChaser(f.enemy,0,16);assert.equal(f.enemy.chapterChaserMotion.path,null);assert.equal(f.enemy.chapterChaserCue,null);assert.equal(f.allocations,0);
});
test('pause and result remain no-redraw owners; recovery disposes the same high-layer cue',()=>{
 const f=fixture();f.s._updateChapterChaser(f.enemy,0,16);const g=f.enemy.chapterChaserCue,commands=JSON.stringify(g.calls);for(const key of ['_battlePaused','_battleEnded']){f.s[key]=true;f.s._updatePublicStage1AttackCues();assert.equal(JSON.stringify(g.calls),commands);f.s[key]=false;}
 f.s._updateChapterChaser(f.enemy,601,16);assert.equal(f.enemy.chapterChaserMotion.state,'rush');assert.strictEqual(f.enemy.chapterChaserCue,g);f.enemy.x=414;f.s._updateChapterChaser(f.enemy,650,16);assert.equal(f.enemy.chapterChaserMotion.state,'recovery');assert.equal(f.enemy.chapterChaserCue,null);assert.equal(g.destroyed,1);assert.equal(f.allocations,1);
});
