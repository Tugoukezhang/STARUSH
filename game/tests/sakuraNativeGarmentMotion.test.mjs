import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {SakuraNativeDetails,composeNativeDetails} from '../src/utils/sakuraNativeDetails.mjs';
import {sampleNativeClip,sampleNativeLocomotion,blendNativeLocomotion,nativeWorldMatrices,skinNativeMesh,SakuraNativeClock} from '../src/utils/sakuraNativePose.mjs';
import {sampleDirectionalPose} from '../src/utils/sakuraNativeDirections.mjs';
import {renderNativeMeshNodes} from '../src/systems/SakuraNativePresentation.mjs';
const read=f=>JSON.parse(fs.readFileSync(new URL('../public/art/'+f,import.meta.url)));
const rigs={down:read('sakura-conformance-20261004/rig.json'),...read('sakura-details-20261004/views.json').views,...read('sakura-turn-native-20261004/views.json').views};
const cloth=new Set(['torso','pelvis','tab']);
const base=(r,c={clock:300,gaitTime:180,locomotionWeight:.8},attack=null)=>r.clips
  ? blendNativeLocomotion(sampleNativeClip(r.clips.idle,c.clock),sampleNativeLocomotion(r,c.gaitTime),c.locomotionWeight)
  : sampleDirectionalPose(r,c,attack);
const maxDelta=(a,b,scale=1)=>Math.max(...a.map((p,i)=>Math.hypot(p[0]-b[i][0],p[1]-b[i][1])*scale));

test('front ponytail responds to existing hair inertia without moving the face or any other bone',()=>{
  const r=rigs.down,p=base(r),next=composeNativeDetails(r,p,{secondary:{hair:8,hem:0},reaction:0});
  const mesh=r.meshes.find(m=>m.name==='ponytail');
  assert.ok(maxDelta(skinNativeMesh(r,mesh,p),skinNativeMesh(r,mesh,next),r.scale*2/3)>.2,'front hair must actually move');
  for(const [i,b]of r.bones.entries())if(b.name!=='hair')assert.deepEqual(next.bones[i],p.bones[i],b.name);
  assert.deepEqual(skinNativeMesh(r,r.meshes.find(m=>m.name==='head'),next),skinNativeMesh(r,r.meshes.find(m=>m.name==='head'),p));
});

test('all eight garment banks deform below the waist, with exact fixed joints and bounded orientation-preserving geometry',()=>{
  for(const [view,r]of Object.entries(rigs)){
    const original=JSON.stringify(r),p=base(r);let affected=0;
    for(const hem of [-8,-3,3,8]){
      const next=composeNativeDetails(r,p,{secondary:{hair:0,hem},reaction:0});
      assert.deepEqual(next.bones,p.bones,'cloth must not perturb bone matrices');
      for(const m of r.meshes){
        const a=skinNativeMesh(r,m,p),b=skinNativeMesh(r,m,next);
        if(!cloth.has(m.name)){assert.deepEqual(b,a,view+'/'+m.name);continue;}
        m.vertices.forEach((v,i)=>{if(v[1]<=190)assert.deepEqual(b[i],a[i],view+' fixed shoulder/waist');});
        const delta=maxDelta(a,b,r.scale*2/3);assert.ok(delta<=2.5,view+' cloth displacement '+delta);
        if(delta>.08)affected++;
        for(let i=0;i<m.indices.length;i+=3){
          const [j,k,l]=m.indices.slice(i,i+3),area=v=>(v[k][0]-v[j][0])*(v[l][1]-v[j][1])-(v[k][1]-v[j][1])*(v[l][0]-v[j][0]);
          if(Math.abs(area(a))>1e-6)assert.ok(area(b)/area(a)>.65,view+' inverted or collapsed cloth triangle');
        }
      }
    }
    assert.ok(affected>=4,view+' must have a visible hem consumer');assert.equal(JSON.stringify(r),original);
  }
});

test('cloth input clamps extreme values, ignores nonfinite values, and absent/zero detail preserves old pixels',()=>{
  for(const r of Object.values(rigs)){
    const p=base(r),m=r.meshes.find(m=>m.name==='pelvis'||m.name==='torso');
    const limit=skinNativeMesh(r,m,composeNativeDetails(r,p,{secondary:{hem:8},reaction:0}));
    assert.deepEqual(skinNativeMesh(r,m,composeNativeDetails(r,p,{secondary:{hem:800},reaction:0})),limit);
    for(const hem of [0,undefined,NaN,Infinity,-Infinity])assert.deepEqual(skinNativeMesh(r,m,composeNativeDetails(r,p,{secondary:{hem},reaction:0})),skinNativeMesh(r,m,p));
    assert.deepEqual(skinNativeMesh(r,m,{...p,clothHem:NaN}),skinNativeMesh(r,m,p));
  }
});

test('cloth actually reaches Phaser render vertices while UVs and the hand socket stay exact',()=>{
  const Vertex=createRequire(import.meta.url)('phaser/src/geom/mesh/Vertex.js');
  for(const r of Object.values(rigs)){
    const p=base(r),next=composeNativeDetails(r,p,{secondary:{hair:0,hem:8},reaction:0}),world=nativeWorldMatrices(r,next);
    assert.deepEqual(world,nativeWorldMatrices(r,p),'committed hand/socket matrices preserved');
    const part=r.meshes.find(m=>m.name==='pelvis'||m.name==='torso');
    const node={vertices:part.indices.map(()=>new Vertex(0,0,0,0,0)),setPosition(){return this;},setAlpha(){return this;},setTint(){return this;},preUpdate(){}};
    renderNativeMeshNodes([{part,node}],r,next,world,[0,0],0,0,1,false,0,{scale:2/3,groundOffset:26});
    const positions=skinNativeMesh(r,part,next,world),prior=skinNativeMesh(r,part,p);
    let renderedChange=0;
    node.vertices.forEach((v,i)=>{
      const index=part.indices[i],at=positions[index],uv=part.uv[index];
      assert.ok(Math.abs(v.x-(at[0]-r.anchor[0])*r.scale*2/3)<1e-10);assert.ok(Math.abs(v.y+(at[1]-r.anchor[1])*r.scale*2/3)<1e-10);
      assert.deepEqual([v.tu,v.tv],[(part.region[0]+uv[0]*part.region[2])/r.atlasSize[0],(part.region[1]+uv[1]*part.region[3])/r.atlasSize[1]]);
      renderedChange=Math.max(renderedChange,Math.hypot(at[0]-prior[index][0],at[1]-prior[index][1])*r.scale*2/3);
    });
    assert.ok(renderedChange>.08,'a stored scalar alone is not an accepted render fix');
  }
});

test('existing solver drives start/stop garment motion at 30/60/120 Hz without perpetual idle flutter',()=>{
  const finals=[];
  for(const hz of [30,60,120]){
    const c=new SakuraNativeClock(64),d=new SakuraNativeDetails(),r=rigs.left;
    c.update(0,0,0,false);d.update(c.clock,0,0,null,'left',false,0);
    for(let i=1;i<=hz;i++){c.update(i*1000/hz,120/hz,0,false);d.update(c.clock,120/hz,0,null,'left',false,0);}
    const pose=composeNativeDetails(r,base(r,c),d),m=r.meshes.find(m=>m.name==='torso');
    assert.ok(maxDelta(skinNativeMesh(r,m,base(r,c)),skinNativeMesh(r,m,pose),r.scale*2/3)>.08);
    finals.push(d.secondary.hem);
    for(let i=1;i<=hz*2;i++){c.update(1000+i*1000/hz,0,0,false);d.update(c.clock,0,0,null,'left',false,0);}
    assert.ok(Math.abs(d.secondary.hem)<.001);assert.equal(c.locomotionWeight,0);
  }
  assert.ok(Math.max(...finals)-Math.min(...finals)<.001);
});
