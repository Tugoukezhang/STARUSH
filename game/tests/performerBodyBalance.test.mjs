import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,image} from './motionStageFixture.mjs';
import {ActorPresentation} from '../src/systems/ActorPresentation.mjs';
import {SAKURA_LAYER_HANDS,SAKURA_LAYER_SIZE,SAKURA_LAYER_ORIGIN_Y} from '../src/systems/SakuraLayeredPresentation.mjs';
import {SAKURA_SECONDARY_REGISTRATION} from '../src/systems/SakuraSecondaryRegistration.mjs';
import {PerformerBodyBalance} from '../src/systems/PerformerBodyBalance.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const rotate=(x,y,a)=>({x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)});
function make(id){
 const f=fixture(id);f.actor.destroy();
 if(id!=='sakura')f.s.add.image=(...args)=>{
  const n=image(...args),frame=n.frame;
  n.setFrame=function(name){this.frame={name,u0:0,u1:.25,v0:0,v1:1/12};return this;};
  return n.setFrame(frame);
 };
 f.s.sys={renderer:{gl:{}}};
 f.s.add.mesh=()=>Object.assign(image(),{
  vertices:[],setSize(){return this;},setOrtho(){return this;},
  addVertices(coords){for(let i=0;i<coords.length;i+=2)this.vertices.push({x:coords[i],y:coords[i+1],setUVs(){}});return this;},preUpdate(){},
 });
 f.actor=f.s.actorPresentation=new ActorPresentation(f.s);
 f.draw=(now,dx=0,dy=0)=>{f.s.time.now=now;f.s.player.x+=dx;f.s.player.y+=dy;f.actor.drawPlayer(f.run.now(),!!(dx||dy),0xffffff);};
 return f;
}
function angle(f){
 if(f.actor.sakuraView)return f.actor.sakuraView.upper.rotation??0;
 const v=f.actor.secondarySurface.mesh.vertices.find(v=>v.baseX===64&&v.baseY===48);
 return Math.atan2(v.x,v.y+24);
}
function checkPivot(f){
 if(f.actor.sakuraView){const v=f.actor.sakuraView;near(v.upper.x,v.visualRoot.x);near(v.upper.y,v.visualRoot.y);}
 else{
  for(const v of f.actor.secondarySurface.mesh.vertices.filter(v=>v.baseX===64&&v.baseY===88)){near(v.x,0);near(v.y,-24);}
  near(f.actor.playerImage.x,f.s.player.x);near(f.actor.playerImage.y,f.s.player.y-13+f.actor.footRig.upperOffset);
 }
}
for(const id of ['sakura','venus','genya','kai','enjo'])test(`${id}: actual upper renderer leans from displacement, preserves pivot and settles`,()=>{
 for(const fps of [15,30,60,120]){
  const f=make(id),dt=1000/fps;f.draw(0);const body=structuredClone(f.s.player.body);
  for(let n=1;n<=fps;n++){f.draw(n*dt,250/fps,0);checkPivot(f);assert.ok(Math.abs(angle(f))<=.06);}
  assert.ok(angle(f)>.02,`${id}/${fps}: upper still upright ${angle(f)}`);
  const frozen=angle(f);f.s._battlePaused=true;f.draw(6000);near(angle(f),frozen);
  f.s._battlePaused=false;f.draw(6000);
  for(let n=1;n<=fps;n++)f.draw(6000+n*dt,-250/fps,0);
  assert.ok(angle(f)<-.02,`${id}/${fps}: lean does not follow reversed movement`);
  for(let n=1;n<=fps;n++)f.draw(7000+n*dt);
  assert.ok(Math.abs(angle(f))<.0001);assert.deepEqual(f.s.player.body,body);
  f.actor.destroy();
 }
});
test('forward/back upper balance shares the planted-foot phase instead of an idle oscillator',()=>{
 for(const id of ['sakura','genya']){
  const f=make(id);f.draw(0);let lo=Infinity,hi=-Infinity;
  for(let n=1;n<=120;n++){f.draw(n*1000/60,0,250/60);if(n>30){lo=Math.min(lo,angle(f));hi=Math.max(hi,angle(f));}checkPivot(f);}
  assert.ok(lo<-.005&&hi>.005,`${id}: no alternating torso balance ${lo}/${hi}`);
  const state=f.actor.sakuraView?.state??f.actor.footRig.state;near(state.travel,500);near(state.phase,(500/(f.actor.footRig?.footOptions.stride??68))%1);
  for(let n=1;n<=120;n++)f.draw(2000+n*1000/60);
  assert.ok(Math.abs(angle(f))<.0001);f.actor.destroy();
 }
});
test('Sakura hand and secondary attachments share the upper rotation during a running attack',()=>{
 const f=make('sakura'),attack={direction:'right',phase:'release',progress:.4,kind:'basic'};
 f.run.sakuraCombat.snapshot=()=>attack;f.run.sakuraCombat.draw=()=>{};f.draw(0);
 for(let n=1;n<=60;n++)f.draw(n*1000/60,250/60,0);
 const v=f.actor.sakuraView,a=angle(f);assert.ok(a>.005&&a<.03);
 const [sx,sy]=SAKURA_LAYER_HANDS[v.upper.frame],local=rotate((sx/256-.5)*SAKURA_LAYER_SIZE,(sy/256-SAKURA_LAYER_ORIGIN_Y)*SAKURA_LAYER_SIZE,a);
 const hand=v.handWorld(attack);near(hand.x,v.visualRoot.x+local.x);near(hand.y,v.visualRoot.y+local.y);
 const registration=SAKURA_SECONDARY_REGISTRATION[v.state.upperTexture+':'+v.state.upperFrame];
 for(const [i,part]of ['hair','hem'].entries()){
  const meta=registration[part],offset=rotate((meta.x-128)*SAKURA_LAYER_SIZE/256,(meta.y-SAKURA_LAYER_ORIGIN_Y*256)*SAKURA_LAYER_SIZE/256,a),node=v.secondaryNodes[i];
  near(node.rotation,a);near(node.x,v.visualRoot.x+offset.x);near(node.y,v.visualRoot.y+offset.y);
 }
 f.actor.destroy();
});
test('four-member running shot uses restrained balance; real hurt wins neutral and reuses the surface',()=>{
 for(const id of ['venus','genya','kai','enjo']){
  const f=make(id);f.draw(0);const mesh=f.actor.secondarySurface.mesh;
  for(let n=1;n<=60;n++){if(n%10===1)f.actor.notifyBasicShot(n*1000/60,1,0,300);f.draw(n*1000/60,250/60,0);}
  assert.ok(angle(f)>.005&&angle(f)<.03);f.s.player.hp=4;f.draw(1016,4,0);near(angle(f),0);
  assert.equal(f.actor.secondarySurface.mesh,mesh);f.actor.destroy();assert.equal(mesh.active,false);
 }
});

test('balance resets on teleport/time discontinuity and never accumulates from repeated renders',()=>{
 const b=new PerformerBodyBalance();b.sample(0,0,0,0);
 for(let n=1;n<=60;n++)b.sample(n*1000/60,250/60,0,n/60);
 const angle=b.angle;
 for(let n=0;n<100;n++)near(b.sample(1000,250/60,0,.2),angle);
 near(b.sample(1016,500,0,.2),0);
 b.sample(1032,4,0,.2);assert.ok(b.angle>0);
 near(b.sample(5000,0,0,.2),0);
 b.sample(5016,4,0,.2);near(b.sample(5032,4,0,.2,false,0),0);
 for(let n=1;n<100;n++)near(b.sample(5032+n*16,0,0,.2),0);
});
