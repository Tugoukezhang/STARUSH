import test from 'node:test';
import assert from 'node:assert/strict';
import {UserCastPresentation} from '../src/systems/UserCastPresentation.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';

function fixture(id='sakura'){
 let time=0;const nodes=[];
 const node=(x=0,y=0,key='',frame=0)=>{const n={x,y,active:true,alpha:1,frame:{name:frame},texture:{key},dead:0,
  setOrigin(x,y=x){this.originX=x;this.originY=y;return this;},setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;},setDepth(d){this.depth=d;return this;},setTint(){return this;},setAlpha(a){this.alpha=a;return this;},setAngle(){return this;},setRotation(r){this.rotation=r;return this;},setFlipX(f){this.flipX=f;return this;},setPosition(x,y){this.x=x;this.y=y;return this;},setTexture(key,f){this.texture={key};this.frame.name=f;return this;},setFrame(f){this.frame.name=f;return this;},destroy(){this.active=false;this.dead++;}};nodes.push(n);return n;};
 const scene={_userCastPresentation:true,game:{loop:{frame:0}},player:{x:500,y:1000,hp:5,active:true},playerGfx:{alpha:1},battleRecord:{playerHitCount:0},publicPerformerRun:{actions:0,now:()=>time},oldStreet:{clearLine:()=>true},textures:{exists:()=>true},add:{ellipse:node,image:node}};
 const view=new UserCastPresentation(scene,id),fx=view.weaponFx;view.update(0,false);
 const bullet=()=>({active:true,paintShot:true,x:516,y:988,moveVx:300,moveVy:-100,color:'pink',body:{untouched:true},gfx:{setRotation(r){this.rotation=r;}}});
 return {scene,view,fx,nodes,bullet,setTime:t=>time=t};
}

test('rifle contact marker uses the existing cel origin and half scale, not the physical hand offset',()=>{
 const {scene:s,view:v}=fixture();v.beginShot(0,1,0,400);v.update(0,false);assert.equal(v.image.frame.name,0);
 assert.deepEqual(v.muzzleWorld(),{x:554,y:970});assert.deepEqual(v.handWorld(),{x:516,y:988});
 v.flip=true;assert.deepEqual(v.muzzleWorld(),{x:446,y:970});assert.deepEqual(v.handWorld(),{x:516,y:988},'visual marker never changes physical shot side');
 assert.equal(v.image.displayWidth,192);assert.equal(v.image.displayHeight,160);assert.equal(s.player.x,500);
});

test('real actor queue waits for the current moving cel in the same postupdate frame',()=>{
 const {scene:s,view:v,fx,bullet}=fixture(),{ActorPresentation}=loadScenes().loadRuntime('systems/ActorPresentation.mjs');
 v.beginShot(0,1,0,400);const b=bullet();assert.equal(ActorPresentation.prototype.queueBasicShotFx.call({userCastView:v,disposed:false},b,0),true);
 assert.equal(fx.rows.length,0,'the old ready cel cannot own an immediate flash');
 s.player.x+=15;v.update(0,false);assert.equal(v.image.texture.key,v.art.motion.walk.key);assert.equal(v.image.frame.name,0);assert.equal(fx.rows.length,1);
 assert.equal(fx.rows[0].x,570);assert.equal(fx.rows[0].y,971);assert.equal(fx.rows[0].angle,Math.atan2(-100,300));
 assert.deepEqual(b.body,{untouched:true});assert.equal(b.x,516);assert.equal(b.moveVx,300);
});

test('queued visual snapshots survive same-frame projectile disposal without retaining its mutable origin',()=>{
 const {view:v,fx,bullet}=fixture(),b=bullet();v.beginShot(0,1,0,400);assert.equal(fx.shot(b,0,v),true);
 assert.equal(fx.shot(b,0,v),false);b.active=false;b.x=NaN;b.y=NaN;b.moveVx=0;b.moveVy=0;
 v.update(0,false);assert.equal(fx.rows.length,1);assert.equal(fx.rows[0].x,554);assert.equal(fx.stats.shots,1);assert.deepEqual(b.body,{untouched:true});
});

test('hurt and committed action cannot emit an ordinary muzzle on the wrong pose',()=>{
 for(const state of ['hurt','action']){
  const {scene:s,view:v,fx,bullet}=fixture();if(state==='hurt')s.battleRecord.playerHitCount++;else s.publicPerformerRun.actions++;
  v.beginShot(0,1,0,400);assert.equal(fx.shot(bullet(),0,v),true);v.update(0,false);
  assert.equal(v.state,state);assert.equal(fx.rows.length,0);assert.equal(fx.pendingShots.length,0);
 }
});

test('cover between physical origin and drawn barrel rejects only the local muzzle',()=>{
 const {scene:s,view:v,fx,bullet}=fixture(),b=bullet();s.oldStreet.clearLine=(from,to)=>!(from.x===516&&to.x>540);
 v.beginShot(0,1,0,400);assert.equal(fx.shot(b,0,v),true);v.update(0,false);
 assert.equal(fx.rows.length,0);assert.equal(b.active,true);assert.equal(b.x,516);assert.equal(b.moveVy,-100);
});

test('pause, dialog and skipped postupdate never replay a stale muzzle after resuming',()=>{
 for(const flag of ['_battlePaused','_publicBattleDialog']){
  const {scene:s,view:v,fx,bullet}=fixture();v.beginShot(0,1,0,400);fx.shot(bullet(),0,v);s[flag]=true;fx.update(0,v);
  assert.equal(fx.pendingShots.length,0);s[flag]=false;v.update(0,false);assert.equal(fx.rows.length,0);
 }
 const {scene:s,view:v,fx,bullet}=fixture();v.beginShot(0,1,0,400);fx.shot(bullet(),0,v);
 s.game.loop.frame++;v.update(0,false);assert.equal(fx.rows.length,0,'real renderer may skip all paused updates while the run clock is frozen');assert.equal(fx.pendingShots.length,0);
});

test('expired, ended, destroyed and unavailable view requests do not leak queued images',()=>{
 for(const mode of ['expired','ended','destroyed','missing']){
  const {scene:s,view:v,fx,bullet,setTime}=fixture();v.beginShot(0,1,0,400);fx.shot(bullet(),0,v);
  if(mode==='expired')setTime(140);if(mode==='ended')s._battleEnded=true;if(mode==='destroyed')v.destroy();
  fx.update(140,mode==='missing'?null:v);assert.equal(fx.rows.length,0);assert.equal(fx.pendingShots.length,0);
 }
});

test('pending snapshots and live FX stay inside the existing 24-node budget without timers',()=>{
 const {view:v,fx,bullet}=fixture();v.beginShot(0,1,0,400);for(let i=0;i<90;i++)fx.shot(bullet(),0,v);
 assert.equal(fx.pendingShots.length,24);assert.equal(fx.rows.length,0);v.update(0,false);assert.equal(fx.pendingShots.length,0);assert.equal(fx.rows.length,24);
 fx.destroy();fx.destroy();assert(fx.rows.length===0&&fx.pendingShots.length===0);
});

test('sword and hammer retain physical-origin effects after final-pose sampling',()=>{
 for(const id of ['kai','enjo']){const {view:v,fx,bullet}=fixture(id),b=bullet();assert.equal(fx.shot(b,0,v),true);assert.equal(fx.rows.length,0);v.update(0,false);assert.equal(fx.rows.length,1);assert.equal(fx.rows[0].x,b.x);assert.equal(fx.rows[0].y,b.y);assert.equal(v.muzzleWorld(),null);}
});

test('unreviewed anticipation, hurt and missing cels do not invent a barrel marker',()=>{
 const {view:v}=fixture();for(const frame of [13,18,19,20,21,22,23,99]){v.image.frame.name=frame;assert.equal(v.muzzleWorld(),null);}
 v.destroy();assert.equal(v.muzzleWorld(),null);
});
