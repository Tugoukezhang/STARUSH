import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {VenusMotion} from '../src/systems/VenusLayeredPresentation.mjs';
import {GenyaMotion} from '../src/systems/GenyaLayeredPresentation.mjs';
import {KaiMotion} from '../src/systems/KaiLayeredPresentation.mjs';
import {EnjoMotion} from '../src/systems/EnjoLayeredPresentation.mjs';
import {SakuraRefinedWorldFrame} from '../src/utils/sakuraRefinedFrame.mjs';
import {sampleRefinedPose} from '../src/utils/sakuraRefinedMotion.mjs';
import {SAKURA_REFINED_ART} from '../src/systems/SakuraRefinedPresentation.mjs';
const part=(p,n)=>p.parts.find(r=>r.name===n),span=a=>Math.max(...a)-Math.min(...a);
const directions={down:[0,2],up:[0,-2],right:[2,0],left:[-2,0]};
function run(M,d,n=120){
 const player={x:100,y:100},m=new M(player),frames=[];m.sample({now:0,player});
 for(let i=1;i<=n;i++){const [dx,dy]=directions[d];player.x+=dx;player.y+=dy;frames.push(m.sample({now:i*1000/60,player,dx,dy}));}
 return {m,player,frames};
}
for(const [id,M]of [['venus',VenusMotion],['genya',GenyaMotion],['kai',KaiMotion],['enjo',EnjoMotion]]){
 test(id+' actual frontal/back segment projection does not open knees sideways',()=>{
  for(const d of ['down','up']){
   const {frames}=run(M,d);let max=0;
   for(const p of frames)for(const side of ['L','R']){
    const thigh=part(p,'thigh'+side),shin=part(p,'shin'+side),boot=part(p,'boot'+side);
    const dx=boot.x-thigh.x,dy=boot.y-(id==='enjo'?5:4)-thigh.y;
    max=Math.max(max,Math.abs(dx*(shin.y-thigh.y)-dy*(shin.x-thigh.x))/Math.hypot(dx,dy));
    assert.ok(shin.height>0&&thigh.height>0);
   }
   assert.ok(max<1.6,id+' '+d+' rendered knee offset '+max);
  }
 });
 test(id+' has phase-driven body posture, swing sole roll and exact planted soles',()=>{
  const {frames}=run(M,'right');let planted=0,swing=0;
  assert.ok(span(frames.slice(10).map(p=>part(p,'torso').angle))>.8,'body must not remain upright');
  const shoes=[];
  for(let i=1;i<frames.length;i++)for(let side=0;side<2;side++){
   const p=frames[i],f=p.feet[side],boot=part(p,'boot'+(side?'R':'L'));
   assert.ok(Math.hypot(boot.x-f.x,boot.y-(f.y-f.lift))<1e-7,'sole pivot');
   if(f.contact){assert.equal(boot.angle,0,'planted sole must stay flat');planted++;}
   else {shoes.push(boot.angle);swing++;}
   const previous=frames[i-1].feet[side];if(f.contact&&previous.contact&&f.plantId===previous.plantId)
    assert.ok(Math.hypot(f.x-previous.x,f.y-previous.y)<1e-7);
  }
  assert.ok(planted>20&&swing>20);assert.ok(span(shoes)>5,'swing shoe needs toe/heel articulation');
 });
 test(id+' visual run envelope settles with feet, freezes, and does not consume action',()=>{
  const {m,player,frames}=run(M,'right',45),last=frames.at(-1);let p=last;
  for(let i=1;i<=20;i++)p=m.sample({now:(45+i)*1000/60,player});
  assert.equal(m.feet.mode,'idle');assert.ok(p.feet.every(f=>f.contact&&f.lift===0));
  assert.equal(p.gait?.weight,0,'stop must release whole-body run pose');
  const frozen=structuredClone(p);assert.deepEqual(m.sample({now:10000,player,frozen:true}),frozen);
  const action=m.sample({now:10016,player,action:true,actionFacing:'left'});assert.equal(action.state,'action');
  assert.equal(m.sample({now:10032,player,action:true,hurt:true}).state,'hurt');
 });
}
test('Sakura whole-body 64px phase stays aligned with foot phase on three successive cycles',()=>{
 const rigs=JSON.parse(fs.readFileSync(new URL('../public/'+SAKURA_REFINED_ART.data,import.meta.url))).views;
 const c=new SakuraRefinedWorldFrame(rigs);c.update({now:0,x:100,y:100});
 for(let i=1;i<=96;i++){
  const f=c.update({now:i*1000/60,x:100,y:100+i*2}),bodyPhase=(c.controller.gaitTime/800)%1;
  assert.ok(Math.abs(bodyPhase-f.contacts.R.phase)<1e-7,'body '+bodyPhase+' foot '+f.contacts.R.phase);
  if(i%32===0)assert.ok(Math.abs(f.contacts.R.phase)<1e-7);
 }
});
test('Sakura authored run has body lean, reciprocal head balance and two-beat compression',()=>{
 const rigs=JSON.parse(fs.readFileSync(new URL('../public/'+SAKURA_REFINED_ART.data,import.meta.url))).views;
 const frames=Array.from({length:32},(_,i)=>sampleRefinedPose({rigs,direction:'right',mode:'walk',time:0,gaitTime:i*25,weight:1}));
 assert.ok(span(frames.map(f=>f.pose.bones[2][2]))>.02,'rigid upright torso');
 assert.ok(span(frames.map(f=>f.pose.bones[1][1]))>2,'whole-body compression');
 const pose=frames[8].pose;assert.ok(pose.bones[2][2]>0&&pose.bones[3][2]<0,'head counterbalances forward lean');
 const still=sampleRefinedPose({rigs,direction:'right',mode:'walk',time:0,gaitTime:200,weight:0});
 assert.equal(still.pose.bones[2][2],rigs.right.rest[2][2],'settled body releases gait lean');
});
