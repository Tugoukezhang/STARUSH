import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {nativeWorldMatrices,multiplyAffine} from '../src/utils/sakuraNativePose.mjs';
import {skinRefinedMesh} from '../src/utils/sakuraRefinedSkinning.mjs';
import {SakuraRefinedWorldFrame} from '../src/utils/sakuraRefinedFrame.mjs';
const original={...JSON.parse(fs.readFileSync(new URL('../public/art/sakura-refined-20261006/views.json',import.meta.url))).views,...JSON.parse(fs.readFileSync(new URL('../public/art/sakura-oblique-20261006/views.json',import.meta.url))).views};
const url=new URL('../src/utils/sakuraCompactBind.mjs',import.meta.url);
const load=async()=>{assert(fs.existsSync(url),'Formal torso/neck retarget helper must exist');return import(url);};
test('compact bind shortens torso and neck without modifying source cache, legs, face aspect or atlas registration',async()=>{
 const {compactSakuraBind}=await load(),before=structuredClone(original),rigs=compactSakuraBind(original);
 assert.deepEqual(original,before);
 for(const [dir,rig]of Object.entries(rigs)){
  const old=original[dir],a=nativeWorldMatrices(old,{bones:old.rest}),b=nativeWorldMatrices(rig,{bones:rig.rest});
  assert.equal(rig.proportionProfile,'compact-torso-v1');assert.notEqual(rig,old);assert.equal(rig.legLength,old.legLength);
  assert.equal(rig.rest[2][1],old.rest[2][1]+15);assert.equal(rig.rest[3][1],old.rest[3][1]+8);
  for(const i of [0,1,10,11,12,13,14,15])assert.deepEqual(b[i],a[i]);
  for(const i of [3,4])assert.deepEqual(b[i].slice(0,4),a[i].slice(0,4),'Face and hair must not be squashed');
  for(let i=0;i<rig.meshes.length;i++){
   const m=rig.meshes[i],o=old.meshes[i];for(const key of ['uv','indices','region','weights'])assert.deepEqual(m[key],o[key]);
   assert(m.vertices.flat().every(Number.isFinite));const t=multiplyAffine(b[0],rig.bones[0].inverseBind);assert(Math.abs(t[0]-1)<1e-7);
   if(m.name==='head-open'){for(let j=0;j<m.vertices.length;j++){assert(Math.abs(m.vertices[j][0]-o.vertices[j][0])<1e-7);assert(Math.abs(m.vertices[j][1]-o.vertices[j][1]-23)<1e-7);}}
   if(m.name.startsWith('leg.'))assert.deepEqual(m.vertices,o.vertices);
  }
 }
});
test('retargeted eight directions retain exact stance, grip, pause and attack recovery',async()=>{
 const {compactSakuraBind}=await load(),rigs=compactSakuraBind(original);
 for(const [dx,dy]of [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]]){
  const a=new SakuraRefinedWorldFrame(original),b=new SakuraRefinedWorldFrame(rigs);let previous;
  for(let i=0;i<100;i++){
   const moving=i<65,args={now:i*16.667,x:500+Math.min(i,64)*dx*2,y:1708+Math.min(i,64)*dy*2,attack:i>=20&&i<45?{id:1,direction:'right',angle:.7,phase:i<30?'windup':i<35?'release':'recovery',progress:(i%5)/5}:null};
   const old=a.update(args),f=b.update(args);assert.deepEqual(f.contacts,old.contacts);assert.equal(f.distance,old.distance);assert.equal(f.attackId,old.attackId);
   for(const layer of f.layers){assert(layer.gripError<1e-7);const rig=rigs[layer.direction];for(const m of rig.meshes)assert(skinRefinedMesh(rig,m,layer.pose,layer.world).flat().every(Number.isFinite));}
   // The existing solver reserves .001 source units at full extension (.00024 world px).
   if(previous)for(const side of ['R','L']){const p=previous.contacts[side],q=f.contacts[side];if(p.id===q.id&&p.state==='stance'&&q.state==='stance')assert(Math.hypot(p.actual.x-q.actual.x,p.actual.y-q.actual.y)<.001);}
   previous=f;
  }
  assert.deepEqual(b.update({now:2500,x:628,y:1836,frozen:true}),previous);
 }
});
test('formal presenter uses compact bind before node creation; private input and assets are not imported',()=>{
 const source=fs.readFileSync(new URL('../src/systems/SakuraRefinedPresentation.mjs',import.meta.url),'utf8');
 assert.match(source,/this\.rigs=compactSakuraBind\(/);assert(source.indexOf('this.rigs=compactSakuraBind(')<source.indexOf('this.controller=new SakuraRefinedWorldFrame'));
 assert.doesNotMatch(source,/sakura-volume|sakuraTrial|sakuraVolumeTrial/);
});
