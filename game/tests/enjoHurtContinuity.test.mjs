import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {getUserCastArt} from '../src/utils/userCast.mjs';
import {UserCastPresentation} from '../src/systems/UserCastPresentation.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const key='user-enjo-hurt-20261021',path='art/enjo-hurt-20261021/hurt.png';
function fixture(id='enjo',available=true){
 const nodes=[];const node=(x=0,y=0,k='',frame=0)=>{const n={x,y,texture:{key:k},frame:{name:frame},alpha:1,destroyed:0,
  setPosition(x,y){Object.assign(this,{x,y});return this;},setOrigin(x,y){Object.assign(this,{originX:x,originY:y});return this;},setDisplaySize(w,h){Object.assign(this,{displayWidth:w,displayHeight:h});return this;},setDepth(){return this;},setFlipX(v){this.flipX=v;return this;},setAngle(){return this;},setAlpha(v){this.alpha=v;return this;},setTint(){return this;},
  setTexture(k,f){this.texture.key=k;this.frame.name=f;return this;},getBounds(){return{x:this.x-this.originX*this.displayWidth,y:this.y-this.originY*this.displayHeight,right:this.x+(1-this.originX)*this.displayWidth,bottom:this.y+(1-this.originY)*this.displayHeight};},destroy(){this.destroyed++;}};nodes.push(n);return n;};
 const scene={player:{x:500,y:1000,active:true,hp:6},playerGfx:{alpha:1},battleRecord:{playerHitCount:0},publicPerformerRun:{actions:0},textures:{exists:k=>k!==key||available},add:{image:node,ellipse:node}};
 return{scene,view:new UserCastPresentation(scene,id),nodes};
}
test('only Enjo exposes a four-frame optional hurt bank while all original cels remain',()=>{
 const art=getUserCastArt('enjo');assert.equal(art.motion.hurt?.key,key);assert.equal(art.motion.hurt.path,path);assert.equal(art.motion.hurt.bounds.length,4);
 assert.equal(getUserCastArt('sakura').motion.hurt,undefined);assert.notEqual(getUserCastArt('kai').motion.hurt?.key,key);
 assert.equal(art.motion.frameWidth,384);assert.equal(art.motion.frameHeight,320);assert.match(art.motion.path,/three-cast-actions-20261018\/hammer-cat.webp$/);
});
test('preload adds the bank only for selected Enjo, never other cast or practice',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const {preloadActorPresentation}=e.loadRuntime('systems/ActorPresentation.mjs');
 for(const id of ['enjo','sakura','kai']){const calls=[],scene={load:{image(){},spritesheet:(...args)=>calls.push(args)}};preloadActorPresentation(scene,{stageId:1,performerId:id});assert.equal(calls.filter(c=>c[0]===key).length,id==='enjo'?1:0);if(id==='enjo'){const c=calls.find(c=>c[0]===key);assert.equal(c[1],path);assert.equal(c[2].frameWidth,384);assert.equal(c[2].frameHeight,320);}const count=calls.length;preloadActorPresentation(scene,{stageId:1,performerId:id,practiceMode:true});assert.equal(calls.length,count);}
});
test('hurt plays all four cels in the existing 240ms with invariant size, origin and counters',()=>{
 const {scene:s,view:v}=fixture();v.update(0,false);s.player.x+=15;v.update(5,false);assert.equal(v.image.texture.key,getUserCastArt('enjo').motion.walk.key);s.battleRecord.playerHitCount++;
 const frames=[];for(const now of [10,70,130,190]){v.update(now,false);assert.equal(v.state,'hurt');assert.equal(v.image.texture.key,key);frames.push(v.image.frame.name);assert.equal(v.image.displayWidth,192);assert.equal(v.image.displayHeight,160);assert.equal(v.image.originY,304/320);assert.equal(v.image.y,1026);}
 assert.deepEqual(frames,[0,1,2,3]);v.update(250,false);assert.equal(v.state,'idle');assert.equal(v.image.frame.name,12);assert.equal(v.image.texture.key,getUserCastArt('enjo').motion.key);assert.equal(s.battleRecord.playerHitCount,1);assert.equal(s.player.hp,6);v.destroy();
});
test('hurt has the existing precedence over action then resumes its remaining original action',()=>{
 const {scene:s,view:v}=fixture();v.update(0,false);s.publicPerformerRun.actions++;s.battleRecord.playerHitCount++;v.update(10,false);assert.equal(v.state,'hurt');assert.equal(v.image.texture.key,key);v.update(250,false);assert.equal(v.state,'action');assert.equal(v.image.texture.key,getUserCastArt('enjo').motion.key);v.update(330,false);assert.equal(v.state,'idle');assert.equal(s.publicPerformerRun.actions,1);v.destroy();
});
test('pause preserves the exact hurt cel and clock through resume without changing facing',()=>{
 const {scene:s,view:v}=fixture();v.update(0,false);s.battleRecord.playerHitCount++;v.update(10,false);v.update(80,false);assert.equal(v.image.texture.key,key);const frame=v.image.frame.name,clock=v.clock,flip=v.flip;
 v.update(1000,true);v.update(2000,true);v.update(2010,false);assert.equal(v.image.frame.name,frame);assert.equal(v.clock,clock);assert.equal(v.flip,flip);v.update(2020,false);assert.equal(v.state,'hurt');v.destroy();
});
test('missing hurt bank retains the original four hurt cels, other members stay unchanged',()=>{
 for(const [id,available] of [['enjo',false],['sakura',true]]){const {scene:s,view:v}=fixture(id,available);v.update(0,false);s.battleRecord.playerHitCount++;for(const [n,now] of [10,70,130,190].entries()){v.update(now,false);assert.equal(v.image.texture.key,getUserCastArt(id).motion.key);assert.equal(v.image.frame.name,18+n);}v.destroy();}
});
test('cue exclusion uses each actual hurt frame including mirrored bounds and teardown is once',()=>{
 for(const dx of [-15,15]){const {scene:s,view:v,nodes}=fixture();v.update(0,false);s.player.x+=dx;v.update(5,false);s.battleRecord.playerHitCount++;
  for(const now of [10,70,130,190]){v.update(now,false);assert.equal(v.image.texture.key,key);const r=getUserCastArt('enjo').motion.hurt.bounds[v.image.frame.name],b=v.image.getBounds();assert.deepEqual(v.cueExclusionBounds(),{x:b.x+(v.flip?384-r[2]:r[0])*.5,y:b.y+r[1]*.5,right:b.x+(v.flip?384-r[0]:r[2])*.5,bottom:b.y+r[3]*.5});}
  v.destroy();v.destroy();assert(nodes.every(n=>n.destroyed===1));}
});
test('release declares only the new hurt PNG and preserves the original atlas byte-for-byte',()=>{
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.group==='owner-character-hurt').map(r=>r.file),[path,'art/kai-hurt-20261021/hurt.png']);const png=fs.readFileSync(new URL('../public/'+path,import.meta.url));assert.equal(png.readUInt32BE(16),1536);assert.equal(png.readUInt32BE(20),320);assert.equal(crypto.createHash('sha256').update(png).digest('hex'),'49fce050bfc1ffdfd6474104c6b148b65cf035123337fd13819308f59f4495ed');
 const old=fs.readFileSync(new URL('../public/art/three-cast-actions-20261018/hammer-cat.webp',import.meta.url));assert.equal(crypto.createHash('sha256').update(old).digest('hex'),'c136b885ce05849f99c406874a71fcdc4a970bbd8850ca7ac065271557e4bebd');
});
