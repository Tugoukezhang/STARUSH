import test from 'node:test';
import assert from 'node:assert/strict';
import {RefinedSecondaryMotion} from '../src/utils/sakuraRefinedDetails.mjs';

function turnSamples(hz,from='front',to='right'){
 const s=new RefinedSecondaryMotion();s.sample(0,0,0,from);
 for(let i=1;i<=hz;i++)s.sample(i*1000/hz,0,0,from);
 const rows=[];
 for(let i=1;i<=hz;i++){
  const value=s.sample(1000+i*1000/hz,0,0,to);
  if(i%(hz/10)===0)rows.push(value);
 }
 return rows;
}

test('same realized turn has the same hair, hem and balance at common times across refresh rates',()=>{
 for(const [from,to]of [['front','right'],['right','front-right'],['front-left','back-right']]){
  const reference=turnSamples(120,from,to);
  assert(Math.abs(reference[0].hair)>.01,'A turn must still have a secondary response');
  for(const hz of [10,20,30,60]){
   const rows=turnSamples(hz,from,to);
   for(let i=0;i<rows.length;i++)for(const key of ['hair','hem','balance'])
    assert(Math.abs(rows[i][key]-reference[i][key])<1e-8,`${from}->${to} ${hz}Hz sample ${i} ${key}: ${rows[i][key]} vs ${reference[i][key]}`);
  }
 }
});

test('stationary initial orientation has no invented turn and repeated samples do not reinject it',()=>{
 const s=new RefinedSecondaryMotion();
 assert.deepEqual(s.sample(0,0,0,'right'),{hair:0,hem:0,balance:0});
 assert.deepEqual(s.sample(16,0,0,'right'),{hair:0,hem:0,balance:0});
 const turn=s.sample(32,0,0,'left');
 assert(Math.abs(turn.hair)>0);
 assert.deepEqual(s.sample(32,0,0,'left'),turn);
 let settled;
 for(let i=1;i<=120;i++)settled=s.sample(32+i*16,0,0,'left');
 assert(Math.abs(settled.hair)<1e-10&&Math.abs(settled.hem)<1e-10);
});

test('discontinuity resets both spring values and yaw; the following stationary frame stays still',()=>{
 const s=new RefinedSecondaryMotion();s.sample(0,0,0,'front');s.sample(16,4,0,'right');
 assert.deepEqual(s.sample(32,100,0,'back-left'),{hair:0,hem:0,balance:0});
 assert.deepEqual(s.sample(48,0,0,'back-left'),{hair:0,hem:0,balance:0});
 assert.deepEqual(s.sample(1048,0,0,'front-right'),{hair:0,hem:0,balance:0});
 assert.deepEqual(s.sample(1064,0,0,'front-right'),{hair:0,hem:0,balance:0});
});
