import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';
import {ActorPresentation} from '../src/systems/ActorPresentation.mjs';
import {EventEmitter} from 'node:events';
import {OpeningStreetCamera} from '../src/systems/OpeningStreetCamera.mjs';
import {ChapterChaserMotion} from '../src/utils/chapterChaserContent.mjs';
const {BattleScene}=loadScenes().loadRuntime('scenes/BattleScene.js');
function graphics(){const g={active:true,calls:[],depth:0,clears:0};for(const method of ['lineStyle','lineBetween','fillStyle','fillCircle','fillTriangle'])g[method]=(...args)=>{g.calls.push([method,...args]);return g;};g.clear=()=>{g.calls=[];g.clears++;return g;};g.setDepth=d=>(g.depth=d,g);g.destroy=()=>{g.active=false;};return g;}
function fixture(){
 const motion=new ChapterChaserMotion('neon');
 const enemy={active:true,x:500,y:500,hp:10,maxHp:10,gfx:{},chapterChaserMotion:motion};
 let bounds={x:650,y:480,right:690,bottom:520},allocations=0;
 const scene=Object.assign(Object.create(BattleScene.prototype),{player:{x:600,y:500},oldStreet:{clearLine:()=>true},enemies:{getChildren:()=>[enemy]},add:{graphics:()=>{allocations++;return graphics();}},actorPresentation:{userCastView:{cueExclusionBounds:()=>bounds}},_drawUnlitBlobGfx(){}});
 return {scene,enemy,setBounds:value=>{bounds=value;},get allocations(){return allocations;}};
}
const body={x:540,y:476,right:570,bottom:524};
function crossesBody(g,b){return g.calls.some(c=>c[0]==='lineBetween'&&Math.min(c[1],c[3])<b.right&&Math.max(c[1],c[3])>b.x&&Math.min(c[2],c[4])<=b.bottom&&Math.max(c[2],c[4])>=b.y);}
test('camera-follow cue refresh clips against the final body pose without recapturing the rush',()=>{
 const f=fixture();f.scene._updateChapterChaser(f.enemy,0,16);
 const path=f.enemy.chapterChaserMotion.path,before=JSON.stringify(path),g=f.enemy.chapterChaserCue;
 assert.equal(f.enemy.chapterChaserMotion.state,'windup');assert(crossesBody(g,body),'Old pose must expose the reproduction');
 f.setBounds(body);f.scene._updatePublicStage1AttackCues();
 assert(!crossesBody(g,body),'Final-camera strokes still cross the submitted character body');
 assert.strictEqual(f.enemy.chapterChaserMotion.path,path);assert.equal(JSON.stringify(path),before);
 for(const c of g.calls.filter(c=>c[0]==='fillTriangle'))assert([c[1],c[3],c[5]].every(x=>x<body.x)||[c[1],c[3],c[5]].every(x=>x>body.right),'Filled corridor crosses the body');
 assert.equal(f.allocations,1);assert.equal(g.depth,10.4);
});
test('windup and rush redraws reuse the same cue; recovery keeps lifecycle ownership',()=>{
 const f=fixture();f.scene._updateChapterChaser(f.enemy,0,16);const g=f.enemy.chapterChaserCue,path=f.enemy.chapterChaserMotion.path;
 f.setBounds(body);f.scene._updateChapterChaser(f.enemy,601,16);assert.equal(f.enemy.chapterChaserMotion.state,'rush');
 for(let i=0;i<50;i++)f.scene._updatePublicStage1AttackCues();
 assert.strictEqual(f.enemy.chapterChaserCue,g);assert.strictEqual(f.enemy.chapterChaserMotion.path,path);assert.equal(f.allocations,1);assert(!crossesBody(g,body));
 f.enemy.x=644;f.scene._updateChapterChaser(f.enemy,650,16);assert.equal(f.enemy.chapterChaserMotion.state,'recovery');assert.equal(f.enemy.chapterChaserCue,null);assert.equal(g.active,false);
 const clears=g.clears;f.scene._updatePublicStage1AttackCues();assert.equal(g.clears,clears);assert.equal(f.allocations,1);
});
test('paused, ended, inactive and legacy refined owners do not redraw chaser cues',()=>{
 const f=fixture();f.scene._updateChapterChaser(f.enemy,0,16);const g=f.enemy.chapterChaserCue,clears=g.clears;
 for(const flag of ['_battlePaused','_battleEnded']){f.scene[flag]=true;f.scene._updatePublicStage1AttackCues();assert.equal(g.clears,clears);f.scene[flag]=false;}
 f.enemy.active=false;f.scene._updatePublicStage1AttackCues();assert.equal(g.clears,clears);f.enemy.active=true;
 f.scene.actorPresentation.sakuraView={state:{refined:true}};f.scene._updatePublicStage1AttackCues();assert.equal(g.clears,clears);
 f.scene._updatePublicStage1AttackCues(true);assert.equal(g.clears,clears+1);
 f.enemy.chapterChaserMotion.dispose();f.scene._updateChapterChaser(f.enemy,700,16);assert.equal(g.active,false);assert.equal(f.enemy.chapterChaserCue,null);
});
test('non-camera user-cast postphysics frame refreshes cues after actor and street submission',()=>{
 const order=[],scene={player:{active:true},playerGfx:{clear(){}},oldStreet:{sync(){order.push('world');}},_updatePublicStage1AttackCues(ready){assert.equal(ready,true);order.push('cue');}};
 const actor=Object.assign(Object.create(ActorPresentation.prototype),{scene,userCastView:{},playerImage:{active:true},pendingPlayerFrame:{now:1,moving:false,bulletColor:1},drawPlayerFrame(){order.push('actor');}});
 actor.flushPlayerFrame();assert.deepEqual(order,['actor','world','cue']);
 order.length=0;scene.openingStreetCamera={};actor.pendingPlayerFrame={now:2,moving:false,bulletColor:1};actor.flushPlayerFrame();assert.deepEqual(order,['actor','world'],'Camera-follow owns its final redraw');
 order.length=0;scene.openingStreetCamera.disposed=true;actor.pendingPlayerFrame={now:3,moving:false,bulletColor:1};actor.flushPlayerFrame();assert.deepEqual(order,['actor','world','cue']);
 for(const flag of ['_battlePaused','_battleEnded','_publicBattleDialog']){order.length=0;scene[flag]=true;actor.pendingPlayerFrame={now:3,moving:false,bulletColor:1};actor.flushPlayerFrame();assert.deepEqual(order,[]);scene[flag]=false;}
});
test('real camera-follow listener with a synthetic event clips and unregisters on destroy',()=>{
 const f=fixture(),main=Object.assign(new EventEmitter(),{id:1,width:375,height:667,setZoom(){return this;},setFollowOffset(){return this;},setDeadzone(){return this;}});
 f.scene.cameras={main,add:()=>({id:2}),remove(){}};f.scene.children={list:[]};f.scene.events=new EventEmitter();
 f.scene._updateChapterChaser(f.enemy,0,16);f.setBounds(body);
 const camera=new OpeningStreetCamera(f.scene);assert(crossesBody(f.enemy.chapterChaserCue,body));main.emit('followupdate');assert(!crossesBody(f.enemy.chapterChaserCue,body));
 const clears=f.enemy.chapterChaserCue.clears;camera.destroy();main.emit('followupdate');assert.equal(f.enemy.chapterChaserCue.clears,clears);assert.equal(main.listenerCount('followupdate'),0);
});
test('diagonal chaser corridor retains both visible sides of an internal body exclusion',()=>{
 const f=fixture();f.scene.player={x:570,y:570};f.scene._updateChapterChaser(f.enemy,0,16);
 const path=f.enemy.chapterChaserMotion.path,before=JSON.stringify(path),middle={x:535,y:535,right:550,bottom:550};
 f.setBounds(middle);f.scene._updatePublicStage1AttackCues();const g=f.enemy.chapterChaserCue,lines=g.calls.filter(c=>c[0]==='lineBetween');
 assert(!crossesBody(g,middle));assert(lines.some(c=>c[1]<middle.x&&c[3]<middle.x));assert(lines.some(c=>c[1]>middle.right&&c[3]>middle.right));
 for(const c of g.calls.filter(c=>c[0]==='fillTriangle'))assert([c[1],c[3],c[5]].every(x=>x<middle.x)||[c[1],c[3],c[5]].every(x=>x>middle.right));
 assert.strictEqual(f.enemy.chapterChaserMotion.path,path);assert.equal(JSON.stringify(path),before);assert.equal(f.allocations,1);
});
