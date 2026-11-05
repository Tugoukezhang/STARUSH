import test from 'node:test';
import assert from 'node:assert/strict';
import {UserWeaponFx,USER_WEAPON_FX,RIFLE_COMIC_MUZZLE} from '../src/systems/UserWeaponFx.mjs';

function fixture(id='sakura'){
 let time=0;const nodes=[];
 const scene={_userCastPresentation:true,player:{x:100,y:100,hp:5,active:true},
  publicPerformerRun:{now:()=>time},oldStreet:{clearLine:()=>true},textures:{exists:()=>true},
  add:{image(x,y,key){const n={key,x,y,frame:0,dead:0,setOrigin(){return this;},setDisplaySize(){return this;},setTint(){return this;},setAlpha(a){this.alpha=a;return this;},setDepth(){return this;},setRotation(a){this.angle=a;return this;},setFrame(f){this.frame=f;return this;},destroy(){this.dead++;}};nodes.push(n);return n;}}};
 return {scene,fx:new UserWeaponFx(scene,id),nodes,setTime:t=>time=t};
}

test('real basic shots use rifle spray, sword sweep and hammer burst instead of three gun muzzles',()=>{
 for(const [id,kind] of [['sakura','spray'],['kai','sweep'],['enjo','burst']]){
  const {fx,nodes}=fixture(id);const b={active:true,paintShot:true,x:116,y:88,moveVx:200,moveVy:100,body:{owner:'physics'}};
  assert.equal(fx.shot(b,0),true);assert.equal(nodes[0].key,id==='sakura'?RIFLE_COMIC_MUZZLE.key:USER_WEAPON_FX[kind].key,id);
  assert.equal(nodes[0].angle,Math.atan2(100,200)+(id==='enjo'?Math.PI/2:0));assert.deepEqual(b.body,{owner:'physics'});assert.equal(fx.shot(b,0),false);
 }
});

test('dense basic fire culls incidental cues before an in-flight skill release',()=>{
 const {fx,nodes}=fixture('enjo');assert.equal(fx.release({x:100,y:100,radius:100,start:0}),true);
 const release=nodes[0];for(let i=0;i<40;i++)fx.impact({x:100,y:100,hit:true});
 assert.equal(fx.rows.length,24);assert.equal(release.dead,0);assert.ok(fx.rows.some(r=>r.node===release));
 fx.destroy();assert.equal(release.dead,1);
});

test('accepted-hit contact cel is readable for at least two samples at 30fps without excessive fade',()=>{
 for(const fps of [30,60])for(const offset of [0,8,16,24,32]){
  const {fx,nodes,setTime}=fixture();fx.impact({x:120,y:100,hit:true});const samples=[];
  for(let t=offset;t<220;t+=1000/fps){setTime(t);fx.update(t,{depth:12});if(nodes[0].frame===2)samples.push(nodes[0].alpha);}
  assert.ok(samples.length>=2,`${fps}fps offset ${offset}: ${samples.length} contact samples`);
  assert.ok(samples.every(a=>a>=.8),'do not fade away the contact before recovery');
 }
});

test('contact, recovery and cleanup run on the existing paused run clock and never change damage',()=>{
 const {scene:s,fx,nodes,setTime}=fixture('enjo');fx.impact({x:120,y:100,hit:true});setTime(60);fx.update(60,{depth:12});
 assert.equal(nodes[0].frame,2);const alpha=nodes[0].alpha;s._battlePaused=true;setTime(60);fx.update(6000,{depth:12});assert.equal(nodes[0].alpha,alpha);
 s._battlePaused=false;setTime(170);fx.update(6110,{depth:12});assert.ok(nodes[0].frame>2);assert.ok(nodes[0].alpha<alpha);
 setTime(220);fx.update(6160,{depth:12});assert.equal(nodes[0].dead,1);assert.equal(fx.rows.length,0);assert.equal(s.player.hp,5);
 fx.destroy();fx.destroy();assert.equal(nodes[0].dead,1);
});

test('rifle emission also holds its authored contact for two 30fps samples',()=>{
 for(const offset of [0,8,16,24,32]){
  const {fx,nodes,setTime}=fixture();fx.shot({active:true,paintShot:true,x:116,y:88,moveVx:200,moveVy:0},0);let count=0;
  for(let t=offset;t<140;t+=1000/30){setTime(t);fx.update(t,{depth:12});if(nodes[0].frame===2){count++;assert.equal(nodes[0].alpha,.78);}}
  assert.ok(count>=2,'contact skipped at phase '+offset);
 }
});
