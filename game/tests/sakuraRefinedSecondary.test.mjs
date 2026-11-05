import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SakuraRefinedWorldFrame} from '../src/utils/sakuraRefinedFrame.mjs';
import {skinRefinedMesh} from '../src/utils/sakuraRefinedSkinning.mjs';
import {sampleRefinedPose} from '../src/utils/sakuraRefinedMotion.mjs';
import {nativeWorldMatrices} from '../src/utils/sakuraNativePose.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-refined-20261006/views.json',import.meta.url)));
const details=()=>import('../src/utils/sakuraRefinedDetails.mjs');

test('formal frame makes actual root motion drive hair and hem, not an idle oscillator',()=>{
 const c=new SakuraRefinedWorldFrame(data.views);let f=c.update({now:0,x:220,y:580});
 for(let i=1;i<=20;i++)f=c.update({now:i*16,x:220+i*4,y:580});
 assert.ok(f.secondary,'Formal frame must expose its actual displacement-driven secondary response');
 assert(f.secondary.hair<-.1&&f.secondary.hem<-.1);
 assert.deepEqual(f.root,{x:300,y:580});assert.equal(f.scale,.24);assert.equal(f.groundY,606);
 assert.equal(f.layers[0].pose.bones[4][2],0,'Hair roots must not rotate as an entire detached attachment');
 assert.equal(f.layers[0].pose.secondaryHair,f.secondary.hair);assert.equal(f.layers[0].pose.clothHem,f.secondary.hem);
 assert(Math.abs(f.secondary.hair)<=12&&Math.abs(f.secondary.hem)<=8&&Math.abs(f.secondary.balance)<=.034);
 for(let i=21;i<=100;i++)f=c.update({now:i*16,x:300,y:580});
 assert(Math.abs(f.secondary.hair)<.00001&&Math.abs(f.secondary.hem)<.00001,'Stop must settle, not keep invented idle flutter');
});

test('existing critically damped movement response stays equivalent at 10, 20, 30, 60 and 120Hz',async()=>{
 const {RefinedSecondaryMotion}=await details(),rows=[];
 for(const hz of [10,20,30,60,120]){const s=new RefinedSecondaryMotion();s.sample(0,0,0,'front');let value;
  for(let i=1;i<=hz;i++)value=s.sample(i*1000/hz,250/hz,0,'front');rows.push(value);
 }
 for(const row of rows)for(const key of ['hair','hem','balance'])assert(Math.abs(row[key]-rows[0][key])<1e-8,key);
});

test('pause freezes actual secondary pose; resume, zero time and discontinuity never invent speed',async()=>{
 const c=new SakuraRefinedWorldFrame(data.views);c.update({now:0,x:220,y:580});
 const moving=c.update({now:16,x:224,y:580}),saved=structuredClone(moving);
 assert.deepEqual(c.update({now:1016,x:224,y:580,frozen:true}),saved);
 const resumed=c.update({now:1032,x:228,y:580});assert.equal(resumed.clock,32);
 assert(Math.abs(resumed.secondary.hair)<12);
 const {RefinedSecondaryMotion}=await details(),s=new RefinedSecondaryMotion();
 assert.deepEqual(s.sample(0,0,0,'front'),{hair:0,hem:0,balance:0});
 assert.deepEqual(s.sample(0,10,0,'right'),{hair:0,hem:0,balance:0});
 s.sample(16,4,0,'right');assert.deepEqual(s.sample(32,100,0,'left'),{hair:0,hem:0,balance:0});
 s.sample(48,4,0,'left');assert.deepEqual(s.sample(1048,4,0,'left'),{hair:0,hem:0,balance:0});
});

test('direction reversal follows actual movement, bounded turn response decays without a queued action',async()=>{
 const {RefinedSecondaryMotion}=await details(),s=new RefinedSecondaryMotion();s.sample(0,0,0,'front');
 let value;for(let i=1;i<=30;i++)value=s.sample(i*16,4,0,'right');assert(value.hair<0);
 for(let i=31;i<=60;i++)value=s.sample(i*16,-4,0,'left');assert(value.hair>0);
 for(let i=61;i<=160;i++)value=s.sample(i*16,0,0,'left');
 assert(Math.abs(value.hair)<1e-7&&Math.abs(value.hem)<1e-7);
});

test('only tips deform; pinned roots, waist, face, eye, arm, fan and leg remain exact',async()=>{
 const {deformRefinedSecondary}=await details(),saved=JSON.stringify(data);
 for(const rig of Object.values(data.views)){
  // Exported front has no direction field; sample the matching bank explicitly.
  const direction=Object.keys(data.views).find(k=>data.views[k]===rig);
  const pose=sampleRefinedPose({rigs:data.views,direction}).pose;pose.secondaryHair=12;pose.clothHem=-8;
  const world=nativeWorldMatrices(rig,pose);
  for(const mesh of rig.meshes){
   const points=mesh.vertices.map(p=>p.slice()),result=deformRefinedSecondary(rig,mesh,points,pose,world);
   if(!['hair','pelvis'].includes(mesh.name)){assert.deepEqual(result,points);continue;}
   let changed=0;
   for(let i=0;i<points.length;i++){
    const pinned=mesh.uv[i][1]<=(mesh.name==='hair' ? .35 : .45);
    const shift=Math.hypot(result[i][0]-points[i][0],result[i][1]-points[i][1]);
    if(pinned)assert.equal(shift,0);else if(shift>0)changed++;
    assert(shift<=12.01);
   }
   assert(changed>0,mesh.name+' must have rendered geometry changes');
   assert.deepEqual(skinRefinedMesh(rig,mesh,pose,world),deformRefinedSecondary(rig,mesh,skinRefinedMesh(rig,mesh,{...pose,secondaryHair:0,clothHem:0},world),pose,world));
  }
  assert(pose.bones.every(b=>b.every(Number.isFinite)));
 }
 assert.equal(JSON.stringify(data),saved,'Immutable authored data must not receive simulation state');
});

test('secondary composition keeps actual hand registration, planted contacts and recovery bounded',()=>{
 const c=new SakuraRefinedWorldFrame(data.views);c.update({now:0,x:220,y:580});let f;
 for(let i=1;i<=80;i++){
  const attack=i<30?{id:1,direction:'up',phase:'release',progress:.5}:null;
  f=c.update({now:i*16,x:220-i*2,y:580,attack});
  assert(f.layers.every(l=>l.pose.bones.flat().every(Number.isFinite)));
  for(const side of ['R','L'])assert(f.contacts[side].error<.001);
  const upper=f.layers[0],m=upper.world[7];
  assert(Math.hypot(f.hand.x-(f.root.x+(m[4]-upper.rootTravel-160)*f.scale),f.hand.y-(f.groundY+(m[5]-333)*f.scale))<1e-8);
  assert(Math.abs(f.secondary.balance)<=.034);
 }
 assert.equal(f.attackId,null);assert.equal(f.visualRecovery,false);
});
