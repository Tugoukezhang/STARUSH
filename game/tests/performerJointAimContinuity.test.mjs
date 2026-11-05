import assert from 'node:assert/strict';import {test} from 'node:test';
import {VenusMotion,buildVenusPose} from '../src/systems/VenusLayeredPresentation.mjs';
import {GenyaMotion,buildGenyaPose} from '../src/systems/GenyaLayeredPresentation.mjs';
import {KaiMotion,buildKaiPose} from '../src/systems/KaiLayeredPresentation.mjs';
import {EnjoMotion} from '../src/systems/EnjoLayeredPresentation.mjs';
const rotate=(x,y,a)=>{const r=a*Math.PI/180;return {x:x*Math.cos(r)-y*Math.sin(r),y:x*Math.sin(r)+y*Math.cos(r)};};
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-7,label+': '+a+' != '+b);
const part=(p,n)=>p.parts.find(r=>r.name===n);
test('Venus lower body follows locomotion, not shot facing',()=>{
 const player={x:100,y:100},m=new VenusMotion(player);m.sample({now:0,player});m.beginShot(10,0,-1,180);
 const p=m.sample({now:10,player,dx:1});assert.equal(p.facing,'up');assert.equal(p.legFacing,'right');
 for(const name of ['thighL','thighR','shinL','shinR','bootL','bootR','skirt'])assert.equal(part(p,name).frame,'right/'+name);
 assert.equal(part(p,'torso').frame,'up/torso');
});
for(const [id,M] of [['venus',VenusMotion],['genya',GenyaMotion],['kai',KaiMotion],['enjo',EnjoMotion]]){
 test(id+' holds aim across actual inter-shot gaps without holding attack/feet',()=>{
  const player={x:100,y:100},m=new M(player);m.sample({now:0,player});let walkGap=false;
  for(let t=10;t<=600;t+=10){player.x+=1;if(t===10||t===190||t===370)m.beginShot(t,0,-1,180);
   const p=m.sample({now:t,player,dx:1});assert.equal(p.facing,t<590?'up':'right','shot/gap '+t);
   assert.equal(p.legFacing,'right');if(p.state==='walk')walkGap=true;
  }
  assert(walkGap,'pose must release attack while retaining orientation');
  const after=m.sample({now:610,player,dx:1});assert.equal(after.facing,'right');assert.equal(after.state,'walk');
 });
 test(id+' aim clock freezes and action/hurt priority stays independent',()=>{
  const player={x:100,y:100},m=new M(player);m.sample({now:0,player});m.beginShot(10,0,-1,180);
  m.sample({now:10,player,dx:1});for(let t=20;t<=140;t+=10)m.sample({now:t,player,dx:1});
  const before=structuredClone(m.pose);assert.deepEqual(m.sample({now:10000,player,dx:1,frozen:true}),before);
  assert.equal(m.sample({now:10010,player,dx:1}).facing,'up');
  assert.equal(m.sample({now:10020,player,dx:1,action:true,actionFacing:'left'}).facing,'left');
  assert.equal(m.sample({now:10030,player,dx:1,hurt:true}).state,'hurt');
 });
}
for(const [id,build,armSide,armFront,armY,elbow,neckY,halfHead] of [
 ['venus',buildVenusPose,2.6,9,-3.5,8.6,-8,15.5],
 ['genya',buildGenyaPose,2.5,8.6,-3.5,8.3,-8,15.5],
 ['kai',buildKaiPose,-4,9.2,-6.2,10.2,-6.75,15.75],
])test(id+' shoulder, elbow and neck remain attached throughout lean/hurt/defeat',()=>{
 for(const facing of ['down','left','right','up'])for(const state of ['idle','walk','attack','action','hurt','defeat']){
  const p=build({root:{x:100,y:100},facing,state,defeat:state==='defeat'?.7:0,clock:0,phase:.2,shotWeight:.8,actionProgress:.25});
  const torso=part(p,'torso'),face=part(p,'face'),side=['left','right'].includes(facing);
  for(let i=0;i<2;i++){
   const s=i?1:-1,name=i?'R':'L',arm=part(p,'upperArm'+name),fore=part(p,'forearm'+name);
   const x=side?(id==='kai'?(facing==='left'?4:-4):s*armSide):s*armFront;
   const shoulder=rotate(x,armY,torso.angle);
   close(arm.x,torso.x+shoulder.x,id+' shoulder x');close(arm.y,torso.y+shoulder.y,id+' shoulder y');
   const bone=rotate(0,elbow,arm.angle);close(fore.x,arm.x+bone.x,id+' elbow x');close(fore.y,arm.y+bone.y,id+' elbow y');
  }
  const neck=rotate(0,neckY,torso.angle),headBottom=rotate(0,halfHead,face.angle);
  close(face.x+headBottom.x,torso.x+neck.x,id+' neck x');close(face.y+headBottom.y,torso.y+neck.y,id+' neck y');
 }
});
test('Genya twin-tail roots follow head translation/rotation',()=>{
 for(const facing of ['down','right'])for(const defeat of [0,.7]){
  const p=buildGenyaPose({root:{x:100,y:100},facing,state:'hurt',clock:0,defeat}),face=part(p,'face');
  for(let i=0;i<2;i++){
   const local=rotate((i?1:-1)*(facing==='right'?12:14.2),3,face.angle),tail=part(p,i?'tailR':'tailL');
   close(tail.x,face.x+local.x,'tail x');close(tail.y,face.y+local.y,'tail y');
  }
 }
});
