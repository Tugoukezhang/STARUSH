import test from 'node:test';
import assert from 'node:assert/strict';
import {GroundEcho} from '../src/utils/groundEcho278.mjs';
test('wave waits 200ms then traverses 150 world units in 420ms',()=>{
 const w=new GroundEcho({x:10,y:20,color:'orange',start:1000});
 assert.equal(w.sample(1199),null);
 assert.equal(w.sample(1200).radius,0);
 assert.equal(w.sample(1410).radius,75);
 assert.equal(w.sample(1620).radius,150);
 assert.equal(w.sample(1621),null);
});
test('swept hit catches skipped frames once, not every expanding frame',()=>{
 const a={x:40,y:0},b={x:120,y:0},w=new GroundEcho({x:0,y:0,color:'orange',start:0});
 assert.deepEqual(w.collect(199,[a,b],()=>true),[]);
 assert.deepEqual(w.collect(350,[a,b],()=>true),[a]);
 assert.deepEqual(w.collect(620,[a,b],()=>true),[b]);
 assert.deepEqual(w.collect(620,[a,b],()=>true),[]);
});
test('late update processes final radius and cannot miss the whole release',()=>{
 const a={x:149,y:0},w=new GroundEcho({x:0,y:0,color:'orange',start:0});
 assert.deepEqual(w.collect(900,[a],()=>true),[a]);
 assert.deepEqual(w.collect(901,[a],()=>true),[]);
});
test('new target entering the already traversed interior is not hit',()=>{
 const w=new GroundEcho({x:0,y:0,color:'orange',start:0});w.collect(480,[],()=>true);
 assert.deepEqual(w.collect(620,[{x:20,y:0}],()=>true),[]);
});
test('walls reject contact and disposed wave has no effects',()=>{
 const a={x:100,y:0},w=new GroundEcho({x:0,y:0,color:'orange',start:0});
 assert.deepEqual(w.collect(620,[a],()=>false),[]);w.destroy();
 assert.equal(w.sample(500),null);assert.deepEqual(w.collect(620,[a],()=>true),[]);
});
test('origin is copied and contact is based on original impact not player position',()=>{
 const origin={x:10,y:20,color:'orange',start:0},w=new GroundEcho(origin);origin.x=900;
 assert.deepEqual(w.collect(620,[{x:20,y:20}],()=>true),[{x:20,y:20}]);
 assert.equal(w.origin.x,10);
});
