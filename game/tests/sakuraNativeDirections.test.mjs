import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const api=await import('../src/utils/sakuraNativeDirections.mjs').catch(()=>({}));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');

test('real movement selects cardinal art, diagonal hysteresis and pause hold it without reflection',()=>{
 assert.equal(typeof api.resolveNativeFacing,'function');
 const s={direction:'down'};
 assert.equal(api.resolveNativeFacing(s,0,-4,null,false),'up');
 assert.equal(api.resolveNativeFacing(s,0,-4,null,true),'down');
 assert.equal(api.resolveNativeFacing({direction:'up'},2,-2,null,false),'up');
 assert.equal(api.resolveNativeFacing(s,-4,0,{direction:'right'},false),'left');
 assert.equal(api.resolveNativeFacing({direction:'left'},0,0,null,false),'left');
 assert.equal(api.resolveNativeFacing(s,0,0,{direction:'right'},false),'right');
 assert.equal(api.resolveNativeFacing(s,0,0,{direction:'invalid'},false),'down');
});

test('three separately drawn skinned directions have distinct texture data and actual two-chain motion',()=>{
 assert.equal(typeof api.sampleDirectionalPose,'function');
 const data=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-directions-20261004/views.json',import.meta.url)));
 assert.deepEqual(Object.keys(data.views).sort(),['left','right','up']);
 assert.equal(data.mirrored,false);assert.equal(data.finalArt,false);
 const hashes=new Set();
 for(const [direction,r]of Object.entries(data.views)){
  hashes.add(r.sourceHash);assert.equal(r.direction,direction);assert(r.meshes.length>=7);
  assert(r.meshes.some(m=>m.name==='leg.R'));assert(r.meshes.some(m=>m.name==='leg.L'));assert(r.meshes.some(m=>m.name==='fan.open'));
  const rest=api.sampleDirectionalPose(r,{clock:0,gaitTime:0,locomotionWeight:0},null);
  const walk=api.sampleDirectionalPose(r,{clock:140,gaitTime:250,locomotionWeight:1},null);
  const attack=api.sampleDirectionalPose(r,{clock:140,gaitTime:250,locomotionWeight:1},{kind:'basic',phase:'release',progress:.5,direction});
  assert.notDeepEqual(rest.bones,walk.bones,'Not a static bobbing sprite');
  for(const name of ['thigh.R','shin.R','foot.R','thigh.L','shin.L','foot.L']){
   const i=r.bones.findIndex(b=>b.name===name);assert(i>=0);assert.deepEqual(attack.bones[i],walk.bones[i],'Attack must not replace gait');
  }
  assert(attack.bones.some((p,i)=>p.some((v,k)=>v!==walk.bones[i][k])),'Arm/fan action actually poses');
  const end=api.sampleDirectionalPose(r,{clock:0,gaitTime:1000,locomotionWeight:1},null),start=api.sampleDirectionalPose(r,{clock:0,gaitTime:0,locomotionWeight:1},null);
  for(let i=0;i<start.bones.length;i++)for(let k=0;k<5;k++)assert(Math.abs(start.bones[i][k]-end.bones[i][k])<1e-8,'No loop root snap');
  for(const m of r.meshes){assert.equal(m.vertices.length,m.weights.length);for(const w of m.weights)assert(Math.abs(w.reduce((n,p)=>n+p[1],0)-1)<1e-6);}
 }
 assert.equal(hashes.size,3,'Independent drawings, not front flips');
 assert.notEqual(sha(fs.readFileSync(new URL('../public/art/sakura-directions-20261004/parts.webp',import.meta.url))),sha(fs.readFileSync(new URL('../public/art/sakura-native-20261004/parts.png',import.meta.url))));
});

test('formal native presenter switches actual meshes, retains one clock/socket and destroys every direction',async()=>{
 const {SakuraNativePresentation}=await import('../src/systems/SakuraNativePresentation.mjs');
 const front=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-native-20261004/rig.json',import.meta.url)));
 const data=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-directions-20261004/views.json',import.meta.url)));
 const made=[];
 const node=()=>{const n={active:true,vertices:[],width:375,height:667,
  addVertices(v,u,ind){this.vertices=ind.map(i=>({x:v[i*2],y:v[i*2+1],u:u[i*2],v:u[i*2+1],setUVs(u,v){this.u=this.tu=u;this.v=this.tv=v;return this;}}));return this;},
  setOrtho(){return this;},setDepth(d){this.depth=d;return this;},setPosition(x,y){this.x=x;this.y=y;return this;},setAlpha(a){this.alpha=a;return this;},setTint(){return this;},preUpdate(){},destroy(){this.active=false;}};made.push(n);return n;};
 const scene={_sakuraNativeDirectionsRequested:true,player:{x:500,y:1000},playerGfx:{alpha:1},cache:{json:{get:key=>key.includes('directions')?data:front}},textures:{exists:()=>true},add:{ellipse:node,mesh:node}};
 const view=new SakuraNativePresentation(scene),clock=view.clock;
 assert.equal(made.length,32,'Every directional mesh actually exists');
 for(const [direction,dx,dy]of [['left',-4,0],['up',0,-4],['right',4,0],['down',0,4]]){
  view.update(view.clock.clock+40,dx,dy,null,false,false);
  assert.equal(view.state.direction,direction);assert.equal(view.clock,clock);
  assert.equal(view.nodes.length,direction==='down'?10:7);
  assert.equal(made.filter(n=>n.alpha>0).length,view.nodes.length+1,'Inactive views cannot render doubled heads');
  const before=view.handWorld();scene.player.x+=20;assert(Math.abs(view.handWorld().x-before.x-20)<1e-8);
 }
 const frozen=structuredClone(view.state);view.update(9999,-100,0,{direction:'left'},true,true);assert.deepEqual(view.state,frozen);
 view.destroy();view.destroy();assert(made.every(n=>!n.active));
});

test('directional feet register to the existing frontal ground plane, not a floating shorter leg',()=>{
 const front=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-native-20261004/rig.json',import.meta.url)));
 const data=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-directions-20261004/views.json',import.meta.url)));
 const ground=r=>Math.max(...r.meshes.filter(m=>m.name.startsWith('leg.')).flatMap(m=>m.vertices.map(v=>(v[1]-r.anchor[1])*r.scale)));
 for(const r of Object.values(data.views))assert(Math.abs(ground(r)-ground(front))<.01,'All views need the same foot ground registration');
});
