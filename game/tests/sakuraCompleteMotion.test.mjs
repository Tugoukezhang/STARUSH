import assert from 'node:assert/strict';
import test from 'node:test';
import {SakuraLayeredPresentation} from '../src/systems/SakuraLayeredPresentation.mjs';

function fixture(){
  const nodes=[];
  const image=(x,y,key,frame)=>{
    const n={x,y,active:true,texture:{key},frame,alpha:1};
    for(const [m,keys] of Object.entries({setDisplaySize:['displayWidth','displayHeight'],setPosition:['x','y'],setOrigin:['originX','originY'],setDepth:['depth'],setAlpha:['alpha'],setTint:['tint'],setAngle:['angle'],setRotation:['rotation'],setScale:['scaleX','scaleY'],setFrame:['frame'],setVisible:['visible']}))n[m]=function(...v){keys.forEach((k,i)=>this[k]=v[i]??v[0]);return this;};
    n.setTexture=function(key,frame=0){this.texture.key=key;this.frame=frame;return this;};n.destroy=function(){this.active=false;this.destroyCount=(this.destroyCount||0)+1;};nodes.push(n);return n;
  };
  const scene={player:{x:300,y:500},playerGfx:{alpha:1},add:{image}};
  const view=new SakuraLayeredPresentation(scene);
  let now=0;
  return {view,scene,nodes,step(dx=0,dy=0,attack=null,frozen=false,dt=1000/60){now+=dt;scene.player.x+=dx;scene.player.y+=dy;view.update(now,dx,dy,attack,frozen);return view.state;}};
}

test('idle has an independent visible cycle while both feet stay planted',()=>{
 const f=fixture(),frames=new Set(),feet=[];
 for(let i=0;i<300;i++){const s=f.step();frames.add(s.upperFrame+':'+(s.upperTexture||''));if(s.feet)feet.push(s.feet.map(p=>[p.x,p.y]));}
 assert.ok(frames.size>=3,'stationary actor must breathe/blink, not one static pose');
 assert.equal(feet.length,300,'explicit contact feet required');
 for(const pair of feet)assert.deepEqual(pair,feet[0]);
});
test('all sixteen movement/attack combinations keep coherent whole-body orientation',()=>{
 for(const [move,dx,dy] of [['down',0,4],['left',-4,0],['right',4,0],['up',0,-4]])for(const aim of ['down','left','right','up']){
   const f=fixture();for(let i=0;i<20;i++)f.step(dx,dy,{direction:aim,phase:'release',progress:.3});
   assert.equal(f.view.state.lowerDirection,f.view.state.upperDirection,`${move}/${aim} cannot splice different views`);
 }
});
test('diagonal micro-jitter does not flicker cardinal facing every frame',()=>{
 const f=fixture();f.step(5,0);const dirs=[];
 for(let i=0;i<20;i++)dirs.push(f.step(i%2?4.1:4.2,i%2?4.2:4.1).upperDirection);
 assert.equal(new Set(dirs).size,1);
});
test('both legs really alternate support and planted contacts stay in world space',()=>{
 const f=fixture(),contacts=[0,0];let old=null;
 for(let i=0;i<150;i++){
  const s=f.step(250/60,0);assert.ok(s.feet?.length===2,'need articulated two-foot state');
  for(let leg=0;leg<2;leg++){
   if(s.feet[leg].contact)contacts[leg]++;
   if(old?.feet[leg].contact && s.feet[leg].contact && old.feet[leg].plantId===s.feet[leg].plantId){
    assert.ok(Math.hypot(old.feet[leg].x-s.feet[leg].x,old.feet[leg].y-s.feet[leg].y)<.001,'support foot must not slide with player');
   }
  }
  old=structuredClone(s);
 }
 assert.ok(contacts.every(n=>n>5));
});
test('pause freezes motion clocks; resume does not catch up paused seconds',()=>{
 const f=fixture();for(let i=0;i<20;i++)f.step(4,0);
 const before=structuredClone(f.view.state);
 f.step(100,0,null,true,5000);assert.deepEqual(f.view.state,before);
 f.step(0,0,null,false,16);assert.ok(f.view.state.clock-before.clock<=17);
});
test('stop settles without restarting strides; disposal destroys all nodes once',()=>{
 const f=fixture();for(let i=0;i<40;i++)f.step(4,0);
 const phase=f.view.state.phase;
 for(let i=0;i<40;i++)f.step();
 assert.equal(f.view.state.phase,phase);assert.equal(f.view.state.mode,'idle');
 assert.ok(f.view.state.feet.every(p=>p.contact));
 f.view.destroy();f.view.destroy();assert.ok(f.nodes.every(n=>!n.active && n.destroyCount===1));
});

test('rendered joints reach the actual foot without hidden bone stretch in every move/aim combination',()=>{
 for(const [dx,dy] of [[4.17,0],[-4.17,0],[0,4.17],[0,-4.17],[2.95,2.95],[-2.95,-2.95]])for(const direction of ['down','left','right','up']){
  const f=fixture();
  for(let i=0;i<120;i++){
   const s=f.step(dx,dy,{direction,phase:'release',progress:.3});
   for(const [side,chain] of s.legGeometry.entries()){
    assert.ok(chain.error<.001,`${dx}/${dy}/${direction}: foot outside reach ${chain.error}`);
    assert.ok(Math.abs(Math.hypot(chain.knee.x-chain.hip.x,chain.knee.y-chain.hip.y,chain.knee.z??0)-9.5)<1e-8);
    assert.ok(Math.abs(Math.hypot(chain.ankle.x-chain.knee.x,chain.ankle.y-chain.knee.y,chain.knee.z??0)-10.5)<1e-8);
    const foot=s.feet[side];assert.ok(Math.abs(chain.ankle.y-(foot.y-5.8-foot.lift))<1e-8);
   }
  }
 }
});

test('turning cannot cross-fade a previous-facing torso over new-facing hips',()=>{
 const f=fixture();f.step(4,0);f.step(4,0);f.step(0,-4);
 assert.equal(f.view.state.upperDirection,'up');
 assert.equal(f.view.upperBlend.alpha,0,'orientation changes must be coherent on rendered nodes, not just state labels');
 assert.equal(f.view.upper.alpha,1);
});

test('a paused root relocation resynchronizes contacts without dragging old feet or advancing a stride',()=>{
 const f=fixture();for(let i=0;i<20;i++)f.step(4,0);
 const phase=f.view.state.phase;
 f.step(120,80,null,true,2000);f.step(0,0);
 assert.equal(f.view.state.phase,phase);
 assert.ok(f.view.state.legGeometry.every(c=>c.error<.001));
 assert.ok(f.view.state.feet.every(p=>Math.abs(p.x-f.scene.player.x)<15));
});
