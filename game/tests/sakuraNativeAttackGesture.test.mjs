import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sampleDirectionalPose} from '../src/utils/sakuraNativeDirections.mjs';
import {nativeWorldMatrices,skinNativeMesh} from '../src/utils/sakuraNativePose.mjs';
const art=new URL('../public/art/',import.meta.url);
const rigs={...JSON.parse(fs.readFileSync(new URL('sakura-details-20261004/views.json',art))).views,...JSON.parse(fs.readFileSync(new URL('sakura-turn-native-20261004/views.json',art))).views};
const clock={clock:270,gaitTime:270,locomotionWeight:1};
const pose=(r,phase,progress,kind='basic')=>sampleDirectionalPose(r,clock,{phase,progress,kind});
const hand=(r,p)=>nativeWorldMatrices(r,p)[r.fanBone].slice(4);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

test('side and back release have a real continuing swing, not a held windup pose',()=>{
 for(const [id,r]of Object.entries(rigs)){
  assert(distance(hand(r,pose(r,'release',0)),hand(r,pose(r,'release',.33)))>8,id+' release must accelerate');
  assert(distance(hand(r,pose(r,'release',.33)),hand(r,pose(r,'release',1)))>3,id+' follow-through required');
 }
});
test('anticipation counter-moves, torso leads the swing, recovery returns to the current gait',()=>{
 for(const [id,r]of Object.entries(rigs)){
  const rest=sampleDirectionalPose(r,clock,null),prepare=pose(r,'windup',.5),release=pose(r,'release',.33);
  const upper=r.bones.findIndex(b=>b.name==='upper.R'),chest=r.bones.findIndex(b=>b.name==='chest');
  assert((prepare.bones[upper][2]-rest.bones[upper][2])*(release.bones[upper][2]-rest.bones[upper][2])<0,id+' anticipation must oppose release');
  assert(Math.abs(prepare.bones[chest][2]-rest.bones[chest][2])>.02,id+' chest anticipation');
  assert(Math.abs(release.bones[chest][2]-rest.bones[chest][2])>.02,id+' chest release');
  assert.deepEqual(pose(r,'recovery',1).bones,rest.bones,id+' exact gait recovery');
  assert.equal(pose(r,'recovery',1).fold,rest.fold);
 }
});
test('phase boundaries are continuous and no attack changes feet, pelvis, bone lengths or rig input',()=>{
 for(const [id,r]of Object.entries(rigs))for(const kind of ['basic','special','encore']){
  const original=JSON.stringify(r),base=sampleDirectionalPose(r,clock,null);
  const endpoints=[[pose(r,'windup',1,kind),pose(r,'release',0,kind)],[pose(r,'release',1,kind),pose(r,'recovery',0,kind)],[pose(r,'windup',0,kind),base],[pose(r,'recovery',1,kind),base]];
  for(const [a,b]of endpoints){assert(distance(hand(r,a),hand(r,b))<1e-8,id+' no socket pop');assert(Math.abs(a.fold-b.fold)<1e-8);}
  for(const phase of ['windup','release','recovery'])for(let n=0;n<=100;n++){
   const p=pose(r,phase,n/100,kind),world=nativeWorldMatrices(r,p);
   assert(p.fold>=0&&p.fold<=1);
   for(const [i,b]of r.bones.entries()){
    if(/^(root|hip|thigh\.|shin\.|foot\.)/.test(b.name))assert.deepEqual(p.bones[i],base.bones[i],id+' protected '+b.name);
    for(const k of [0,1,3,4])assert.equal(p.bones[i][k],base.bones[i][k],id+' fixed bone length/scale');
   }
   for(const m of r.meshes)assert(skinNativeMesh(r,m,p,world).every(v=>v.every(Number.isFinite)));
  }
  assert.equal(JSON.stringify(r),original);
 }
});
test('dense swing sampling remains bounded and full release opens the fan in all seven alternate views',()=>{
 for(const [id,r]of Object.entries(rigs)){
  let previous,max=0;
  for(const phase of ['windup','release','recovery'])for(let i=0;i<=100;i++){
   const current=hand(r,pose(r,phase,i/100));if(previous)max=Math.max(max,distance(current,previous));previous=current;
  }
  assert(max<4,id+' discontinuous gesture '+max);
  assert.equal(pose(r,'release',.33).fold,0);
  assert(distance(hand(r,pose(r,'release',.33)),hand(r,sampleDirectionalPose(r,clock,null)))>35,id+' clear extension');
 }
});
