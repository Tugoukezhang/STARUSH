import test from 'node:test';
import assert from 'node:assert/strict';
import {createSakuraConnectedSurface} from '../src/systems/SakuraConnectedSurface.mjs';

function model(){
 const points=[new Float32Array([425,180,430,200]),new Float32Array([425,180,430,200,450,256]),new Float32Array([425,180,430,200,450,256,400,500,300,1150,500,1260])];
 return {width:853,height:1280,meshIds:['ArtMeshEyeClose','ArtMeshFace','ArtMeshTopwear'],meshVertices:i=>points[i],points};
}
test('overlapping face, eye and collar vertices receive exactly the same transform',()=>{
 const p=model(),move=createSakuraConnectedSurface(p);
 for(const look of [{x:-1,y:-1},{x:1,y:1},{x:0,y:0}]){
  move({look,env:-1,elapsed:875,still:false});
  assert.deepEqual([...p.points[0]],[...p.points[1].slice(0,4)]);
  assert.deepEqual([...p.points[1]],[...p.points[2].slice(0,6)]);
 }
});
test('upper head and collar retain distance and feet stay planted at stress pose',()=>{
 const p=model(),move=createSakuraConnectedSurface(p),rest=p.points.map(v=>v.slice());
 move({look:{x:1,y:-1},env:-1,elapsed:1300,still:false});
 const distance=v=>Math.hypot(v[2]-v[0],v[3]-v[1]);
 assert(Math.abs(distance(p.points[1])-distance(rest[1]))<.0001);
 assert.deepEqual([...p.points[2].slice(-4)],[...rest[2].slice(-4)]);
 assert.notDeepEqual([...p.points[1]],[...rest[1]]);
});
test('poses do not accumulate; reduced motion restores exact rest geometry',()=>{
 const p=model(),rest=p.points.map(v=>v.slice()),move=createSakuraConnectedSurface(p);
 const pose={look:{x:.8,y:-.4},env:.25,elapsed:1500,still:false};
 move(pose);const first=p.points.map(v=>v.slice());
 for(let i=0;i<100;i++)move(pose);
 assert.deepEqual(p.points,first);
 move({...pose,still:true});assert.deepEqual(p.points,rest);
});
test('wrong mesh registration is rejected instead of silently deforming another asset',()=>{
 const p=model();p.meshIds[1]='OtherFace';assert.throws(()=>createSakuraConnectedSurface(p),RangeError);
});
