import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {getUserCastArt} from '../src/utils/userCast.mjs';
import {UserCastPresentation} from '../src/systems/UserCastPresentation.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const key='user-kai-hurt-20261021',path='art/kai-hurt-20261021/hurt.png';
const bounds=[[16,133,324,306],[29,128,328,305],[26,132,325,306],[16,133,324,306]];
function fixture(id='kai',available=true){
 const nodes=[];const node=(x=0,y=0,k='',frame=0)=>{const n={x,y,texture:{key:k},frame:{name:frame},alpha:1,destroyed:0,
  setPosition(x,y){Object.assign(this,{x,y});return this;},setOrigin(x,y){Object.assign(this,{originX:x,originY:y});return this;},setDisplaySize(w,h){Object.assign(this,{displayWidth:w,displayHeight:h});return this;},setDepth(){return this;},setFlipX(v){this.flipX=v;return this;},setAngle(){return this;},setAlpha(v){this.alpha=v;return this;},setTint(){return this;},
  setTexture(k,f){this.texture.key=k;this.frame.name=f;return this;},getBounds(){return{x:this.x-this.originX*this.displayWidth,y:this.y-this.originY*this.displayHeight,right:this.x+(1-this.originX)*this.displayWidth,bottom:this.y+(1-this.originY)*this.displayHeight};},destroy(){this.destroyed++;}};nodes.push(n);return n;};
 const scene={player:{x:500,y:1000,active:true,hp:6},playerGfx:{alpha:1},battleRecord:{playerHitCount:0},publicPerformerRun:{actions:0},textures:{exists:k=>k!==key||available},add:{image:node,ellipse:node}};
 return{scene,view:new UserCastPresentation(scene,id),nodes};
}
test('Kai exposes a frozen four-frame hurt bank while the original sword atlas and other cast stay unchanged',()=>{
 const art=getUserCastArt('kai'),hurt=art.motion.hurt;assert.equal(hurt?.key,key);assert.equal(hurt.path,path);assert.deepEqual(hurt.bounds,bounds);
 assert(Object.isFrozen(hurt)&&Object.isFrozen(hurt.bounds)&&hurt.bounds.every(Object.isFrozen));
 assert.match(art.motion.path,/three-cast-actions-20261018\/mecha-sword.webp$/);assert.equal(art.motion.key,'user-motion-mecha-sword');
 assert.equal(art.motion.frameWidth,384);assert.equal(art.motion.frameHeight,320);assert.equal(art.motion.originX,240/384);assert.equal(art.motion.originY,304/320);
 assert.equal(art.motion.walk,undefined);assert.equal(art.motion.shoot,undefined);assert.equal(art.motion.bounds.length,24);
 assert.equal(getUserCastArt('enjo').motion.hurt.key,'user-enjo-hurt-20261021');assert.equal(getUserCastArt('sakura').motion.hurt,undefined);
});
test('preload adds the bank only for selected Kai, never other cast or practice',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const {preloadActorPresentation}=e.loadRuntime('systems/ActorPresentation.mjs');
 for(const id of ['kai','sakura','enjo']){const calls=[],scene={load:{image(){},spritesheet:(...args)=>calls.push(args)}};preloadActorPresentation(scene,{stageId:1,performerId:id});assert.equal(calls.filter(c=>c[0]===key).length,id==='kai'?1:0);
  if(id==='kai'){const c=calls.find(c=>c[0]===key);assert.equal(c[1],path);assert.equal(c[2].frameWidth,384);assert.equal(c[2].frameHeight,320);}
  const count=calls.length;preloadActorPresentation(scene,{stageId:1,performerId:id,practiceMode:true});assert.equal(calls.length,count);}
 const calls=[],scene={load:{image(){},spritesheet:(...args)=>calls.push(args)}};preloadActorPresentation(scene,{stageId:1,performerId:'kai',practiceMode:true});assert.equal(calls.filter(c=>c[0]===key).length,0);
});
test('Kai hurt plays all four cels in the existing 240ms with invariant size, origin and counters',()=>{
 const {scene:s,view:v}=fixture();v.update(0,false);assert.equal(v.image.texture.key,getUserCastArt('kai').motion.key);assert.equal(v.image.frame.name,12);s.battleRecord.playerHitCount++;
 const frames=[];for(const now of [10,70,130,190]){v.update(now,false);assert.equal(v.state,'hurt');assert.equal(v.image.texture.key,key);frames.push(v.image.frame.name);
  assert.equal(v.image.displayWidth,192);assert.equal(v.image.displayHeight,160);assert.equal(v.image.originX,1-240/384);assert.equal(v.image.originY,304/320);assert.equal(v.image.y,1026);}
 assert.deepEqual(frames,[0,1,2,3]);v.update(250,false);assert.equal(v.state,'idle');assert.equal(v.image.frame.name,12);assert.equal(v.image.texture.key,getUserCastArt('kai').motion.key);
 assert.equal(s.battleRecord.playerHitCount,1);assert.equal(s.player.hp,6);assert.deepEqual([s.player.x,s.player.y],[500,1000]);v.destroy();
});
test('Kai idle, move and action keep the original atlas cels',()=>{
 const {scene:s,view:v}=fixture(),motion=getUserCastArt('kai').motion;v.update(0,false);assert.equal(v.image.texture.key,motion.key);assert.equal(v.image.frame.name,12);
 s.player.x+=15;v.update(16,false);assert.equal(v.state,'move');assert.equal(v.image.texture.key,motion.key);assert(v.image.frame.name>=6&&v.image.frame.name<12);
 s.publicPerformerRun.actions++;v.update(32,false);assert.equal(v.state,'action');assert.equal(v.image.texture.key,motion.key);assert.equal(v.image.frame.name,14);
 v.update(400,false);assert.equal(v.state,'idle');assert.equal(v.image.texture.key,motion.key);assert.equal(v.image.frame.name,12);v.destroy();
});
test('Kai hurt keeps existing precedence over action then resumes its remaining original action',()=>{
 const {scene:s,view:v}=fixture();v.update(0,false);s.publicPerformerRun.actions++;s.battleRecord.playerHitCount++;v.update(10,false);assert.equal(v.state,'hurt');assert.equal(v.image.texture.key,key);
 v.update(250,false);assert.equal(v.state,'action');assert.equal(v.image.texture.key,getUserCastArt('kai').motion.key);v.update(330,false);assert.equal(v.state,'idle');assert.equal(s.publicPerformerRun.actions,1);v.destroy();
});
test('pause preserves the exact Kai hurt cel and clock through resume without changing facing',()=>{
 const {scene:s,view:v}=fixture();v.update(0,false);s.battleRecord.playerHitCount++;v.update(10,false);v.update(80,false);assert.equal(v.image.texture.key,key);const frame=v.image.frame.name,clock=v.clock,flip=v.flip;
 v.update(1000,true);v.update(2000,true);v.update(2010,false);assert.equal(v.image.frame.name,frame);assert.equal(v.clock,clock);assert.equal(v.flip,flip);v.update(2020,false);assert.equal(v.state,'hurt');v.destroy();
});
test('missing Kai hurt bank falls back to the original 18..21 cels; Sakura stays on its original cels',()=>{
 for(const [id,available] of [['kai',false],['sakura',true]]){const {scene:s,view:v}=fixture(id,available);v.update(0,false);s.battleRecord.playerHitCount++;
  for(const [n,now] of [10,70,130,190].entries()){v.update(now,false);assert.equal(v.state,'hurt');assert.equal(v.image.texture.key,getUserCastArt(id).motion.key);assert.equal(v.image.frame.name,18+n);}v.destroy();}
});
test('cue exclusion uses each actual Kai hurt frame in both facings and teardown is once',()=>{
 for(const dx of [-15,15]){const {scene:s,view:v,nodes}=fixture();v.update(0,false);s.player.x+=dx;v.update(5,false);assert.equal(v.flip,dx>0);s.battleRecord.playerHitCount++;
  for(const now of [10,70,130,190]){v.update(now,false);assert.equal(v.image.texture.key,key);assert.equal(v.image.flipX,dx>0);assert.equal(v.image.originX,dx>0?1-240/384:240/384);
   const r=bounds[v.image.frame.name],b=v.image.getBounds();assert.deepEqual(v.cueExclusionBounds(),{x:b.x+(v.flip?384-r[2]:r[0])*.5,y:b.y+r[1]*.5,right:b.x+(v.flip?384-r[0]:r[2])*.5,bottom:b.y+r[3]*.5});}
  v.destroy();v.destroy();assert(nodes.every(n=>n.destroyed===1));}
});
test('release declares the Kai hurt PNG under the existing hurt group and preserves the original atlas byte-for-byte',()=>{
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.group==='owner-character-hurt').map(r=>r.file),['art/enjo-hurt-20261021/hurt.png',path]);
 const png=fs.readFileSync(new URL('../public/'+path,import.meta.url));assert.equal(png.length,267918);assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1536);assert.equal(png.readUInt32BE(20),320);
 assert.equal(png[24],8);assert.equal(png[25],6,'RGBA alpha retained');
 assert.equal(crypto.createHash('sha256').update(png).digest('hex'),'b79ba57bd65d8eb1bf3b87b9572aee6a10bf21aa1f52f2bdbb73c5b13ef4bd34');
 const old=fs.readFileSync(new URL('../public/art/three-cast-actions-20261018/mecha-sword.webp',import.meta.url));assert.equal(crypto.createHash('sha256').update(old).digest('hex'),'0cc48832b80e50a33f9093a483b8a9ea608004df7f9c9a1b8468a61a60629baa');
});
