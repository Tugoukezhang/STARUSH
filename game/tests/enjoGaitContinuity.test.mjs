import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {getUserCastArt} from '../src/utils/userCast.mjs';
import {UserCastPresentation} from '../src/systems/UserCastPresentation.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';

const key='user-enjo-gait-20261021',path='art/enjo-gait-20261021/walk.png';
function fixture(available=true){
 const nodes=[];
 const node=(x=0,y=0,k='',frame=0)=>{const n={x,y,texture:{key:k},frame:{name:frame},alpha:1,destroyed:0,
  setPosition(x,y){Object.assign(this,{x,y});return this;},setOrigin(x,y){Object.assign(this,{originX:x,originY:y});return this;},
  setDisplaySize(w,h){Object.assign(this,{displayWidth:w,displayHeight:h});return this;},setDepth(){return this;},
  setFlipX(v){this.flipX=v;return this;},setAngle(){return this;},setAlpha(v){this.alpha=v;return this;},setTint(){return this;},
  setTexture(k,f){this.texture.key=k;this.frame.name=f;return this;},
  getBounds(){return {x:this.x-this.originX*this.displayWidth,y:this.y-this.originY*this.displayHeight,right:this.x+(1-this.originX)*this.displayWidth,bottom:this.y+(1-this.originY)*this.displayHeight};},
  destroy(){this.destroyed++;}};nodes.push(n);return n;};
 const scene={player:{x:500,y:1000,active:true,hp:6},playerGfx:{alpha:1},battleRecord:{playerHitCount:0},publicPerformerRun:{actions:0},
  textures:{exists:k=>k!==key||available},add:{image:node,ellipse:node}};
 return {scene,view:new UserCastPresentation(scene,'enjo'),nodes};
}
test('Enjo retains its six-cel walk beside the distinct four-cel rifle bank; all original motion banks remain',()=>{
 const art=getUserCastArt('enjo');assert.equal(art.motion.walk?.key,key);assert.equal(art.motion.walk.path,path);
 assert.equal(art.motion.walk.bounds.length,6);
 assert.equal(getUserCastArt('sakura').motion.walk.key,'user-rifle-walk-20261022');assert.equal(getUserCastArt('sakura').motion.walk.frames,4);assert.equal(getUserCastArt('kai').motion.walk,undefined);
 for(const id of ['sakura','kai','enjo'])assert.match(getUserCastArt(id).motion.path,/three-cast-actions-20261018\/.*\.webp$/);
});
test('only Enjo preloads the new bank, practice and other cast do not',()=>{
 const env=loadScenes();env.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 const {preloadActorPresentation}=env.loadRuntime('systems/ActorPresentation.mjs');
 for(const id of ['sakura','kai','enjo']){const calls=[],s={load:{image(){},spritesheet:(...a)=>calls.push(a)}};
  preloadActorPresentation(s,{stageId:1,performerId:id});assert.equal(calls.filter(a=>a[0]===key).length,id==='enjo'?1:0);
  if(id==='enjo'){const entry=calls.find(a=>a[0]===key);assert.equal(entry[1],path);assert.equal(entry[2].frameWidth,384);assert.equal(entry[2].frameHeight,320);}
  const count=calls.length;preloadActorPresentation(s,{stageId:1,performerId:id,practiceMode:true});assert.equal(calls.length,count);
 }
});
test('six walk phases follow unchanged 15px distance cadence while automatic fire continues',()=>{
 const {scene:s,view:v}=fixture();v.update(0,false);const frames=[];
 for(let i=1;i<=6;i++){s.player.x+=15;v.beginShot(i*60-1,1,0,260);v.update(i*60,false);frames.push(v.image.frame.name);assert.equal(v.state,'move-attack');assert.equal(v.image.texture.key,key);}
 assert.deepEqual(frames,[1,2,3,4,5,0]);assert.equal(v.walkDistance,90);
 assert.equal(v.image.displayWidth,192);assert.equal(v.image.displayHeight,160);assert.equal(v.image.originY,304/320);
 assert.equal(v.image.y,1026);assert.deepEqual(v.handWorld(),{x:606,y:988});assert.equal(s.player.hp,6);
});
test('idle, stationary release and action keep original cels; hurt uses its dedicated bank without changing counters',()=>{
 const {scene:s,view:v}=fixture(),old=getUserCastArt('enjo').motion.key;v.update(0,false);
 assert.equal(v.image.texture.key,old);assert.equal(v.image.frame.name,12);
 s.player.x+=15;v.update(10,false);assert.equal(v.image.texture.key,key);
 v.beginShot(11,1,0,260);v.update(12,false);assert.equal(v.state,'attack');assert.equal(v.image.texture.key,old);assert.equal(v.image.frame.name,14);
 s.publicPerformerRun.actions++;v.update(20,false);assert.equal(v.state,'action');assert.equal(v.image.texture.key,old);assert.equal(v.image.frame.name,14);
 s.battleRecord.playerHitCount++;v.update(30,false);assert.equal(v.state,'hurt');assert.equal(v.image.texture.key,getUserCastArt('enjo').motion.hurt.key);assert.equal(v.image.frame.name,0);
 v.update(1000,false);assert.equal(v.image.texture.key,old);assert.equal(v.image.frame.name,12);
 assert.equal(s.publicPerformerRun.actions,1);assert.equal(s.battleRecord.playerHitCount,1);
});
test('pause holds gait phase and texture, missing optional bank retains legacy walk; teardown once',()=>{
 const {scene:s,view:v,nodes}=fixture();v.update(0,false);s.player.x+=15;v.update(10,false);
 assert.equal(v.image.texture.key,key);const f=v.image.frame.name,d=v.walkDistance;v.update(2000,true);v.update(4000,true);v.update(4010,false);
 assert.equal(v.image.frame.name,12,'stationary resume returns ready pose');assert.equal(v.walkDistance,d);
 s.player.x+=15;v.update(4020,false);const held=v.image.frame.name;v.update(5000,true);assert.equal(v.image.texture.key,key);assert.equal(v.image.frame.name,held);assert.notEqual(f,held);
 v.destroy();v.destroy();for(const n of nodes)assert.equal(n.destroyed,1);
 const missing=fixture(false);missing.view.update(0,false);missing.scene.player.x+=15;missing.view.update(10,false);
 assert.equal(missing.view.image.texture.key,getUserCastArt('enjo').motion.key);assert.equal(missing.view.image.frame.name,7);
});
test('cue exclusion follows the actual texture bounds, including mirrored gait and old idle',()=>{
 const {scene:s,view:v}=fixture();v.update(0,false);
 for(const dx of [15,-15]){s.player.x+=dx;v.update(v.clock+20,false);assert.equal(v.image.texture.key,key);
  const r=getUserCastArt('enjo').motion.walk.bounds[v.image.frame.name],b=v.image.getBounds();
  assert.deepEqual(v.cueExclusionBounds(),{x:b.x+(v.flip?384-r[2]:r[0])*.5,y:b.y+r[1]*.5,right:b.x+(v.flip?384-r[0]:r[2])*.5,bottom:b.y+r[3]*.5});
 }
 v.update(v.clock+20,false);const b=v.image.getBounds(),r=getUserCastArt('enjo').motion.bounds[12];assert.equal(v.cueExclusionBounds().bottom,b.y+r[3]*.5);
});
test('direct walking damage switches to its dedicated hurt bank without changing world or hand anchors',()=>{
 const {scene:s,view:v}=fixture();v.update(0,false);s.player.x+=15;v.update(10,false);assert.equal(v.image.texture.key,key);
 const hand=v.handWorld(),position={x:s.player.x,y:s.player.y};s.battleRecord.playerHitCount++;s.player.y+=15;v.update(20,false);
 assert.equal(v.state,'hurt');assert.equal(v.image.texture.key,getUserCastArt('enjo').motion.hurt.key);assert.equal(v.image.frame.name,0);
 assert.equal(v.image.x,position.x);assert.equal(v.image.y,position.y+41);assert.equal(v.handWorld().x,hand.x);
 assert.equal(s.player.hp,6);assert.equal(s.battleRecord.playerHitCount,1);
});
test('vertical walking uses the same distance gait and stop-then-fire restores the old release bank',()=>{
 const {scene:s,view:v}=fixture();v.update(0,false);
 for(let n=1;n<=6;n++){s.player.y+=15;v.update(n*60,false);assert.equal(v.image.texture.key,key);assert.equal(v.image.frame.name,n%6);assert.equal(v.flip,false);}
 v.update(420,false);assert.equal(v.state,'idle');assert.equal(v.image.frame.name,12);
 v.beginShot(421,-1,0,260);v.update(422,false);assert.equal(v.state,'attack');assert.equal(v.image.texture.key,getUserCastArt('enjo').motion.key);assert.equal(v.image.frame.name,14);assert.equal(v.flip,true);
});
test('the release adds only the explicit walk PNG and keeps the original hammer atlas byte-identical',()=>{
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.group==='owner-character-gait').map(r=>r.file),[path]);
 const png=fs.readFileSync(new URL('../public/'+path,import.meta.url));assert.equal(png.readUInt32BE(16),2304);assert.equal(png.readUInt32BE(20),320);
 assert(png.length<2000000);const old=fs.readFileSync(new URL('../public/art/three-cast-actions-20261018/hammer-cat.webp',import.meta.url));
 assert.equal(crypto.createHash('sha256').update(png).digest('hex'),'45536749a24e3b12e2cd068ca05598f2f57746148a8d3d07effcb31df0b13481');
 assert.equal(crypto.createHash('sha256').update(old).digest('hex'),'c136b885ce05849f99c406874a71fcdc4a970bbd8850ca7ac065271557e4bebd');
});
