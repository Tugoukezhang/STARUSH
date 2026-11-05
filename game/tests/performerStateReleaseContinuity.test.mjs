import assert from 'node:assert/strict';
import {test} from 'node:test';
import {LayeredPoseTransition} from '../src/systems/LayeredPoseTransition.mjs';
import {VenusMotion,buildVenusPose} from '../src/systems/VenusLayeredPresentation.mjs';
import {GenyaMotion,buildGenyaPose} from '../src/systems/GenyaLayeredPresentation.mjs';
import {KaiMotion,buildKaiPose} from '../src/systems/KaiLayeredPresentation.mjs';
import {EnjoMotion,buildEnjoPose} from '../src/systems/EnjoLayeredPresentation.mjs';
import {LayeredObliqueController,applyObliquePose} from '../src/systems/LayeredObliquePresentation.mjs';

const part=(p,n)=>p.parts.find(q=>q.name===n);
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-7,`${label}: ${a} != ${b}`);
const rotate=(x,y,a)=>{const r=a*Math.PI/180;return {x:x*Math.cos(r)-y*Math.sin(r),y:x*Math.sin(r)+y*Math.cos(r)};};
const builds=[['venus',buildVenusPose],['genya',buildGenyaPose],['kai',buildKaiPose],['enjo',buildEnjoPose]];
const directions=['down','left','up','right','down-left','down-right','up-left','up-right'];
const pose=(id,build,state,clock,direction='right',root={x:100,y:200})=>applyObliquePose(build({
  root,facing:'right',legFacing:'right',state,clock,phase:.19,actionProgress:.5,
  shotWeight:.2,gait:{weight:.8,armSwing:.8,bodyY:-.8,lean:3},
  visualFacing:direction,visualLegFacing:direction
}),build,id);

for(const [id,build] of builds){
  for(const state of ['hurt','action','attack','walk'])test(`${id} ${state} mixes out without moving planted feet`,()=>{
    for(const direction of directions){
      const t=new LayeredPoseTransition(),a=pose(id,build,state,0,direction),before=t.sample(a);
      const raw=pose(id,build,'idle',10,direction,{x:103,y:200}),copy=structuredClone(raw),shown=t.sample(raw);
      for(const name of ['torso','upperArmL','upperArmR','forearmL','forearmR','face']){
        near(part(shown,name).angle,part(before,name).angle,`${id}/${direction}/${state}/${name} first release angle`);
        near(part(shown,name).x-shown.root.x,part(before,name).x-before.root.x,`${name} root-relative x`);
        near(part(shown,name).y-shown.root.y,part(before,name).y-before.root.y,`${name} root-relative y`);
      }
      assert.deepEqual(shown.root,raw.root);assert.deepEqual(shown.feet,raw.feet);
      for(const q of raw.parts.filter(q=>/^(boot|thigh|shin)/.test(q.name)))assert.deepEqual(part(shown,q.name),q);
      assert.equal(shown.state,'idle');assert.equal(shown.clock,10);assert.deepEqual(raw,copy);
      const mid=t.sample(pose(id,build,'idle',40,direction));
      assert(Number.isFinite(part(mid,'torso').angle));
      for(const s of ['L','R']){
        const arm=part(mid,'upperArm'+s),fore=part(mid,'forearm'+s),p=rotate(fore.x-arm.x,fore.y-arm.y,-arm.angle);
        near(p.x,0,'elbow stays attached');assert(p.y>7&&p.y<12);
      }
      const end=pose(id,build,'idle',160,direction);assert.deepEqual(t.sample(end).parts,end.parts);
    }
  });
  test(`${id} new shot and priority reactions preempt stale release, render repeat is idempotent`,()=>{
    for(const state of ['attack','hurt','action','defeat']){
      const t=new LayeredPoseTransition();t.sample(pose(id,build,'action',0));t.sample(pose(id,build,'idle',10));
      const raw=pose(id,build,state,20),shown=t.sample(raw);
      assert.deepEqual(shown.parts,raw.parts);assert.strictEqual(t.sample(raw),shown);
    }
    const t=new LayeredPoseTransition();t.sample(pose(id,build,'action',0));
    const frozen=pose(id,build,'idle',10);const shown=t.sample(frozen);
    assert.strictEqual(t.sample(frozen),shown);
    assert.deepEqual(t.sample(pose(id,build,'idle',10)).parts,shown.parts,'zero presentation-clock time does not progress recovery');
    const reset=pose(id,build,'idle',11,'right',{x:400,y:200});assert.deepEqual(t.sample(reset).parts,reset.parts);
  });
}

for(const [id,build,Motion] of [['venus',buildVenusPose,VenusMotion],['genya',buildGenyaPose,GenyaMotion],['kai',buildKaiPose,KaiMotion],['enjo',buildEnjoPose,EnjoMotion]]){
  test(`${id} repeated real-motion walk/stop cannot accumulate transport offsets`,()=>{
    const player={x:100,y:200},motion=new Motion(player),oblique=new LayeredObliqueController(),turn=new LayeredPoseTransition();
    let rawMax=0,shownMax=0;
    for(let i=0;i<360;i++){
      const dx=i%2?.4:0;player.x+=dx;
      const raw=applyObliquePose(oblique.sample(motion.sample({now:i*16,player,dx,dy:0}),dx,0),build,id),shown=turn.sample(raw);
      rawMax=Math.max(rawMax,Math.abs(part(raw,'upperArmR').angle));shownMax=Math.max(shownMax,Math.abs(part(shown,'upperArmR').angle));
      assert(shownMax<=rawMax+15,`display angle ${shownMax} outside actual pose envelope ${rawMax}`);
    }
  });
  test(`${id} release-to-turn retains recovery provenance and a new shot preempts it`,()=>{
    const t=new LayeredPoseTransition();t.sample(pose(id,build,'hurt',0,'down'));t.sample(pose(id,build,'walk',10,'down'));
    t.sample(pose(id,build,'walk',20,'down-left'));
    const shot=pose(id,build,'attack',30,'down-left');assert.deepEqual(t.sample(shot).parts,shot.parts);
  });
  test(`${id} release finishes on the pose clock at 30/60/120Hz with no delayed state`,()=>{
    for(const hz of [30,60,120]){
      const t=new LayeredPoseTransition();t.sample(pose(id,build,'action',0));
      t.sample(pose(id,build,'idle',10));
      for(let clock=10+1000/hz;clock<155;clock+=1000/hz){const raw=pose(id,build,'idle',clock),shown=t.sample(raw);assert.equal(shown.clock,clock);assert.equal(shown.state,'idle');}
      const end=pose(id,build,'idle',155);assert.deepEqual(t.sample(end).parts,end.parts);
    }
  });
}

test('Venus action is a local start/release/return envelope, not a held arm pose',()=>{
  const root={x:100,y:200},p=q=>buildVenusPose({root,state:'action',facing:'down',legFacing:'down',clock:0,actionProgress:q});
  const rest=buildVenusPose({root,state:'idle',facing:'down',legFacing:'down',clock:0});
  for(const q of [0,1])for(const n of ['torso','upperArmL','upperArmR','face'])near(part(p(q),n).angle,part(rest,n).angle,`${n} envelope at ${q}`);
  assert(Math.abs(part(p(.35),'upperArmR').angle)>30,'own release gesture remains readable');
  for(let q=0;q<=1;q+=1/60)for(const n of ['torso','upperArmL','upperArmR','face']){
    assert(Math.abs(part(p(Math.min(1,q+1/60)),n).angle-part(p(q),n).angle)<8,'no one-frame 38 degree snap');
  }
});

test('Venus action presentation clock pauses and restarts without owning gameplay timing',()=>{
  const player={x:100,y:200},m=new VenusMotion(player);m.sample({now:0,player});
  let p=m.sample({now:16,player,action:true});assert.equal(p.actionProgress,0);
  p=m.sample({now:66,player,action:true});near(p.actionProgress,50/260,'elapsed own pose clock');
  const held=m.sample({now:1066,player,action:true,frozen:true});assert.strictEqual(held,p);
  p=m.sample({now:1082,player,action:true});near(p.actionProgress,66/260,'resume excludes paused time');
  m.sample({now:1098,player,action:false});p=m.sample({now:1114,player,action:true});assert.equal(p.actionProgress,0);
});
