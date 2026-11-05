import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
let module;
try { module=await import('../src/systems/EnjoLayeredPresentation.mjs'); }
catch(error){ if(error.code!=='ERR_MODULE_NOT_FOUND')throw error; }
assert.ok(module,'independent Enjo pose module must exist');
const {EnjoMotion,ENJO_ART,buildEnjoPose,preloadEnjoLayered}=module;
const root={x:100,y:100},motion=new EnjoMotion(root),loads=[];
assert.equal(ENJO_ART.id,'enjo');
preloadEnjoLayered({load:{atlas:(...a)=>loads.push(a),json:(...a)=>loads.push(a)}});
assert.equal(loads.length,2);assert.ok(loads.every(r=>!r.join().match(/venus|sakura/i)));
let pose=motion.sample({now:0,player:root});
assert.equal(pose.state,'idle');assert.equal(pose.parts.length,14);
assert.equal(pose.parts.filter(p=>p.name==='face').length,1);
assert.equal(pose.parts.filter(p=>p.name==='pelvis').length,1);
const saved=JSON.stringify(root);let contacts=0;
for(let i=1;i<=180;i++){
  const before=motion.feet.feet.map(f=>({...f}));
  pose=motion.sample({now:i*16,player:{x:100+i*1.2,y:100},dx:1.2});
  for(let side=0;side<2;side++){
    const f=motion.feet.feet[side],old=before[side];
    if(f.contact&&old.contact&&f.plantId===old.plantId){assert.equal(f.x,old.x);assert.equal(f.y,old.y);contacts++;}
    const leg=pose.legs[side];
    for(const [a,b] of [[leg.hip,leg.knee],[leg.knee,leg.ankle]])assert.ok(Math.abs(Math.hypot(b.x-a.x,b.y-a.y)-(a===leg.hip?8.4:7.5))<1e-6);
    assert.ok(leg.error<.1,JSON.stringify(leg));
  }
  assert.ok(Math.abs(pose.balance)<=6);
}
assert.ok(contacts>30);
assert.equal(motion.beginShot(2900,-1,0,200),true);
pose=motion.sample({now:2900,player:{x:317.2,y:100},dx:1.2});
assert.equal(pose.facing,'left');assert.equal(pose.legFacing,'right');
assert.ok(pose.parts.filter(p=>/thigh|shin|boot|pelvis/.test(p.name)).every(p=>p.frame.startsWith('right/')));
for(let i=0;i<30;i++)pose=motion.sample({now:3000+i*16,player:{x:317.2,y:100}});
assert.equal(motion.feet.mode,'idle');assert.ok(pose.feet.every(f=>f.contact&&f.lift===0));
const freeze=JSON.stringify(pose);assert.equal(JSON.stringify(motion.sample({now:8000,player:root,frozen:true})),freeze);
pose=motion.sample({now:8016,player:root,hurt:true,action:true,actionFacing:'up'});
assert.equal(pose.state,'hurt');assert.ok(pose.parts.find(p=>p.name==='face').frame.endsWith('/hurtFace'));
pose=motion.sample({now:8032,player:root,action:true,actionFacing:'left'});
assert.equal(pose.state,'action');assert.equal(pose.facing,'left');
assert.equal(JSON.stringify(root),saved);
for(const facing of ['down','left','up','right']){
  const p=buildEnjoPose({root,facing,legFacing:facing,state:'idle',clock:0});
  assert.ok(p.parts.every(n=>n.frame.startsWith(facing+'/')));
  assert.ok(p.parts.every(n=>Number.isFinite(n.x+n.y+n.angle+n.width+n.height)));
}
const collapse=buildEnjoPose({...pose,defeat:.7});
const standing=buildEnjoPose({root,facing:'down',state:'idle'});
assert.equal(standing.parts.find(p=>p.name==='thighL').height,9.8,'shorts-thigh must not overpaint the shin-owned knee');
assert.equal(standing.parts.find(p=>p.name==='shinL').width,5.2,'bare-shin width must join the narrower exposed thigh');
assert.ok(standing.legs.every(l=>Math.abs(l.knee.x-l.hip.x)<.5),'idle shorts knees must not bow sideways');
for(const d of ['left','right']){
  const side=buildEnjoPose({root,facing:d,state:'idle'});
  const near=side.parts.find(p=>p.name==='upperArmR');
  assert.ok(d==='left'?near.x>root.x:near.x<root.x,'near sleeve must cover side jacket armhole');
}
assert.equal(collapse.state,'defeat');assert.ok(collapse.parts.find(p=>p.name==='face').frame.endsWith('/closedFace'));
assert.ok(collapse.parts.some(p=>Math.abs(p.angle)>15));
const early=buildEnjoPose({root,facing:'down',state:'action',actionProgress:.2});
const late=buildEnjoPose({root,facing:'down',state:'action',actionProgress:.75});
assert.ok(Math.abs(early.parts.find(p=>p.name==='upperArmL').angle-late.parts.find(p=>p.name==='upperArmL').angle)>10,'Enjo burst must have launch and settle poses');
const atlas=JSON.parse(readFileSync(new URL('../public/art/enjo-layered-20261007/enjo-parts.json',import.meta.url)));
assert.equal(Object.keys(atlas.frames).length,64);assert.equal(atlas.rig.identity,'enjo');
assert.equal(atlas.rig.shortsBind,true);assert.equal(atlas.rig.splitUpperLowerFacing,true);
for(const view of ['down','left','up','right']){
  assert.equal(Object.keys(atlas.frames).filter(k=>k.startsWith(view+'/')).length,16);
  for(const part of buildEnjoPose({root,facing:view,state:'idle'}).parts)assert.ok(atlas.frames[part.frame]);
}
for(const {frame:f} of Object.values(atlas.frames))assert.ok(f.x>=0&&f.y>=0&&f.x+f.w<=1024&&f.y+f.h<=1024);
console.log('Enjo independent pose/contact/split-facing/dash/freeze contracts passed');
