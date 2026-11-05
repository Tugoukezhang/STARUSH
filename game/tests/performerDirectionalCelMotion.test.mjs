import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const target=process.env.PERFORMER_CEL_SOURCE || new URL('../src/systems/PerformerCelMotion.mjs',import.meta.url);
const motion=existsSync(target)?await import(typeof target==='string'?pathToFileURL(target):target):{};

test('four-way cel contract exists, replacing one-facing static idle',()=>{
  assert.equal(typeof motion.PerformerCelMotion,'function');
});

test('250px in one second does not produce an eight-cycle-per-second leg loop',()=>{
  const view=new motion.PerformerCelMotion();
  let previous=null,changes=0;
  for(let i=0;i<60;i++){
    const frame=view.sample({now:i*1000/60,dx:250/60,dy:0,state:'walk'}).frame;
    if(previous!==null&&frame!==previous)changes++;
    previous=frame;
  }
  assert.equal(changes,10,'96px visual cycle: about 2.6 cycles/s at 250px/s, not 7.8');
});

test('idle has its own breathing/blink frames; blocked movement cannot spend walk distance',()=>{
  const view=new motion.PerformerCelMotion();
  const frames=[0,1600,2100,3300,3550].map(now=>view.sample({now,dx:0,dy:0,state:'idle'}).frame);
  assert.ok(frames.every(frame=>frame>=16&&frame<20));
  assert.ok(new Set(frames).size>=3);
  assert.equal(view.distance,0);
});

test('four directions, opposite strides and distance-driven phase, not wall time',()=>{
  for(const [dx,dy,row] of [[0,24,0],[-24,0,1],[24,0,2],[0,-24,3]]){
    const view=new motion.PerformerCelMotion(),frames=[];
    for(let i=0;i<4;i++)frames.push(view.sample({now:i*120,dx,dy,state:'walk'}).frame);
    assert.equal(new Set(frames).size,4);
    assert.ok(frames.every(f=>Math.floor(f/4)===row));
    const distance=view.distance;
    view.sample({now:20000,dx:0,dy:0,state:'idle'});
    assert.equal(view.distance,distance);
    assert.equal(view.direction,row);
  }
});

test('moving action uses action upper body over directional moving legs, never planted full-body glide',()=>{
  const view=new motion.PerformerCelMotion();
  for(const [now,pose] of [[100,0],[160,1],[240,2],[310,3]]){
    const sample=view.sample({now,dx:8,dy:0,state:'action',actionUntil:360});
    assert.equal(sample.frame,32+8+pose);
    assert.ok(sample.lowerFrame>=8&&sample.lowerFrame<12);
    assert.equal(sample.splitY,88);
  }
  assert.equal(view.sample({now:350,dx:0,dy:0,state:'action',actionUntil:360}).lowerFrame,null);
  const idle=view.sample({now:360,dx:0,dy:0,state:'idle'});
  assert.ok(idle.frame>=24&&idle.frame<28);
});

test('frozen pose remains identical and does not consume motion, direction or action frames',()=>{
  const view=new motion.PerformerCelMotion();
  const saved=view.sample({now:100,dx:8,dy:0,state:'action',actionUntil:360});
  const distance=view.distance;
  assert.deepEqual(view.sample({now:20000,dx:0,dy:-90,state:'idle',frozen:true}),saved);
  assert.equal(view.distance,distance);
  assert.equal(view.direction,2);
});

test('hurt preserves walking legs and does not invent a generated hurt/defeat pose',()=>{
  const view=new motion.PerformerCelMotion();
  assert.ok(view.sample({now:10,dx:-8,dy:0,state:'hurt'}).frame<16);
  assert.equal(view.sample({now:20,dx:0,dy:0,state:'hurt'}).lowerFrame,null);
});

test('near-diagonal displacement keeps a coherent facing until the other axis clearly wins',()=>{
  for(const [dx,dy,row] of [[4,0,2],[-4,0,1],[0,4,0],[0,-4,3]]){
    const view=new motion.PerformerCelMotion();
    view.sample({now:0,dx,dy,state:'walk'});
    for(let i=0;i<20;i++){
      const horizontal=dx!==0, major=i%2?3.9:4.1;
      const sample=view.sample({now:16*(i+1),dx:horizontal?Math.sign(dx)*4:major,
        dy:horizontal?major:Math.sign(dy)*4,state:'walk'});
      assert.equal(Math.floor(sample.frame/4),row,'diagonal noise must not alternate front and side cels');
    }
    const horizontal=dx!==0;
    view.sample({now:400,dx:horizontal?Math.sign(dx)*4:6,dy:horizontal?6:Math.sign(dy)*4,state:'walk'});
    assert.equal(view.direction,horizontal?0:2,'a deliberate turn must still respond');
  }
});

test('a diagonal moving action keeps upper and lower facing coherent, while a reversal remains immediate',()=>{
  const view=new motion.PerformerCelMotion();
  view.sample({now:0,dx:4,dy:0,state:'walk'});
  const pose=view.sample({now:100,dx:4,dy:4.1,state:'action',actionUntil:360});
  assert.equal(Math.floor((pose.frame-32)/4),2);
  assert.equal(Math.floor(pose.lowerFrame/4),2);
  assert.equal(pose.facing,'right');
  const reversed=view.sample({now:110,dx:-4,dy:0,state:'walk'});
  assert.equal(Math.floor(reversed.frame/4),1);
  assert.equal(reversed.facing,'left');
});
