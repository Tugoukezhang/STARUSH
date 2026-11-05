import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {nativeWorldMatrices, multiplyAffine, sampleNativeClip, composeNativePose, skinNativeMesh} from '../src/utils/sakuraNativePose.mjs';
import {prepareNativeGripRig} from '../src/utils/sakuraNativeGrip.mjs';
import {sampleDirectionalPose} from '../src/utils/sakuraNativeDirections.mjs';

const read=f=>JSON.parse(fs.readFileSync(new URL('../public/art/'+f,import.meta.url)));
const banks={down:read('sakura-conformance-20261004/rig.json'),...read('sakura-details-20261004/views.json').views,...read('sakura-turn-native-20261004/views.json').views};
const close=(a,b,label,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<=tolerance,`${label}: ${a} != ${b}`);
function rawSkin(rig,mesh,pose,world=nativeWorldMatrices(rig,pose)){
 const transforms=world.map((m,i)=>multiplyAffine(m,rig.bones[i].inverseBind));
 return mesh.vertices.map(([vx,vy],i)=>{
  const x=vx+(mesh.fold?.[i][0]??0)*pose.fold,y=vy+(mesh.fold?.[i][1]??0)*pose.fold;
  return mesh.weights[i].reduce(([px,py],[bone,w])=>{const m=transforms[bone];return [px+w*(m[0]*x+m[2]*y+m[4]),py+w*(m[1]*x+m[3]*y+m[5])];},[0,0]);
 });
}
function rows(mesh){
 const byV=new Map();mesh.uv.forEach(([u,v],i)=>{if(!byV.has(v))byV.set(v,[]);byV.get(v).push(i);});
 return [...byV.values()].map(indices=>indices.sort((a,b)=>mesh.uv[a][0]-mesh.uv[b][0]));
}
function targetWidth(rig,mesh,indices,world){
 const first=indices[0],last=indices.at(-1),d=mesh.vertices[last].map((v,k)=>v-mesh.vertices[first][k]);
 return mesh.weights[first].reduce((n,[bone,w])=>{const m=multiplyAffine(world[bone],rig.bones[bone].inverseBind);return n+w*Math.hypot(m[0]*d[0]+m[2]*d[1],m[1]*d[0]+m[3]*d[1]);},0);
}
function fixture(angle=120*Math.PI/180,scale=1){
 const rig={bones:[{name:'upper.R',parent:-1,inverseBind:[1,0,0,1,0,0]},{name:'forearm.R',parent:0,inverseBind:[1,0,0,1,0,0]}]};
 const mesh={name:'arm.R',vertices:[[-5,0],[0,0],[5,0]],uv:[[0,0],[.5,0],[1,0]],weights:Array.from({length:3},()=>[[0,.5],[1,.5]])};
 const pose={fold:0,bones:[[0,0,0,1,1],[0,0,angle,scale,scale]]};
 return {rig,mesh,pose};
}
test('uniform sleeve cross section keeps its width under opposed bone rotation',()=>{
 const {rig,mesh,pose}=fixture(),out=skinNativeMesh(rig,mesh,pose);
 close(Math.hypot(out[2][0]-out[0][0],out[2][1]-out[0][1]),10,'sleeve width');
 const raw=rawSkin(rig,mesh,pose);assert.deepEqual(out[1],raw[1]);
 for(let k=0;k<2;k++)close((out[0][k]+out[2][k])/2,(raw[0][k]+raw[2][k])/2,'centerline');
});
test('volume preservation retains authored bone scale rather than forcing bind width',()=>{
 const {rig,mesh,pose}=fixture(120*Math.PI/180,2),out=skinNativeMesh(rig,mesh,pose);
 close(Math.hypot(out[2][0]-out[0][0],out[2][1]-out[0][1]),15,'weighted scaled width');
});
test('rigid palm and all non-arm meshes keep exact original linear skinning',()=>{
 const {rig,mesh,pose}=fixture();mesh.vertices.push([-4,9],[0,9],[4,9]);mesh.uv.push([0,1],[.5,1],[1,1]);mesh.weights.push([[1,1]],[[1,1]],[[1,1]]);
 const out=skinNativeMesh(rig,mesh,pose),raw=rawSkin(rig,mesh,pose);assert.deepEqual(out.slice(3),raw.slice(3));
 for(const name of ['leg.R','leg.L','fan.open','head','torso'])assert.deepEqual(skinNativeMesh(rig,{...mesh,name},pose),raw);
});
test('rest pose stays exact; nonuniform and nonadjacent weights fail closed',()=>{
 const {rig,mesh,pose}=fixture(0);assert.deepEqual(skinNativeMesh(rig,mesh,pose),rawSkin(rig,mesh,pose));
 pose.bones[1][2]=2;mesh.weights[1]=[[0,.2],[1,.8]];assert.deepEqual(skinNativeMesh(rig,mesh,pose),rawSkin(rig,mesh,pose));
 mesh.weights[1]=[[0,.5],[1,.5]];rig.bones[1].parent=-1;assert.deepEqual(skinNativeMesh(rig,mesh,pose),rawSkin(rig,mesh,pose));
});
test('degenerate rotation cancellation stays finite with bounded width and fixed center',()=>{
 const {rig,mesh,pose}=fixture(Math.PI),out=skinNativeMesh(rig,mesh,pose);
 assert(out.flat().every(Number.isFinite));close(Math.hypot(out[2][0]-out[0][0],out[2][1]-out[0][1]),10,'cancelled rotation width');
 const raw=rawSkin(rig,mesh,pose);assert.deepEqual(out[1],raw[1]);
});
test('actual front release shoulder retains its measured cross section',()=>{
 const rig=prepareNativeGripRig(banks.down),mesh=rig.meshes.find(m=>m.name==='arm.R');
 const pose=composeNativePose(rig,sampleNativeClip(rig.clips.idle,0),{phase:'release',progress:.25}),world=nativeWorldMatrices(rig,pose),out=skinNativeMesh(rig,mesh,pose,world);
 const indices=rows(mesh).find(r=>Math.abs(mesh.uv[r[0]][1]-.0833334)<1e-6),a=indices[0],b=indices.at(-1),raw=rawSkin(rig,mesh,pose,world),expected=targetWidth(rig,mesh,indices,world);
 close(Math.hypot(out[b][0]-out[a][0],out[b][1]-out[a][1]),expected,'formal shoulder');
 for(let k=0;k<2;k++)close((out[a][k]+out[b][k])/2,(raw[a][k]+raw[b][k])/2,'formal shoulder center');
 assert(Math.hypot(raw[b][0]-raw[a][0],raw[b][1]-raw[a][1])/expected<.86,'fixture must retain the original collapse');
});
test('all eight banks and authored attack phases preserve uniform arm rows and grip',()=>{
 const before=JSON.stringify(banks);let measured=0;
 for(const source of Object.values(banks)){
  const rig=prepareNativeGripRig(source);
  for(const phase of ['windup','release','recovery'])for(let step=0;step<=20;step++){
   const attack={phase,progress:step/20,kind:'basic'};
   const pose=rig.clips?composeNativePose(rig,sampleNativeClip(rig.clips.idle,0),attack):sampleDirectionalPose(rig,{clock:0,gaitTime:0,locomotionWeight:0},attack),world=nativeWorldMatrices(rig,pose);
   for(const mesh of rig.meshes.filter(m=>m.name==='arm.R'||m.name==='arm.L')){
    const out=skinNativeMesh(rig,mesh,pose,world),raw=rawSkin(rig,mesh,pose,world);assert(out.flat().every(Number.isFinite));
    for(const indices of rows(mesh)){
     const weights=mesh.weights[indices[0]];if(weights.length!==2||!indices.every(i=>JSON.stringify(mesh.weights[i])===JSON.stringify(weights)))continue;
     const [a,b]=weights.map(w=>w[0]);if(rig.bones[a].parent!==b&&rig.bones[b].parent!==a)continue;
     const first=indices[0],last=indices.at(-1),expected=targetWidth(rig,mesh,indices,world);
     close(Math.hypot(out[last][0]-out[first][0],out[last][1]-out[first][1]),expected,source.view+' '+phase+' width',2e-5);
     for(let k=0;k<2;k++)close((out[first][k]+out[last][k])/2,(raw[first][k]+raw[last][k])/2,'row center');
     measured++;
    }
    const inverse=rig.bones[rig.fanBone].inverseBind;
    if(mesh.name==='arm.R')for(let i=0;i<mesh.vertices.length;i++){
     const [x,y]=mesh.vertices[i];if(inverse[1]*x+inverse[3]*y+inverse[5]>=-6-1e-6)assert.deepEqual(out[i],raw[i],'fully bound palm must not move relative to grip');
    }
   }
  }
 }
 assert(measured>5000);assert.equal(JSON.stringify(banks),before,'source rigs must remain immutable');
});
test('unsupported curved rows and missing UVs preserve raw fallback',()=>{
 const {rig,mesh,pose}=fixture();mesh.vertices[1][1]=2;assert.deepEqual(skinNativeMesh(rig,mesh,pose),rawSkin(rig,mesh,pose));
 delete mesh.uv;assert.deepEqual(skinNativeMesh(rig,mesh,pose),rawSkin(rig,mesh,pose));
});
