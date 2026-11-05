import test from 'node:test';
import assert from 'node:assert/strict';
import {UserCastPresentation} from '../src/systems/UserCastPresentation.mjs';
import {getUserCastArt} from '../src/utils/userCast.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
function fixture(id){
 const node=()=>({x:0,y:0,ox:0,oy:0,w:192,h:160,alpha:1,frame:{name:0},destroyed:0,
  setPosition(x,y){this.x=x;this.y=y;return this;},setOrigin(x,y){this.ox=x;this.oy=y;return this;},setDisplaySize(w,h){this.w=w;this.h=h;return this;},setDepth(){return this;},setFlipX(v){this.flipX=v;return this;},setAngle(){return this;},setAlpha(){return this;},setTint(){return this;},setTexture(key,frame){this.texture={key};this.frame.name=frame;return this;},getBounds(){return{x:this.x-this.ox*this.w,y:this.y-this.oy*this.h,right:this.x+(1-this.ox)*this.w,bottom:this.y+(1-this.oy)*this.h};},destroy(){this.destroyed++;}});
 const scene={player:{x:500,y:1000,hp:5,active:true},playerGfx:{alpha:1},battleRecord:{playerHitCount:0},publicPerformerRun:{actions:0},textures:{exists:()=>true},add:{image:node,ellipse:node}};
 return {scene,view:new UserCastPresentation(scene,id)};
}
test('all three stationary shots draw actual contact and recovery cels, never idle or late anticipation',()=>{
 for(const id of ['sakura','kai','enjo']){
  const {scene:s,view:v}=fixture(id);v.update(0,false);const before={...s.player};assert.equal(v.beginShot(0,1,0,400),true);v.update(0,false);
  assert.equal(v.state,'attack');assert.equal(v.image.frame.name,id==='sakura'?0:14,id+' must start at already committed contact');
  const frames=[];for(let t=0;t<v.shotDuration;t+=10){v.update(t,false);frames.push(v.image.frame.name);}
  assert.deepEqual([...new Set(frames)],id==='sakura'?[0,1,2,3]:[14,15,16,17]);assert(!frames.includes(13));
  v.update(1000,false);assert.equal(v.state,'idle');assert.equal(v.image.frame.name,12);assert.deepEqual(s.player,before);assert.equal(s.publicPerformerRun.actions,0);v.destroy();
 }
});
test('taller attack envelope preserves half scale and original foot position for all three owners',()=>{
 for(const id of ['sakura','kai','enjo']){const {view:v}=fixture(id),a=getUserCastArt(id);
  assert.equal(a.motion.frameHeight,320);assert.equal(a.motion.originY,304/320);assert.equal(v.height,160);assert.equal(v.width,192);
  v.update(0,false);assert.equal(v.image.y+(304-v.image.oy*320)*.5,1026);assert(a.motion.path.includes('20261018'));v.destroy();}
});
test('pause freezes the actual cel and late shot notifications cannot change facing or restart it',()=>{
 const {scene:s,view:v}=fixture('kai');let t=0;s.publicPerformerRun.now=()=>t;
 v.update(0,false);v.beginShot(0,1,0,400);t=60;v.update(60,false);const frame=v.image.frame.name,flip=v.flip,clock=v.shotClock;
 s._battlePaused=true;v.update(6000,true);assert.equal(v.beginShot(6000,-1,0,400),false);assert.equal(v.flip,flip);assert.equal(v.shotClock,clock);assert.equal(v.image.frame.name,frame);
 s._battlePaused=false;v.update(6010,false);assert.equal(v.image.frame.name,frame);v.destroy();assert.equal(v.beginShot(6020,-1),false);
});
test('real action counters start contact immediately and do not invent gameplay or hit callbacks',()=>{
 for(const id of ['sakura','kai','enjo']){const {scene:s,view:v}=fixture(id);v.update(0,false);s.publicPerformerRun.actions=1;v.update(20,false);assert.equal(v.state,'action');assert.equal(v.image.frame.name,14,id);
  v.update(400,false);assert.equal(v.state,'idle');assert.equal(s.publicPerformerRun.actions,1);assert.equal(s.battleRecord.playerHitCount,0);v.destroy();v.destroy();assert.equal(v.image.destroyed,1);}
});
test('cue exclusions use current visible-frame bounds, including mirrored asymmetric sword origin',()=>{
 for(const id of ['sakura','kai','enjo'])for(const sign of [-1,1]){
  const {view:v}=fixture(id);v.update(0,false);v.beginShot(0,sign,0,400);v.update(0,false);const b=v.image.getBounds(),r=id==='sakura'?v.art.motion.shoot.bounds[0]:v.art.motion.bounds?.[14];assert(r,'reviewed visible bounds missing');
  const actual=v.cueExclusionBounds(),left=v.flip?384-r[2]:r[0],right=v.flip?384-r[0]:r[2];
  assert.equal(actual.x,b.x+left*.5);assert.equal(actual.y,b.y+r[1]*.5);assert.equal(actual.right,b.x+right*.5);assert.equal(actual.bottom,b.y+r[3]*.5);assert(actual.y>b.y,'transparent tall margin must not hide a hostile cue');v.destroy();
 }
});
test('only three new approved export paths enter the existing motion release group',()=>{
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.group==='owner-character-motion').map(r=>r.file),['cat-rifle','mecha-sword','hammer-cat'].map(id=>'art/three-cast-actions-20261018/'+id+'.webp'));
});
test('a release between rendered frames starts contact without aging by the previous render gap',()=>{
 for(const id of ['sakura','kai','enjo']){const {view:v}=fixture(id);v.update(0,false);v.beginShot(80,1,0,333);v.update(80,false);assert.equal(v.image.frame.name,id==='sakura'?0:14,id);v.destroy();}
});
test('new pose durations preserve the old 140ms movement-facing origin used by actual paint shots',()=>{
 for(const id of ['kai','enjo']){const {scene:s,view:v}=fixture(id);v.update(0,false);v.beginShot(0,1,0,400);v.update(0,false);s.player.x-=15;v.update(200,false);v.update(340,false);assert.equal(v.handWorld().x,469,id+' changed original left-side shot origin');v.destroy();}
});
