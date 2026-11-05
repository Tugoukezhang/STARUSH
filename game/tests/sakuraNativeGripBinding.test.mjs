import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SakuraNativePresentation,SAKURA_NATIVE_ART,SAKURA_DIRECTION_ART} from '../src/systems/SakuraNativePresentation.mjs';
import {nativeWorldMatrices,multiplyAffine,skinNativeMesh,sampleNativeClip} from '../src/utils/sakuraNativePose.mjs';
const art=process.env.STARUSH_ART?new URL(process.env.STARUSH_ART):new URL('../public/art/',import.meta.url);
const front=JSON.parse(fs.readFileSync(new URL('sakura-conformance-20261004/rig.json',art)));
const directions=JSON.parse(fs.readFileSync(new URL('sakura-details-20261004/views.json',art)));
const turns=JSON.parse(fs.readFileSync(new URL('sakura-turn-native-20261004/views.json',art)));
const source={down:front,...directions.views,...turns.views};
function node(){return {active:true,vertices:[],width:375,height:667,addVertices(v,uv,ix){this.vertices=ix.map(i=>({x:v[i*2],y:v[i*2+1],setUVs(u,v){this.tu=u;this.tv=v;}}));return this;},setOrtho(){return this;},setPosition(x,y){this.x=x;this.y=y;return this;},setDepth(){return this;},setAlpha(a){this.alpha=a;return this;},setTint(){return this;},preUpdate(){},destroy(){this.active=false;}};}
function fixture(){const made=[],scene={player:{x:187.5,y:587},cache:{json:{get:k=>k===SAKURA_NATIVE_ART.dataKey?front:k===SAKURA_DIRECTION_ART.dataKey?directions:turns}},textures:{exists:()=>true},_sakuraNativeDirectionsRequested:true,_sakuraNativeTurnRequested:true,add:{mesh(){const n=node();made.push(n);return n;},ellipse(){const n=node();made.push(n);return n;}}};return {made,view:new SakuraNativePresentation(scene)};}
const rest=r=>r.rest?{bones:r.rest.map(b=>b.slice()),fold:0}:sampleNativeClip(r.clips.idle,0);
function fanLocal(r,v){const m=r.bones[r.fanBone].inverseBind;return [m[0]*v[0]+m[2]*v[1]+m[4],m[1]*v[0]+m[3]*v[1]+m[5]];}
function apply(m,v){return [m[0]*v[0]+m[2]*v[1]+m[4],m[1]*v[0]+m[3]*v[1]+m[5]];}
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

test('every actual presentation bank keeps the palm rigid to the fan during a wrist rotation',()=>{
 const f=fixture();let checked=0;
 for(const [name,r]of Object.entries(f.view.rigs)){
  const arm=r.meshes.find(m=>m.name==='arm.R'),base=rest(r),rotated=structuredClone(base);rotated.bones[r.fanBone][2]+=.9;
  const world=nativeWorldMatrices(r,rotated),fanTransform=multiplyAffine(world[r.fanBone],r.bones[r.fanBone].inverseBind),actual=skinNativeMesh(r,arm,rotated,world);
  for(let i=0;i<arm.vertices.length;i++)if(fanLocal(r,arm.vertices[i])[1]>=-6){
   assert(distance(actual[i],apply(fanTransform,arm.vertices[i]))<1e-6,name+' palm must rotate with fan instead of sliding against its grip');checked++;
  }
 }
 assert(checked>=80);f.view.destroy();
});
test('sleeve/elbow weights are untouched and the wrist transition is normalized and bounded',()=>{
 const f=fixture();let transitions=0;
 for(const [name,r]of Object.entries(f.view.rigs)){
  const arm=r.meshes.find(m=>m.name==='arm.R'),old=source[name].meshes.find(m=>m.name==='arm.R');
  for(let i=0;i<arm.vertices.length;i++){
   const y=fanLocal(r,arm.vertices[i])[1],weights=arm.weights[i];
   assert(Math.abs(weights.reduce((s,w)=>s+w[1],0)-1)<1e-5,'retain authored six-decimal source normalization');
   assert(weights.every(([b,w])=>Number.isInteger(b)&&w>0&&w<=1));
   if(y<=-18)assert.deepEqual(weights,old.weights[i],name+' proximal sleeve cannot be pulled by fan');
   if(y>-18&&y<-6){const w=weights.find(w=>w[0]===r.fanBone)?.[1]??0;assert(w>0&&w<1);transitions++;}
  }
 }
 assert(transitions>20);f.view.destroy();
});
test('preparation is per-instance, source rig/poses/UVs and all non-grip meshes are immutable',()=>{
 const original=JSON.stringify(source),a=fixture(),b=fixture();
 for(const [name,r]of Object.entries(a.view.rigs)){
  const old=source[name];for(const key of Object.keys(old).filter(k=>k!=='meshes'))assert.deepEqual(r[key],old[key]);
  for(const m of r.meshes){const prior=old.meshes.find(p=>p.name===m.name);if(m.name!=='arm.R')assert.deepEqual(m,prior);else for(const k of Object.keys(m).filter(k=>k!=='weights'))assert.deepEqual(m[k],prior[k]);}
  assert.notEqual(r,old,'do not alter shared Phaser cache');assert.notEqual(r,b.view.rigs[name]);
 }
 assert.equal(JSON.stringify(source),original);assert.equal(a.made.length,60);assert.equal(a.view.allNodes.length,59);
 const live=a.view.allNodes.slice();a.view.destroy();a.view.destroy();assert(live.every(n=>!n.node.active));b.view.destroy();
});
test('mesh drawing uses prepared weights without changing world hand/socket, gait or frozen pose',()=>{
 const f=fixture();for(const aim of ['down','left','up','right']){
  for(let n=1;n<=15;n++)f.view.update(aim.length*100+n*20,4,0,{id:1,direction:aim,phase:'release',progress:.33,kind:'basic'},false,false);
  const v=f.view,r=v.activeRig,arm=v.nodes.find(n=>n.part.name==='arm.R'),raw=source[v.state.upperRenderDirection];
  assert.deepEqual(nativeWorldMatrices(raw,v.pose),v.world,'prepared weights do not move bones');
  const prepared=r.meshes.find(m=>m.name==='arm.R');assert.equal(arm.part,prepared,'render node must bind the prepared mesh, not source weights');
  const expected=skinNativeMesh(r,prepared,v.pose,v.world),fanTransform=multiplyAffine(v.world[r.fanBone],r.bones[r.fanBone].inverseBind);
  for(let n=0;n<prepared.indices.length;n++){
   const i=prepared.indices[n],p=fanLocal(r,prepared.vertices[i])[1]>=-6?apply(fanTransform,prepared.vertices[i]):expected[i],vertex=arm.node.vertices[n];
   assert(Math.abs(vertex.x-(p[0]-v.rootShift[0]-r.anchor[0])*r.scale)<1e-8,'actual rendered palm X must independently follow fan transform');
   assert(Math.abs(vertex.y+(p[1]-v.rootShift[1]-r.anchor[1])*r.scale)<1e-8,'actual rendered palm Y must independently follow fan transform');
  }
  const positions=v.nodes.map(n=>n.node.vertices.map(v=>[v.x,v.y]));v.update(9999,80,0,null,true,true);assert.deepEqual(v.nodes.map(n=>n.node.vertices.map(v=>[v.x,v.y])),positions);
 }f.view.destroy();
});
test('legacy one-bank fallback retains its original rig and mesh bindings',()=>{
 const f=fixture(),scene=f.view.scene;f.view.destroy();delete scene._sakuraNativeDirectionsRequested;delete scene._sakuraNativeTurnRequested;
 const v=new SakuraNativePresentation(scene);assert.equal(v.activeRig,front);assert.equal(v.rigs.down,front);
 assert.equal(v.nodes.find(n=>n.part.name==='arm.R').part,front.meshes.find(m=>m.name==='arm.R'));v.destroy();
});
