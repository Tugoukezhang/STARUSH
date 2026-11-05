import assert from 'node:assert/strict';
import { VenusMotion, VENUS_ART, buildVenusPose, preloadVenusLayered } from '../src/systems/VenusLayeredPresentation.mjs';
const root={x:100,y:100},motion=new VenusMotion(root);
assert.equal(VENUS_ART.id,'venus');
const loads=[];preloadVenusLayered({load:{atlas:(...a)=>loads.push(a),json:(...a)=>loads.push(a)}});
assert.equal(loads.length,2);assert.ok(loads.every(r=>!r.join().includes('sakura')));
let pose=motion.sample({now:0,player:root,dx:0,dy:0});
assert.equal(pose.state,'idle');assert.equal(pose.facing,'down');
assert.equal(pose.parts.filter(p=>p.name==='face').length,1);
assert.equal(pose.parts.length,14);assert.equal(pose.root.y,100);
const saved=JSON.stringify(root);
let contacts=0;
for(let i=1;i<=180;i++){
  const p={x:100+i*1.2,y:100};
  const before=motion.feet.feet.map(f=>({...f}));
  pose=motion.sample({now:i*16,player:p,dx:1.2,dy:0});
  assert.equal(pose.facing,'right');
  for(let side=0;side<2;side++){
    const f=motion.feet.feet[side],old=before[side];
    if(f.contact&&old.contact&&f.plantId===old.plantId){assert.equal(f.x,old.x);assert.equal(f.y,old.y);contacts++;}
    const leg=pose.legs[side];
    assert.ok(Math.abs(Math.hypot(leg.knee.x-leg.hip.x,leg.knee.y-leg.hip.y)-7.5)<1e-6);
    assert.ok(Math.abs(Math.hypot(leg.ankle.x-leg.knee.x,leg.ankle.y-leg.knee.y)-7.5)<1e-6);
    assert.ok(leg.error<.1,JSON.stringify(leg));
  }
}
assert.ok(contacts>30);
for(let i=0;i<20;i++)pose=motion.sample({now:3000+i*16,player:{x:316,y:100},dx:0,dy:0});
assert.equal(motion.feet.mode,'idle');assert.ok(pose.feet.every(f=>f.contact&&f.lift===0));
assert.equal(JSON.stringify(root),saved);
assert.equal(motion.beginShot(3400,0,-1,200),true);
pose=motion.sample({now:3420,player:{x:316,y:100},dx:0,dy:0});
assert.equal(pose.state,'attack');assert.equal(pose.facing,'up');
const freeze=JSON.stringify(pose);assert.equal(JSON.stringify(motion.sample({now:8000,player:{x:316,y:100},dx:0,dy:0,frozen:true})),freeze);
pose=motion.sample({now:8016,player:{x:316,y:100},dx:0,dy:0,hurt:true});
assert.equal(pose.state,'hurt');
pose=motion.sample({now:8032,player:{x:316,y:100},dx:0,dy:0,action:true,actionFacing:'left'});
assert.equal(pose.state,'action');assert.equal(pose.facing,'left');
for(const facing of ['down','left','up','right']){
  const m=new VenusMotion(root);m.facing=facing;
  const p=m.sample({now:0,player:root,dx:0,dy:0});
  assert.ok(p.parts.every(n=>n.frame.startsWith(facing+'/')));
  assert.equal(p.parts.filter(n=>n.name==='face').length,1);
  assert.ok(p.parts.every(n=>Number.isFinite(n.x+n.y+n.angle+n.width+n.height)));
}
const collapse=buildVenusPose({...pose,defeat:.7});
assert.equal(collapse.state,'defeat');assert.ok(collapse.parts.some(p=>Math.abs(p.angle)>15));
console.log('Venus independent layered pose/state/contact contracts passed');
