import assert from 'node:assert/strict';
import test from 'node:test';
import { ActorPresentation } from '../src/systems/ActorPresentation.mjs';

function node() {
  const n={active:true,alpha:1,frame:0,texture:{key:''},destroy(){this.active=false;}};
  for(const [method,keys] of Object.entries({setScale:['scaleX','scaleY'],setRotation:['rotation'],setPosition:['x','y'],setFrame:['frame'],setAlpha:['alpha'],setAngle:['angle'],setTint:['tint'],setDisplaySize:['displayWidth','displayHeight'],setDepth:['depth'],setOrigin:['originX','originY'],setScrollFactor:['scrollFactor']}))
    n[method]=function(...v){keys.forEach((k,i)=>this[k]=v[i]);return this;};
  n.setTexture=function(key,frame){this.texture.key=key;this.frame=frame;return this;};
  for(const key of ['fillStyle','fillCircle','lineStyle','strokeCircle'])n[key]=()=>n;
  return n;
}
function fixture() {
  let attack=null;
  const scene={battleData:{stageId:1,performerId:'sakura'},textures:{exists:()=>true},
    player:{active:true,x:300,y:500,hp:5,body:{halfWidth:4,velocity:{x:0,y:0}}},playerGfx:node(),
    add:{rectangle:()=>node(),image:(x,y,key,frame)=>node().setTexture(key,frame).setPosition(x,y)},
    publicPerformerRun:{member:{id:'sakura'},actions:0,sakuraCombat:{snapshot:()=>attack}}};
  return {scene,p:new ActorPresentation(scene),attack(value){attack=value;}};
}
const strike=(direction='right',phase='release',progress=.2)=>({id:1,kind:'basic',direction,phase,progress,frame:9});

test('real presenter retains a lower locomotion layer during a fan attack',()=>{
  const f=fixture();f.p.drawPlayer(0,false,0xffffff);f.attack(strike());f.scene.player.x+=10;f.p.drawPlayer(40,true,0xffffff);
  assert.ok(f.p.sakuraView,'Sakura needs independent upper/lower presentation, not whole-body attack replacement');
  assert.equal(f.p.sakuraView.upper.alpha+f.p.sakuraView.upperBlend.alpha,1);
  assert.equal(f.p.sakuraView.legs.length,6);
  assert.ok(f.p.sakuraView.state.feet.some(foot=>!foot.contact));
  assert.equal(f.p.sakuraView.state.upperDirection,'right');
});

test('gait advances by equal actual distance, independent of attack clock or elapsed wall time',()=>{
  const a=fixture(),b=fixture();a.p.drawPlayer(0,false,0xffffff);b.p.drawPlayer(0,false,0xffffff);
  for(let i=1;i<=6;i++) {a.scene.player.x+=5;a.attack(strike('right',i%2?'release':'windup'));a.p.drawPlayer(i*16,true,0xffffff);}
  b.scene.player.x+=30;b.p.drawPlayer(250,true,0xffffff);
  assert.ok(Math.abs(a.p.sakuraView.state.phase-b.p.sakuraView.state.phase)<1e-9);
  assert.equal(a.p.sakuraView.state.lowerFrame,b.p.sakuraView.state.lowerFrame);
  const phase=a.p.sakuraView.state.phase;a.scene.player.body.velocity.x=250;
  a.p.drawPlayer(450,true,0xffffff);assert.equal(a.p.sakuraView.state.phase,phase,'wall-blocked intent cannot animate a stride');
  assert.equal(a.p.sakuraView.state.moving,false);
});

test('pause and dialog freeze both layers, resume never catches up hidden displacement',()=>{
  const f=fixture();f.attack(strike());f.p.drawPlayer(0,false,0xffffff);f.scene.player.x+=10;f.p.drawPlayer(30,true,0xffffff);
  const saved={...f.p.sakuraView.state};f.scene._battlePaused=true;f.scene.player.x+=120;f.attack(strike('up','recovery',.8));
  f.p.drawPlayer(500,true,0xffffff);assert.deepEqual(f.p.sakuraView.state,saved);
  f.scene._battlePaused=false;f.scene._publicBattleDialog={};f.p.drawPlayer(900,true,0xffffff);assert.deepEqual(f.p.sakuraView.state,saved);
  f.scene._publicBattleDialog=null;f.p.drawPlayer(1000,false,0xffffff);assert.equal(f.p.sakuraView.state.phase,saved.phase);
});

test('opposite movement backsteps without joining a front torso to reversed hips',()=>{
  const f=fixture();f.p.drawPlayer(0,false,0xffffff);f.attack(strike('right'));f.scene.player.x-=10;f.p.drawPlayer(40,true,0xffffff);
  assert.equal(f.p.sakuraView.state.movementDirection,'left');
  assert.equal(f.p.sakuraView.state.lowerDirection,'right');
  assert.equal(f.p.sakuraView.state.backpedal,true);
  assert.equal(f.p.sakuraView.state.upperDirection,'right');
});

test('stopping settles into standing feet; no attack restarts the leg clock',()=>{
  const f=fixture();f.p.drawPlayer(0,false,0xffffff);f.scene.player.y-=12;f.p.drawPlayer(40,true,0xffffff);
  const phase=f.p.sakuraView.state.phase;f.p.drawPlayer(60,false,0xffffff);f.p.drawPlayer(200,false,0xffffff);
  assert.equal(f.p.sakuraView.state.lowerDirection,'up');
  f.attack(strike('up'));f.p.drawPlayer(250,false,0xffffff);assert.equal(f.p.sakuraView.state.lowerDirection,'up');
  assert.equal(f.p.sakuraView.state.phase,phase);
});

test('all layers share existing visibility, world feet and idempotent disposal; physics unchanged',()=>{
  const f=fixture(),original=JSON.stringify(f.scene.player.body);f.p.drawPlayer(0,false,0xffffff);
  const {legs,upper,upperBlend}=f.p.sakuraView;assert.equal(upper.displayHeight,88);
  assert.ok(Math.abs((245/256-upper.originY)*88-26)<1e-8);
  f.scene.playerGfx.alpha=.3;f.p.drawPlayer(100,false,0xffffff);assert.ok(legs.every(n=>n.alpha===.3));assert.equal(upper.alpha+upperBlend.alpha,.3);
  assert.equal(JSON.stringify(f.scene.player.body),original);f.p.destroy();f.p.destroy();assert.ok(legs.every(n=>!n.active));assert.equal(upper.active,false);assert.equal(upperBlend.active,false);
});

test('real combat windup draws from the registered visible hand without moving the damage origin',async()=>{
  const {SakuraCombat}=await import('../src/systems/SakuraCombat.mjs');
  const f=fixture(),lines=[];
  const g={setDepth(){return this;},clear(){return this;},lineStyle(){return this;},lineBetween(...args){lines.push(args);return this;}};
  f.scene.add.graphics=()=>g;
  f.scene._battlePerformerContract={publicActionOwnerId:'sakura'};
  Object.assign(f.scene.publicPerformerRun,{alive:()=>true,effects:()=>({paintRadiusBonus:0}),now:()=>0});
  const combat=new SakuraCombat(f.scene,f.scene.publicPerformerRun);
  f.scene.actorPresentation=f.p;
  combat.beginBasic({x:500,y:500,active:true},0,400);
  const snapshot=combat.snapshot(0),before={x:combat.attack.x,y:combat.attack.y,angle:combat.attack.angle};
  const hand=f.p.sakuraView.handWorld(snapshot);combat.draw(0);
  assert.ok(Math.abs(lines[0][0]-(hand.x-3))<1e-9,'windup must originate at the new layer hand, not the retired atlas root');
  assert.deepEqual({x:combat.attack.x,y:combat.attack.y,angle:combat.attack.angle},before);
});
