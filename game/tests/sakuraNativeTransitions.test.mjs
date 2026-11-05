import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as poseApi from '../src/utils/sakuraNativePose.mjs';
const rig=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-native-20261004/rig.json',import.meta.url)));
const {SakuraNativeClock,sampleNativeClip,skinNativeMesh,composeNativePose}=poseApi;

test('stopping blends a real arbitrary gait pose into breathing idle, without a phase reset pop',()=>{
  const c=new SakuraNativeClock();c.update(0,0,0,false);c.update(100,0,24,false);c.update(120,0,5,false);
  assert.equal(c.locomotionWeight,1);
  const priorPhase=c.gaitTime;
  c.update(136,0,0,false);
  assert(c.locomotionWeight>0 && c.locomotionWeight<1);
  assert(c.gaitTime>=priorPhase);
  assert.equal(c.settling,true);
  for(let t=152;t<=360;t+=16)c.update(t,0,0,false);
  assert.equal(c.locomotionWeight,0);assert.equal(c.gaitTime,0);assert.equal(c.settling,false);
  assert.equal(c.travel,29);
});

test('starting uses gradual pose weight, stationary intent never walks, pause never catches up',()=>{
  const c=new SakuraNativeClock();c.update(0,0,0,false);c.update(16,4,0,false);
  assert(c.locomotionWeight>0 && c.locomotionWeight<.2);
  const before={weight:c.locomotionWeight,phase:c.gaitTime,clock:c.clock,travel:c.travel};
  c.update(5016,120,0,true);
  assert.deepEqual({weight:c.locomotionWeight,phase:c.gaitTime,clock:c.clock,travel:c.travel},before);
  c.update(5032,0,0,false);assert.equal(c.travel,4);assert.equal(c.moving,false);
  for(let t=5048;t<=5304;t+=16)c.update(t,0,0,false);
  assert.equal(c.locomotionWeight,0);assert.equal(c.gaitTime,0);
});

test('real skinned vertices remain continuous at the half-cycle stop and upper attack preserves blended legs',()=>{
  assert.equal(typeof poseApi.blendNativeLocomotion,'function');
  const c=new SakuraNativeClock(),mesh=rig.meshes.find(m=>m.name==='leg.R');
  let previous,maxStep=0;const samples=[];
  for(let i=0;i<38;i++){
    c.update(i*16,i>0&&i<14?4:0,0,false);
    const idle=sampleNativeClip(rig.clips.idle,c.clock),walk=sampleNativeClip(rig.clips.walk,c.gaitTime);
    const base=poseApi.blendNativeLocomotion(idle,walk,c.locomotionWeight);
    const vertices=skinNativeMesh(rig,mesh,base);
    if(previous)maxStep=Math.max(maxStep,...vertices.map((v,j)=>Math.hypot(v[0]-previous[j][0],v[1]-previous[j][1])*rig.scale));
    previous=vertices;samples.push(c.locomotionWeight);
    for(const phase of ['windup','release','recovery'])assert.deepEqual(skinNativeMesh(rig,mesh,composeNativePose(rig,base,{phase,progress:.65})),vertices);
    if(c.locomotionWeight===0)assert.deepEqual(base,idle);
  }
  assert(maxStep<3,`screen-space leg jump ${maxStep}px`);assert(samples.some(w=>w>0&&w<1));
});

test('authored common root translation is removed once, so a full stride and its stop do not snap 9px',()=>{
  assert.equal(typeof poseApi.sampleNativeLocomotion,'function');
  const start=poseApi.sampleNativeLocomotion(rig,0),end=poseApi.sampleNativeLocomotion(rig,999.999);
  let maxSeam=0;
  for(const mesh of rig.meshes){const a=skinNativeMesh(rig,mesh,start),b=skinNativeMesh(rig,mesh,end);maxSeam=Math.max(maxSeam,...a.map((v,i)=>Math.hypot(v[0]-b[i][0],v[1]-b[i][1])*rig.scale));}
  assert(maxSeam<.001,`loop seam ${maxSeam}px`);
  const before=JSON.stringify(rig),c=new SakuraNativeClock();c.update(0,0,0,false);c.update(100,90,0,false);c.update(120,5.8,0,false);
  const mesh=rig.meshes.find(m=>m.name==='leg.R');
  let old=skinNativeMesh(rig,mesh,poseApi.blendNativeLocomotion(sampleNativeClip(rig.clips.idle,c.clock),poseApi.sampleNativeLocomotion(rig,c.gaitTime),c.locomotionWeight));
  for(let t=136;t<340;t+=16){c.update(t,0,0,false);const next=skinNativeMesh(rig,mesh,poseApi.blendNativeLocomotion(sampleNativeClip(rig.clips.idle,c.clock),poseApi.sampleNativeLocomotion(rig,c.gaitTime),c.locomotionWeight));assert(Math.max(...next.map((v,i)=>Math.hypot(v[0]-old[i][0],v[1]-old[i][1])*rig.scale))<3);old=next;}
  assert.equal(JSON.stringify(rig),before,'source clips are preserved byte-for-byte in memory');
});
